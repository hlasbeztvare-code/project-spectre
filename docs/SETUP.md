# Návod ke spuštění a konfiguraci

## Požadavky
- Node.js 18+
- `npm` nebo `npx`
- Cloudflare účet (Workers Paid doporučen)
- Google Cloud účet (pro Sheets API)

## 1. Instalace
```bash
git clone <repo-url>
cd project-spectre
npm install
```

## 2. Lokální vývoj
```bash
npm run dev
# Worker běží na http://localhost:8787
```

## 3. Cloudflare D1 — Databáze
```bash
# Vytvoření databáze (už existuje)
npx wrangler d1 create leads-db

# Aplikace migrací
npx wrangler d1 execute leads-db --remote --file=./migrations/0001_init.sql
npx wrangler d1 execute leads-db --remote --file=./migrations/0002_full_schema.sql
```

## 4. Google Sheets — Nastavení

### 4.1 Vytvoření Service Account
1. Jdi na [Google Cloud Console](https://console.cloud.google.com)
2. Vytvoř nový projekt (nebo použij existující)
3. Zapni **Google Sheets API** (APIs & Services → Enable APIs)
4. Vytvoř Service Account (IAM → Service Accounts → Create)
5. Stáhni JSON klíč

### 4.2 Sdílení Google Sheetu
1. Vytvoř nový Google Sheet
2. Sdílej ho s e-mailem service accountu (např. `spectre@project-xxx.iam.gserviceaccount.com`)
3. Dej oprávnění **Editor**

### 4.3 Nastavení secrets
```bash
# Ulož celý obsah JSON klíče jako secret
npx wrangler secret put GCP_SERVICE_ACCOUNT
# Vlož obsah JSON souboru a stiskni Enter

# Ulož ID Google Sheetu (z URL: https://docs.google.com/spreadsheets/d/TOTO_JE_ID/edit)
npx wrangler secret put GOOGLE_SHEET_ID
# Vlož ID a stiskni Enter
```

## 5. Apify (Facebook Skupiny) — Nastavení
Pro automatizované stahování Facebook skupin je potřeba účet na Apify.
1. Vytvoř si účet na [Apify](https://apify.com)
2. Najdi a spusť Actor: **Facebook Groups Scraper** (`apify/facebook-groups-scraper`)
3. V nastavení Actoru zadej požadované URL skupin a (ideálně testovací/dummy) přihlašovací údaje (cookies) k Facebooku.
4. Nastav **Integration / Webhook** u tohoto Actoru.
5. Jako Webhook URL zadej: `https://project-spectre.hlancaric.workers.dev/webhook/apify`
6. Jako Event Type zvol `Run succeeded`.
7. Kdykoliv se Actor na Apify dokončí, pošle data do našeho systému, který je zpracuje.

## 6. Deploy
```bash
npm run deploy
# nebo
npx wrangler deploy
```

## 6. Ověření
- Otevři `https://project-spectre.hlancaric.workers.dev/dashboard`
- Spusť test: `https://project-spectre.hlancaric.workers.dev/run/bazos`
- Zkontroluj Google Sheet

## 7. Cron
Automatický běh je nastaven v `wrangler.toml`:
```toml
[triggers]
crons = ["0 */4 * * *"]  # Každé 4 hodiny
```

Pro změnu frekvence uprav a znovu deployjni.
