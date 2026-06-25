// ============================================
// Project Spectre — Main Worker Entry Point
// Cloudflare Worker s cron triggers a API endpointy
// ============================================

import { scrape as scrapeBazos } from './modules/bazos.js';
import { scrape as scrapeBezrealitky } from './modules/bezrealitky.js';
import { scrape as scrapeAvizo } from './modules/avizo.js';
import { scrape as scrapeAnnonce } from './modules/annonce.js';
import { scrape as scrapeHyperinzerce } from './modules/hyperinzerce.js';
import { scrape as scrapeKuprealitu } from './modules/kuprealitu.js';
import { scrape as scrapeRealizujte } from './modules/realizujte.js';
import { scrape as scrapeMujrealitak } from './modules/mujrealitak.js';
import { scrape as scrapeSbazar } from './modules/sbazar.js';
import { processUrl, processText } from './modules/sbazar.js';
import { processApifyPost } from './modules/facebook_apify.js';
import {
  saveLead, getStats, getStatsBySource, getStatsByRegion,
  getSourcesStatus, updateSourceStatus, saveScrapeLog,
  postProcessCycle, getLeads, getRecentLogs
} from './db.js';
import { calculateScores, resetRulesCache } from './scoring.js';
import { syncToSheets, updateDashboard } from './sheets.js';
import { renderDashboard } from './dashboard.js';

// Mapa zdrojů → scraper funkce
const SCRAPERS = {
  bazos: scrapeBazos,
  bezrealitky: scrapeBezrealitky,
  avizo: scrapeAvizo,
  annonce: scrapeAnnonce,
  hyperinzerce: scrapeHyperinzerce,
  kuprealitu: scrapeKuprealitu,
  realizujte: scrapeRealizujte,
  mujrealitak: scrapeMujrealitak,
  sbazar: scrapeSbazar,
};

/**
 * Zpracuje výsledky jednoho scraperu — scoring + uložení
 */
async function processScraperResult(db, result) {
  const { ads, errors, source } = result;
  const startTime = Date.now();
  let newCount = 0, updatedCount = 0, duplicateCount = 0;

  for (const ad of ads) {
    try {
      // Scoring
      const scores = await calculateScores(db, ad);
      ad.realitka_score = scores.realitkaScore;
      ad.private_score = scores.privateScore;
      ad.advertiser_type = scores.advertiserType;

      // Automaticky označit bez telefonu
      if (!ad.phone || ad.phone === 'N/A') {
        ad.status = 'bez_telefonu';
      }

      // Uložit
      const saveResult = await saveLead(db, ad);
      if (saveResult.action === 'new') newCount++;
      else if (saveResult.action === 'updated') updatedCount++;
      else if (saveResult.action === 'duplicate') duplicateCount++;
    } catch (e) {
      console.error(`Error processing ad ${ad.url}: ${e.message}`);
    }
  }

  const duration = Date.now() - startTime;

  return {
    source,
    processed: ads.length,
    new_leads: newCount,
    updated_leads: updatedCount,
    duplicates: duplicateCount,
    errors: errors.length > 0 ? errors.join('; ') : null,
    duration_ms: duration,
  };
}

export default {
  /**
   * Cron Trigger — automatický scrape cyklus
   */
  async scheduled(event, env, ctx) {
    console.log('=== SPECTRE SCRAPE CYCLE STARTED ===');
    const cycleStart = Date.now();
    resetRulesCache();

    // Načti konfiguraci zdrojů
    const sources = await getSourcesStatus(env.DB);
    const enabledSources = sources.filter(s => s.enabled && s.scrape_method !== 'manual');

    const results = [];
    const allNewLeads = [];

    for (const sourceConfig of enabledSources) {
      const scraperFn = SCRAPERS[sourceConfig.source_name];
      if (!scraperFn) {
        console.warn(`No scraper found for source: ${sourceConfig.source_name}`);
        continue;
      }

      console.log(`--- Scraping: ${sourceConfig.display_name} ---`);

      try {
        const scrapeResult = await scraperFn();
        const processResult = await processScraperResult(env.DB, scrapeResult);

        // Log výsledek
        await saveScrapeLog(env.DB, processResult);
        await updateSourceStatus(env.DB, sourceConfig.source_name, true, null, processResult.new_leads);

        results.push(processResult);

        // Sbírej nové leady pro Sheets sync
        if (processResult.new_leads > 0) {
          const newLeads = await env.DB.prepare(`
            SELECT * FROM leads
            WHERE source = ? AND first_seen >= datetime('now', '-1 hour')
            ORDER BY first_seen DESC
            LIMIT 100
          `).bind(sourceConfig.source_name).all();

          if (newLeads.results) {
            allNewLeads.push(...newLeads.results);
          }
        }
      } catch (e) {
        console.error(`Scraper ${sourceConfig.source_name} failed:`, e);
        await updateSourceStatus(env.DB, sourceConfig.source_name, false, e.message);
        await saveScrapeLog(env.DB, {
          source: sourceConfig.source_name,
          processed: 0,
          new_leads: 0,
          errors: e.message,
          duration_ms: 0,
        });
      }
    }

    // Post-processing: duplicate counts + phone frequency
    await postProcessCycle(env.DB);

    // Google Sheets sync
    if (allNewLeads.length > 0) {
      try {
        await syncToSheets(env, allNewLeads);
      } catch (e) {
        console.error('Sheets sync failed:', e);
      }
    }

    // Dashboard update
    try {
      const stats = await getStats(env.DB);
      const sourceStats = await getStatsBySource(env.DB);
      const regionStats = await getStatsByRegion(env.DB);
      await updateDashboard(env, stats, sourceStats, regionStats);
    } catch (e) {
      console.error('Dashboard update failed:', e);
    }

    const totalDuration = Date.now() - cycleStart;
    const totalNew = results.reduce((sum, r) => sum + r.new_leads, 0);
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);

    console.log('=== SPECTRE CYCLE FINISHED ===');
    console.log(`Processed: ${totalProcessed} | New: ${totalNew} | Duration: ${totalDuration}ms`);

    return { success: true, results, totalNew, totalProcessed, duration: totalDuration };
  },

  /**
   * HTTP Request Handler — API endpointy
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // === GET / — Status stránka ===
      if (path === '/' && request.method === 'GET') {
        return new Response(
          'Project Spectre is running. Go to /dashboard for overview, /run to trigger scrape.',
          { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        );
      }

      // === GET /dashboard — HTML dashboard ===
      if (path === '/dashboard' && request.method === 'GET') {
        const stats = await getStats(env.DB);
        const sourceStats = await getStatsBySource(env.DB);
        const regionStats = await getStatsByRegion(env.DB);
        const recentLogs = await getRecentLogs(env.DB);
        const sourcesStatus = await getSourcesStatus(env.DB);

        const html = renderDashboard(stats, sourceStats, regionStats, recentLogs, sourcesStatus);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // === GET /run — Manuální spuštění celého cyklu ===
      if (path === '/run' && request.method === 'GET') {
        const result = await this.scheduled(null, env, null);
        return jsonResponse(result);
      }

      // === GET /run/:source — Spuštění konkrétního zdroje ===
      const runMatch = path.match(/^\/run\/(\w+)$/);
      if (runMatch && request.method === 'GET') {
        const sourceName = runMatch[1];
        const scraperFn = SCRAPERS[sourceName];

        if (!scraperFn) {
          return jsonResponse({ error: `Unknown source: ${sourceName}` }, 404);
        }

        resetRulesCache();
        const scrapeResult = await scraperFn();
        const processResult = await processScraperResult(env.DB, scrapeResult);
        await saveScrapeLog(env.DB, processResult);
        await updateSourceStatus(env.DB, sourceName, true, null, processResult.new_leads);
        await postProcessCycle(env.DB);

        return jsonResponse(processResult);
      }

      // === GET /stats — JSON statistiky ===
      if (path === '/stats' && request.method === 'GET') {
        const stats = await getStats(env.DB);
        return jsonResponse(stats);
      }

      // === GET /stats/sources — Stav zdrojů ===
      if (path === '/stats/sources' && request.method === 'GET') {
        const sources = await getSourcesStatus(env.DB);
        return jsonResponse(sources);
      }

      // === GET /stats/regions — Statistiky podle krajů ===
      if (path === '/stats/regions' && request.method === 'GET') {
        const regions = await getStatsByRegion(env.DB);
        return jsonResponse(regions);
      }

      // === GET /leads — Filtrované leady ===
      if (path === '/leads' && request.method === 'GET') {
        const filters = Object.fromEntries(url.searchParams.entries());
        const leads = await getLeads(env.DB, filters);
        return jsonResponse({ count: leads.length, leads });
      }

      // === POST /manual — Ruční import ===
      if (path === '/manual' && request.method === 'POST') {
        const body = await request.json();

        let result;
        if (body.url) {
          // Import z URL
          result = await processUrl(body.url);
        } else {
          // Import z textu
          result = processText(body);
        }

        // Scoring + uložení
        const processed = await processScraperResult(env.DB, result);
        return jsonResponse(processed);
      }

      // === POST /sheets/sync — Manuální sync do Sheets ===
      if (path === '/sheets/sync' && request.method === 'POST') {
        const leads = await getLeads(env.DB, { status: 'novy', limit: '500' });
        const syncResult = await syncToSheets(env, leads);

        const stats = await getStats(env.DB);
        const sourceStats = await getStatsBySource(env.DB);
        const regionStats = await getStatsByRegion(env.DB);
        await updateDashboard(env, stats, sourceStats, regionStats);

        return jsonResponse(syncResult);
      }

      // === POST /webhook/apify — Příjem dat z Apify (Facebook skupiny) ===
      if (path === '/webhook/apify' && request.method === 'POST') {
        const body = await request.json();
        // Apify dataset typicky posílá array nebo objekt s items
        const items = Array.isArray(body) ? body : (body.items || [body]);
        
        const ads = items.map(processApifyPost).filter(Boolean);
        if (ads.length > 0) {
          const processResult = await processScraperResult(env.DB, { ads, errors: [], source: 'facebook' });
          await saveScrapeLog(env.DB, processResult);
          await updateSourceStatus(env.DB, 'facebook_apify', true, null, processResult.new_leads);
          await postProcessCycle(env.DB);
          return jsonResponse(processResult);
        }
        return jsonResponse({ source: 'facebook', processed: 0, message: 'No valid ads found in payload' });
      }

      // === 404 ===
      return jsonResponse({ error: 'Not found', endpoints: [
        'GET /', 'GET /dashboard', 'GET /run', 'GET /run/:source',
        'GET /stats', 'GET /stats/sources', 'GET /stats/regions',
        'GET /leads?source=&status=&region=&city=&offer_type=&property_type=&price_min=&price_max=&advertiser_type=&limit=&offset=',
        'POST /manual', 'POST /sheets/sync', 'POST /webhook/apify'
      ]}, 404);

    } catch (error) {
      console.error('Request error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    }
  });
}