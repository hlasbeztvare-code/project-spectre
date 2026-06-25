# Provozní náklady

## Jednorázové náklady
| Položka | Cena |
|---------|------|
| Vývoj a dodání systému | 14 500 Kč |

## Měsíční provozní náklady

### Základní varianta (bez proxy)
| Položka | Cena |
|---------|------|
| Cloudflare Workers Paid | $5/měsíc (~120 Kč) |
| Cloudflare D1 databáze | Zdarma (do 5M reads/den) |
| Google Sheets API | Zdarma (do 300 req/den) |
| **Celkem** | **~120 Kč/měsíc** |

### Doporučená varianta (s residential proxy)
| Položka | Cena |
|---------|------|
| Cloudflare Workers Paid | $5/měsíc (~120 Kč) |
| Cloudflare D1 databáze | Zdarma |
| Google Sheets API | Zdarma |
| Residential proxy (BrightData/Oxylabs) | ~500–1 500 Kč/měsíc |
| **Celkem** | **~620–1 620 Kč/měsíc** |

### Premium varianta (plný proxy + monitoring)
| Položka | Cena |
|---------|------|
| Cloudflare Workers Paid | $5/měsíc (~120 Kč) |
| Cloudflare D1 databáze | Zdarma |
| Google Sheets API | Zdarma |
| Premium residential proxy | ~1 500–2 500 Kč/měsíc |
| Uptime monitoring (optional) | ~200 Kč/měsíc |
| **Celkem** | **~1 820–2 820 Kč/měsíc** |

## Co je v ceně Cloudflare Workers Paid ($5/měsíc)
- 10 milionů requestů/měsíc
- 30 sekund CPU time per request
- Neomezené subrequests
- D1 databáze (5 GB, 5M reads/den)
- Cron triggers
- Custom domains

## Kdy je potřeba proxy
- Když weby začnou blokovat Cloudflare IP adresy
- Pro zvýšení spolehlivosti scrapingu
- Pro přístup k webům s přísnější ochranou

## Odhad datového objemu
- ~100–500 nových inzerátů denně (závisí na trhu)
- ~1 000–5 000 existujících inzerátů v DB po měsíci
- D1 storage: < 50 MB po roce provozu
- Google Sheets: < 10 000 řádků po měsíci
