# Zdroje inzerátů

## Hlavní zdroje (v systému)

| # | Zdroj | Metoda | Priorita | Riziko | Stav |
|---|-------|--------|----------|--------|------|
| 1 | **Bazoš Reality** | HTML scraping | 1 (vysoká) | Nízké | ✅ Implementováno |
| 2 | **Bezrealitky** | API endpointy | 1 (vysoká) | Střední | ✅ Implementováno |
| 3 | **Avízo Reality** | HTML scraping | 2 | Nízké | ✅ Implementováno |
| 4 | **Annonce Reality** | HTML scraping | 3 | Nízké | ✅ Implementováno |
| 5 | **Hyperinzerce Reality** | HTML scraping | 3 | Nízké | ✅ Implementováno |
| 6 | **KupRealitu** | K-API (oficiální) | 2 | Nízké | ✅ Implementováno |
| 7 | **Realizujte** | HTML scraping | 3 | Střední | ✅ Implementováno |
| 8 | **MůjRealiťák** | HTML scraping | 3 | Střední | ✅ Implementováno |
| 9 | **Sreality** | API JSON | 1 (vysoká) | Střední | ✅ Implementováno |
| 10 | **Ceskereality** | HTML scraping | 2 | Nízké | ✅ Implementováno |
| 11 | **Realitymix** | HTML scraping | 2 | Nízké | ✅ Implementováno |
| 12 | **Realcity** | HTML scraping | 2 | Nízké | ✅ Implementováno |
| 13 | **Videobydleni** | HTML scraping | 2 | Nízké | ✅ Implementováno |
| 14 | **Realingo** | HTML scraping | 3 | Nízké | ✅ Implementováno |
| 15 | **Bydlet** | HTML scraping | 3 | Nízké | ✅ Implementováno |
| 16 | **Realhit** | HTML scraping | 3 | Nízké | ✅ Implementováno |
| 17 | **Sbazar** | Poloautomatický | 2 | Vysoké | ⚠️ Pouze manuální |
| 18 | **Facebook Skupiny** | Webhook / Stealth | 1 | Střední | ✅ Implementováno (Stealth/Apify) |
| 19 | **Ruční import** | POST endpoint | 5 | Žádné | ✅ Implementováno |

## Detaily zdrojů

### Bazoš Reality (bazos.cz)
- **URL**: https://reality.bazos.cz
- **Metoda**: HTML scraping s Cheerio
- **Pokrytí**: Prodej bytů, domů, pozemků + Pronájem bytů, domů
- **Rate limiting**: 1.5s mezi stránkami
- **Riziko**: Nízké — stabilní HTML, minimální ochrana
- **Poznámka**: Hlavní zdroj soukromých inzerentů

### Bezrealitky (bezrealitky.cz)
- **URL**: https://www.bezrealitky.cz
- **Metoda**: Interní API (web je SPA/React, HTML scraping nefunguje)
- **Pokrytí**: Prodej + Pronájem bytů, domů, pozemků
- **Riziko**: Střední — API endpointy se mohou měnit
- **Poznámka**: Primárně soukromní inzerenti (to je celý smysl portálu)

### Sbazar (sbazar.cz)
- **URL**: https://www.sbazar.cz
- **Metoda**: Poloautomatický (ruční vložení URL přes POST /manual)
- **Riziko**: ⚠️ VYSOKÉ
- **Důvod**: Seznam.cz explicitně zakazuje automatizovaný sběr dat ve svých podmínkách. Hrozí blokace IP a právní kroky.
- **Řešení**: Systém zpracuje ručně vložené URL nebo text ze Sbazaru stejně jako jiné inzeráty.

### Facebook Skupiny
- **Metoda**: Lokální skript `fb-stealth.js` + webhook `POST /api/incoming-lead`
- **Důvod**: Facebook neumožňuje klasický scraping. 
- **Řešení**: Systém zahrnuje lokální `fb-stealth.js` běžící nad Puppeteer s maskováním (`puppeteer-extra-plugin-stealth`), který projíždí mobilní UI (`m.facebook.com`), obchází balast nativních React komponent a posílá čisté JSON data do API Workeru. API Worker inzeráty skóruje a přes auto-sync okamžitě nahrává do Google Sheets. Současně systém podporuje i záložní Apify Webhooky.

## Známá omezení

1. **HTML selektory se mohou měnit** — Když web změní design, scraper přestane fungovat. Dashboard zobrazí "0 nalezeno" pro daný zdroj. Viz MAINTENANCE.md pro postup opravy.

2. **Bezrealitky API** — Interní API není dokumentované a může se měnit bez upozornění.

3. **Rate limiting** — Všechny scrapery mají vestavěný delay (1.5-2s) mezi požadavky, aby nezatěžovaly servery.

4. **Telefony z popisu** — Ne všechny inzeráty mají telefon přímo v popisu. U některých je telefon až po kliknutí "Zobrazit kontakt". Tyto případy budou označeny jako "bez telefonu".

5. **Geolokace** — Parsování lokality na kraj/okres/město je založené na slovníku a nemusí být 100% přesné.

## Doplňkové zdroje (připraveno pro budoucnost)
Systém je navržen tak, aby přidání dalšího zdroje vyžadovalo pouze:
1. Nový soubor v `src/modules/`
2. Import v `src/index.js`
3. Řádek v tabulce `source_config`

Žádné přepisování celého systému není nutné.
