import { navigate } from '../app.js';

export function renderLanding(container) {
  container.innerHTML += `
    <div class="bg-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="page-container page-center">
      <div class="text-center animate-in" style="max-width: 700px;">
        <p class="text-secondary mb-8" style="font-size: 0.9rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;">
          Hall Ticket Management System
        </p>
        <h1 class="heading-xl mb-16">
          <span class="text-gradient">QR PRO</span>
        </h1>
        <p class="text-secondary animate-in animate-in-delay-1" style="font-size: 1.1rem; line-height: 1.7; max-width: 540px; margin: 0 auto;">
          Generate professional hall tickets with unique QR codes.
          Choose your workflow below.
        </p>
      </div>

      <!-- Mode Selection Cards -->
      <div class="mode-grid animate-in animate-in-delay-2">
        <button class="mode-card glass-card" id="mode-manual">
          <div class="mode-card-icon">📤</div>
          <h3 class="mode-card-title">Quick Generate</h3>
          <p class="mode-card-desc">
            Upload CSV/Excel files, generate hall tickets with QR codes, and download as PDF.
            <strong>Works offline — no server needed.</strong>
          </p>
          <div class="mode-card-features">
            <span class="mode-feature">Upload Files</span>
            <span class="mode-feature">Generate PDFs</span>
            <span class="mode-feature">Download ZIP</span>
          </div>
          <span class="mode-card-action">Start Generating →</span>
        </button>

        <button class="mode-card glass-card" id="mode-auto">
          <div class="mode-card-icon">⚡</div>
          <div class="mode-card-badge">Automated</div>
          <h3 class="mode-card-title">Email Pipeline</h3>
          <p class="mode-card-desc">
            Upload files or connect Google Forms.
            Tickets are <strong>emailed automatically</strong> with QR codes and verification links.
          </p>
          <div class="mode-card-features">
            <span class="mode-feature">Google Forms</span>
            <span class="mode-feature">Auto Email</span>
            <span class="mode-feature">Token Verify</span>
          </div>
          <span class="mode-card-action">Open Pipeline →</span>
        </button>
      </div>

      <!-- Quick Stats -->
      <div class="feature-grid animate-in animate-in-delay-3" style="margin-top: 60px; max-width: 900px; width: 100%;">
        <div class="glass-card feature-card">
          <span class="feature-card-icon">🔐</span>
          <h3 class="feature-card-title">HMAC Verified</h3>
          <p class="feature-card-desc">Every QR code uses token-based verification with HMAC signatures. No raw data exposed.</p>
        </div>
        <div class="glass-card feature-card">
          <span class="feature-card-icon">📧</span>
          <h3 class="feature-card-title">Your Gmail</h3>
          <p class="feature-card-desc">Emails sent from your own Gmail address. Recipients see your institution, not ours.</p>
        </div>
        <div class="glass-card feature-card">
          <span class="feature-card-icon">📊</span>
          <h3 class="feature-card-title">Scan Tracking</h3>
          <p class="feature-card-desc">Track how many times each QR code is scanned with timestamps and location data.</p>
        </div>
        <div class="glass-card feature-card">
          <span class="feature-card-icon">🔄</span>
          <h3 class="feature-card-title">Forms Sync</h3>
          <p class="feature-card-desc">Connect Google Forms for real-time ticket generation as responses come in.</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('mode-manual').addEventListener('click', () => navigate('/details'));
  document.getElementById('mode-auto').addEventListener('click', () => navigate('/admin'));
}
