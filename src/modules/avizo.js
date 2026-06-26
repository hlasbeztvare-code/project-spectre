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
  { path: '/reality/byty/', offer: 'neznamo', propType: 'byt' },
  { path: '/reality/rodinne-domy/', offer: 'neznamo', propType: 'dum' },
  { path: '/reality/pozemky-zahrady/', offer: 'neznamo', propType: 'pozemek' },
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

        // Avízo listing selektory
        const listItems = [];
        $('.item-link').each((i, el) => {
          try {
            const titleEl = $(el).find('.item-title').first();
            const title = titleEl.text().trim() || $(el).attr('title');
            if (!title || title.length < 3) return;

            const href = $(el).attr('href') || '';
            const adUrl = href.startsWith('http') ? href : BASE_URL + href;

            const priceText = $(el).find('.item-price').text();
            const location = $(el).find('.item-locality').text().trim();
            const shortDesc = $(el).find('.item-text').text().trim();

            listItems.push({ adUrl, title, priceText, location, shortDesc });
          } catch (e) { /* skip */ }
        });

        for (const item of listItems) {
          try {
            await delay(800);
            const detailHtml = await fetchWithRetry(item.adUrl);
            const $detail = parseHtml(detailHtml);

            const phoneText = $detail('a[href^="tel:"], .phone, .telefon, .kontakt, .contact').text() + ' ' + $detail('.item-phone').text();
            const fullDesc = $detail('.item-description, .popis, .text, article, p').text().trim() || item.shortDesc;

            let phone = extractPhone(phoneText);
            if (phone === 'N/A') {
              phone = extractPhone(fullDesc);
            }
            const email = extractEmail(fullDesc);

            const ad = createAdObject({
              source: 'avizo',
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
            errors.push(`Avizo detail error ${item.adUrl}: ${e.message}`);
          }
        }

        await delay(1000);
      } catch (e) {
        errors.push(`Avizo ${cat.path} page ${page}: ${e.message}`);
      }
    }
  }

  console.log(`Avizo: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'avizo' };
}
