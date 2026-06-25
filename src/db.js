export async function saveLead(db, ad) {
  try {
    // Kontrola duplicity podle URL nebo telefonu + lokality
    const existing = await db.prepare(
      `SELECT id, duplicate_group, realitka_score, private_score 
       FROM leads 
       WHERE url = ? OR (phone = ? AND phone != 'N/A' AND location = ?)`
    ).bind(ad.url, ad.phone, ad.location).first();

    const now = new Date().toISOString();

    if (existing) {
      // Aktualizace existujícího záznamu
      await db.prepare(
        `UPDATE leads 
         SET last_seen = ?, 
             last_check = ?,
             price = ?,
             description = ?,
             realitka_score = ?,
             private_score = ?,
             advertiser_type = ?
         WHERE id = ?`
      ).bind(
        now, now, ad.price, ad.description,
        ad.realitka_score, ad.private_score, ad.advertiser_type,
        existing.id
      ).run();

      console.log(Updated existing lead: ${ ad.url });
      return { action: 'updated', id: existing.id };
    } else {
      // Nový záznam
      const result = await db.prepare(
        `INSERT INTO leads (
          id, source, url, title, description, price, location, 
          phone, advertiser_type, realitka_score, private_score, 
          first_seen, last_seen, last_check, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        ad.id, ad.source, ad.url, ad.title, ad.description,
        ad.price, ad.location, ad.phone, ad.advertiser_type,
        ad.realitka_score  0, ad.private_score  0,
        now, now, now, 'novy'
      ).run();

      console.log(New lead saved: ${ ad.url });
      return { action: 'new', id: ad.id };
    }
  } catch (error) {
    console.error('DB save error:', error);
    throw error;
  }
}

export async function getStats(db) {
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'novy' THEN 1 END) as new,
      COUNT(CASE WHEN advertiser_type = 'soukromnik' THEN 1 END) as private,
      COUNT(CASE WHEN advertiser_type = 'realitka' THEN 1 END) as realitka
    FROM leads
  `).first();

  return stats;
}