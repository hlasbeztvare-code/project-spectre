// ============================================
// Project Spectre — MůjRealiťák Scraper
// Zdroj: https://www.mujrealitak.cz
// Metoda: HTML scraping
// ============================================

import {
  fetchWithRetry, parseHtml, delay, createAdObject,
  extractPhone, extractEmail, parsePrice
} from '../scraper-base.js';

const BASE_URL = 'https://www.mujrealitak.cz';

const CATEGORIES = [
  { path: '/nabidky/prodej/byty/', offer: 'prodej', propType: 'byt' },
  { path: '/nabidky/prodej/domy/', offer: 'prodej', propType: 'dum' },
  { path: '/nabidky/prodej/pozemky/', offer: 'prodej', propType: 'pozemek' },
  { path: '/nabidky/pronajem/byty/', offer: 'pronajem', propType: 'byt' },
  { path: '/nabidky/pronajem/domy/', offer: 'pronajem', propType: 'dum' },
];

const PAGES = 2;

export async function scrape() {
  const ads = [];
  const errors = [];

  for (const cat of CATEGORIES) {
    for (let page = 1; page <= PAGES; page++) {
      try {
        const url = page === 1
          ? `${BASE_URL}${cat.path}`
          : `${BASE_URL}${cat.path}?strana=${page}`;

        const html = await fetchWithRetry(url);
        const $ = parseHtml(html);

        // Generické selektory
        $('.property, .item, .inzerat, article, .listing-item, .estate-item, .card').each((i, el) => {
          try {
            const titleEl = $(el).find('h2 a, h3 a, .title a, a.property-title, .card-title a').first();
            const title = titleEl.text().trim();
            if (!title || title.length < 3) return;

            const href = titleEl.attr('href') || '';
            const adUrl = href.startsWith('http') ? href : BASE_URL + href;

            const priceText = $(el).find('.cena, .price, .property-price').text();
            const location = $(el).find('.lokalita, .location, .address, .property-location').text().trim();
            const desc = $(el).find('.popis, .description, .text, .property-description, p').first().text().trim();
            const fullText = title + ' ' + desc;

            const ad = createAdObject({
              source: 'mujrealitak',
              url: adUrl,
              title,
              description: desc || title,
              offer_type: cat.offer,
              property_type: cat.propType,
              price: parsePrice(priceText),
              location,
              phone: extractPhone(fullText),
              email: extractEmail(fullText),
              raw_data: JSON.stringify({ category: cat.path, page }),
            });

            ads.push(ad);
          } catch (e) { /* skip */ }
        });

        await delay(2000);
      } catch (e) {
        errors.push(`MujRealitak ${cat.path} page ${page}: ${e.message}`);
      }
    }
  }

  console.log(`MůjRealiťák: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'mujrealitak' };
}
