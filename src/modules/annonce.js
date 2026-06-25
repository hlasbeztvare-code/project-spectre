// ============================================
// Project Spectre — Annonce Reality Scraper
// Zdroj: https://www.annonce.cz
// Metoda: HTML scraping
// ============================================

import {
  fetchWithRetry, parseHtml, delay, createAdObject,
  extractPhone, extractEmail, parsePrice
} from '../scraper-base.js';

const BASE_URL = 'https://www.annonce.cz';

const CATEGORIES = [
  { path: '/reality/prodej/', offer: 'prodej', propType: 'jine' },
  { path: '/reality/pronajem/', offer: 'pronajem', propType: 'jine' },
];

const PAGES = 3;

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

        // Annonce selektory
        $('.inzerat, .oglas, .ad-item, article, .list-item').each((i, el) => {
          try {
            const titleEl = $(el).find('h2 a, h3 a, .title a, a.title').first();
            const title = titleEl.text().trim();
            if (!title || title.length < 3) return;

            const href = titleEl.attr('href') || '';
            const adUrl = href.startsWith('http') ? href : BASE_URL + href;

            const priceText = $(el).find('.cena, .price').text();
            const location = $(el).find('.lokalita, .location, .misto, .region').text().trim();
            const desc = $(el).find('.popis, .text, .description, p').first().text().trim();
            const fullText = title + ' ' + desc + ' ' + location;

            const ad = createAdObject({
              source: 'annonce',
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
        errors.push(`Annonce ${cat.path} page ${page}: ${e.message}`);
      }
    }
  }

  console.log(`Annonce: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'annonce' };
}
