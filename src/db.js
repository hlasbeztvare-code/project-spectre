export async function saveLead(db, ad) {
  // Použijeme INSERT OR REPLACE nebo INSERT OR IGNORE, aby se neopakovaly duplicity
  await db.prepare(
    `INSERT INTO leads (id, source, url, price, title, description, phone, location, score) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
     price=excluded.price, status=excluded.status`
  )
    .bind(ad.id, ad.source, ad.url, ad.price, ad.title, ad.description, ad.phone, ad.location, ad.score)
    .run();
}