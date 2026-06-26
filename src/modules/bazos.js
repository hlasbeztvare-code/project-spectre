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
  { path: '/prodam/byt/', offer: 'prodej', propType: 'byt' },
  { path: '/prodam/dum/', offer: 'prodej', propType: 'dum' },
  { path: '/prodam/pozemek/', offer: 'prodej', propType: 'pozemek' },
  { path: '/prodam/ostatni/', offer: 'prodej', propType: 'jine' },
  { path: '/pronajmu/byt/', offer: 'pronajem', propType: 'byt' },
  { path: '/pronajmu/dum/', offer: 'pronajem', propType: 'dum' },
];

const BASE_URL = 'https://reality.bazos.cz';
const PAGES_PER_CATEGORY = 1; // 1 stránka × ~20 inzerátů (častý scraping stačí)

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
        const listItems = [];
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
            const shortDesc = $(el).find('.inzeratypopis, .popis').text().trim();

            listItems.push({
              adUrl, title, priceText, location, shortDesc
            });
          } catch (e) {
            // Skip broken item
          }
        });

        // 2. Krok: Návštěva detailu každého inzerátu pro získání telefonu
        for (const item of listItems) {
          try {
            // Pauza proti zablokování (Rate limit)
            await delay(800);
            
            const detailHtml = await fetchWithRetry(item.adUrl);
            const $detail = parseHtml(detailHtml);
            
            // Text inzerátu z detailu je spolehlivější a delší
            const fullDesc = $detail('.popisdetail').text().trim() || item.shortDesc;
            
            // Telefon je často v .telefon nebo v textu
            const phoneText = $detail('.telefon').text() + ' ' + $detail('a[href^="tel:"]').text();
            
            let phone = extractPhone(phoneText);
            if (phone === 'N/A') {
              phone = extractPhone(fullDesc); // Fallback na text
            }
            
            const email = extractEmail(fullDesc);

            const ad = createAdObject({
              source: 'bazos',
              url: item.adUrl,
              title: item.title,
              description: fullDesc || item.title,
              offer_type: category.offer,
              property_type: category.propType,
              price: parsePrice(item.priceText),
              location: item.location,
              phone,
              email,
              raw_data: JSON.stringify({ category: category.path, page }),
            });

            ads.push(ad);
          } catch (e) {
            errors.push(`Bazos detail error ${item.adUrl}: ${e.message}`);
          }
        }

        // Rate limiting mezi hlavními stránkami kategorií
        await delay(1000);
      }
    } catch (e) {
      errors.push(`Bazos category ${category.path}: ${e.message}`);
    }
  }

  console.log(`Bazos: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'bazos' };
}