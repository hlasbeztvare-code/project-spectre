import * as cheerio from 'cheerio';

async function fetchWithProxy(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  return await response.text();
}

export async function scrape() {
  const html = await fetchWithProxy('https://reality.bazos.cz/');
  const $ = cheerio.load(html);
  const ads = [];

  $('.inzeraty').each((i, el) => {
    const title = $(el).find('.inzeratynadpis a').text().trim();
    if (!title) return;

    const url = 'https://reality.bazos.cz' + $(el).find('.inzeratynadpis a').attr('href');
    const price = $(el).find('.inzeratycenad').text().replace(/[^0-9]/g, '');
    const location = $(el).find('.inzeratyokres').text().trim();

    ads.push({
      id: Buffer.from(url).toString('base64').substring(0, 16),
      source: 'bazos',
      url,
      price: parseInt(price) || 0,
      title,
      description: title,
      phone: 'N/A',
      location,
      score: 80
    });
  });
  return ads;
}