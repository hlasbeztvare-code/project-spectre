# Údržba a řešení problémů

## Každodenní kontrola
1. Otevři `/dashboard` — zkontroluj "Poslední běhy"
2. Zkontroluj Google Sheet — nové záznamy

## Přidání nového zdroje
1. Vytvoř soubor `src/modules/novyzdroj.js`
2. Implementuj funkci `export async function scrape()` — musí vracet `{ ads: [], errors: [], source: 'novyzdroj' }`
3. V `src/index.js` přidej import a záznám do `SCRAPERS` mapy
4. V DB přidej konfiguraci:
```sql
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method)
VALUES ('novyzdroj', 'Nový Zdroj', 3, 'https://www.novyzdroj.cz', 'html');
```
5. Deployjni: `npm run deploy`

## Úprava scoring pravidel
Pravidla jsou v DB tabulce `scoring_rules`. Můžeš je měnit bez deploye:
```bash
# Přidat nové pravidlo
npx wrangler d1 execute leads-db --remote --command "INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'nové klíčové slovo', 20)"

# Deaktivovat pravidlo
npx wrangler d1 execute leads-db --remote --command "UPDATE scoring_rules SET enabled = 0 WHERE keyword = 'staré slovo'"

# Změnit váhu
npx wrangler d1 execute leads-db --remote --command "UPDATE scoring_rules SET points = 30 WHERE keyword = 'makléř'"
```

## Změna HTML selektorů
Když web změní strukturu HTML:
1. Otevři stránku v prohlížeči → F12 → Inspekce elementu
2. Najdi nové CSS selektory
3. Uprav příslušný modul v `src/modules/`
4. Deployjni

## Aktivace/deaktivace zdroje
```bash
# Deaktivovat zdroj (přestane se scrapovat)
npx wrangler d1 execute leads-db --remote --command "UPDATE source_config SET enabled = 0 WHERE source_name = 'annonce'"

# Aktivovat zpět
npx wrangler d1 execute leads-db --remote --command "UPDATE source_config SET enabled = 1 WHERE source_name = 'annonce'"
```

## Řešení problémů

### Scraper nenajde žádné inzeráty
- Web pravděpodobně změnil HTML strukturu
- Otevři web ručně, zkontroluj selektory
- Uprav modul a deployjni

### Chyba při přístupu k webu (403, 429)
- Web možná blokuje Cloudflare IP
- Zkus přidat proxy nebo snížit frekvenci
- Zvyš `delay()` v modulu

### Google Sheets se neaktualizuje
- Zkontroluj secrets: `npx wrangler secret list`
- Ověř, že Sheet je sdílen se service accountem
- Zkus manuální sync: `POST /sheets/sync`

### Duplicity se neoznačují
- Spusť post-processing ručně: `GET /run`
- Zkontroluj `duplicate_group` v DB

## Záloha databáze
```bash
# Export dat
npx wrangler d1 execute leads-db --remote --command "SELECT * FROM leads" --json > backup.json
```

## Reset databáze
```bash
# POZOR: Smaže všechna data!
npx wrangler d1 execute leads-db --remote --file=./migrations/0001_init.sql
npx wrangler d1 execute leads-db --remote --file=./migrations/0002_full_schema.sql
```
