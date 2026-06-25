// ============================================
// Project Spectre — Facebook Apify Webhook Handler
// Zpracovává data poslaná z Apify "Facebook Groups Scraper"
// ============================================

import { createAdObject, extractPhone, extractEmail, parsePrice, parseLocation } from '../scraper-base.js';

/**
 * Zpracuje jeden příspěvek z Apify datasetu
 */
export function processApifyPost(post) {
  try {
    const url = post.url || (post.id ? `https://www.facebook.com/${post.id}` : null);
    if (!url) return null;

    const text = post.text || post.message || '';
    if (!text || text.length < 10) return null; // Přeskoč prázdné fotky bez textu

    const advertiser_name = post.user?.name || post.author || null;
    const date = post.date || post.time || new Date().toISOString();

    // Pokusíme se z nestrukturovaného textu vydolovat cenu a lokalitu
    const price = parsePrice(text);
    
    // Extrahování telefonu a emailu (standardní utility)
    const phone = extractPhone(text);
    const email = extractEmail(text);

    // Identifikace typu z textu
    const lowerText = text.toLowerCase();
    let offer_type = 'prodej';
    if (lowerText.includes('pronájm') || lowerText.includes('pronajm') || lowerText.includes('podnájm') || lowerText.includes('k pronajmutí')) {
      offer_type = 'pronajem';
    } else if (lowerText.includes('hledám') || lowerText.includes('koupím') || lowerText.includes('poptávám')) {
      // Poptávky obvykle nechceme, ale můžeme je označit
      offer_type = 'poptavka';
    }

    let property_type = 'jine';
    if (lowerText.includes('byt') || lowerText.includes('apartmán')) property_type = 'byt';
    else if (lowerText.includes('dům') || lowerText.includes('dum') || lowerText.includes('vil')) property_type = 'dum';
    else if (lowerText.includes('pozemek') || lowerText.includes('parcel')) property_type = 'pozemek';
    else if (lowerText.includes('chat') || lowerText.includes('chalup')) property_type = 'chata';
    else if (lowerText.includes('garáž') || lowerText.includes('garaz')) property_type = 'garaz';

    // Generování nadpisu z prvních slov textu (Facebook většinou nemá klasické nadpisy)
    const title = text.split('\n')[0].substring(0, 100) + (text.split('\n')[0].length > 100 ? '...' : '');

    return createAdObject({
      source: 'facebook', // Interně ukládáme jako facebook
      url,
      title,
      description: text,
      offer_type,
      property_type,
      price,
      location: '', // Na FB lidé píší lokace divně, necháme prázdné nebo případně parsujeme z textu v budoucnu
      phone,
      email,
      advertiser_name,
      ad_published_date: date,
      raw_data: JSON.stringify({ apifyId: post.id, groupUrl: post.groupUrl || post.facebookUrl }),
    });

  } catch (e) {
    console.error('Error processing Apify post:', e);
    return null;
  }
}
