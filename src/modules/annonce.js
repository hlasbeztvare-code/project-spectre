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
  { path: '/byty-na-prodej.html', offer: 'prodej', propType: 'byt' },
  { path: '/domy-na-prodej.html', offer: 'prodej', propType: 'dum' },
  { path: '/pozemky-na-prodej.html', offer: 'prodej', propType: 'pozemek' },
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
          : `${BASE_URL}${cat.path}?strana=${page}`;

        const html = await fetchWithRetry(url);
        const $ = parseHtml(html);

        // Annonce selektory
        const listItems = [];
        $('.inzerat, .oglas, .ad-item, article, .list-item').each((i, el) => {
          try {
            const titleEl = $(el).find('h2 a, h3 a, .title a, a.title').first();
            const title = titleEl.text().trim();
            if (!title || title.length < 3) return;

            const href = titleEl.attr('href') || '';
            const adUrl = href.startsWith('http') ? href : BASE_URL + href;

            const priceText = $(el).find('.cena, .price').text();
            const location = $(el).find('.lokalita, .location, .misto, .region').text().trim();
            const shortDesc = $(el).find('.popis, .text, .description, p').first().text().trim();

            listItems.push({ adUrl, title, priceText, location, shortDesc });
          } catch (e) { /* skip */ }
        });

        for (const item of listItems) {
          try {
            await delay(800);
            const detailHtml = await fetchWithRetry(item.adUrl);
            const $detail = parseHtml(detailHtml);

            const phoneText = $detail('a[href^="tel:"], .phone, .telefon, .kontakt, .contact-phone').text();
            const fullDesc = $detail('.popis, .description, .detail-text, .text, article, p').text().trim() || item.shortDesc;

            let phone = extractPhone(phoneText);
            if (phone === 'N/A') {
              phone = extractPhone(fullDesc);
            }
            const email = extractEmail(fullDesc);

            const ad = createAdObject({
              source: 'annonce',
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
            errors.push(`Annonce detail error ${item.adUrl}: ${e.message}`);
          }
        }

        await delay(1000);
      } catch (e) {
        errors.push(`Annonce ${cat.path} page ${page}: ${e.message}`);
      }
    }
  }

  console.log(`Annonce: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'annonce' };
}
