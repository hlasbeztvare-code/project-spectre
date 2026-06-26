import { fetchWithRetry, parseHtml, delay, createAdObject, extractPhone, extractEmail, parsePrice } from '../scraper-base.js';

const BASE_URL = 'https://www.realizujte.cz';
const CATEGORIES = [
  { path: '/reality/prodej/', offer: 'prodej', propType: 'jine' },
  { path: '/reality/pronajem/', offer: 'pronajem', propType: 'jine' },
];

export async function scrape() {
  const ads = [];
  const errors = [];
  
  for (const cat of CATEGORIES) {
    try {
      const html = await fetchWithRetry(`${BASE_URL}${cat.path}`);
      const $ = parseHtml(html);
      const listItems = [];
      
      $('.inzerat, .item, .ad, article, .listing-item, .property-item').each((i, el) => {
        try {
          const titleEl = $(el).find('h2 a, h3 a, .title a, a.ad-title').first();
          const title = titleEl.text().trim();
          if (!title || title.length < 3) return;
          const href = titleEl.attr('href') || '';
          const adUrl = href.startsWith('http') ? href : BASE_URL + href;
          listItems.push({ 
            adUrl, title, 
            priceText: $(el).find('.cena, .price').text(), 
            location: $(el).find('.lokalita, .location, .address').text().trim(), 
            shortDesc: $(el).find('.popis, .description, .text, p').first().text().trim() 
          });
        } catch(e) {}
      });

      for (const item of listItems) {
        try {
          await delay(800);
          const detailHtml = await fetchWithRetry(item.adUrl);
          const $detail = parseHtml(detailHtml);
          const fullDesc = $detail('.popis, .description, .detail-text, .text, article, p').text().trim() || item.shortDesc;
          
          // 3-tier phone extraction
          const telHref = $detail('a[href^="tel:"]').first().attr('href') || '';
          const telFromHref = telHref.replace(/^tel:[+]?/, '').replace(/\s/g, '');
          const phoneText = $detail('.phone, .telefon, .kontakt, .contact').text();
          
          let phone = extractPhone(telFromHref);
          if (phone === 'N/A') phone = extractPhone(phoneText);
          if (phone === 'N/A') phone = extractPhone(fullDesc);
          
          ads.push(createAdObject({
            source: 'realizujte', url: item.adUrl, title: item.title, description: fullDesc || item.title,
            offer_type: cat.offer, property_type: cat.propType, price: parsePrice(item.priceText),
            location: item.location, phone, email: extractEmail(fullDesc),
            raw_data: JSON.stringify({ category: cat.path })
          }));
        } catch(e) {
          if (e.message && e.message.includes('404')) continue;
          errors.push(`Realizujte detail error ${item.adUrl}: ${e.message}`);
        }
      }
    } catch(e) {
      if (e.message && e.message.includes('404')) continue;
      errors.push(`Realizujte cat ${cat.path}: ${e.message}`);
    }
  }
  console.log(`Realizujte: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'realizujte' };
}
