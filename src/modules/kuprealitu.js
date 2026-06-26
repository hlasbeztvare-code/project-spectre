// ============================================
// Project Spectre — KupRealitu Scraper
// Zdroj: https://www.kuprealitu.cz
// Metoda: Sitemap Scraping (přepracováno 2026-06)
//
// DŮVOD PŘEPRACOVÁNÍ:
//   Staré /api/v1/* endpointy a /prodej/* listing stránky
//   vracejí HTTP 404 — portál žádné veřejné listing pages ani
//   JSON API nemá. Jedinou spolehlivou vstupní branou je
//   sitemap.xml (~6000+ URL, denní aktualizace).
//
// STRATEGIE:
//   1. Fetch sitemap.xml → parsuj <loc> URL regexem
//   2. Filtruj jen /detail/ URL s relevantními klíčovými slovy
//   3. Detekuj typ nabídky a nemovitosti ze slugu
//   4. Scrapuj max. MAX_PER_RUN detail stránek
//   5. Vytaž telefon přes 3-úrovňový fallback s extractPhone()
// ============================================

import {
  fetchWithRetry, parseHtml, delay, createAdObject,
  extractPhone, extractEmail, parsePrice
} from '../scraper-base.js';

const BASE_URL = 'https://www.kuprealitu.cz';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;

// Max. počet detail stránek ke scrapování na jeden běh.
// 30 × ~600ms delay = ~18 vteřin (bezpečně pod limitem)
const MAX_PER_RUN = 30;

// Klíčová slova pro detekci offer_type ze URL slugu
const PRODEJ_KEYWORDS   = ['prodej'];
const PRONAJEM_KEYWORDS = ['pronajem'];

// Klíčová slova pro detekci property_type ze URL slugu
// Řazeno od nejspecifičtějšího k nejobecnějšímu
const PROPERTY_MAP = [
  { type: 'pozemek', keywords: ['stavebniho-pozemku', 'pozemku', 'zahrady', 'louky', 'lesa', 'pole', 'parcely'] },
  { type: 'dum',     keywords: ['rodinneho-domu', 'rodinny-dum', 'domu', 'vily', 'bungalovu', 'usedlosti', 'chalupy', 'chaty'] },
  { type: 'byt',     keywords: ['bytu', 'byty'] },
  { type: 'komerce', keywords: ['kancelare', 'skladu', 'obchodnich-prostor', 'komercni', 'restauracniho'] },
];

/**
 * Detekuje offer_type ('prodej' | 'pronajem') ze slug URL
 */
function detectOfferType(slug) {
  if (PRONAJEM_KEYWORDS.some(k => slug.includes(k))) return 'pronajem';
  if (PRODEJ_KEYWORDS.some(k => slug.includes(k))) return 'prodej';
  return 'prodej'; // výchozí
}

/**
 * Detekuje property_type ze slug URL
 */
function detectPropertyType(slug) {
  for (const { type, keywords } of PROPERTY_MAP) {
    if (keywords.some(k => slug.includes(k))) return type;
  }
  return 'jine';
}

/**
 * Parsuje sitemap.xml a vrací pole URL detail stránek
 * Regex přístup — cloudflare Workers nepodporuje DOMParser
 */
function parseSitemapUrls(xml) {
  const urls = [];
  // Extrahujeme obsah <loc>...</loc> tagů
  const locRegex = /<loc>(https:\/\/www\.kuprealitu\.cz\/detail\/[^<]+)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

/**
 * Scrapuje jeden detail inzerátu z HTML stránky
 */
function scrapeDetail($, url) {
  // Titul: h1 ve .property-title (bez tlačítka Zpět)
  const titleRaw = $('h1[itemprop="name"]').first().text()
    .replace(/\s+/g, ' ').trim();

  // Alternativa z meta title (spolehlivější, bez HTML artefaktů)
  const metaTitle = $('meta[name="title"]').attr('content') || '';
  const title = titleRaw || metaTitle.replace(' | KUPREALITU.CZ', '').replace(' | www.kuprealitu.cz', '').trim();

  // Cena: span.tag.price
  const priceText = $('span.tag.price').first().text().trim();

  // Adresa: schema.org mikrodata (nejspolehlivější)
  const street   = $('span[itemprop="streetAddress"]').first().text().trim();
  const locality = $('span[itemprop="addressLocality"]').first().text().trim();
  const region   = $('span[itemprop="addressRegion"]').first().text().trim();
  // Fallback: figure tag ve .property-title
  const figureText = $('header.property-title figure').first().text().trim();
  const location = [street, locality].filter(Boolean).join(', ') || figureText;

  // Dispozice: dt "Dispozice" → dd
  let disposition = null;
  $('dl dt').each((i, el) => {
    if ($(el).text().toLowerCase().includes('dispozice')) {
      disposition = $(el).next('dd').text().trim() || null;
    }
  });

  // Plocha: dt "Plocha" → dd
  let areaTxt = null;
  $('dl dt').each((i, el) => {
    if ($(el).text().toLowerCase().includes('plocha')) {
      areaTxt = $(el).next('dd').text().replace(/[^0-9]/g, '') || null;
    }
  });
  const area_m2 = areaTxt ? parseInt(areaTxt) || null : null;

  // Popis: primárně meta description (nejkompaktnější a nejspolehlivější)
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  // Fallback: hlavní text sekce
  const bodyDesc = $('#property-detail .property-description, #property-detail section.description, #property-detail .text')
    .first().text().trim();
  const description = metaDesc || bodyDesc || title;

  // Telefon: 3-úrovňový fallback s extractPhone()
  // 1. Přímý tel: href atribut
  const telHref = $('a[href^="tel:"]').first().attr('href') || '';
  const telFromHref = telHref.replace(/^tel:[+]?/, '').replace(/\s/g, '');

  // 2. Text kontaktních elementů
  const phoneText = $('a[href^="tel:"], .contact, .kontakt, .phone, .telefon').text();

  // 3. Celý popis (telefon může být zapsán slovně nebo v textu)
  let phone = extractPhone(telFromHref);
  if (phone === 'N/A') phone = extractPhone(phoneText);
  if (phone === 'N/A') phone = extractPhone(description);

  // Email
  const email = extractEmail(phoneText) || extractEmail(description);

  return { title, priceText, location, region, disposition, area_m2, description, phone, email };
}

export async function scrape() {
  const ads = [];
  const errors = [];

  // ── Krok 1: Stáhni sitemap ──────────────────────────────────────
  let allDetailUrls = [];
  try {
    const sitemapXml = await fetchWithRetry(SITEMAP_URL);
    allDetailUrls = parseSitemapUrls(sitemapXml);
    console.log(`KupRealitu: sitemap obsahuje ${allDetailUrls.length} detail URL`);
  } catch (e) {
    errors.push(`KupRealitu sitemap fetch failed: ${e.message}`);
    return { ads, errors, source: 'kuprealitu' };
  }

  if (allDetailUrls.length === 0) {
    errors.push('KupRealitu: sitemap neobsahuje žádné detail URL (parsování selhalo?)');
    return { ads, errors, source: 'kuprealitu' };
  }

  // ── Krok 2: Filtruj relevantní nemovitosti ze slugu ─────────────
  // Bereme jen byty, domy, pozemky (ne garáže, sklady, restaurace atp.)
  const RELEVANT_TYPES = new Set(['byt', 'dum', 'pozemek']);
  const filtered = allDetailUrls.filter(url => {
    const slug = url.split('/detail/')[1] || '';
    return RELEVANT_TYPES.has(detectPropertyType(slug));
  });

  // Bereme POSLEDNÍCH MAX_PER_RUN URL (= nejnovější inzeráty v sitemapě)
  const toScrape = filtered.slice(-MAX_PER_RUN);
  console.log(`KupRealitu: scrapuji ${toScrape.length} detail URL (filtrováno z ${filtered.length})`);

  // ── Krok 3: Scrapuj detail stránky ──────────────────────────────
  for (const adUrl of toScrape) {
    try {
      await delay(600);

      const slug = adUrl.split('/detail/')[1] || '';
      const offerType    = detectOfferType(slug);
      const propertyType = detectPropertyType(slug);

      const html = await fetchWithRetry(adUrl);
      const $    = parseHtml(html);

      const { title, priceText, location, region, disposition, area_m2, description, phone, email } = scrapeDetail($, adUrl);

      if (!title || title.length < 3) continue;

      const ad = createAdObject({
        source:        'kuprealitu',
        url:           adUrl,
        title,
        description:   description || title,
        offer_type:    offerType,
        property_type: propertyType,
        price:         parsePrice(priceText),
        location,
        region:        region || null,
        disposition:   disposition || null,
        area_m2,
        phone,
        email,
        raw_data:      JSON.stringify({ slug }),
      });

      ads.push(ad);
    } catch (e) {
      // 404/403 na detail → inzerát smazán, přeskočíme bez šumu
      if (e.message && e.message.includes('404')) continue;
      errors.push(`KupRealitu detail ${adUrl}: ${e.message}`);
    }
  }

  console.log(`KupRealitu: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'kuprealitu' };
}
