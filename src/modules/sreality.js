import { fetchWithRetry, delay, createAdObject, extractPhone, extractEmail } from '../scraper-base.js';

const BASE_API_URL = 'https://www.sreality.cz/api/cs/v2/estates';
const BASE_WEB_URL = 'https://www.sreality.cz/detail';

const CATEGORIES = [
  { qs: '?category_main_cb=1&category_type_cb=1&per_page=20', offer: 'prodej', propType: 'byt' },
  { qs: '?category_main_cb=2&category_type_cb=1&per_page=20', offer: 'prodej', propType: 'dum' },
  { qs: '?category_main_cb=3&category_type_cb=1&per_page=20', offer: 'prodej', propType: 'pozemek' },
  { qs: '?category_main_cb=1&category_type_cb=2&per_page=20', offer: 'pronajem', propType: 'byt' },
  { qs: '?category_main_cb=2&category_type_cb=2&per_page=20', offer: 'pronajem', propType: 'dum' },
];

export async function scrape() {
  const ads = [];
  const errors = [];
  
  for (const cat of CATEGORIES) {
    try {
      const responseText = await fetchWithRetry(`${BASE_API_URL}${cat.qs}`);
      const json = JSON.parse(responseText);
      
      const listItems = json._embedded?.estates || [];
      
      for (const item of listItems) {
        try {
          // Construct friendly URL for the ad
          // Sreality detail path format: /detail/prodej/byt/1+kk/praha-1-stare-mesto-dlouha/123456789
          const seoUrl = item.seo ? `/${item.seo.category_type_cb}/${item.seo.category_main_cb}/${item.seo.category_sub_cb}/${item.seo.locality}` : '/reality';
          const adUrl = `${BASE_WEB_URL}${seoUrl}/${item.hash_id}`;
          
          await delay(500);
          const detailText = await fetchWithRetry(`${BASE_API_URL}/${item.hash_id}`);
          const detailJson = JSON.parse(detailText);
          
          const title = detailJson.name?.value || item.name;
          const fullDesc = detailJson.text?.value || '';
          
          // API Phone extraction
          // Realitky i soukromníci v JSONu
          const contacts = detailJson._embedded?.seller?.phones || [];
          let phoneText = contacts.map(p => p.number).join(', ');
          
          // 3-tier phone extraction logic inside JSON
          let phone = extractPhone(phoneText);
          if (phone === 'N/A') phone = extractPhone(fullDesc);
          
          ads.push(createAdObject({
            source: 'sreality', url: adUrl, title: title, description: fullDesc || title,
            offer_type: cat.offer, property_type: cat.propType, price: item.price,
            location: item.locality || detailJson.locality?.value || '', 
            phone, email: extractEmail(fullDesc),
            raw_data: JSON.stringify({ hash_id: item.hash_id, api: true })
          }));
        } catch(e) {
          if (e.message && e.message.includes('404')) continue;
          errors.push(`Sreality detail error ${item.hash_id}: ${e.message}`);
        }
      }
    } catch(e) {
      if (e.message && e.message.includes('404')) continue;
      errors.push(`Sreality cat ${cat.qs}: ${e.message}`);
    }
  }
  console.log(`Sreality: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'sreality' };
}
