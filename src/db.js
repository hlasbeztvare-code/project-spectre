// ============================================
// Project Spectre — Database Layer
// CRUD operace nad D1 databází
// ============================================

import { checkDuplicate, updateDuplicateCounts } from './dedup.js';
import { calculateScores, analyzePhoneFrequency, resetRulesCache } from './scoring.js';

/**
 * Uloží nebo aktualizuje lead v databázi
 * Zahrnuje deduplikaci a scoring
 */
export async function saveLead(db, ad) {
  try {
    // 1. Deduplikace
    const dupResult = await checkDuplicate(db, ad);

    const now = new Date().toISOString();

    if (dupResult.action === 'update') {
      // Existující záznam (stejné URL) → aktualizuj
      await db.prepare(`
        UPDATE leads
        SET last_seen = ?,
            last_check = ?,
            price = ?,
            description = ?,
            realitka_score = ?,
            private_score = ?,
            advertiser_type = ?,
            ad_status = 'aktivni',
            offer_type = COALESCE(?, offer_type),
            property_type = COALESCE(?, property_type),
            disposition = COALESCE(?, disposition),
            area_m2 = COALESCE(?, area_m2),
            region = COALESCE(?, region),
            district = COALESCE(?, district),
            city = COALESCE(?, city),
            email = COALESCE(?, email),
            advertiser_name = COALESCE(?, advertiser_name),
            duplicate_group = COALESCE(?, duplicate_group)
        WHERE id = ?
      `).bind(
        now, now, ad.price, ad.description,
        ad.realitka_score || 0, ad.private_score || 0, ad.advertiser_type || 'neznamo',
        ad.offer_type, ad.property_type, ad.disposition, ad.area_m2,
        ad.region, ad.district, ad.city, ad.email, ad.advertiser_name,
        dupResult.duplicateGroup,
        dupResult.existingId
      ).run();

      return { action: 'updated', id: dupResult.existingId };

    } else if (dupResult.action === 'mark_duplicate') {
      // Cross-source duplicita → ulož ale označ
      const result = await db.prepare(`
        INSERT OR IGNORE INTO leads (
          id, source, url, title, description, offer_type, property_type,
          disposition, area_m2, price, currency, location, region, district, city,
          phone, email, advertiser_name, advertiser_type,
          realitka_score, private_score, duplicate_group,
          ad_published_date, ad_status,
          first_seen, last_seen, last_check, status, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'duplicitni', ?)
      `).bind(
        ad.id, ad.source, ad.url, ad.title, ad.description,
        ad.offer_type || 'prodej', ad.property_type || 'jine',
        ad.disposition, ad.area_m2,
        ad.price, ad.currency || 'CZK',
        ad.location, ad.region, ad.district, ad.city,
        ad.phone, ad.email, ad.advertiser_name, ad.advertiser_type || 'neznamo',
        ad.realitka_score || 0, ad.private_score || 0,
        dupResult.duplicateGroup,
        ad.ad_published_date, ad.ad_status || 'aktivni',
        now, now, now, ad.raw_data
      ).run();

      return { action: 'duplicate', id: ad.id, group: dupResult.duplicateGroup };

    } else {
      // Nový záznam
      const result = await db.prepare(`
        INSERT INTO leads (
          id, source, url, title, description, offer_type, property_type,
          disposition, area_m2, price, currency, location, region, district, city,
          phone, email, advertiser_name, advertiser_type,
          realitka_score, private_score, duplicate_group,
          ad_published_date, ad_status,
          first_seen, last_seen, last_check, status, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'novy', ?)
      `).bind(
        ad.id, ad.source, ad.url, ad.title, ad.description,
        ad.offer_type || 'prodej', ad.property_type || 'jine',
        ad.disposition, ad.area_m2,
        ad.price, ad.currency || 'CZK',
        ad.location, ad.region, ad.district, ad.city,
        ad.phone, ad.email, ad.advertiser_name, ad.advertiser_type || 'neznamo',
        ad.realitka_score || 0, ad.private_score || 0,
        dupResult.duplicateGroup,
        ad.ad_published_date, ad.ad_status || 'aktivni',
        now, now, now, ad.raw_data
      ).run();

      return { action: 'new', id: ad.id };
    }
  } catch (error) {
    // INSERT OR IGNORE pro případ race condition na UNIQUE constraint
    if (error.message && error.message.includes('UNIQUE')) {
      console.warn(`Duplicate key for ${ad.url}, skipping`);
      return { action: 'skipped', id: ad.id };
    }
    console.error('DB save error:', error);
    throw error;
  }
}

/**
 * Vrací statistiky z databáze
 */
export async function getStats(db) {
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'novy' THEN 1 END) as new_leads,
      COUNT(CASE WHEN advertiser_type = 'soukromnik' THEN 1 END) as private_count,
      COUNT(CASE WHEN advertiser_type = 'realitka' THEN 1 END) as realitka_count,
      COUNT(CASE WHEN advertiser_type = 'neznamo' THEN 1 END) as unknown_count,
      COUNT(CASE WHEN status = 'duplicitni' THEN 1 END) as duplicate_count,
      COUNT(CASE WHEN phone = 'N/A' OR phone IS NULL THEN 1 END) as no_phone_count,
      COUNT(CASE WHEN first_seen >= datetime('now', '-1 day') THEN 1 END) as today_new,
      COUNT(CASE WHEN first_seen >= datetime('now', '-7 days') THEN 1 END) as week_new
    FROM leads
  `).first();

  return stats;
}

/**
 * Statistiky podle zdrojů
 */
export async function getStatsBySource(db) {
  const result = await db.prepare(`
    SELECT
      source,
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'novy' THEN 1 END) as new_leads,
      COUNT(CASE WHEN advertiser_type = 'soukromnik' THEN 1 END) as private_count,
      COUNT(CASE WHEN advertiser_type = 'realitka' THEN 1 END) as realitka_count,
      COUNT(CASE WHEN phone != 'N/A' AND phone IS NOT NULL THEN 1 END) as with_phone
    FROM leads
    GROUP BY source
  `).all();

  return result.results || [];
}

/**
 * Statistiky podle krajů
 */
export async function getStatsByRegion(db) {
  const result = await db.prepare(`
    SELECT
      COALESCE(region, 'Neznámý') as region,
      COUNT(*) as total,
      COUNT(CASE WHEN advertiser_type = 'soukromnik' THEN 1 END) as private_count
    FROM leads
    WHERE status != 'duplicitni'
    GROUP BY region
    ORDER BY total DESC
  `).all();

  return result.results || [];
}

/**
 * Informace o zdrojích (konfigurace + poslední běhy)
 */
export async function getSourcesStatus(db) {
  const result = await db.prepare(`
    SELECT * FROM source_config ORDER BY priority ASC
  `).all();

  return result.results || [];
}

/**
 * Aktualizace stavu zdroje po běhu
 */
export async function updateSourceStatus(db, sourceName, success, error = null, leadsCount = 0) {
  const now = new Date().toISOString();

  if (success) {
    await db.prepare(`
      UPDATE source_config
      SET last_run = ?, last_success = ?, total_runs = total_runs + 1,
          total_leads = total_leads + ?, last_error = NULL
      WHERE source_name = ?
    `).bind(now, now, leadsCount, sourceName).run();
  } else {
    await db.prepare(`
      UPDATE source_config
      SET last_run = ?, total_runs = total_runs + 1,
          last_error = ?
      WHERE source_name = ?
    `).bind(now, error, sourceName).run();
  }
}

/**
 * Uloží log o běhu scraperu
 */
export async function saveScrapeLog(db, log) {
  await db.prepare(`
    INSERT INTO scrape_logs (source, processed, new_leads, updated_leads, duplicates, errors, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    log.source, log.processed || 0, log.new_leads || 0,
    log.updated_leads || 0, log.duplicates || 0,
    log.errors || null, log.duration_ms || 0
  ).run();
}

/**
 * Filtrované leady (pro API)
 */
export async function getLeads(db, filters = {}) {
  let where = ['1=1'];
  let binds = [];

  if (filters.source) { where.push('source = ?'); binds.push(filters.source); }
  if (filters.status) { where.push('status = ?'); binds.push(filters.status); }
  if (filters.region) { where.push('region = ?'); binds.push(filters.region); }
  if (filters.district) { where.push('district = ?'); binds.push(filters.district); }
  if (filters.city) { where.push('city LIKE ?'); binds.push(`%${filters.city}%`); }
  if (filters.offer_type) { where.push('offer_type = ?'); binds.push(filters.offer_type); }
  if (filters.property_type) { where.push('property_type = ?'); binds.push(filters.property_type); }
  if (filters.price_min) { where.push('price >= ?'); binds.push(parseInt(filters.price_min)); }
  if (filters.price_max) { where.push('price <= ?'); binds.push(parseInt(filters.price_max)); }
  if (filters.advertiser_type) { where.push('advertiser_type = ?'); binds.push(filters.advertiser_type); }

  const limit = Math.min(parseInt(filters.limit) || 100, 500);
  const offset = parseInt(filters.offset) || 0;

  const sql = `
    SELECT * FROM leads
    WHERE ${where.join(' AND ')}
    ORDER BY first_seen DESC
    LIMIT ? OFFSET ?
  `;

  binds.push(limit, offset);

  const stmt = db.prepare(sql);
  const result = await stmt.bind(...binds).all();
  return result.results || [];
}

/**
 * Post-processing po celém cyklu — duplikáty a phone frequency
 */
export async function postProcessCycle(db) {
  resetRulesCache();
  await updateDuplicateCounts(db);
  await analyzePhoneFrequency(db);
}

/**
 * Poslední scrape logy
 */
export async function getRecentLogs(db, limit = 20) {
  const result = await db.prepare(`
    SELECT * FROM scrape_logs ORDER BY run_time DESC LIMIT ?
  `).bind(limit).all();
  return result.results || [];
}