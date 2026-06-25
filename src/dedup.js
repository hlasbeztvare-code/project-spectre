// ============================================
// Project Spectre — Dedup Engine
// Detekce a správa duplicitních inzerátů
// ============================================

/**
 * Generuje duplicate_group hash z normalizovaných klíčových polí
 */
function generateDuplicateGroup(ad) {
  const parts = [
    normalizePhone(ad.phone),
    normalizeLocation(ad.location || ad.city || ''),
    (ad.property_type || 'jine').toLowerCase(),
    normalizePriceRange(ad.price)
  ].filter(Boolean);

  if (parts.length < 2) return null;

  // Jednoduchý hash (DJB2)
  const str = parts.join('|');
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return 'DG' + Math.abs(hash).toString(36);
}

/**
 * Normalizace telefonního čísla
 */
function normalizePhone(phone) {
  if (!phone || phone === 'N/A' || phone === '') return null;
  return phone.replace(/[\s\-\+]/g, '').replace(/^420/, '').replace(/^00420/, '');
}

/**
 * Normalizace lokality pro porovnání
 */
function normalizeLocation(location) {
  if (!location) return null;
  return location.toLowerCase()
    .replace(/[,\-\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^okres\s+/i, '')
    .replace(/^kraj\s+/i, '');
}

/**
 * Normalizace ceny do cenového pásma (po 100k)
 */
function normalizePriceRange(price) {
  if (!price || price <= 0) return null;
  return Math.round(price / 100000).toString();
}

/**
 * Normalizace textu pro porovnání
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\sáčďéěíňóřšťúůýž]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Jednoduchá podobnost dvou stringů (Jaccard na slovech)
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(normalizeText(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalizeText(b).split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / (wordsA.size + wordsB.size - intersection);
}

/**
 * Hlavní deduplikační funkce — kontroluje jestli je inzerát duplicita
 * @param {Object} db - D1 database
 * @param {Object} ad - nový inzerát
 * @returns {{ isDuplicate: boolean, existingId?: string, duplicateGroup?: string, action: string }}
 */
export async function checkDuplicate(db, ad) {
  // === Level 1: Exact URL match ===
  const byUrl = await db.prepare(
    `SELECT id, duplicate_group FROM leads WHERE url = ?`
  ).bind(ad.url).first();

  if (byUrl) {
    return {
      isDuplicate: true,
      existingId: byUrl.id,
      duplicateGroup: byUrl.duplicate_group,
      action: 'update'
    };
  }

  // === Level 2: Same phone + similar location ===
  const normalizedPhone = normalizePhone(ad.phone);
  if (normalizedPhone && normalizedPhone.length >= 9) {
    const byPhone = await db.prepare(`
      SELECT id, url, location, city, price, title, duplicate_group
      FROM leads
      WHERE phone = ? OR phone = ?
      LIMIT 10
    `).bind(ad.phone, normalizedPhone).all();

    if (byPhone.results && byPhone.results.length > 0) {
      for (const existing of byPhone.results) {
        // Telefon + podobná lokalita = duplicita
        const locSimilarity = textSimilarity(
          ad.location || ad.city || '',
          existing.location || existing.city || ''
        );
        if (locSimilarity > 0.4) {
          return {
            isDuplicate: true,
            existingId: existing.id,
            duplicateGroup: existing.duplicate_group || generateDuplicateGroup(ad),
            action: 'mark_duplicate'
          };
        }
      }
    }
  }

  // === Level 3: Content similarity (nadpis + cena + typ + lokalita) ===
  if (ad.price && ad.price > 0 && ad.location) {
    const priceMin = Math.round(ad.price * 0.9);
    const priceMax = Math.round(ad.price * 1.1);

    const bySimilar = await db.prepare(`
      SELECT id, title, description, location, city, phone, duplicate_group
      FROM leads
      WHERE price BETWEEN ? AND ?
        AND property_type = ?
        AND offer_type = ?
      LIMIT 20
    `).bind(priceMin, priceMax, ad.property_type || 'jine', ad.offer_type || 'prodej').all();

    if (bySimilar.results) {
      for (const existing of bySimilar.results) {
        const titleSim = textSimilarity(ad.title, existing.title);
        const locSim = textSimilarity(
          ad.location || ad.city || '',
          existing.location || existing.city || ''
        );

        // Vysoká podobnost nadpisu + lokality + cenového pásma = duplicita
        if (titleSim > 0.6 && locSim > 0.4) {
          return {
            isDuplicate: true,
            existingId: existing.id,
            duplicateGroup: existing.duplicate_group || generateDuplicateGroup(ad),
            action: 'mark_duplicate'
          };
        }
      }
    }
  }

  // === Není duplicita — vygeneruj duplicate_group pro budoucí párování ===
  return {
    isDuplicate: false,
    duplicateGroup: generateDuplicateGroup(ad),
    action: 'new'
  };
}

/**
 * Aktualizuje počty duplicit v rámci skupin
 */
export async function updateDuplicateCounts(db) {
  await db.prepare(`
    UPDATE leads
    SET duplicate_count = (
      SELECT COUNT(*) - 1
      FROM leads AS l2
      WHERE l2.duplicate_group = leads.duplicate_group
        AND leads.duplicate_group IS NOT NULL
    )
    WHERE duplicate_group IS NOT NULL
  `).run();

  // Automaticky označ záznamy s vysokým duplicate_count jako duplicitní
  await db.prepare(`
    UPDATE leads
    SET status = 'duplicitni'
    WHERE duplicate_count > 0
      AND status = 'novy'
      AND id NOT IN (
        SELECT id FROM leads AS l2
        WHERE l2.duplicate_group = leads.duplicate_group
        ORDER BY first_seen ASC
        LIMIT 1
      )
  `).run();
}
