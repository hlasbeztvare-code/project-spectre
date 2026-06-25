# Project Spectre — Dokumentace

## Přehled systému
Scraper / monitorovací systém nemovitostních inzerátů pro celou Českou republiku.
Automaticky vyhledává nové inzeráty, identifikuje soukromé majitele vs. realitní kanceláře
a exportuje obchodně použitelné kontakty do Google Sheets.

## Technologie
| Technologie | Použití |
|-------------|---------|
| **Cloudflare Workers** | Hlavní runtime (serverless) |
| **Cloudflare D1** | SQLite databáze (leady, konfigurace, logy) |
| **Google Sheets API** | Výstupní tabulka pro obchodní tým |
| **JavaScript (ES Modules)** | Programovací jazyk |
| **Cheerio** | HTML parsing pro scraping |

## Kde systém běží
- **Worker URL**: `https://project-spectre.hlancaric.workers.dev`
- **Dashboard**: `https://project-spectre.hlancaric.workers.dev/dashboard`
- **Cron**: Automaticky každé 4 hodiny (`0 */4 * * *`)
- **Databáze**: Cloudflare D1 `leads-db`

## Struktura projektu
```
project-spectre/
├── src/
│   ├── index.js           # Hlavní entry point (Worker + API)
│   ├── db.js              # Databázová vrstva (CRUD, filtry, statistiky)
│   ├── scoring.js         # Bodovací systém (realitka/soukromník)
│   ├── dedup.js           # Deduplikace (3-úrovňová)
│   ├── scraper-base.js    # Sdílené utility (fetch, parsování, lokality)
│   ├── sheets.js          # Google Sheets integrace (JWT auth)
│   ├── dashboard.js       # HTML dashboard
│   ├── schema.sql         # Kompletní DB schéma (referenční)
│   └── modules/
│       ├── bazos.js       # Bazoš Reality
│       ├── bezrealitky.js # Bezrealitky (API)
│       ├── avizo.js       # Avízo Reality
│       ├── annonce.js     # Annonce Reality
│       ├── hyperinzerce.js# Hyperinzerce Reality
│       ├── kuprealitu.js  # KupRealitu (K-API)
│       ├── realizujte.js  # Realizujte
│       ├── mujrealitak.js # MůjRealiťák
│       └── sbazar.js      # Sbazar/Manual (poloauto)
├── migrations/
│   ├── 0001_init.sql      # Počáteční schema
│   └── 0002_full_schema.sql # Rozšířené schema + scoring rules
├── docs/                  # Dokumentace
├── wrangler.toml          # Cloudflare konfigurace
└── package.json
```

## API Endpointy

| Endpoint | Metoda | Popis |
|----------|--------|-------|
| `/` | GET | Status systému |
| `/dashboard` | GET | HTML dashboard s přehledy |
| `/run` | GET | Manuální spuštění celého cyklu |
| `/run/:source` | GET | Spuštění konkrétního zdroje |
| `/stats` | GET | JSON statistiky |
| `/stats/sources` | GET | Stav zdrojů |
| `/stats/regions` | GET | Statistiky podle krajů |
| `/leads` | GET | Filtrované leady (viz filtry níže) |
| `/manual` | POST | Ruční import inzerátu |
| `/sheets/sync` | POST | Manuální sync do Google Sheets |

### Filtry pro `/leads`
| Parametr | Popis | Příklad |
|----------|-------|---------|
| `source` | Zdroj | `bazos`, `bezrealitky` |
| `status` | Stav | `novy`, `ma_zajem` |
| `region` | Kraj | `Liberecký kraj` |
| `district` | Okres | `Liberec` |
| `city` | Město (like) | `Praha` |
| `offer_type` | Typ nabídky | `prodej`, `pronajem` |
| `property_type` | Typ nemovitosti | `byt`, `dum`, `pozemek` |
| `price_min` | Min. cena | `500000` |
| `price_max` | Max. cena | `5000000` |
| `advertiser_type` | Typ inzerenta | `soukromnik`, `realitka` |
| `limit` | Max. záznamů | `100` (max 500) |
| `offset` | Offset | `0` |

## Další dokumenty
- [SETUP.md](./SETUP.md) — Návod ke spuštění
- [MAINTENANCE.md](./MAINTENANCE.md) — Údržba a řešení problémů
- [DATA_MODEL.md](./DATA_MODEL.md) — Datový model
- [SOURCES.md](./SOURCES.md) — Zdroje a jejich omezení
- [COSTS.md](./COSTS.md) — Provozní náklady
