// ============================================
// Project Spectre — Sbazar Poloautomatický Scraper
// Zdroj: Sbazar (Seznam.cz) + Facebook + ruční vstup
// Metoda: Poloautomatický — ruční vložení URL/textu
// ============================================
// UPOZORNĚNÍ: Seznam.cz explicitně zakazuje automatizovaný
// sběr dat. Tento modul slouží pouze pro ruční import.
// ============================================

import {
  fetchWithRetry, parseHtml, createAdObject,
  extractPhone, extractEmail, parsePrice
} from '../scraper-base.js';

/**
 * Zpracování ručně vloženého URL — stáhne stránku a extrahuje data
 */
export async function processUrl(url) {
  const errors = [];

  try {
    // Určení zdroje z URL
    let source = 'manual';
    if (url.includes('sbazar.cz')) source = 'sbazar';
    else if (url.includes('facebook.com')) source = 'facebook';

    const html = await fetchWithRetry(url);
    const $ = parseHtml(html);

    // Generická extrakce — funguje na většině stránek
    const title = $('h1').first().text().trim()
      || $('title').text().trim()
      || $('[class*="title"]').first().text().trim();

    const description = $('[class*="description"], [class*="popis"], [class*="text"], .content p, article p')
      .map((i, el) => $(el).text().trim())
      .get()
      .join(' ')
      .substring(0, 2000);

    const priceText = $('[class*="price"], [class*="cena"], .price').first().text();
    const locationText = $('[class*="location"], [class*="lokalita"], [class*="address"], [class*="misto"]').first().text().trim();

    const fullText = title + ' ' + description;

    const ad = createAdObject({
      source,
      url,
      title: title || 'Ruční import',
      description: description || title,
      price: parsePrice(priceText),
      location: locationText,
      phone: extractPhone(fullText),
      email: extractEmail(fullText),
      raw_data: JSON.stringify({ importMethod: 'url', originalUrl: url }),
    });

    return { ads: [ad], errors, source };

  } catch (e) {
    errors.push(`Manual URL processing failed: ${e.message}`);
    return { ads: [], errors, source: 'manual' };
  }
}

/**
 * Zpracování ručně vloženého textu
 */
export function processText(data) {
  const {
    url = '',
    title = 'Ruční import',
    description = '',
    price = 0,
    location = '',
    phone = 'N/A',
    email = null,
    source = 'manual',
    offer_type = 'prodej',
    property_type = 'jine',
    advertiser_name = null,
    note = null,
  } = data;

  const ad = createAdObject({
    source,
    url: url || `manual://${Date.now()}`,
    title,
    description: description || title,
    offer_type,
    property_type,
    price: typeof price === 'string' ? parsePrice(price) : price,
    location,
    phone: phone || extractPhone(description),
    email: email || extractEmail(description),
    advertiser_name,
    raw_data: JSON.stringify({ importMethod: 'text', note }),
  });

  return { ads: [ad], errors: [], source };
}

/**
 * Automatický scrape — vrací prázdný výsledek
 * (Sbazar je poloautomatický, nemá automatický scraping)
 */
export async function scrape() {
  console.log('Sbazar/Manual: poloautomatický režim — použijte POST /manual endpoint');
  return { ads: [], errors: [], source: 'sbazar' };
}
