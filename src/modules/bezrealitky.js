// ============================================
// Project Spectre — Bezrealitky Scraper
// Zdroj: https://www.bezrealitky.cz
// Metoda: DISABLED — WAF 403 ban (2026-06)
//
// DŮVOD DEAKTIVACE:
//   Cloudflare WAF na bezrealitky.cz blokuje požadavky z Cloudflare
//   Worker IP rozsahů tvrdým HTTP 403. GraphQL API i /api/record/markers
//   vracejí 404. Modul byl příčinou 77s běhu a 6 chyb na cyklus.
//
// STAV: Modul vrací okamžitý čistý fallback bez jakéhokoliv fetche.
//   Reaktivace: odkomentovat import v src/index.js + tento soubor opravit.
// ============================================

export async function scrape() {
  console.log('Bezrealitky: DISABLED (WAF 403 ban) — skipping, duration: 0ms');
  return {
    ads: [],
    errors: [],
    source: 'bezrealitky',
    status: 'disabled_waf',
  };
}