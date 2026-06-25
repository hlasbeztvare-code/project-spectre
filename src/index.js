import { scrape as scrapeBazos } from './modules/bazos.js';
import { saveLead } from './db.js';

export default {
  async scheduled(event, env, ctx) {
    // Tady můžeš snadno přidávat další moduly
    const modules = [scrapeBazos];

    for (const scrapeModule of modules) {
      try {
        const ads = await scrapeModule();
        for (const ad of ads) {
          if (ad.score >= 50) await saveLead(env.DB, ad);
        }
      } catch (e) {
        console.error("Chyba v modulu:", e);
      }
    }
  },

  async fetch(request, env) {
    await this.scheduled(null, env, null);
    return new Response("Spectre cyklus dokončen.");
  }
};