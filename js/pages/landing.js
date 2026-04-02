import { navigate } from '../app.js';

export function renderLanding(container) {
  container.innerHTML = `
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
        <p class="text-secondary animate-in animate-in-delay-1" style="font-size: 1.15rem; line-height: 1.7; max-width: 540px; margin: 0 auto;">
          Generate professional hall tickets with unique QR codes linked to a secure database.
          Upload student data, configure batches, and download verified tickets — all in one place.
        </p>

        <div class="mt-48 animate-in animate-in-delay-2">
          <button id="cta-generate" class="btn btn-primary btn-lg" style="animation: pulseGlow 3s ease-in-out infinite;">
            <span class="btn-icon">🎫</span>
            Generate Hall Tickets
          </button>
        </div>
      </div>

      <div class="feature-grid animate-in animate-in-delay-3" style="margin-top: 80px; max-width: 900px; width: 100%;">
        <div class="glass-card feature-card">
          <span class="feature-card-icon">📤</span>
          <h3 class="feature-card-title">Upload & Parse</h3>
          <p class="feature-card-desc">Upload CSV or Excel files with student data. Smart column auto-detection handles any format.</p>
        </div>
        <div class="glass-card feature-card">
          <span class="feature-card-icon">⚡</span>
          <h3 class="feature-card-title">Smart Batching</h3>
          <p class="feature-card-desc">Divide students into batches with custom time slots. Random or sequential assignment.</p>
        </div>
        <div class="glass-card feature-card">
          <span class="feature-card-icon">🔐</span>
          <h3 class="feature-card-title">QR Verification</h3>
          <p class="feature-card-desc">Each ticket gets a unique QR code linked to the database for instant authenticity checks.</p>
        </div>
        <div class="glass-card feature-card">
          <span class="feature-card-icon">📦</span>
          <h3 class="feature-card-title">Bulk Download</h3>
          <p class="feature-card-desc">Download all tickets organized in batch-wise folders as a single ZIP file.</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cta-generate').addEventListener('click', () => {
    navigate('/details');
  });
}
