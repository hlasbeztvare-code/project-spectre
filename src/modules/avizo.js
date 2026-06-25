// ============================================
// Project Spectre — Avízo Reality Scraper
// Zdroj: https://www.avizo.cz
// Metoda: HTML scraping
// ============================================

import {
  fetchWithRetry, parseHtml, delay, createAdObject,
  extractPhone, extractEmail, parsePrice
} from '../scraper-base.js';

const BASE_URL = 'https://www.avizo.cz';

const CATEGORIES = [
  { path: '/reality/prodej-bytu/', offer: 'prodej', propType: 'byt' },
  { path: '/reality/prodej-domu/', offer: 'prodej', propType: 'dum' },
  { path: '/reality/prodej-pozemku/', offer: 'prodej', propType: 'pozemek' },
  { path: '/reality/pronajem-bytu/', offer: 'pronajem', propType: 'byt' },
  { path: '/reality/pronajem-domu/', offer: 'pronajem', propType: 'dum' },
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

        // Avízo listing selektory
        $('.inzerat, .item, .listing-item, article').each((i, el) => {
          try {
            const titleEl = $(el).find('h2 a, h3 a, .title a, .nadpis a').first();
            const title = titleEl.text().trim();
            if (!title || title.length < 3) return;

            const href = titleEl.attr('href') || '';
            const adUrl = href.startsWith('http') ? href : BASE_URL + href;

            const priceText = $(el).find('.cena, .price, .inzerat-cena').text();
            const location = $(el).find('.lokalita, .location, .misto').text().trim();
            const desc = $(el).find('.popis, .description, .text, p').first().text().trim();
            const fullText = title + ' ' + desc;

            const ad = createAdObject({
              source: 'avizo',
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
        errors.push(`Avizo ${cat.path} page ${page}: ${e.message}`);
      }
    }
  }

  console.log(`Avizo: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'avizo' };
}
