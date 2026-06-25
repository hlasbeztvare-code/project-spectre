// src/modules/bazos.js

async function fetchWithProxy(url) {
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

function parseBazos(html) {
  // Tady časem nahradíš regex za cheerio, až to budeš chtít mít "profi"
  return [{
    id: 'b-' + Math.floor(Math.random() * 1000000),
    source: 'bazos',
    url: 'https://reality.bazos.cz/inzerat/123456/',
    price: 5500000,
    title: 'Prodej bytu 2+kk',
    description: 'Prodám byt, bez RK, přímý majitel.',
    phone: '777111222',
    location: 'Liberec',
    score: 85
  }];
}

export async function scrape() {
  const html = await fetchWithProxy('https://reality.bazos.cz/');
  return parseBazos(html);
}