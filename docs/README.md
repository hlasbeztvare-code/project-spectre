# Project Spectre — B2B Lead Generation (Spojuji.cz)

**Verze:** 2.0 (Production-Ready)
**Účel:** Plně automatizovaný scraper a monitorovací systém pro realitní tipařství, který v reálném čase detekuje soukromé inzerenty, odfiltrovává realitky a řeší duplicity z 10+ českých realitních serverů. Výstupem jsou předžvýkané leady přímo ve firemním Google Sheetu (tzv. **System Command Center**).

---

## Hlavní funkce (dle B2B specifikace)
1. **Pokročilé skórování (AI-like NLP):** Detekce klíčových slov ("RK nevolat", "zastupujeme", "rezervační záloha"), analýza počtu inzerátů na jedno telefonní číslo (detekce skrytých makléřů).
2. **Self-Healing a Anti-Block:** Vestavěný `Exponential Backoff` pro obcházení rate-limitů (např. Google API) a rotace prodlev u scrapování.
3. **Plná Deduplikace:** 3-úrovňový dedup engine (URL → Telefon+Lokalita → Jaccard sémantická shoda). Systém propojuje inzeráty přes napříč portály pomocí `duplicate_group` hashe.
4. **Google Sheets Sync:** Automatický export leadů a obousměrná aktualizace bez nutnosti cizích SDK (čisté Web Crypto API pro generování JWT).

---

## Architektura a nasazení

| Vrstva | Technologie | Důvod |
|--------|-------------|-------|
| **Core** | Cloudflare Workers | Serverless, nulová údržba, extrémní propustnost, běží 24/7. |
| **Databáze**| Cloudflare D1 (SQLite)| Extrémně rychlá, distribuovaná SQL databáze přímo na okraji sítě. |
| **Export** | Google Sheets API | B2B rozhraní, které znají a umí používat obchodníci bez školení. |
| **Parsing**| Cheerio / Native Fetch | Lightweight parsování bez headless prohlížečů (šetří výkon). |

### Rychlé nasazení
1. Naklonovat repo a `npm install`
2. Spustit migraci: `npx wrangler d1 execute leads-db --remote --file=./migrations/0002_full_schema.sql`
3. Vložit Google Service Account: `npx wrangler secret put GCP_SERVICE_ACCOUNT`
4. Nasadit: `npm run deploy`

---

## Jak přidat nový parser (Nový realitní portál)
Architektura je modulární. Pro přidání zdroje (např. `Sreality`) stačí:
1. Vytvořit soubor `src/modules/sreality.js`.
2. Importovat standardní utility ze `src/scraper-base.js` (`fetchWithRetry`, `parseHtml`, `createAdObject`).
3. Vrátit objekt `{ ads: [...], errors: [], source: 'sreality' }`.
4. Importovat modul v `src/index.js` a zapsat do objektu `SCRAPERS`.
5. Spustit 1x SQL příkaz: `npx wrangler d1 execute leads-db --remote --command "INSERT INTO source_config (source_name, enabled) VALUES ('sreality', 1)"`.
*Hotovo. Systém si sám převezme cron job, deduplikaci, bodování i export!*

---

## Provozní náklady (Měsíčně)
- **Cloudflare Workers:** ZDARMA pro prvních 100 000 requestů / den. Nad limit $5/měsíc (předpoklad: pro tento projekt trvale zdarma).
- **Cloudflare D1:** ZDARMA do 5 GB dat a 5 milionů čtení. (Předpoklad: zdarma minimálně prvních 5 let).
- **Google API:** ZDARMA (Google Sheets neúčtuje za standardní používání přes Service Account).
- **Apify (Volitelné pro Facebook):** Cca $49/měsíc (pokud běží Actor pro Facebook skupiny, viz SOURCES.md).

---

## Známá rizika a Monitoring

### Rizika
1. **Změna HTML struktury zdroje (Bazoš, Avízo atd.):** Pokud portál redesignuje web, scraper přestane najít data a Dashboard zahlásí "Nalezeno 0". *Řešení: Rychlá oprava CSS selektorů v modulu daného zdroje.*
2. **Rate Limiting / IP Block:** Portály mohou zablokovat IP adresy Cloudflare. *Řešení: Systém má zabudovaný Delay a Retry. V extrémním případě by bylo nutné napojit Proxy.*

### Jak monitorovat (System Command Center)
Není potřeba lézt do databáze! Celý monitoring probíhá v první záložce vašeho **Google Sheetu** nebo na webu:
- **Health Check zdroje**: Ukazuje, zda daný zdroj v posledním běhu nespadl.
- **Detekce chyb**: Pokud API vrátí chybu, Command center vypíše konkrétní text chyby.
- Alternativně: Webový dashboard běží na `/dashboard` URL vašeho workeru.

---
*Vyvinul: Jan Lančarič (L-Code Dynamics) pro Spojuji.cz | Architektonický dohled: Google Antigravity*
