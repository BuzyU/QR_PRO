import { navigate, state } from '../app.js';
import { wakeServer, getTickets, resendEmail, getQueueStats, exportTickets } from '../utils/api.js';

let serverStatus = 'unknown';

export function renderAdmin(container) {
  container.innerHTML += `
    </div>
    <div class="page-container">
      <div style="max-width:900px;margin:0 auto;">
        <div class="flex flex-between" style="align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h1 class="heading-lg animate-in"><span class="text-gradient">Email Pipeline</span></h1>
            <p class="text-secondary animate-in animate-in-delay-1" style="font-size:0.9rem;">
              Google Forms integration — tickets emailed automatically on submission.
            </p>
          </div>
          <div class="server-status animate-in" id="server-status">
            <span class="server-dot"></span><span class="server-label">Checking...</span>
          </div>
        </div>

        <!-- Google Forms Status -->
        <div class="glass-card-static animate-in animate-in-delay-2 mt-32">
          <h3 class="heading-md mb-8">🔗 Google Forms Connection</h3>
          <p class="text-muted mb-16" style="font-size:0.82rem;">
            Connect a Google Form so tickets are generated and emailed automatically when someone submits a response.
          </p>
          <div class="setup-checklist">
            <div class="checklist-item">
              <span class="checklist-icon" id="check-smtp">○</span>
              <span>SMTP configured — <a href="#/profile" style="color:var(--color-primary-light);">Profile → Gmail SMTP</a></span>
            </div>
            <div class="checklist-item">
              <span class="checklist-icon" id="check-mapping">○</span>
              <span>Column mapping set — <a href="#/profile" style="color:var(--color-primary-light);">Profile → Column Mapping</a></span>
            </div>
            <div class="checklist-item">
              <span class="checklist-icon" id="check-apikey">○</span>
              <span>API key copied to Apps Script — <a href="#/setup" style="color:var(--color-primary-light);">Setup Guide</a></span>
            </div>
          </div>
          <a href="#/setup" class="btn btn-primary btn-sm mt-16" style="display:inline-flex;text-decoration:none;">
            📖 Open Setup Guide
          </a>
        </div>

        <!-- Queue Stats -->
        <div class="glass-card-static animate-in animate-in-delay-3 mt-24">
          <div class="flex flex-between" style="align-items:center;">
            <h3 class="heading-md">📊 Queue Status</h3>
            <button class="btn btn-outline btn-sm" id="refresh-stats">↻ Refresh</button>
          </div>
          <div class="stats-grid mt-16" id="queue-stats" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));">
            <div class="stat-card"><div class="stat-value">—</div><div class="stat-label">Sent</div></div>
            <div class="stat-card"><div class="stat-value">—</div><div class="stat-label">Pending</div></div>
            <div class="stat-card"><div class="stat-value">—</div><div class="stat-label">Deferred (Quota)</div></div>
            <div class="stat-card"><div class="stat-value" style="color:var(--color-danger)">—</div><div class="stat-label">Failed</div></div>
          </div>
        </div>

        <!-- Ticket List -->
        <div class="glass-card-static animate-in animate-in-delay-4 mt-24">
          <div class="flex flex-between" style="align-items:center;flex-wrap:wrap;gap:12px;">
            <h3 class="heading-md">🎫 Generated Tickets</h3>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-outline btn-sm" id="export-csv">📥 Export</button>
              <button class="btn btn-outline btn-sm" id="refresh-tickets">↻</button>
            </div>
          </div>
          <div id="tickets-table" class="mt-16">
            <p class="text-muted text-center" style="padding:24px;">Loading...</p>
          </div>
          <div id="pag-controls" class="mt-16 text-center"></div>
        </div>
      </div>
    </div>`;
  init();
}

async function init() {
  const el = document.getElementById('server-status');
  if (el) el.innerHTML = '<span class="server-dot waking"></span><span>Waking...</span>';
  serverStatus = 'waking';
  const ok = await wakeServer();
  serverStatus = ok ? 'awake' : 'asleep';
  if (el) el.innerHTML = ok
    ? '<span class="server-dot awake"></span><span>Online</span>'
    : '<span class="server-dot asleep"></span><span>Offline</span>';

  if (ok) {
    loadQueueStats();
    updateChecklist();
  }
  setupListeners();
  loadTickets(1);
}

async function updateChecklist() {
  try {
    const { profile } = await (await fetch(`${getServerUrl()}/api/profile`, {
      headers: { Authorization: `Bearer ${state.currentUser?.uid || ''}` },
    })).json();

    if (profile) {
      setCheck('check-smtp', !!profile.smtp_configured);
      setCheck('check-mapping', !!(profile.column_mapping?.name_field));
      setCheck('check-apikey', !!profile.api_key);
    }
  } catch { /* server offline */ }
}

function setCheck(id, ok) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = ok ? '✓' : '○';
    el.style.color = ok ? 'var(--color-success)' : 'var(--text-muted)';
  }
}

function getServerUrl() {
  return 'https://qr-pro-server.onrender.com';
}

async function loadQueueStats() {
  try {
    const stats = await getQueueStats();
    const c = document.getElementById('queue-stats');
    if (c) {
      c.innerHTML = `
        <div class="stat-card"><div class="stat-value" style="color:var(--color-success)">${stats.sent || 0}</div><div class="stat-label">Emails Sent</div></div>
        <div class="stat-card"><div class="stat-value">${stats.pending || 0}</div><div class="stat-label">Processing</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--color-warning)">${stats.deferred || 0}</div><div class="stat-label">Deferred (Quota)</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--color-danger)">${stats.failed || 0}</div><div class="stat-label">Failed</div></div>
      `;
    }
  } catch { /* offline */ }
}

async function loadTickets(page) {
  const w = document.getElementById('tickets-table');
  if (!w) return;
  try {
    const r = await getTickets(page);
    const t = r.tickets || [];
    if (!t.length) { w.innerHTML = '<p class="text-muted text-center" style="padding:24px;">No tickets yet. Connect a Google Form to get started.</p>'; return; }
    let h = '<div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Scans</th><th></th></tr></thead><tbody>';
    t.forEach(tk => {
      const badge = tk.email_sent ? '<span class="badge badge-success">Sent</span>' : '<span class="badge badge-pending">Pending</span>';
      h += `<tr><td>${tk.student_name}</td><td style="font-size:0.8rem">${tk.email||'—'}</td><td>${badge}</td><td>${tk.scan_count||0}</td><td><button class="btn btn-outline btn-sm resend-btn" data-id="${tk.id}">Resend</button></td></tr>`;
    });
    h += '</tbody></table></div>';
    w.innerHTML = h;
    w.querySelectorAll('.resend-btn').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = '...';
      try { await resendEmail(b.dataset.id); b.textContent = '✓'; } catch { b.textContent = '✕'; }
    }));
  } catch { w.innerHTML = '<p class="text-muted text-center" style="padding:24px;">Server offline.</p>'; }
}

function setupListeners() {
  document.getElementById('refresh-stats')?.addEventListener('click', loadQueueStats);
  document.getElementById('refresh-tickets')?.addEventListener('click', () => loadTickets(1));
  document.getElementById('export-csv')?.addEventListener('click', async () => {
    try {
      const r = await exportTickets(); const t = r.tickets||[];
      if (!t.length) { alert('No data'); return; }
      const ks = Object.keys(t[0]);
      let csv = ks.join(',') + '\n';
      t.forEach(row => { csv += ks.map(k => `"${String(row[k]||'').replace(/"/g,'""')}"`).join(',') + '\n'; });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'tickets.csv'; a.click();
    } catch(e) { alert(e.message); }
  });
}
