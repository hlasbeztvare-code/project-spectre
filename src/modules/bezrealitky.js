// ============================================
// Project Spectre — Bezrealitky Scraper
// Zdroj: https://www.bezrealitky.cz
// Metoda: API (SPA — HTML scraping nefunguje)
// ============================================

import { fetchJsonWithRetry, delay, createAdObject, extractPhone, extractEmail } from '../scraper-base.js';

const BASE_URL = 'https://www.bezrealitky.cz';

// Bezrealitky API endpointy (interní GraphQL/REST)
const API_URL = 'https://api.bezrealitky.cz/graphql';

// Fallback: Public listing API
const LISTING_API = 'https://www.bezrealitky.cz/api/record/markers';

const OFFER_TYPES = [
  { type: 'PRODEJ', offer: 'prodej' },
  { type: 'PRONAJEM', offer: 'pronajem' },
];

const PROPERTY_TYPES = [
  { type: 'BYT', propType: 'byt' },
  { type: 'DUM', propType: 'dum' },
  { type: 'POZEMEK', propType: 'pozemek' },
];

export async function scrape() {
  const ads = [];
  const errors = [];

  for (const offerType of OFFER_TYPES) {
    for (const propertyType of PROPERTY_TYPES) {
      try {
        // Zkusíme API endpoint pro výpis
        const apiUrl = `${LISTING_API}?offerType=${offerType.type}&estateType=${propertyType.type}&page=1&regionOsmIds=R51684`; // R51684 = ČR

        let data;
        try {
          data = await fetchJsonWithRetry(apiUrl);
        } catch (e) {
          // Fallback: zkusíme GraphQL
          try {
            const graphqlBody = JSON.stringify({
              operationName: 'ListAdverts',
              variables: {
                offerType: offerType.type,
                estateType: propertyType.type,
                limit: 50,
                offset: 0,
              },
              query: `query ListAdverts($offerType: String!, $estateType: String!, $limit: Int!, $offset: Int!) {
                listAdverts(offerType: $offerType, estateType: $estateType, limit: $limit, offset: $offset) {
                  list { id uri title description price address { city region district } }
                }
              }`
            });

            const graphqlResponse = await fetchJsonWithRetry(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: graphqlBody,
            });

            if (graphqlResponse?.data?.listAdverts?.list) {
              data = graphqlResponse.data.listAdverts.list;
            }
          } catch (gqlError) {
            errors.push(`Bezrealitky API ${offerType.type}/${propertyType.type}: ${e.message}, GraphQL: ${gqlError.message}`);
            continue;
          }
        }

        if (!data) continue;

        // Zpracuj data (formát závisí na API)
        const items = Array.isArray(data) ? data : (data.list || data.records || data.results || []);

        for (const item of items) {
          try {
            const adUrl = item.uri
              ? `${BASE_URL}${item.uri.startsWith('/') ? '' : '/'}${item.uri}`
              : `${BASE_URL}/nemovitosti-byty-domy/${item.id || item.slug || ''}`;

            const description = item.description || item.text || item.note || '';
            const title = item.title || item.name || '';
            const fullText = title + ' ' + description;

            const ad = createAdObject({
              source: 'bezrealitky',
              url: adUrl,
              title,
              description: description || title,
              offer_type: offerType.offer,
              property_type: propertyType.propType,
              price: item.price || item.priceCzk || 0,
              location: item.address?.city || item.location || item.city || '',
              region: item.address?.region || null,
              district: item.address?.district || null,
              city: item.address?.city || item.city || null,
              phone: extractPhone(fullText),
              email: extractEmail(fullText),
              advertiser_name: item.advertiser?.name || item.owner?.name || null,
              raw_data: JSON.stringify({ id: item.id, offerType: offerType.type, estateType: propertyType.type }),
            });

            ads.push(ad);
          } catch (e) {
            // Skip broken ad
          }
        }

        // Rate limiting
        await delay(2000);

      } catch (e) {
        errors.push(`Bezrealitky ${offerType.type}/${propertyType.type}: ${e.message}`);
      }
    }
  }

  console.log(`Bezrealitky: nalezeno ${ads.length} inzerátů, ${errors.length} chyb`);
  return { ads, errors, source: 'bezrealitky' };
}