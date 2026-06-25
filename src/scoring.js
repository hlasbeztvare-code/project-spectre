// ============================================
// Project Spectre — Scoring Engine
// Konfigurovatelný bodovací systém pro rozpoznání
// realitní kanceláře vs. soukromého majitele
// ============================================

// Cache pro scoring pravidla (načtou se z DB jednou za cyklus)
let cachedRules = null;

/**
 * Načte scoring pravidla z DB (cache na dobu cyklu)
 */
export async function loadRules(db) {
  if (cachedRules) return cachedRules;

  const rules = await db.prepare(
    `SELECT rule_type, keyword, points FROM scoring_rules WHERE enabled = 1`
  ).all();

  cachedRules = {
    realitka: rules.results.filter(r => r.rule_type === 'realitka_keyword'),
    soukromnik: rules.results.filter(r => r.rule_type === 'soukromnik_keyword'),
  };

  return cachedRules;
}

/**
 * Reset cache (volat na začátku každého scrape cyklu)
 */
export function resetRulesCache() {
  cachedRules = null;
}

/**
 * Hlavní scoring funkce — vypočítá skóre realitka/soukromník
 * @param {Object} db - D1 database binding
 * @param {Object} ad - inzerát s title, description, phone, email, source
 * @returns {{ realitkaScore: number, privateScore: number, advertiserType: string }}
 */
export async function calculateScores(db, ad) {
  const rules = await loadRules(db);
  let realitkaScore = 0;
  let privateScore = 0;

  const text = ((ad.title || '') + ' ' + (ad.description || '')).toLowerCase();

  // === 1. Keyword matching z DB pravidel ===
  for (const rule of rules.realitka) {
    if (text.includes(rule.keyword.toLowerCase())) {
      realitkaScore += rule.points;
    }
  }

  for (const rule of rules.soukromnik) {
    if (text.includes(rule.keyword.toLowerCase())) {
      privateScore += rule.points;
    }
  }

  // === 1.5 Explicitní klientská B2B specifikace (Hard-Overrides) ===
  const b2bSoukromnikKeywords = [
    'rk nevolat', 'rk prosím nevolat', 'bez realitky', 'přímý majitel', 'jsem majitel',
    'bez provize', 'neplatíte provizi', 'realitky nevolat', 'bez rk'
  ];
  const b2bRealitkaKeywords = [
    'rezervační záloha', 'zastupujeme', 'realitní kancelář', 'makléř', 'naše kancelář',
    'služby rk', 'cena nezahrnuje'
  ];

  for (const kw of b2bSoukromnikKeywords) {
    if (text.includes(kw)) {
      privateScore += 40; // Masivní bonus klientské specifikace
    }
  }

  for (const kw of b2bRealitkaKeywords) {
    if (text.includes(kw)) {
      realitkaScore += 40; // Masivní postih klientské specifikace
    }
  }

  // Opatrnější kontrola slova "provize" (aby nehitlo "bez provize")
  if (text.includes('provize') && !text.includes('bez provize') && !text.includes('neplatíte provizi')) {
    realitkaScore += 40;
  }

  // === 2. Email analýza ===
  if (ad.email && ad.email !== 'N/A') {
    const emailLower = ad.email.toLowerCase();
    const realitkaEmails = [
      'remax', 'century21', 'mmreality', 'nextreality', 'sting',
      'realitni', 'reality', 'makler', 'estates', 'realty',
      'sreality', 'bezrealitky'
    ];
    if (realitkaEmails.some(re => emailLower.includes(re))) {
      realitkaScore += 30;
    }
  }

  // === 3. Délka a styl popisu ===
  const descLen = (ad.description || '').length;
  if (descLen > 500) {
    // Dlouhý strukturovaný popis = pravděpodobně realitka
    const hasStructure = text.includes('dispozice') || text.includes('plocha') ||
      text.includes('podlaží') || text.includes('energetický') ||
      text.includes('penb') || text.includes('užitná plocha');
    if (hasStructure) {
      realitkaScore += 10;
    }
  } else if (descLen < 200 && descLen > 20) {
    // Krátký neformální popis = pravděpodobně soukromník
    privateScore += 10;
  }

  // === 4. Telefonní číslo — délka (firemní čísla bývají delší) ===
  if (ad.phone && ad.phone !== 'N/A') {
    if (ad.phone.length > 9) {
      realitkaScore += 10;
    }
  }

  // === 5. Zdroj — bazarové servery favorizují soukromníky ===
  const bazarSources = ['bazos', 'sbazar', 'avizo', 'hyperinzerce', 'annonce'];
  if (bazarSources.includes(ad.source)) {
    privateScore += 5;
  }

  // === Cap skóre na 0-100 ===
  realitkaScore = Math.min(100, Math.max(0, realitkaScore));
  privateScore = Math.min(100, Math.max(0, privateScore));

  // === Určení typu inzerenta ===
  let advertiserType = 'neznamo';
  if (realitkaScore >= 61) {
    advertiserType = 'realitka';
  } else if (privateScore >= 30 && realitkaScore < 31) {
    advertiserType = 'soukromnik';
  } else if (realitkaScore >= 31) {
    advertiserType = 'neznamo'; // šedá zóna
  }

  return { realitkaScore, privateScore, advertiserType };
}

/**
 * Analýza frekvence telefonních čísel — volat po uložení všech leadů
 * Telefon u 3+ nemovitostí = bonus pro realitku
 */
export async function analyzePhoneFrequency(db) {
  // Najdi telefony, které se vyskytují u 3+ různých inzerátů
  const frequentPhones = await db.prepare(`
    SELECT phone, COUNT(*) as cnt
    FROM leads
    WHERE phone IS NOT NULL AND phone != 'N/A' AND phone != ''
    GROUP BY phone
    HAVING cnt >= 3
  `).all();

  if (!frequentPhones.results || frequentPhones.results.length === 0) return 0;

  let updated = 0;
  for (const row of frequentPhones.results) {
    // Přidej 25 bodů realitka skóre pro všechny leady s tímto telefonem
    await db.prepare(`
      UPDATE leads
      SET realitka_score = MIN(100, realitka_score + 25),
          advertiser_type = CASE
            WHEN MIN(100, realitka_score + 25) >= 61 THEN 'realitka'
            ELSE advertiser_type
          END
      WHERE phone = ? AND phone != 'N/A'
    `).bind(row.phone).run();
    updated += row.cnt;
  }

  // Telefony u jen 1 inzerátu = bonus pro soukromníka
  await db.prepare(`
    UPDATE leads
    SET private_score = MIN(100, private_score + 15)
    WHERE phone IN (
      SELECT phone FROM leads
      WHERE phone IS NOT NULL AND phone != 'N/A' AND phone != ''
      GROUP BY phone
      HAVING COUNT(*) = 1
    )
  `).run();

  console.log(`Phone frequency analysis: ${frequentPhones.results.length} frequent phones, ${updated} leads updated`);
  return updated;
}
