# Project Spectre

Project Spectre je automatizovaný **B2B lead generation a scraping systém** pro monitoring realitního trhu v České republice. Běží jako serverless **Cloudflare Worker** s napojením na SQLite databázi **Cloudflare D1** a **Google Sheets API**.

Systém periodicky stahuje nové inzeráty z hlavních českých portálů, provádí jejich sémantickou deduplikaci, analyzuje chování inzerentů a pomocí bodovacího systému (Scoring Engine) odhaluje skryté realitní makléře vystupující jako soukromí majitelé. Výsledné provolatelné leady (pouze s telefonními čísly) synchronizuje v reálném čase do Google Tabulek pro operátory call centra.

---

## Hlavní Funkce

- **Dvoufázový scraping s ochranou**: Scrapery nejdříve přečtou výpisy a následně s bezpečným odstupem (rate limit) navštěvují detaily inzerátů pro spolehlivé vytěžení kontaktů a celých textů.
- **Robustní Phone Extraction**: Pokročilá extrakce českých telefonních čísel z různých formátů a textových zápisů, ošetřená proti falešnému zachytávání ID inzerátů.
- **Scoring Engine**: Bodovací systém analyzující texty inzerátů, e-maily a délku popisů pro identifikaci typu inzerenta (Soukromník vs. Realitní kancelář).
- **Sémantická Deduplikace**: Detekce cross-source duplicit na základě shody telefonů, lokality (Jaccardova podobnost na slovech) a cenového rozpětí.
- **Google Sheets Integrace**: Automatická synchronizace a filtrace pouze kvalitních provolatelných kontaktů do Google Tabulky + generování živého statusového **System Command Center (Dashboard)** přímo v Sheets.
- **Webový Dashboard**: Přehledné HTML rozhraní s historií běhů, úspěšností zdrojů a stavem systému běžící přímo na Workeru.

---

## Struktura Projektu

```text
├── docs/                        # Detailní B2B dokumentace a specifikace
├── migrations/                  # SQL migrační skripty pro Cloudflare D1
│   ├── 0001_init.sql
│   ├── 0002_full_schema.sql
│   └── 0003_fix_scrape_logs.sql
├── modules/                     # Standalone agenti (Python, nepovinné)
├── src/                         # Zdrojový kód Workeru
│   ├── modules/                 # Jednotlivé moduly scraperů
│   │   ├── bazos.js             # Bazoš Reality Scraper
│   │   ├── bezrealitky.js       # Bezrealitky GraphQL/REST API
│   │   ├── avizo.js             # Avízo Reality Scraper
│   │   ├── annonce.js           # Annonce Reality Scraper
│   │   ├── hyperinzerce.js      # Hyperinzerce Reality Scraper
│   │   ├── kuprealitu.js        # KupRealitu API Scraper
│   │   ├── realizujte.js        # Realizujte Scraper
│   │   ├── mujrealitak.js       # MůjRealiťák Scraper
│   │   ├── sreality.js          # Sreality JSON API Scraper
│   │   ├── ceskereality.js      # ČeskéReality Scraper
│   │   ├── realitymix.js        # Realitymix Scraper
│   │   ├── realcity.js          # Realcity Scraper
│   │   ├── videobydleni.js      # Videobydlení Scraper
│   │   ├── realingo.js          # Realingo Scraper
│   │   ├── bydlet.js            # Bydlet.cz Scraper
│   │   ├── realhit.js           # Realhit Scraper
│   │   ├── sbazar.js            # Sbazar manuální import
│   │   └── facebook_apify.js    # Zpracování webhooků
├── fb-stealth.js                # Lokální stealth satelit pro FB skupiny
│   ├── index.js                 # Hlavní Worker router a správa cron cyklů
│   ├── db.js                    # Databázová vrstva (SQLite D1 CRUD)
│   ├── dedup.js                 # Algoritmy deduplikace a shody textů
│   ├── scoring.js               # Bodovací engine a analýza inzerentů
│   ├── sheets.js                # JWT autentizace a Google Sheets API sync
│   └── dashboard.js             # HTML šablona pro webový dashboard
├── wrangler.toml                # Konfigurační soubor Cloudflare Workers
└── package.json                 # Závislosti a npm skripty
```

---

## Konfigurace a Nasazení

### 1. Požadavky
- Node.js v18 nebo novější
- Cloudflare účet s aktivovaným Wrangler CLI (`npx wrangler login`)
- Google Cloud Service Account s povoleným **Google Sheets API**

### 2. Lokální instalace a spuštění
Nainstalujte závislosti a spusťte lokální vývojový server (Wrangler):
```bash
npm install
npm run dev
```
Worker bude běžet lokálně na `http://localhost:8787`.

### 3. Nastavení D1 databáze
Vytvořte databázi na Cloudflare a aplikujte SQL migrace pro nastavení schématu:
```bash
# Vytvoření D1 databáze
npx wrangler d1 create leads-db

# Aplikace migrací na lokální vývojové prostředí
npx wrangler d1 execute leads-db --local --file=./migrations/0001_init.sql
npx wrangler d1 execute leads-db --local --file=./migrations/0002_full_schema.sql
npx wrangler d1 execute leads-db --local --file=./migrations/0003_fix_scrape_logs.sql

# Aplikace migrací na produkční Cloudflare databázi
npx wrangler d1 execute leads-db --remote --file=./migrations/0001_init.sql
npx wrangler d1 execute leads-db --remote --file=./migrations/0002_full_schema.sql
npx wrangler d1 execute leads-db --remote --file=./migrations/0003_fix_scrape_logs.sql
```

### 4. Konfigurace Secrets (Šifrované proměnné)
Všechny citlivé klíče musí být uloženy jako Cloudflare Secrets v administraci projektu:

```bash
# Celý obsah JSON souboru s klíčem ke Google Service Accountu
npx wrangler secret put GCP_SERVICE_ACCOUNT

# ID Google Tabulky (najdete v její URL: https://docs.google.com/spreadsheets/d/ID_TABULKY/edit)
npx wrangler secret put GOOGLE_SHEET_ID

# API klíč pro xAI (pokud využíváte Grok-Beta integrace)
npx wrangler secret put XAI_API_KEY
```

### 5. Nasazení do produkce
Nasazení celého projektu na Cloudflare Edge síť provedete příkazem:
```bash
npm run deploy
```

---

## Monitoring a Logování chyb

Systém disponuje třemi vrstvami monitoringu, které zajišťují maximální transparentnost běhu a usnadňují ladění chyb:

### 1. Tabulka `scrape_logs` v D1
Při každém dokončeném běhu scraperu (ať už ručním nebo automatickém přes cron) se do SQLite databáze uloží podrobný log. Můžete si jej zobrazit pomocí příkazu:
```bash
npx wrangler d1 execute leads-db --remote --command="SELECT * FROM scrape_logs ORDER BY run_time DESC LIMIT 10"
```
Logy obsahují:
- `run_time`: Datum a čas spuštění scraperu.
- `source`: Název scraperu (např. `bazos`, `annonce`).
- `processed`: Počet celkem nalezených inzerátů.
- `new_leads`: Počet nově uložených inzerátů s kontaktem.
- `updated_leads`: Počet aktualizovaných inzerátů.
- `duplicates`: Počet odhalených duplicit.
- `errors`: Výpis chybových hlášení při selhání scraperu (např. chyba sítě, změna HTML selektorů).
- `duration_ms`: Doba běhu cyklu v milisekundách.

### 2. System Command Center v Google Sheets
Záložka **Dashboard** přímo v Google Tabulce funguje jako živý status panel. Zobrazuje:
- **Health Check zdrojů**: Tabulku se stavem každého portálu (OK, CHYBA nebo VYPNUTO), časem posledního úspěšného běhu a výpisem poslední známé chyby.
- **Výkonnost zdrojů**: Celkové počty stažených inzerátů a poměr soukromníků vůči realitkám.
- **Krajová statistika**: Rozložení leadů v rámci České republiky.

### 3. Wrangler Tail (Živé logování)
Pro živé sledování konzolových výpisů přímo z produkčního prostředí Cloudflare Workers spusťte:
```bash
npx wrangler tail
```
Tím uvidíte v reálném čase všechny konzolové logy, síťové dotazy na jednotlivé weby a případné chyby Google Sheets API.

---

## Známá omezení a limity (Known Issues & Limitations)

### 1. Limit subrequestů na Cloudflare Workers (Free Plan)
Bezplatný Cloudflare plán omezuje počet odchozích síťových dotazů (subrequestů) na **50 na jeden běh Workeru**. Jelikož naše scrapery otevírají detail každého inzerátu zvlášť (20 inzerátů = ~20 HTTP požadavků), spuštění všech scraperů naráz by tento limit okamžitě překročilo.
- **Řešení**: Systém je nastaven na **Round-Robin spouštění**. Každý běh cronu (každé 4 hodiny) vybere a zpracuje **pouze jeden nejstarší aktivní zdroj**. Během 24 hodin se tak bezpečně vystřídají a aktualizují všechny weby.
- **Doporučení**: Pro produkční nasazení bez tohoto omezení doporučujeme přejít na placený tarif *Workers Paid* ($5/měsíc), který navyšuje limit subrequestů na 1000 na běh, což umožňuje spouštět všechny scrapery naráz.

### 2. Scraping bez přihlášení (Omezení kontaktů)
Některé portály (typicky Bezrealitky) neumožňují stažení telefonního čísla z detailu bez přihlášení a zaplacení poplatku.
- **Dopad**: U těchto portálů se systém spoléhá výhradně na parsování textu inzerátu. Pokud uživatel nenapíše telefon přímo do popisu inzerátu, lead je uložen se statusem `bez_telefonu` a nesynchronizuje se do Google Sheets.

### 3. Zranitelnost vůči změnám HTML (Selektory)
HTML scrapery (Bazoš, Annonce, Avízo, Hyperinzerce, Realizujte, MůjRealiťák) závisí na CSS selektorech. Pokud majitelé webu změní design stránky, scraper selže (na Dashboardu se u daného zdroje objeví stav CHYBA).
- **Náprava**: Je nutné upravit příslušné CSS selektory v modulech uvnitř `src/modules/`. Postup opravy je detailně popsán v dokumentu [MAINTENANCE.md](file:///Users/lucky/Project%20Spectre/docs/MAINTENANCE.md).

---

## Jak Přidat Nový Parser (Scraper)

Přidání nového inzertního portálu do systému je navrženo velmi modulárně:

### Krok 1: Vytvořte modul v `src/modules/`
Vytvořte nový JavaScript soubor, např. `src/modules/novy_web.js`. Implementujte funkci `scrape()`, která:
1. Stáhne seznam inzerátů (listing).
2. S časovým rozestupem (`await delay(800)`) projde detaily jednotlivých inzerátů.
3. Vytěží text a telefonní číslo.
4. Použije funkci `createAdObject()` pro normalizaci dat.

```javascript
import { fetchWithRetry, parseHtml, delay, createAdObject, extractPhone, extractEmail, parsePrice } from '../scraper-base.js';

const BASE_URL = 'https://www.novy-web.cz';

export async function scrape() {
  const ads = [];
  const errors = [];

  try {
    const html = await fetchWithRetry(BASE_URL + '/vypis');
    const $ = parseHtml(html);
    const listItems = [];

    // Najděte odkazy na detaily
    $('.inzerat-link').each((i, el) => {
      listItems.push({
        url: BASE_URL + $(el).attr('href'),
        title: $(el).find('.title').text().trim(),
        priceText: $(el).find('.price').text()
      });
    });

    // Projděte detaily pro telefonní čísla
    for (const item of listItems) {
      try {
        await delay(800); // Prevence banu
        const detailHtml = await fetchWithRetry(item.url);
        const $detail = parseHtml(detailHtml);

        const phoneText = $detail('.phone-field').text();
        const description = $detail('.description-field').text();

        const ad = ad = createAdObject({
          source: 'novy_web',
          url: item.url,
          title: item.title,
          description,
          price: parsePrice(item.priceText),
          phone: extractPhone(phoneText || description),
          email: extractEmail(description),
        });
        ads.push(ad);
      } catch (e) {
        errors.push(`Detail error ${item.url}: ${e.message}`);
      }
    }
  } catch (e) {
    errors.push(`NovyWeb scrape error: ${e.message}`);
  }

  return { ads, errors, source: 'novy_web' };
}
```

### Krok 2: Zaregistrujte modul v `src/index.js`
1. Importujte funkci `scrape` na začátku souboru:
   ```javascript
   import { scrape as scrapeNovyWeb } from './modules/novy_web.js';
   ```
2. Přidejte ji do mapy `SCRAPERS` na řádku ~27:
   ```javascript
   const SCRAPERS = {
     // ...
     novy_web: scrapeNovyWeb
   };
   ```

### Krok 3: Přidejte zdroj do D1 databáze
Pro aktivaci scraperu v periodickém cron cyklu vložte konfigurační řádek do tabulky `source_config`:
```sql
INSERT INTO source_config (source_name, display_name, enabled, priority, base_url)
VALUES ('novy_web', 'Nový Web Reality', 1, 3, 'https://www.novy-web.cz');
```

---

## API a Endpointy

Worker naslouchá na následujících HTTP endpointech:

- **`GET /`** — Status stránka systému.
- **`GET /dashboard`** — Kompletní webový dashboard s přehlednými statistikami.
- **`GET /run`** — Spustí jeden scrape cyklus (vybere nejstarší aktivní zdroj).
- **`GET /run/:source`** — Spustí konkrétní scraper (např. `/run/bazos` nebo `/run/annonce`).
- **`GET /stats`** — Vrací celkové statistiky systému v JSON formátu.
- **`GET /leads`** — Vrací filtrovaný seznam leadů (podporuje parametry jako `?source=bazos&status=novy`).
- **`POST /manual`** — Ruční import inzerátu (přijímá JSON s `url` nebo s plnými daty inzerátu v těle požadavku).
- **`POST /sheets/sync`** — Vyvolá okamžitou ruční synchronizaci nových leadů s Google Sheets.
- **`POST /api/incoming-lead`** — Datový příjem z lokálních stealth modulů (např. `fb-stealth.js`) s auto-sync funkcí do Google Sheets.
- **`POST /webhook/apify`** — Webhook pro příjem dat ze služby Apify.
