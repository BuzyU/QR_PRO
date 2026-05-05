import { navigate, state } from '../app.js';
import { wakeServer, uploadFileToServer, getTickets, resendEmail, getQueueStats, exportTickets } from '../utils/api.js';

let serverStatus = 'unknown';

export function renderAdmin(container) {
  container.innerHTML += `
    <div class="bg-orbs"><div class="orb orb-1"></div></div>
    <div class="page-container">
      <div style="max-width:900px;margin:0 auto;">
        <div class="flex flex-between" style="align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h1 class="heading-lg animate-in"><span class="text-gradient">Email Pipeline</span></h1>
            <p class="text-secondary animate-in animate-in-delay-1" style="font-size:0.9rem;">
              Upload files or connect Google Forms for automated emailing.
            </p>
          </div>
          <div class="server-status animate-in" id="server-status">
            <span class="server-dot"></span><span class="server-label">Checking...</span>
          </div>
        </div>
        <div class="glass-card-static animate-in animate-in-delay-2 mt-32">
          <h3 class="heading-md mb-8">📤 Server Upload</h3>
          <p class="text-muted mb-16" style="font-size:0.82rem;">
            Upload CSV/Excel. Configure column mapping in <a href="#/profile" style="color:var(--color-primary-light);">Profile</a> first.
          </p>
          <div class="upload-zone" id="admin-upload-zone">
            <span class="upload-zone-icon">📁</span>
            <p class="upload-zone-text">Drop file here or click to browse</p>
          </div>
          <input type="file" id="admin-file-input" accept=".csv,.xlsx,.xls" style="display:none;">
          <div id="admin-upload-result" class="mt-16"></div>
        </div>
        <div class="glass-card-static animate-in animate-in-delay-3 mt-24">
          <div class="flex flex-between" style="align-items:center;">
            <h3 class="heading-md">🎫 Tickets</h3>
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
  const ok = await wakeServer();
  serverStatus = ok ? 'awake' : 'asleep';
  if (el) el.innerHTML = ok
    ? '<span class="server-dot awake"></span><span>Online</span>'
    : '<span class="server-dot asleep"></span><span>Offline</span>';
  setupListeners();
  loadTickets(1);
}

async function loadTickets(page) {
  const w = document.getElementById('tickets-table');
  if (!w) return;
  try {
    const r = await getTickets(page);
    const t = r.tickets || [];
    if (!t.length) { w.innerHTML = '<p class="text-muted text-center" style="padding:24px;">No tickets yet.</p>'; return; }
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
  const zone = document.getElementById('admin-upload-zone');
  const fi = document.getElementById('admin-file-input');
  zone?.addEventListener('click', () => fi?.click());
  zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone?.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) doUpload(e.dataTransfer.files[0]); });
  fi?.addEventListener('change', e => { if (e.target.files[0]) doUpload(e.target.files[0]); e.target.value = ''; });
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

async function doUpload(file) {
  const res = document.getElementById('admin-upload-result');
  if (serverStatus !== 'awake') { res.innerHTML = '<p class="auth-error">Server offline</p>'; return; }
  res.innerHTML = '<p class="text-muted">Uploading...</p>';
  try {
    const r = await uploadFileToServer(file, { event: '', year: '' });
    res.innerHTML = `<p class="auth-success">✅ ${r.totalRecords} records queued.</p>`;
    setTimeout(() => loadTickets(1), 3000);
  } catch(e) { res.innerHTML = `<p class="auth-error">❌ ${e.message}</p>`; }
}
