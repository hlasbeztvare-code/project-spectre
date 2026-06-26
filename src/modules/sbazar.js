// ============================================
// Project Spectre — Sbazar Poloautomatický Scraper
// Zdroj: Sbazar (Seznam.cz) + Facebook + ruční vstup
// Metoda: Poloautomatický — ruční vložení URL/textu
// ============================================
import { fetchWithRetry, parseHtml, createAdObject, extractPhone, extractEmail, parsePrice } from '../scraper-base.js';

export async function processUrl(url) {
  const errors = [];
  try {
    let source = 'manual';
    if (url.includes('sbazar.cz')) source = 'sbazar';
    else if (url.includes('facebook.com')) source = 'facebook';

    const html = await fetchWithRetry(url);
    const $ = parseHtml(html);

    const title = $('h1').first().text().trim() || $('title').text().trim() || $('[class*="title"]').first().text().trim();
    const description = $('[class*="description"], [class*="popis"], [class*="text"], .content p, article p')
      .map((i, el) => $(el).text().trim()).get().join(' ').substring(0, 2000);
    const priceText = $('[class*="price"], [class*="cena"], .price').first().text();
    const locationText = $('[class*="location"], [class*="lokalita"], [class*="address"], [class*="misto"]').first().text().trim();

    // 3-tier phone extraction
    const telHref = $('a[href^="tel:"]').first().attr('href') || '';
    const telFromHref = telHref.replace(/^tel:[+]?/, '').replace(/\s/g, '');
    const phoneText = $('.phone, .telefon, .kontakt, .contact').text();
    
    let phone = extractPhone(telFromHref);
    if (phone === 'N/A') phone = extractPhone(phoneText);
    if (phone === 'N/A') phone = extractPhone(title + ' ' + description);

    const ad = createAdObject({
      source, url, title: title || 'Ruční import', description: description || title,
      price: parsePrice(priceText), location: locationText,
      phone, email: extractEmail(title + ' ' + description),
      raw_data: JSON.stringify({ importMethod: 'url', originalUrl: url }),
    });

    return { ads: [ad], errors, source };
  } catch (e) {
    if (e.message && e.message.includes('404')) return { ads: [], errors: [], source: 'manual' }; // Silent fail
    errors.push(`Manual URL processing failed: ${e.message}`);
    return { ads: [], errors, source: 'manual' };
  }
}

export function processText(data) {
  const { url = '', title = 'Ruční import', description = '', price = 0, location = '', phone = 'N/A', email = null, source = 'manual', offer_type = 'prodej', property_type = 'jine', advertiser_name = null, note = null } = data;
  
  // Apply final fallback directly on manual text desc
  let finalPhone = phone !== 'N/A' && phone !== '' ? phone : extractPhone(description);

  const ad = createAdObject({
    source, url: url || `manual://${Date.now()}`, title, description: description || title,
    offer_type, property_type, price: typeof price === 'string' ? parsePrice(price) : price,
    location, phone: finalPhone, email: email || extractEmail(description),
    advertiser_name, raw_data: JSON.stringify({ importMethod: 'text', note }),
  });
  return { ads: [ad], errors: [], source };
}

export async function scrape() {
  return { ads: [], errors: [], source: 'sbazar' };
}
