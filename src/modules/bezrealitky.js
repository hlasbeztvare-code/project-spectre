import * as cheerio from 'cheerio';

async function fetchWithProxy(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'cs-CZ,cs;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(Bezrealitky fetch failed: ${ response.status } ${ url });
  }
  return await response.text();
}

function calculateScores(ad) {
  let realitkaScore = 0;
  let privateScore = 0;
  const text = (ad.title + ' ' + ad.description).toLowerCase();

  // Realitka znaky
  if (text.includes('realitní')  text.includes('rk ')  text.includes('makléř')
  text.includes('provize')  text.includes('exkluzivně')  text.includes('nabízíme')) {
    realitkaScore += 35;
  }
  if (ad.phone && ad.phone.length > 9) realitkaScore += 15;

  // Soukromník znaky
  if (text.includes('přímý majitel')  text.includes('bez realitky')
  text.includes('prodám sám')  text.includes('vlastník')  text.includes('nevolat realitky')) {
    privateScore += 45;
  }

  return { realitkaScore, privateScore };
}

export async function scrape() {
  const ads = [];
  const baseUrl = 'https://www.bezrealitky.cz';

  try {
    // Hlavní stránka nemovitostí
    const urls = [
      `${baseUrl}/prodej/byty/`,
      `${baseUrl}/prodej/domy/`,
      `${baseUrl}/pronajem/byty/`
    ];

    for (const url of urls) {
      const html = await fetchWithProxy(url);
      const $ = cheerio.load(html);

      // Hlavní selektory pro Bezrealitky
      $('.property').each((i, el) => {
        const titleEl = $(el).find('h2 a, .property-title a');
        const title = titleEl.text().trim();
        if (!title) return;

        const relativeUrl = titleEl.attr('href');
        const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : baseUrl + relativeUrl;

        const priceText = $(el).find('.price, .property-price').text().replace(/[^0-9]/g, '');
        const location = $(el).find('.location, .property-location').text().trim();
        const desc = $(el).find('.description, .property-description').text().trim();

        // Telefon - často v detailu, ale zkusíme z popisu
        const phoneMatch = (desc + title).match(/(\+420)?\s*([0-9]{3}\s*[0-9]{3}\s*[0-9]{3})/);
        const phone = phoneMatch ? phoneMatch[2].replace(/\s/g, '') : 'N/A';

        const ad = {
          id: Buffer.from(fullUrl).toString('base64').substring(0, 20),
          source: 'bezrealitky',
          url: fullUrl,
          title,
          description: desc  title,
          price: parseInt(priceText) || 0,
          location,
          phone,
          raw_data: JSON.stringify({ originalDesc: desc })
        };

        const scores = calculateScores(ad);
        ad.realitka_score = scores.realitkaScore;
        ad.private_score = scores.privateScore;
        ad.advertiser_type = scores.privateScore > 30 ? 'soukromnik' : 'realitka';

        ads.push(ad);
      });
    }

    console.log(Bezrealitky: nalezeno ${ ads.length } inzerátů);
    return ads;

  } catch (error) {
    console.error('Chyba při scrapování Bezrealitky:', error);
    return [];
  }
}