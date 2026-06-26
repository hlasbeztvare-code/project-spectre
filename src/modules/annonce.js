// ============================================
// Project Spectre — Annonce Reality Scraper
// Zdroj: https://www.annonce.cz
// Metoda: HTML scraping
// Aktualizováno: 2026-06 — oprava URL (/rodinne-domy.html, /pozemky.html)
// ============================================

import {
  fetchWithRetry, parseHtml, delay, createAdObject,
  extractPhone, extractEmail, parsePrice
} from '../scraper-base.js';

const BASE_URL = 'https://www.annonce.cz';

// Ověřeno živě 2026-06: byty-na-prodej.html OK, domy = rodinne-domy.html, pozemky = pozemky.html
const CATEGORIES = [
  { path: '/byty-na-prodej.html', offer: 'prodej', propType: 'byt' },
  { path: '/rodinne-domy.html',   offer: 'prodej', propType: 'dum' },
  { path: '/pozemky.html',        offer: 'prodej', propType: 'pozemek' },
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

        // Annonce selektory (ověřeno 2026-06, Annonce.cz používá třídu .inzerat pro každý item)
        const listItems = [];
        $('.inzerat, .oglas, .ad-item, article, .list-item').each((i, el) => {
          try {
            const titleEl = $(el).find('h2 a, h3 a, .inzerat-title a, .title a, a.title').first();
            const title = titleEl.text().trim();
            if (!title || title.length < 3) return;

            const href = titleEl.attr('href') || '';
            const adUrl = href.startsWith('http') ? href : BASE_URL + href;

            // .inzerat-price je primární na Annonce, .cena / .price jako fallback
            const priceText = $(el).find('.inzerat-price, .cena, .price').text();
            // .inzerat-location je primární na Annonce
            const location = $(el).find('.inzerat-location, .lokalita, .location, .misto, .region').text().trim();
            const shortDesc = $(el).find('.inzerat-text, .popis, .text, .description, p').first().text().trim();

            listItems.push({ adUrl, title, priceText, location, shortDesc });
          } catch (e) { /* skip */ }
        });

        for (const item of listItems) {
          try {
            await delay(800);
            const detailHtml = await fetchWithRetry(item.adUrl);
            const $detail = parseHtml(detailHtml);

            // 1. Nejspolehlivější: přímý tel: href atribut (čisté číslo bez šumu)
            const telHref = $detail('a[href^="tel:"]').first().attr('href') || '';
            const telFromHref = telHref.replace(/^tel:[+]?/, '').replace(/\s/g, '');

            // 2. Fallback: text z kontaktních elementů
            const phoneText = $detail('a[href^="tel:"], .inzerat-contact, .contact-box, .phone, .telefon, .kontakt').text();

            // 3. Popis: Annonce používá .popis-text nebo .inzerat-text
            const fullDesc = $detail('.inzerat-text, .popis-text, .popis, .description, .detail-text, article').text().trim() || item.shortDesc;

            // Priorita: tel href → text elementů → celý popis
            let phone = extractPhone(telFromHref);
            if (phone === 'N/A') phone = extractPhone(phoneText);
            if (phone === 'N/A') phone = extractPhone(fullDesc);

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
