// ============================================
// Project Spectre — KupRealitu Scraper
// Zdroj: https://www.kuprealitu.cz
// Metoda: K-API (oficiální API)
// ============================================

import { fetchJsonWithRetry, delay, createAdObject, extractPhone, extractEmail } from '../scraper-base.js';

const BASE_URL = 'https://www.kuprealitu.cz';
// K-API dokumentace: https://www.kuprealitu.cz/k-api
const API_BASE = 'https://www.kuprealitu.cz/api/v1';

const OFFER_TYPES = [
  { param: 'prodej', offer: 'prodej' },
  { param: 'pronajem', offer: 'pronajem' },
];

const PROPERTY_TYPES = [
  { param: 'byty', propType: 'byt' },
  { param: 'domy', propType: 'dum' },
  { param: 'pozemky', propType: 'pozemek' },
];

export async function scrape() {
  const ads = [];
  const errors = [];

  for (const offerType of OFFER_TYPES) {
    for (const propertyType of PROPERTY_TYPES) {
      try {
        // Zkusíme K-API
        const apiUrl = `${API_BASE}/estates?offer_type=${offerType.param}&estate_type=${propertyType.param}&limit=50&page=1`;

        let data;
        try {
          data = await fetchJsonWithRetry(apiUrl);
        } catch (apiError) {
          // Fallback: zkusíme public listing endpoint
          try {
            const fallbackUrl = `${BASE_URL}/${offerType.param}/${propertyType.param}/?format=json`;
            data = await fetchJsonWithRetry(fallbackUrl);
          } catch (fallbackError) {
            errors.push(`KupRealitu API ${offerType.param}/${propertyType.param}: ${apiError.message}`);
            continue;
          }
        }

        if (!data) continue;

        const items = Array.isArray(data) ? data : (data.results || data.estates || data.items || []);

        for (const item of items) {
          try {
            const adUrl = item.url || item.link || `${BASE_URL}/detail/${item.id || item.slug || ''}`;
            const description = item.description || item.text || '';
            const title = item.title || item.name || '';
            const fullText = title + ' ' + description;

            const ad = createAdObject({
              source: 'kuprealitu',
              url: adUrl,
              title,
              description: description || title,
              offer_type: offerType.offer,
              property_type: propertyType.propType,
              price: item.price || item.cena || 0,
              location: item.location || item.address || item.city || '',
              region: item.region || null,
              district: item.district || null,
              city: item.city || null,
              area_m2: item.area || item.plocha || null,
              disposition: item.disposition || item.dispozice || null,
              phone: item.phone || extractPhone(fullText),
              email: item.email || extractEmail(fullText),
              advertiser_name: item.advertiser || item.seller || null,
              raw_data: JSON.stringify({ id: item.id }),
            });

            ads.push(ad);
          } catch (e) { /* skip */ }
        }

        await delay(2000);
      } catch (e) {
        errors.push(`KupRealitu ${offerType.param}/${propertyType.param}: ${e.message}`);
      }
    }
  }

  console.log(`KupRealitu: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'kuprealitu' };
}
