export async function fetchWithProxy(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'cs-CZ,cs;q=0.9',
      'Referer': 'https://www.google.com/'
    }
  });

  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  return await response.text();
}

export function parseBezrealitky(html) {
  return [{
    id: 'br-' + Math.floor(Math.random() * 1000000),
    source: 'bezrealitky',
    url: 'https://www.bezrealitky.cz/nemovitosti-byty-domy/12345',
    price: 6200000,
    title: 'Prodej bytu 3+kk',
    description: 'Krásný byt v centru bez provize.',
    phone: '777999888',
    location: 'Praha',
    score: 90
  }];
}

export async function scrape() {
  // const html = await fetchWithProxy('https://www.bezrealitky.cz/');
  // return parseBezrealitky(html);
  
  // Pro PoC rovnou vracíme mock data
  return parseBezrealitky("");
}

export default { scrape };
