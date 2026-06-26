// ============================================
// Project Spectre — Scraper Base
// Sdílená logika pro všechny scraper moduly
// ============================================

import * as cheerio from 'cheerio';

/**
 * Fetch s retry logikou a rate limiting
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Cache-Control': 'no-cache',
  };

  const fetchOptions = {
    headers: { ...defaultHeaders, ...(options.headers || {}) },
    ...options,
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (response.status === 429) {
        // Rate limited — čekej a zkus znovu
        const waitMs = Math.min(5000 * attempt, 15000);
        console.warn(`Rate limited on ${url}, waiting ${waitMs}ms (attempt ${attempt})`);
        await delay(waitMs);
        continue;
      }

      if (!response.ok) {
        if ([404, 403, 400, 401].includes(response.status)) {
          throw new Error(`HTTP ${response.status} for ${url} (Fatal, not retrying)`);
        }
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.text();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.warn(`Fetch attempt ${attempt} failed for ${url}: ${error.message}`);
      await delay(2000 * attempt);
    }
  }
}

/**
 * Fetch JSON s retry
 */
export async function fetchJsonWithRetry(url, options = {}, maxRetries = 3) {
  const text = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...(options.headers || {}),
    }
  }, maxRetries);
  return JSON.parse(text);
}

/**
 * Parse HTML do Cheerio
 */
export function parseHtml(html) {
  return cheerio.load(html);
}

/**
 * Delay / sleep helper
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generuje unikátní ID z URL
 */
export function generateId(url) {
  // DJB2 hash → base36 (kratší a unikátnější než base64 substring)
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36) + '_' + url.length.toString(36);
}

// ============================================
// Parsovací utility
// ============================================

/**
 * Extrakce telefonního čísla z textu
 * Agresivní, neprůstřelná verze s podporou českých textových číslic,
 * odstraňováním šumu mezi číslicemi a robustním fallbackem.
 */
export function extractPhone(text) {
  if (!text) return 'N/A';

  // --- Krok 1: Převod českých textových číslic na číslice ---
  // Podporuje varianty s i bez diakritiky (pro případ OCR nebo neformálního zápisu)
  const WORD_TO_DIGIT = {
    'nula': '0', 'jedna': '1', 'jedná': '1', 'dva': '2', 'dvě': '2',
    'tri': '3', 'tři': '3', 'čtyři': '4', 'ctyri': '4',
    'pět': '5', 'pet': '5', 'šest': '6', 'sest': '6',
    'sedm': '7', 'osm': '8', 'devět': '9', 'devet': '9',
  };
  let normalized = text.toLowerCase();
  for (const [word, digit] of Object.entries(WORD_TO_DIGIT)) {
    // Nahradíme celá slova (word boundary), opakovaně pro více výskytů
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  }

  // --- Krok 2: Odstraníme šum (+, -, /, tečky, závorky, mezery) POUZE mezi číslicemi ---
  // Využíváme lookbehind (?<=\d) a lookahead (?=\d) pro přesné cílení
  const denoised = normalized
    .replace(/[\(\)]/g, ' ')
    .replace(/(?<=\d)[\s+\-\/\.\(\)]+(?=\d)/g, '');

  // --- Krok 3: Primární extrakce pomocí regex s uzávorkovanou skupinou ---
  // Odřízne mezinárodní předvolby (+420, 420, 00420, +421, 00421 atd.)
  // a zachytí devítimístné tělo začínající na 2–9
  const primaryPattern = /(?:\+?(?:420|421)|00(?:420|421))?([2-9]\d{8})\b/;
  const primaryMatch = denoised.match(primaryPattern);
  if (primaryMatch) {
    const phone = primaryMatch[1];
    // Sanity check: neprojdou čísla začínající na 42x (mezinárodní prefix uvnitř)
    if (!phone.startsWith('42')) {
      return phone;
    }
  }

  // --- Krok 4: Robustní nouzový fallback ---
  // Odstraní vše nečíselné a zkontroluje délku výsledného řetězce
  const digitsOnly = denoised.replace(/\D/g, '');

  if (digitsOnly.length === 9 && /^[2-9]/.test(digitsOnly)) {
    return digitsOnly;
  }
  // 12 číslic → předvolba +420 (3) + číslo (9)
  if (digitsOnly.length === 12 && /^420[2-9]/.test(digitsOnly)) {
    return digitsOnly.slice(3);
  }
  // 14 číslic → 00420 (5) + číslo (9)
  if (digitsOnly.length === 14 && /^00420[2-9]/.test(digitsOnly)) {
    return digitsOnly.slice(5);
  }

  return 'N/A';
}

/**
 * Extrakce emailu z textu
 */
export function extractEmail(text) {
  if (!text) return null;
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Parsování ceny z textu
 */
export function parsePrice(text) {
  if (!text) return 0;
  const cleaned = text.replace(/\s/g, '').replace(/[^0-9]/g, '');
  const price = parseInt(cleaned);
  return (price && price > 0) ? price : 0;
}

/**
 * Určení typu nabídky z textu/URL
 */
export function parseOfferType(text) {
  if (!text) return 'prodej';
  const lower = text.toLowerCase();

  if (lower.includes('pronájem') || lower.includes('pronajem') ||
      lower.includes('podnájem') || lower.includes('rent') ||
      lower.includes('k pronájmu') || lower.includes('/pronajem/')) {
    return 'pronajem';
  }
  return 'prodej';
}

/**
 * Určení typu nemovitosti z textu/URL
 */
export function parsePropertyType(text) {
  if (!text) return 'jine';
  const lower = text.toLowerCase();

  const types = [
    { keywords: ['byt', 'bytu', 'byty', 'apartmán'], type: 'byt' },
    { keywords: ['dům', 'dum', 'domy', 'rodinný dům', 'rodinny dum', 'vila'], type: 'dum' },
    { keywords: ['pozemek', 'pozemky', 'parcela', 'stavební pozemek'], type: 'pozemek' },
    { keywords: ['chata', 'chaty', 'chalupa', 'chalupy', 'rekreační'], type: 'chata' },
    { keywords: ['garáž', 'garaz', 'garážové', 'parking'], type: 'garaz' },
    { keywords: ['komerční', 'komerčn', 'kancelář', 'obchod', 'sklad', 'provozovna'], type: 'komerce' },
  ];

  for (const { keywords, type } of types) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return type;
    }
  }
  return 'jine';
}

/**
 * Parsování dispozice z textu
 */
export function parseDisposition(text) {
  if (!text) return null;
  // Hledáme vzory jako 1+1, 2+kk, 3+1, 4+kk, 5+1, atd.
  const match = text.match(/(\d)\s*\+\s*(kk|kt|\d)/i);
  return match ? match[0].replace(/\s/g, '') : null;
}

/**
 * Parsování plochy z textu
 */
export function parseArea(text) {
  if (!text) return null;
  // Hledáme číslo před "m2" nebo "m²"
  const match = text.match(/(\d+)\s*(?:m[²2]|m\s*2)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Mapa krajů ČR s okresy
 */
const REGIONS_MAP = {
  'praha': { region: 'Praha', district: 'Praha' },
  'středočeský': { region: 'Středočeský kraj' },
  'jihočeský': { region: 'Jihočeský kraj' },
  'plzeňský': { region: 'Plzeňský kraj' },
  'karlovarský': { region: 'Karlovarský kraj' },
  'ústecký': { region: 'Ústecký kraj' },
  'liberecký': { region: 'Liberecký kraj' },
  'královéhradecký': { region: 'Královéhradecký kraj' },
  'pardubický': { region: 'Pardubický kraj' },
  'vysočina': { region: 'Kraj Vysočina' },
  'jihomoravský': { region: 'Jihomoravský kraj' },
  'olomoucký': { region: 'Olomoucký kraj' },
  'zlínský': { region: 'Zlínský kraj' },
  'moravskoslezský': { region: 'Moravskoslezský kraj' },
  // Zkrácené verze
  'brno': { region: 'Jihomoravský kraj', district: 'Brno-město', city: 'Brno' },
  'ostrava': { region: 'Moravskoslezský kraj', district: 'Ostrava-město', city: 'Ostrava' },
  'plzeň': { region: 'Plzeňský kraj', district: 'Plzeň-město', city: 'Plzeň' },
  'olomouc': { region: 'Olomoucký kraj', district: 'Olomouc', city: 'Olomouc' },
  'liberec': { region: 'Liberecký kraj', district: 'Liberec', city: 'Liberec' },
  'hradec králové': { region: 'Královéhradecký kraj', district: 'Hradec Králové', city: 'Hradec Králové' },
  'pardubice': { region: 'Pardubický kraj', district: 'Pardubice', city: 'Pardubice' },
  'zlín': { region: 'Zlínský kraj', district: 'Zlín', city: 'Zlín' },
  'české budějovice': { region: 'Jihočeský kraj', district: 'České Budějovice', city: 'České Budějovice' },
  'karlovy vary': { region: 'Karlovarský kraj', district: 'Karlovy Vary', city: 'Karlovy Vary' },
  'ústí nad labem': { region: 'Ústecký kraj', district: 'Ústí nad Labem', city: 'Ústí nad Labem' },
  'jihlava': { region: 'Kraj Vysočina', district: 'Jihlava', city: 'Jihlava' },
};

/**
 * Parsování lokality na kraj/okres/město
 */
export function parseLocation(locationText) {
  if (!locationText) return { region: null, district: null, city: null };

  const lower = locationText.toLowerCase().trim();
  const result = { region: null, district: null, city: null };

  // Zkus přesnou shodu s mapou pro názvy (města/kraje)
  for (const [key, data] of Object.entries(REGIONS_MAP)) {
    if (lower.includes(key)) {
      result.region = data.region || result.region;
      result.district = data.district || result.district;
      result.city = data.city || result.city;
    }
  }

  // Detekce PSČ (Bazoš často uvádí "110 00", "602 00")
  const pscMatch = locationText.match(/\b(\d{3})\s*(\d{2})\b/);
  if (pscMatch) {
    const pscPrefix = pscMatch[1];
    // Jednoduché mapování dle prvních dvou číslic PSČ (orientační B2B zlepšení)
    if (pscPrefix.startsWith('1')) { result.region = 'Praha'; result.district = 'Praha'; }
    else if (pscPrefix.startsWith('2')) { result.region = 'Středočeský kraj'; }
    else if (pscPrefix.startsWith('3')) { 
      result.region = pscPrefix.startsWith('36') || pscPrefix.startsWith('35') ? 'Karlovarský kraj' : (pscPrefix.startsWith('33') || pscPrefix.startsWith('34') ? 'Plzeňský kraj' : 'Jihočeský kraj'); 
    }
    else if (pscPrefix.startsWith('4')) { result.region = pscPrefix.startsWith('46') || pscPrefix.startsWith('47') ? 'Liberecký kraj' : 'Ústecký kraj'; }
    else if (pscPrefix.startsWith('5')) { 
      result.region = pscPrefix.startsWith('58') || pscPrefix.startsWith('59') ? 'Kraj Vysočina' : (pscPrefix.startsWith('53') ? 'Pardubický kraj' : 'Královéhradecký kraj');
    }
    else if (pscPrefix.startsWith('6')) { result.region = 'Jihomoravský kraj'; }
    else if (pscPrefix.startsWith('7')) { 
      result.region = pscPrefix.startsWith('73') || pscPrefix.startsWith('74') ? 'Moravskoslezský kraj' : (pscPrefix.startsWith('76') ? 'Zlínský kraj' : 'Olomoucký kraj');
    }
  }

  // Pokud město nebylo nalezeno, použij první část lokality
  if (!result.city) {
    const parts = locationText.split(/[,\-\/]/).map(p => p.trim());
    if (parts.length > 0 && parts[0].length > 1) {
      result.city = parts[0];
    }
  }

  // Pokud je okres v textu, parsuj ho
  const districtMatch = locationText.match(/okres\s+(.+?)(?:\s*[,\-]|$)/i);
  if (districtMatch && !result.district) {
    result.district = districtMatch[1].trim();
  }

  return result;
}

/**
 * Vytvoří standardní ad objekt ze surových dat
 */
export function createAdObject(data) {
  const locationInfo = parseLocation(data.location || '');

  return {
    id: data.id || generateId(data.url),
    source: data.source,
    url: data.url,
    title: (data.title || '').trim(),
    description: (data.description || data.title || '').trim(),
    offer_type: data.offer_type || parseOfferType((data.url || '') + ' ' + (data.title || '')),
    property_type: data.property_type || parsePropertyType((data.title || '') + ' ' + (data.description || '')),
    disposition: data.disposition || parseDisposition((data.title || '') + ' ' + (data.description || '')),
    area_m2: data.area_m2 || parseArea((data.title || '') + ' ' + (data.description || '')),
    price: data.price || 0,
    currency: data.currency || 'CZK',
    location: data.location || '',
    region: data.region || locationInfo.region,
    district: data.district || locationInfo.district,
    city: data.city || locationInfo.city,
    phone: data.phone || 'N/A',
    email: data.email || null,
    advertiser_name: data.advertiser_name || null,
    ad_published_date: data.ad_published_date || null,
    raw_data: data.raw_data || null,
  };
}
