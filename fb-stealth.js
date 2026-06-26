import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFileSync, writeFileSync } from 'fs';

// Inicializace Stealth Pluginu pro obejití Meta bot detekce
puppeteer.use(StealthPlugin());

// Náhodná lidská prodleva pro maskování (default: 2 - 5 sekund)
const delay = (min = 2000, max = 5000) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

const TARGET_GROUP_ID = process.env.FB_GROUP_ID;
// Fallback pole Facebook skupin, pokud není specifikováno v ENV
const GROUP_IDS = TARGET_GROUP_ID ? [TARGET_GROUP_ID] : [
  '308902856124756', // Spolubydlení Praha - Hard Target
  'bydleni.praha.bez.realitky',
  'byty.domy.bez.realitky'
];

const ENDPOINT = process.env.SPECTRE_API || 'https://project-spectre.hlancaric.workers.dev/api/incoming-lead';
const COOKIES_PATH = process.env.FB_COOKIES_PATH || './fb-cookies.json';

async function run() {
  console.log('🚀 Inicializace FB Stealth Satelitu...');
  
  let cookies = [];
  try {
    const cookiesJson = readFileSync(COOKIES_PATH, 'utf8');
    cookies = JSON.parse(cookiesJson);
    console.log('🍪 Cookies úspěšně načteny.');
  } catch (err) {
    console.error('❌ Chyba načítání cookies. Vytvoř soubor fb-cookies.json.', err.message);
    process.exit(1);
  }

  // Spuštění prohlížeče s optimalizacemi pro server
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled' // Dodatečná stealth vrstva
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Maskování za mobilní prohlížeč
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
    
    // Injekce auth cookies
    await page.setCookie(...cookies);
    
    for (const groupId of GROUP_IDS) {
      const TARGET_URL = `https://m.facebook.com/groups/${groupId}`;
      console.log(`\n🌐 Naviguji na Skupinu: ${TARGET_URL}...`);
      
      await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
      await delay(3000, 6000); // Simulace načítání React feedu uživatelem
      
      console.log('🕵️‍♂️ Parsuji feed...');
      
      const posts = await page.evaluate(() => {
        const textNodes = Array.from(document.querySelectorAll('.native-text'));
        
        let currentPostLines = [];
        const extracted = [];
        
        textNodes.forEach(el => {
          const text = el.innerText.trim();
          if (!text) return;
          
          currentPostLines.push(text);
          
          // ZPRÁVA a Přidejte komentář označují konec inzerátu na m.facebook.com
          if (text.includes('Přidejte komentář') || text.includes('ZPRÁVA')) {
            if (currentPostLines.length > 5) {
              // Filtrace balastu z návrhů FB
              const fullText = currentPostLines.join('\\n');
              if (!fullText.includes('Návrhy skupin pro vás')) {
                
                // Určení autora z předchozích řádků před časovým údajem (1 d, 2 h...)
                let author = currentPostLines[0];
                for (let j = 0; j < Math.min(5, currentPostLines.length); j++) {
                  if (currentPostLines[j].match(/^\\d+ (d|h|m)$/) || currentPostLines[j].includes('󲄭󳆢')) {
                    if (j > 0) author = currentPostLines[j - 1];
                    break;
                  }
                }
                
                // Odstranění vnitřních FB ikon a speciálních znaků z autora
                author = author.replace(/[󳃟󳄫󳇭󱡓󳉢󳅭󰍸󰍹󰍺]/g, '').trim();
                
                // Odstranění zbytečných prefixů a ikon z textu
                let cleanText = fullText.replace(/[󳃟󳄫󳇭󱡓󳉢󳅭󰍸󰍹󰍺]/g, '').replace(/Zobrazit další/g, '').trim();
                
                extracted.push({
                  author,
                  text: cleanText,
                  link: window.location.href
                });
              }
            }
            // Reset bufferu pro další inzerát
            currentPostLines = [];
          }
        });
        
        return extracted;
      });

      console.log(`✅ Nalezeno ${posts.length} smysluplných příspěvků.`);
      
      // Iterativní odesílání s lidskými prodlevami
      for (const post of posts) {
        console.log(`📤 Odesílám: Inzerát od ${post.author}`);
        
        const payload = {
          source: 'facebook',
          url: post.link,
          title: `FB Skupina (${groupId}): ${post.author}`,
          description: post.text,
          advertiser_name: post.author,
          raw_data: JSON.stringify({ importMethod: 'stealth_puppeteer', groupId })
        };
        
        try {
          const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if (response.ok) {
            console.log(`   ✔️  Úspěšně předáno Cloudflare (Project Spectre)`);
          } else {
            console.error(`   ❌ Selhání endpointu: ${response.status} ${response.statusText}`);
          }
        } catch (err) {
          console.error(`   ❌ Síťová chyba odeslání:`, err.message);
        }
        
        await delay(2000, 5000); // Bezpečnostní pauza
      }
      
      // Pauza před skokem do další skupiny, abychom neprovokovali bot ochranu
      if (groupId !== GROUP_IDS[GROUP_IDS.length - 1]) {
        console.log(`⏳ Čekám před přechodem na další skupinu...`);
        await delay(5000, 12000); 
      }
    }
    
  } catch (err) {
    console.error('❌ Kritická chyba:', err);
  } finally {
    console.log('\n🛑 Zhasínám Stealth instanci.');
    await browser.close();
  }
}

run();
