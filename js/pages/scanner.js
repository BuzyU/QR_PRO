import { navigate, state } from '../app.js';
import { getEvents, wakeServer } from '../utils/api.js';

const SERVER_URL = 'https://qr-pro-server.onrender.com';
let selectedEventId = null;
let html5QrCode = null;

export async function renderScanner(container) {
  container.innerHTML += `
    </div>
    <div class="page-container">
      <div style="max-width: 600px; margin: 0 auto;">
        <button class="btn-link animate-in" onclick="window.location.hash='/'">← Back to Events</button>

        <h1 class="heading-lg mt-8 animate-in">
          <span class="text-gradient">QR Scanner</span>
        </h1>
        <p class="text-secondary animate-in animate-in-delay-1 mb-24">
          Scan attendee QR codes to verify tickets and mark attendance.
        </p>

        <!-- Event Selector -->
        <div class="glass-card-static animate-in animate-in-delay-2 mb-24" id="scanner-setup">
          <div class="form-group">
            <label class="form-label" for="scanner-event-select">Select Event</label>
            <select class="form-select" id="scanner-event-select">
              <option value="">Loading events...</option>
            </select>
          </div>
          <button class="btn btn-primary" id="start-scanner-btn" disabled>
            Start Scanner
          </button>
        </div>

        <!-- Scanner View (hidden until started) -->
        <div id="scanner-view" class="hidden">
          <div class="glass-card-static animate-in mb-16">
            <div id="qr-reader" style="border-radius: 12px; overflow: hidden;"></div>
          </div>

          <!-- Scan Result -->
          <div id="scan-result" class="hidden">
            <!-- Populated dynamically -->
          </div>

          <!-- Scan History -->
          <div class="glass-card-static mt-24">
            <h3 class="heading-md mb-16">Scan History</h3>
            <div id="scan-history">
              <p class="text-muted text-center" style="font-size: 0.85rem; padding: 16px;">
                No scans yet. Point your camera at a QR code.
              </p>
            </div>
          </div>

          <button class="btn btn-outline mt-24" id="stop-scanner-btn" style="width: 100%;">
            Stop Scanner
          </button>
        </div>
      </div>
    </div>
  `;

  // Load events
  try {
    await wakeServer();
    const { events } = await getEvents();
    const select = document.getElementById('scanner-event-select');
    const startBtn = document.getElementById('start-scanner-btn');

    if (!events || events.length === 0) {
      select.innerHTML = '<option value="">No events found</option>';
      return;
    }

    select.innerHTML = `<option value="">Choose an event...</option>` +
      events.map((e) => `<option value="${e.id}">${e.name} (${e.stats?.total || 0} tickets)</option>`).join('');

    select.addEventListener('change', () => {
      selectedEventId = select.value;
      startBtn.disabled = !selectedEventId;
    });

    startBtn.addEventListener('click', () => startScanner());
    document.getElementById('stop-scanner-btn')?.addEventListener('click', () => stopScanner());
  } catch (err) {
    document.getElementById('scanner-event-select').innerHTML =
      `<option value="">Error loading events: ${err.message}</option>`;
  }
}

const scanHistory = [];

async function startScanner() {
  document.getElementById('scanner-setup').classList.add('hidden');
  document.getElementById('scanner-view').classList.remove('hidden');

  // Load html5-qrcode from CDN dynamically
  if (!window.Html5Qrcode) {
    await loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
  }

  const readerDiv = document.getElementById('qr-reader');
  html5QrCode = new window.Html5Qrcode('qr-reader');

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      () => {} // ignore scan failures (happens every frame without a QR)
    );
  } catch (err) {
    readerDiv.innerHTML = `
      <div class="text-center" style="padding: 40px;">
        <p style="color: var(--color-danger);">Camera access denied or unavailable.</p>
        <p class="text-muted mt-8" style="font-size: 0.85rem;">${err.message || err}</p>
      </div>
    `;
  }
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode.clear();
    html5QrCode = null;
  }

  document.getElementById('scanner-view').classList.add('hidden');
  document.getElementById('scanner-setup').classList.remove('hidden');
}

// Debounce to avoid double-scanning
let lastScannedUrl = '';
let lastScanTime = 0;

async function onScanSuccess(decodedText) {
  const now = Date.now();
  if (decodedText === lastScannedUrl && now - lastScanTime < 5000) return;
  lastScannedUrl = decodedText;
  lastScanTime = now;

  // Extract token from URL
  let token = '';
  try {
    const url = new URL(decodedText);
    token = url.searchParams.get('token') || '';
  } catch {
    // Maybe the QR contains just the token directly
    token = decodedText;
  }

  if (!token) {
    showScanResult({
      status: 'error',
      title: 'Invalid QR Code',
      detail: 'No verification token found in the scanned code.',
    });
    return;
  }

  // Vibrate on scan (mobile)
  if (navigator.vibrate) navigator.vibrate(100);

  showScanResult({ status: 'loading', title: 'Verifying...', detail: '' });

  try {
    const res = await fetch(`${SERVER_URL}/api/verify?token=${token}`);
    const data = await res.json();

    if (data.status === 'VERIFIED') {
      const isFirst = data.isFirstScan;
      showScanResult({
        status: isFirst ? 'success' : 'warning',
        title: isFirst ? 'Entry Granted' : 'Already Entered',
        detail: `${data.ticket.name}${data.ticket.event ? ' — ' + data.ticket.event : ''}`,
        scanCount: data.ticket.scanCount,
        attendedAt: data.ticket.attendedAt,
        fields: data.ticket.fields || [],
      });

      // Add to history
      scanHistory.unshift({
        name: data.ticket.name,
        status: isFirst ? 'granted' : 'repeat',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        scanCount: data.ticket.scanCount,
      });
      renderScanHistory();
    } else {
      showScanResult({
        status: 'error',
        title: 'Invalid Ticket',
        detail: data.error || 'Token does not match any record.',
      });
      scanHistory.unshift({
        name: 'Unknown',
        status: 'invalid',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        scanCount: 0,
      });
      renderScanHistory();
    }
  } catch (err) {
    showScanResult({
      status: 'error',
      title: 'Network Error',
      detail: 'Could not reach the verification server.',
    });
  }
}

function showScanResult({ status, title, detail, scanCount, attendedAt, fields }) {
  const resultDiv = document.getElementById('scan-result');
  resultDiv.classList.remove('hidden');

  const colors = {
    success: { bg: 'rgba(0, 212, 170, 0.1)', border: 'rgba(0, 212, 170, 0.3)', icon: '🟢', color: 'var(--color-success)' },
    warning: { bg: 'rgba(255, 179, 71, 0.1)', border: 'rgba(255, 179, 71, 0.3)', icon: '🟡', color: 'var(--color-warning)' },
    error: { bg: 'rgba(255, 71, 87, 0.1)', border: 'rgba(255, 71, 87, 0.3)', icon: '🔴', color: 'var(--color-danger)' },
    loading: { bg: 'rgba(108, 99, 255, 0.1)', border: 'rgba(108, 99, 255, 0.3)', icon: '⏳', color: 'var(--color-primary-light)' },
  };

  const c = colors[status] || colors.error;

  let fieldsHtml = '';
  if (fields && fields.length > 0) {
    fieldsHtml = fields.map((f) => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.82rem;">
        <span style="color:var(--text-muted);">${f.label}</span>
        <span style="color:var(--text-primary);font-weight:600;">${f.value}</span>
      </div>
    `).join('');
  }

  resultDiv.innerHTML = `
    <div class="glass-card-static" style="background: ${c.bg}; border-color: ${c.border}; animation: slideUp 0.3s ease;">
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: ${fieldsHtml ? '16px' : '0'};">
        <span style="font-size: 2rem;">${c.icon}</span>
        <div>
          <strong style="color: ${c.color}; font-size: 1.1rem; display: block;">${title}</strong>
          <span style="color: var(--text-secondary); font-size: 0.88rem;">${detail}</span>
        </div>
      </div>
      ${fieldsHtml}
      ${scanCount !== undefined ? `
        <div style="border-top: 1px solid ${c.border}; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted);">
          <span>Scan #${scanCount}</span>
          ${attendedAt ? `<span>Checked in: ${new Date(attendedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;

  // Auto-hide after 5 seconds on success
  if (status === 'success' || status === 'warning') {
    setTimeout(() => {
      if (resultDiv) resultDiv.innerHTML = '';
    }, 5000);
  }
}

function renderScanHistory() {
  const historyDiv = document.getElementById('scan-history');
  if (!historyDiv || scanHistory.length === 0) return;

  historyDiv.innerHTML = scanHistory.slice(0, 20).map((s) => {
    const color = s.status === 'granted' ? 'var(--color-success)'
      : s.status === 'repeat' ? 'var(--color-warning)'
      : 'var(--color-danger)';
    const label = s.status === 'granted' ? 'Entry' : s.status === 'repeat' ? 'Repeat' : 'Invalid';

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></span>
          <span>${s.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="color: ${color}; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">${label}</span>
          <span style="color: var(--text-muted); font-size: 0.75rem;">${s.time}</span>
        </div>
      </div>
    `;
  }).join('');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
