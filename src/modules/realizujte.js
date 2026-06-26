// ============================================
// Project Spectre — Realizujte Scraper
// Zdroj: https://www.realizujte.cz
// Metoda: HTML scraping
// ============================================

import {
  fetchWithRetry, parseHtml, delay, createAdObject,
  extractPhone, extractEmail, parsePrice
} from '../scraper-base.js';

const BASE_URL = 'https://www.realizujte.cz';

const CATEGORIES = [
  { path: '/reality/prodej/', offer: 'prodej', propType: 'jine' },
  { path: '/reality/pronajem/', offer: 'pronajem', propType: 'jine' },
];

const PAGES = 1;

export async function scrape() {
  const ads = [];
  const errors = [];

  for (const cat of CATEGORIES) {
    for (let page = 1; page <= PAGES; page++) {
      try {
        const url = page === 1
          ? `${BASE_URL}${cat.path}`
          : `${BASE_URL}${cat.path}?page=${page}`;

        const html = await fetchWithRetry(url);
        const $ = parseHtml(html);

        // Generické selektory
        const listItems = [];
        $('.inzerat, .item, .ad, article, .listing-item, .property-item').each((i, el) => {
          try {
            const titleEl = $(el).find('h2 a, h3 a, .title a, a.ad-title').first();
            const title = titleEl.text().trim();
            if (!title || title.length < 3) return;

            const href = titleEl.attr('href') || '';
            const adUrl = href.startsWith('http') ? href : BASE_URL + href;

            const priceText = $(el).find('.cena, .price').text();
            const location = $(el).find('.lokalita, .location, .address').text().trim();
            const shortDesc = $(el).find('.popis, .description, .text, p').first().text().trim();

            listItems.push({ adUrl, title, priceText, location, shortDesc });
          } catch (e) { /* skip */ }
        });

        for (const item of listItems) {
          try {
            await delay(800);
            const detailHtml = await fetchWithRetry(item.adUrl);
            const $detail = parseHtml(detailHtml);

            const phoneText = $detail('a[href^="tel:"], .phone, .telefon, .kontakt, .contact').text();
            const fullDesc = $detail('.popis, .description, .detail-text, .text, article, p').text().trim() || item.shortDesc;

            let phone = extractPhone(phoneText);
            if (phone === 'N/A') {
              phone = extractPhone(fullDesc);
            }
            const email = extractEmail(fullDesc);

            const ad = createAdObject({
              source: 'realizujte',
              url: item.adUrl,
              title: item.title,
              description: fullDesc || item.title,
              offer_type: cat.offer,
              property_type: cat.propType,
              price: parsePrice(item.priceText),
              location: item.location,
              phone,
              email,
              raw_data: JSON.stringify({ category: cat.path, page }),
            });

            ads.push(ad);
          } catch (e) {
            errors.push(`Realizujte detail error ${item.adUrl}: ${e.message}`);
          }
        }

        await delay(1000);
      } catch (e) {
        errors.push(`Realizujte ${cat.path} page ${page}: ${e.message}`);
      }
    }
  }

  console.log(`Realizujte: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'realizujte' };
}
