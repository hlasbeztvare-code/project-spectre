// ============================================
// Project Spectre — HTML Dashboard
// Přehled funkčnosti systému
// ============================================

export function renderDashboard(stats, sourceStats, regionStats, recentLogs, sourcesStatus) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Spectre — Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e1e5ee;
      padding: 20px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      padding: 30px 0;
      border-bottom: 1px solid #2a2d3a;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .header .subtitle { color: #8892a4; font-size: 14px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }
    .card {
      background: #1a1d2e;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #2a2d3a;
    }
    .card .label { color: #8892a4; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .card .value { font-size: 32px; font-weight: 700; margin-top: 4px; }
    .card .value.green { color: #4ade80; }
    .card .value.blue { color: #60a5fa; }
    .card .value.orange { color: #fb923c; }
    .card .value.red { color: #f87171; }
    .card .value.purple { color: #a78bfa; }
    .section { margin-bottom: 30px; }
    .section h2 {
      font-size: 18px;
      color: #a78bfa;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #2a2d3a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #1a1d2e;
      border-radius: 12px;
      overflow: hidden;
    }
    th, td {
      padding: 10px 16px;
      text-align: left;
      border-bottom: 1px solid #2a2d3a;
      font-size: 14px;
    }
    th {
      background: #252838;
      color: #8892a4;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 1px;
    }
    tr:hover { background: #252838; }
    .status-ok { color: #4ade80; }
    .status-warn { color: #fb923c; }
    .status-error { color: #f87171; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge.active { background: #064e3b; color: #4ade80; }
    .badge.inactive { background: #450a0a; color: #f87171; }
    .badge.manual { background: #1e1b4b; color: #a78bfa; }
    .actions {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #2a2d3a;
    }
    .btn {
      display: inline-block;
      padding: 10px 24px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 0 8px;
      font-size: 14px;
    }
    .btn:hover { opacity: 0.9; }
    .btn.secondary { background: #2a2d3a; }
    .footer { text-align: center; color: #4a5068; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Project Spectre</h1>
    <p class="subtitle">Monitoring nemovitostních inzerátů — ${now}</p>
  </div>

  <div class="grid">
    <div class="card">
      <div class="label">Celkem leadů</div>
      <div class="value blue">${stats.total || 0}</div>
    </div>
    <div class="card">
      <div class="label">Nových (dnes)</div>
      <div class="value green">${stats.today_new || 0}</div>
    </div>
    <div class="card">
      <div class="label">Nových (týden)</div>
      <div class="value green">${stats.week_new || 0}</div>
    </div>
    <div class="card">
      <div class="label">Soukromníci</div>
      <div class="value green">${stats.private_count || 0}</div>
    </div>
    <div class="card">
      <div class="label">Realitky</div>
      <div class="value orange">${stats.realitka_count || 0}</div>
    </div>
    <div class="card">
      <div class="label">Neznámé</div>
      <div class="value purple">${stats.unknown_count || 0}</div>
    </div>
    <div class="card">
      <div class="label">Duplicity</div>
      <div class="value red">${stats.duplicate_count || 0}</div>
    </div>
    <div class="card">
      <div class="label">Bez telefonu</div>
      <div class="value red">${stats.no_phone_count || 0}</div>
    </div>
  </div>

  <div class="section">
    <h2>Statistiky podle zdrojů</h2>
    <table>
      <thead>
        <tr><th>Zdroj</th><th>Celkem</th><th>Nové</th><th>Soukromníci</th><th>Realitky</th><th>S telefonem</th></tr>
      </thead>
      <tbody>
        ${(sourceStats || []).map(s => `
          <tr>
            <td><strong>${s.source}</strong></td>
            <td>${s.total}</td>
            <td>${s.new_leads}</td>
            <td class="status-ok">${s.private_count}</td>
            <td class="status-warn">${s.realitka_count}</td>
            <td>${s.with_phone}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Statistiky podle krajů</h2>
    <table>
      <thead>
        <tr><th>Kraj</th><th>Celkem</th><th>Soukromníci</th></tr>
      </thead>
      <tbody>
        ${(regionStats || []).map(r => `
          <tr>
            <td>${r.region}</td>
            <td>${r.total}</td>
            <td class="status-ok">${r.private_count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Stav zdrojů</h2>
    <table>
      <thead>
        <tr><th>Zdroj</th><th>Stav</th><th>Metoda</th><th>Priorita</th><th>Poslední úspěch</th><th>Celkem běhů</th><th>Celkem leadů</th><th>Chyba</th></tr>
      </thead>
      <tbody>
        ${(sourcesStatus || []).map(s => `
          <tr>
            <td><strong>${s.display_name}</strong></td>
            <td><span class="badge ${s.enabled ? 'active' : 'inactive'}">${s.enabled ? 'Aktivní' : 'Neaktivní'}</span></td>
            <td><span class="badge ${s.scrape_method === 'manual' ? 'manual' : 'active'}">${s.scrape_method}</span></td>
            <td>${s.priority}</td>
            <td>${s.last_success ? s.last_success.replace('T', ' ').substring(0, 19) : '—'}</td>
            <td>${s.total_runs}</td>
            <td>${s.total_leads}</td>
            <td class="${s.last_error ? 'status-error' : ''}">${s.last_error || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Poslední běhy</h2>
    <table>
      <thead>
        <tr><th>Čas</th><th>Zdroj</th><th>Zpracováno</th><th>Nové</th><th>Aktualizováno</th><th>Duplicity</th><th>Trvání</th><th>Chyby</th></tr>
      </thead>
      <tbody>
        ${(recentLogs || []).map(l => `
          <tr>
            <td>${(l.run_time || '').replace('T', ' ').substring(0, 19)}</td>
            <td>${l.source}</td>
            <td>${l.processed}</td>
            <td class="status-ok">${l.new_leads}</td>
            <td>${l.updated_leads || 0}</td>
            <td>${l.duplicates || 0}</td>
            <td>${l.duration_ms}ms</td>
            <td class="${l.errors ? 'status-error' : ''}">${l.errors ? 'CHYBA' : 'OK'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="actions">
    <a href="/run" class="btn">Spustit scrape</a>
    <a href="/stats" class="btn secondary">JSON stats</a>
    <a href="/stats/sources" class="btn secondary">Stav zdrojů</a>
  </div>

  <div class="footer">
    <p>Project Spectre v1.0 — L-Code Dynamics © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
}
