import { fetchWithRetry, parseHtml, delay, createAdObject, extractPhone, extractEmail, parsePrice } from '../scraper-base.js';

const BASE_URL = 'https://reality.hyperinzerce.cz';
const CATEGORIES = [
  { path: '/prodej+bytu/', offer: 'prodej', propType: 'byt' },
  { path: '/prodej+domu/', offer: 'prodej', propType: 'dum' },
  { path: '/prodej+pozemku/', offer: 'prodej', propType: 'pozemek' },
  { path: '/pronajem+bytu/', offer: 'pronajem', propType: 'byt' },
  { path: '/pronajem+domu/', offer: 'pronajem', propType: 'dum' },
];

export async function scrape() {
  const ads = [];
  const errors = [];
  
  for (const cat of CATEGORIES) {
    try {
      const html = await fetchWithRetry(`${BASE_URL}${cat.path}`);
      const $ = parseHtml(html);
      const listItems = [];
      
      $('.inzerat, .offer, .ad-row, .listing-item, tr.row, .item').each((i, el) => {
        try {
          const titleEl = $(el).find('a.title, h3 a, h2 a, .nadpis a, td a').first();
          const title = titleEl.text().trim();
          if (!title || title.length < 3) return;
          const href = titleEl.attr('href') || '';
          const adUrl = href.startsWith('http') ? href : BASE_URL + href;
          listItems.push({ 
            adUrl, title, 
            priceText: $(el).find('.cena, .price, td.cena').text(), 
            location: $(el).find('.lokalita, .location, td.lokalita').text().trim(), 
            shortDesc: $(el).find('.popis, .text, .description').first().text().trim() 
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
            source: 'hyperinzerce', url: item.adUrl, title: item.title, description: fullDesc || item.title,
            offer_type: cat.offer, property_type: cat.propType, price: parsePrice(item.priceText),
            location: item.location, phone, email: extractEmail(fullDesc),
            raw_data: JSON.stringify({ category: cat.path })
          }));
        } catch(e) {
          if (e.message && e.message.includes('404')) continue; // Silent skip for deleted ads
          errors.push(`Hyperinzerce detail error ${item.adUrl}: ${e.message}`);
        }
      }
    } catch(e) {
      if (e.message && e.message.includes('404')) continue;
      errors.push(`Hyperinzerce cat ${cat.path}: ${e.message}`);
    }
  }
  console.log(`Hyperinzerce: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'hyperinzerce' };
}
