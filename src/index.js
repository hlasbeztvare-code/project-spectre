import { scrape as scrapeBazos } from './modules/bazos.js';
import { scrape as scrapeBezrealitky } from './modules/bezrealitky.js';
import { saveLead, getStats } from './db.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('=== SPECTRE SCRAPE CYCLE STARTED ===');
    const startTime = Date.now();

    const modules = [
      scrapeBazos,
      scrapeBezrealitky
      // přidáváš další moduly sem
    ];

    let totalNew = 0;
    let totalProcessed = 0;

    for (const scrapeModule of modules) {
      try {
        const ads = await scrapeModule();
        totalProcessed += ads.length;

        for (const ad of ads) {
          // Filtrujeme jen slušné leady
          if (ad.realitka_score < 70) {  // preferujeme potenciální soukromníky
            const result = await saveLead(env.DB, ad);
            if (result.action === 'new') totalNew++;
          }
        }
      } catch (e) {
        console.error("Chyba v modulu:", e);
      }
    }

    const duration = Date.now() - startTime;
    const stats = await getStats(env.DB);

    console.log(=== SPECTRE CYCLE FINISHED ===);
    console.log(Processed: ${ totalProcessed } | New leads: ${ totalNew } | Duration: ${ duration }ms);

    // TODO: Tady později přidáme push do Google Sheets
    return { success: true, newLeads: totalNew, stats };
  },

  // Pro manuální spuštění přes URL
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/run') {
      const result = await this.scheduled(null, env, null);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Project Spectre is running. Go to /run to trigger scrape.', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};