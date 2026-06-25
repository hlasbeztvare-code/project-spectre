// ============================================
// Project Spectre — Bazoš Reality Scraper
// Zdroj: https://reality.bazos.cz
// Metoda: HTML scraping
// ============================================

import {
  fetchWithRetry, parseHtml, delay, createAdObject,
  extractPhone, extractEmail, parsePrice
} from '../scraper-base.js';

// Kategorie na Bazoš Reality
const CATEGORIES = [
  { path: '/prodej/byt/', offer: 'prodej', propType: 'byt' },
  { path: '/prodej/dum/', offer: 'prodej', propType: 'dum' },
  { path: '/prodej/pozemek/', offer: 'prodej', propType: 'pozemek' },
  { path: '/prodej/ostatni/', offer: 'prodej', propType: 'jine' },
  { path: '/pronajem/byt/', offer: 'pronajem', propType: 'byt' },
  { path: '/pronajem/dum/', offer: 'pronajem', propType: 'dum' },
];

const BASE_URL = 'https://reality.bazos.cz';
const PAGES_PER_CATEGORY = 3; // 3 stránky × ~20 inzerátů = ~60 per kategorie

export async function scrape() {
  const ads = [];
  const errors = [];

  for (const category of CATEGORIES) {
    try {
      for (let page = 0; page < PAGES_PER_CATEGORY; page++) {
        const offset = page * 20;
        const url = `${BASE_URL}${category.path}${offset > 0 ? offset + '/' : ''}`;

        let html;
        try {
          html = await fetchWithRetry(url);
        } catch (e) {
          errors.push(`Bazos ${category.path} page ${page}: ${e.message}`);
          continue;
        }

        const $ = parseHtml(html);

        // Bazos používá .inzeraty kontejnery
        $('.inzeraty, .inzerat').each((i, el) => {
          try {
            const titleEl = $(el).find('.inzeratynadpis a, .nadpis a');
            const title = titleEl.text().trim();
            if (!title) return;

            const href = titleEl.attr('href') || '';
            const adUrl = href.startsWith('http') ? href : BASE_URL + href;

            const priceText = $(el).find('.inzeratycena, .cena').text();
            const location = $(el).find('.inzeratylokace, .lokace').text().trim()
              || $(el).find('.inzeratynadpis + div').text().trim();
            const desc = $(el).find('.inzeratypopis, .popis').text().trim();

            const fullText = title + ' ' + desc;
            const phone = extractPhone(fullText);
            const email = extractEmail(fullText);

            const ad = createAdObject({
              source: 'bazos',
              url: adUrl,
              title,
              description: desc || title,
              offer_type: category.offer,
              property_type: category.propType,
              price: parsePrice(priceText),
              location,
              phone,
              email,
              raw_data: JSON.stringify({ category: category.path, page }),
            });

            ads.push(ad);
          } catch (e) {
            // Skip jednotlivý inzerát s chybou
          }
        });

        // Rate limiting — 1.5s mezi stránkami
        await delay(1500);
      }
    } catch (e) {
      errors.push(`Bazos category ${category.path}: ${e.message}`);
    }
  }

  console.log(`Bazos: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'bazos' };
}