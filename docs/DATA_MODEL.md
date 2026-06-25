# Datový model

## Tabulka `leads` — Hlavní tabulka inzerátů

| Sloupec | Typ | Popis |
|---------|-----|-------|
| `id` | TEXT PK | Unikátní ID záznamu (hash z URL) |
| `source` | TEXT | Zdroj (bazos, bezrealitky, avizo, ...) |
| `url` | TEXT UNIQUE | URL inzerátu |
| `title` | TEXT | Nadpis inzerátu |
| `description` | TEXT | Popis inzerátu |
| `offer_type` | TEXT | Typ nabídky: `prodej` / `pronajem` |
| `property_type` | TEXT | Typ nemovitosti: `byt` / `dum` / `pozemek` / `chata` / `garaz` / `komerce` / `jine` |
| `disposition` | TEXT | Dispozice: `1+1`, `2+kk`, `3+1`, ... |
| `area_m2` | REAL | Plocha v m² |
| `price` | INTEGER | Cena |
| `currency` | TEXT | Měna (default: CZK) |
| `location` | TEXT | Lokalita jako text |
| `region` | TEXT | Kraj |
| `district` | TEXT | Okres |
| `city` | TEXT | Město / obec |
| `phone` | TEXT | Telefonní číslo (9 číslic bez předvolby) |
| `email` | TEXT | E-mail (pokud je dostupný) |
| `advertiser_name` | TEXT | Jméno inzerenta |
| `advertiser_type` | TEXT | Typ inzerenta: `soukromnik` / `realitka` / `neznamo` |
| `realitka_score` | INTEGER | Skóre pravděpodobnosti realitky (0-100) |
| `private_score` | INTEGER | Skóre pravděpodobnosti soukromníka (0-100) |
| `duplicate_group` | TEXT | ID skupiny duplicit |
| `duplicate_count` | INTEGER | Počet výskytů v rámci skupiny |
| `ad_published_date` | DATETIME | Datum vložení inzerátu |
| `ad_status` | TEXT | Stav inzerátu: `aktivni` / `neaktivni` / `smazany` / `nedostupny` |
| `status` | TEXT | Stav zpracování (viz stavy níže) |
| `first_seen` | DATETIME | Datum prvního nalezení |
| `last_seen` | DATETIME | Datum posledního nalezení |
| `last_check` | DATETIME | Datum poslední kontroly |
| `note` | TEXT | Poznámka |
| `assigned_to` | TEXT | Přiřazeno komu |
| `contact_date` | DATETIME | Datum kontaktování |
| `contact_result` | TEXT | Výsledek kontaktu |
| `raw_data` | TEXT | Surová data (JSON) |
| `created_at` | DATETIME | Datum vytvoření záznamu |

## Stavy zpracování (`status`)

| Hodnota | Popis |
|---------|-------|
| `novy` | Nový záznam |
| `pripraveno` | Připraveno k provolání |
| `volano` | Voláno |
| `nedovolano` | Nedovoláno |
| `dovolat_pozdeji` | Dovolat později |
| `nema_zajem` | Nemá zájem |
| `ma_zajem` | Má zájem |
| `predano_makleri` | Předáno makléři |
| `duplicitni` | Duplicitní záznam |
| `realitka` | Identifikováno jako realitka |
| `bez_telefonu` | Bez telefonu |
| `nerelevantni` | Nerelevantní |
| `archiv` | Archivováno |

## Tabulka `scoring_rules` — Pravidla bodování

| Sloupec | Typ | Popis |
|---------|-----|-------|
| `id` | INTEGER PK | Auto-increment ID |
| `rule_type` | TEXT | `realitka_keyword` / `soukromnik_keyword` |
| `keyword` | TEXT | Klíčové slovo/fráze |
| `points` | INTEGER | Body za nález |
| `enabled` | INTEGER | 1 = aktivní, 0 = neaktivní |

## Tabulka `source_config` — Konfigurace zdrojů

| Sloupec | Typ | Popis |
|---------|-----|-------|
| `source_name` | TEXT UNIQUE | Interní název (bazos, avizo, ...) |
| `display_name` | TEXT | Zobrazovaný název |
| `enabled` | INTEGER | 1 = aktivní |
| `priority` | INTEGER | Priorita (1 = nejvyšší) |
| `scrape_method` | TEXT | `html` / `api` / `manual` |
| `last_success` | DATETIME | Poslední úspěšný běh |
| `last_error` | TEXT | Poslední chyba |

## Tabulka `scrape_logs` — Logy běhů

| Sloupec | Typ | Popis |
|---------|-----|-------|
| `source` | TEXT | Zdroj |
| `processed` | INTEGER | Zpracováno inzerátů |
| `new_leads` | INTEGER | Nové leady |
| `updated_leads` | INTEGER | Aktualizované |
| `duplicates` | INTEGER | Duplicity |
| `errors` | TEXT | Chyby |
| `duration_ms` | INTEGER | Délka běhu v ms |

## Skóre interpretace

| Realitka skóre | Interpretace |
|---------------|-------------|
| 0–30 | Pravděpodobně soukromník |
| 31–60 | Nejisté (šedá zóna) |
| 61–100 | Pravděpodobně realitka |
