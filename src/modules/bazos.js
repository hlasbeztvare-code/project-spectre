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
    throw new Error(Bazos fetch failed: ${ response.status } ${ url });
  }
  return await response.text();
}

function calculateScores(ad) {
  let realitkaScore = 0;
  let privateScore = 0;
  const text = (ad.title + ' ' + ad.description).toLowerCase();

  // Realitka znaky
  if (text.includes('realitní kancelář')  text.includes('rk ')  text.includes('makléř')
  text.includes('provize')  text.includes('exkluzivně')  text.includes('naše společnost')) {
    realitkaScore += 40;
  }
  if (ad.phone && ad.phone.length > 9) realitkaScore += 10; // delší čísla často firmy

  // Soukromník znaky
  if (text.includes('přímý majitel')  text.includes('bez rk')  text.includes('realitky nevolat')
  text.includes('vlastní')  text.includes('prodám sám')) {
    privateScore += 50;
  }

  return { realitkaScore, privateScore };
}

export async function scrape() {
  const ads = [];
  const baseUrl = 'https://reality.bazos.cz';

  try {
    // Základní stránka + 2 další stránky pro lepší pokrytí
    for (let page = 1; page <= 3; page++) {
      const url = page === 1 ? `${baseUrl}/` : `${baseUrl}/?p=${page}`;
      const html = await fetchWithProxy(url);
      const $ = cheerio.load(html);

      $('.inzeraty').each((i, el) => {
        const titleEl = $(el).find('.inzeratynadpis a');
        const title = titleEl.text().trim();
        if (!title) return;

        const url = baseUrl + titleEl.attr('href');
        const priceText = $(el).find('.inzeratycenad').text().replace(/[^0-9]/g, '');
        const location = $(el).find('.inzeratyokres').text().trim();
        const desc = $(el).find('.inzeratypopis').text().trim();

        // Základní extrakce telefonu (často v popisu)
        const phoneMatch = desc.match(/(\+420)?\s*([0-9]{3}\s*[0-9]{3}\s*[0-9]{3})/);
        const phone = phoneMatch ? phoneMatch[2].replace(/\s/g, '') : 'N/A';

        const ad = {
          id: Buffer.from(url).toString('base64').substring(0, 20),
          source: 'bazos',
          url,
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
        ad.advertiser_type = scores.privateScore > scores.realitkaScore ? 'soukromnik' : 'realitka';

        ads.push(ad);
      });
    }

    console.log(Bazos: nalezeno ${ ads.length } inzerátů);
    return ads;

  } catch (error) {
    console.error('Chyba při scrapování Bazos:', error);
    return [];
  }
}