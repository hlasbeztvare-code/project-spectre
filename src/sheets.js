// ============================================
// Project Spectre — Google Sheets Integration
// JWT autentizace přes Web Crypto API
// (googleapis SDK nefunguje v CF Workers)
// ============================================

/**
 * Vytvoří JWT token pro Google Service Account
 */
async function createJWT(serviceAccount) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const pemKey = serviceAccount.private_key;
  const pemBody = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64urlEncode(new Uint8Array(signature));
  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Base64url encoding
 */
function base64urlEncode(data) {
  let base64;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    // Uint8Array
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Získá access token z Google OAuth2
 */
async function getAccessToken(serviceAccount) {
  const jwt = await createJWT(serviceAccount);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Cache pro access token
let tokenCache = { token: null, expires: 0 };

/**
 * Získá token s cache
 */
async function getCachedToken(serviceAccount) {
  if (tokenCache.token && Date.now() < tokenCache.expires) {
    return tokenCache.token;
  }

  const token = await getAccessToken(serviceAccount);
  tokenCache = { token, expires: Date.now() + 3500 * 1000 }; // 58 minut
  return token;
}

/**
 * Volání Google Sheets API s exponential backoff (Self-Healing anti-rate-limit)
 */
async function sheetsRequest(token, spreadsheetId, endpoint, method = 'GET', body = null, retries = 3) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${endpoint}`;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 429 || response.status >= 500) {
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      console.warn(`Sheets API rate limit/error (status ${response.status}). Retrying in ${Math.round(delay)}ms...`);
      await new Promise(res => setTimeout(res, delay));
      continue;
    }

    const error = await response.text();
    throw new Error(`Sheets API error: ${response.status} ${error}`);
  }
  throw new Error(`Sheets API failed after ${retries} retries`);
}

// ============================================
// Hlavní export funkce
// ============================================

// Názvy sloupců dle specifikace klienta
const SHEET_HEADERS = [
  'Datum nalezení', 'Zdroj', 'URL', 'Typ nabídky', 'Typ nemovitosti',
  'Dispozice', 'Plocha m²', 'Lokalita', 'Kraj', 'Okres', 'Město',
  'Cena', 'Měna', 'Telefon', 'E-mail', 'Jméno inzerenta',
  'Soukromník (A/N)', 'Realitka (A/N)', 'Skóre realitky', 'Skóre soukromníka',
  'Typ inzerenta', 'Stav', 'Poznámka', 'Přiřazeno komu',
  'Datum kontaktování', 'Výsledek kontaktu', 'Počet duplicit',
  'ID záznamu'
];

const SHEET_NAME = 'Leady';
const DASHBOARD_SHEET = 'Dashboard';

/**
 * Konvertuje lead na řádek pro Google Sheet
 */
function leadToRow(lead) {
  return [
    lead.first_seen || '',
    lead.source || '',
    lead.url || '',
    lead.offer_type === 'pronajem' ? 'Pronájem' : 'Prodej',
    formatPropertyType(lead.property_type),
    lead.disposition || '',
    lead.area_m2 || '',
    lead.location || '',
    lead.region || '',
    lead.district || '',
    lead.city || '',
    lead.price || 0,
    lead.currency || 'CZK',
    lead.phone || '',
    lead.email || '',
    lead.advertiser_name || '',
    lead.private_score >= 30 ? 'ANO' : 'NE',
    lead.realitka_score >= 61 ? 'ANO' : 'NE',
    lead.realitka_score || 0,
    lead.private_score || 0,
    formatAdvertiserType(lead.advertiser_type),
    formatStatus(lead.status),
    lead.note || '',
    lead.assigned_to || '',
    lead.contact_date || '',
    lead.contact_result || '',
    lead.duplicate_count || 0,
    lead.id || '',
  ];
}

function formatPropertyType(type) {
  const map = {
    'byt': 'Byt', 'dum': 'Dům', 'pozemek': 'Pozemek',
    'chata': 'Chata/Chalupa', 'garaz': 'Garáž',
    'komerce': 'Komerční', 'jine': 'Jiné',
  };
  return map[type] || type || 'Jiné';
}

function formatAdvertiserType(type) {
  const map = {
    'soukromnik': 'Soukromník', 'realitka': 'Realitka', 'neznamo': 'Neznámé',
  };
  return map[type] || type || 'Neznámé';
}

function formatStatus(status) {
  const map = {
    'novy': 'Nový', 'pripraveno': 'Připraveno k provolání',
    'volano': 'Voláno', 'nedovolano': 'Nedovoláno',
    'dovolat_pozdeji': 'Dovolat později', 'nema_zajem': 'Nemá zájem',
    'ma_zajem': 'Má zájem', 'predano_makleri': 'Předáno makléři',
    'duplicitni': 'Duplicitní', 'realitka': 'Realitka',
    'bez_telefonu': 'Bez telefonu', 'nerelevantni': 'Nerelevantní',
    'archiv': 'Archiv',
  };
  return map[status] || status || 'Nový';
}

/**
 * Sync leadů do Google Sheetu
 * - Nové leady přidá na konec
 * - Existující leady aktualizuje (hledá podle URL)
 */
export async function syncToSheets(env, leads) {
  if (!env.GCP_SERVICE_ACCOUNT || !env.GOOGLE_SHEET_ID) {
    console.warn('Google Sheets: credentials not configured, skipping sync');
    return { synced: 0, error: 'credentials not configured' };
  }

  // Pouze synchronizovat leady, které mají platné telefonní číslo
  const filteredLeads = leads.filter(lead => lead.phone && lead.phone !== 'N/A' && lead.phone !== '');
  if (filteredLeads.length === 0) {
    console.log('Google Sheets sync: Žádné nové leady s telefonním číslem k synchronizaci.');
    return { synced: 0, new: 0, updated: 0 };
  }

  try {
    const serviceAccount = JSON.parse(env.GCP_SERVICE_ACCOUNT);
    const spreadsheetId = env.GOOGLE_SHEET_ID;
    console.log(`Starting syncToSheets for ${filteredLeads.length} leads. SpreadsheetId: ${spreadsheetId}`);
    const token = await getCachedToken(serviceAccount);
    console.log(`Got Google API token successfully`);

    // 1. Ověř/vytvoř sheet
    await ensureSheet(token, spreadsheetId);
    console.log(`ensureSheet passed`);

    // 2. Načti existující URL z sheetu (sloupec C = URL)
    let existingUrls = new Map();
    try {
      const existing = await sheetsRequest(
        token, spreadsheetId,
        `/values/${SHEET_NAME}!C:C`
      );
      if (existing.values) {
        existing.values.forEach((row, idx) => {
          if (idx > 0 && row[0]) { // Skip header
            existingUrls.set(row[0], idx + 1); // rowNumber (1-indexed)
          }
        });
      }
    } catch (e) {
      // Sheet might be empty
    }

    // 3. Rozděl na nové a aktualizace
    const newRows = [];
    const updates = [];

    for (const lead of filteredLeads) {
      const row = leadToRow(lead);
      const existingRow = existingUrls.get(lead.url);

      if (existingRow) {
        updates.push({ range: `${SHEET_NAME}!A${existingRow}`, row });
      } else {
        newRows.push(row);
      }
    }

    // 4. Batch append nových řádků
    if (newRows.length > 0) {
      console.log(`Appending ${newRows.length} new rows to sheets...`);
      const appendResult = await sheetsRequest(
        token, spreadsheetId,
        `/values/${SHEET_NAME}!A:AB:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        'POST',
        { values: newRows }
      );
      console.log(`Append result:`, JSON.stringify(appendResult));
    }

    // 5. Batch update existujících
    if (updates.length > 0) {
      const batchData = updates.map(u => ({
        range: u.range,
        values: [u.row],
      }));

      console.log(`Updating ${updates.length} existing rows in sheets...`);
      for (let i = 0; i < batchData.length; i += 100) {
        const chunk = batchData.slice(i, i + 100);
        const updateResult = await sheetsRequest(
          token, spreadsheetId,
          '/values:batchUpdate',
          'POST',
          {
            valueInputOption: 'USER_ENTERED',
            data: chunk,
          }
        );
        console.log(`Update chunk result:`, JSON.stringify(updateResult));
      }
    }

    console.log(`Sheets sync: ${newRows.length} new, ${updates.length} updated`);
    return { synced: newRows.length + updates.length, new: newRows.length, updated: updates.length };

  } catch (e) {
    console.error('CRITICAL ERROR IN syncToSheets:', e.message, e.stack);
    return { synced: 0, error: e.message };
  }
}

/**
 * Zajistí existenci sheetu s hlavičkou
 */
async function ensureSheet(token, spreadsheetId) {
  try {
    // Zkontroluj jestli sheet existuje
    const metadata = await sheetsRequest(token, spreadsheetId, '');
    const sheets = metadata.sheets || [];
    const hasLeadySheet = sheets.some(s => s.properties?.title === SHEET_NAME);
    const hasDashboardSheet = sheets.some(s => s.properties?.title === DASHBOARD_SHEET);

    const requests = [];

    if (!hasLeadySheet) {
      requests.push({
        addSheet: { properties: { title: SHEET_NAME } }
      });
    }

    if (!hasDashboardSheet) {
      requests.push({
        addSheet: { properties: { title: DASHBOARD_SHEET } }
      });
    }

    if (requests.length > 0) {
      await sheetsRequest(token, spreadsheetId, ':batchUpdate', 'POST', { requests });
    }

    // Ověř hlavičku
    const headerCheck = await sheetsRequest(
      token, spreadsheetId,
      `/values/${SHEET_NAME}!A1:AB1`
    );

    if (!headerCheck.values || headerCheck.values.length === 0) {
      // Napiš hlavičku
      await sheetsRequest(
        token, spreadsheetId,
        `/values/${SHEET_NAME}!A1:AB1?valueInputOption=USER_ENTERED`,
        'PUT',
        { values: [SHEET_HEADERS] }
      );
    }
  } catch (e) {
    console.error('Error ensuring sheet:', e);
  }
}

/**
 * Aktualizace Dashboard záložky v Google Sheetu (System Command Center)
 */
export async function updateDashboard(env, stats, sourceStats, regionStats, sourcesStatus = []) {
  if (!env.GCP_SERVICE_ACCOUNT || !env.GOOGLE_SHEET_ID) return;

  try {
    const serviceAccount = JSON.parse(env.GCP_SERVICE_ACCOUNT);
    const spreadsheetId = env.GOOGLE_SHEET_ID;
    const token = await getCachedToken(serviceAccount);

    // Zajistit existenci listů před zápisem
    await ensureSheet(token, spreadsheetId);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const dashboardData = [
      ["'=== ⚡ PROJECT SPECTRE — SYSTEM COMMAND CENTER ⚡ ===", '', '', '', ''],
      ['Poslední aktualizace:', now, '', '', ''],
      ['', '', '', '', ''],
      ["'=== 📊 CELKOVÉ STATISTIKY ===", '', '', '', ''],
      ['Celkem zpracováno:', stats.total || 0, '', '', ''],
      ['Nových leadů (dnes):', stats.today_new || 0, '', '', ''],
      ['Nových leadů (týden):', stats.week_new || 0, '', '', ''],
      ['Detekováno Soukromníků:', stats.private_count || 0, '', '', ''],
      ['Odfiltrováno RK:', stats.realitka_count || 0, '', '', ''],
      ['Duplicity (šetří čas):', stats.duplicate_count || 0, '', '', ''],
      ['', '', '', '', ''],
      ["'=== 🔴🟢 STATUS ZDROJŮ (HEALTH CHECK) ===", '', '', '', ''],
      ['Zdroj', 'Stav', 'Poslední běh', 'Nalezeno leadů', 'Poslední chyba'],
    ];

    for (const s of sourcesStatus) {
      const isOk = !s.last_error;
      const statusText = s.enabled ? (isOk ? '✅ OK' : '❌ CHYBA') : '⏸️ VYPNUTO';
      dashboardData.push([
        s.display_name || s.source_name,
        statusText,
        s.last_run || 'Nikdy',
        s.last_leads_found || 0,
        s.last_error || '-'
      ]);
    }

    dashboardData.push(['', '', '', '', '']);
    dashboardData.push(["'=== 🎯 VÝKONNOST PODLE ZDROJŮ ===", '', '', '', '']);
    dashboardData.push(['Zdroj', 'Celkem', 'Nové', 'Soukromníci', 'Realitky']);

    for (const s of sourceStats) {
      dashboardData.push([
        s.source, s.total, s.new_leads, s.private_count, s.realitka_count
      ]);
    }

    dashboardData.push(['', '', '', '', '']);
    dashboardData.push(["'=== 🗺️ VÝKONNOST PODLE KRAJŮ ===", '', '', '', '']);
    dashboardData.push(['Kraj', 'Celkem leadů', 'Z toho Soukromníci', '', '']);

    for (const r of regionStats) {
      dashboardData.push([r.region, r.total, r.private_count, '', '']);
    }

    // Čištění celého sheetu před zapsáním nových hodnot
    await sheetsRequest(
      token, spreadsheetId,
      `/values/${DASHBOARD_SHEET}!A1:Z100:clear`,
      'POST'
    );

    // Zápis hodnot
    await sheetsRequest(
      token, spreadsheetId,
      `/values/${DASHBOARD_SHEET}!A1:E${dashboardData.length}?valueInputOption=USER_ENTERED`,
      'PUT',
      { values: dashboardData }
    );

  } catch (error) {
    console.error('Dashboard Command Center update error:', error);
  }
}
