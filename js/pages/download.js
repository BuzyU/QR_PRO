import { navigate, state } from '../app.js';
import { renderSteps } from './details.js';
import { buildAndDownloadZip, downloadSingleBatch } from '../utils/zip-builder.js';

export function renderDownload(container) {
  if (!state.generatedTickets || state.generatedTickets.length === 0) {
    navigate('/');
    return;
  }

  const tickets = state.generatedTickets;
  const batches = state.batches;
  const totalStudents = tickets.length;
  const totalBatches = batches.length;

  // Group tickets by batch for individual download
  const batchGroups = {};
  tickets.forEach((t) => {
    if (!batchGroups[t.batchNumber]) batchGroups[t.batchNumber] = [];
    batchGroups[t.batchNumber].push(t);
  });

  container.innerHTML = `
    <div class="bg-orbs"><div class="orb orb-1"></div><div class="orb orb-3"></div></div>
    <div class="page-container">
      ${renderSteps(4)}
      <div style="max-width: 700px; margin: 0 auto;">
        <div class="text-center animate-in">
          <span style="font-size: 3.5rem; display: block; margin-bottom: 16px;">🎉</span>
          <h1 class="heading-lg mb-8">
            <span class="text-gradient">Tickets Ready!</span>
          </h1>
          <p class="text-secondary">
            All hall tickets have been generated and linked to the database.
          </p>
        </div>

        <div class="stats-grid mt-32 animate-in animate-in-delay-1">
          <div class="stat-card">
            <div class="stat-value">${totalStudents}</div>
            <div class="stat-label">Total Tickets</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${totalBatches}</div>
            <div class="stat-label">Batches</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Math.ceil(totalStudents / totalBatches)}</div>
            <div class="stat-label">Per Batch</div>
          </div>
        </div>

        <div class="glass-card-static mt-32 animate-in animate-in-delay-2">
          <h3 class="heading-md mb-16">📦 Download All</h3>
          <p class="text-secondary mb-24" style="font-size: 0.9rem;">
            Download a ZIP file containing batch-wise folders with all hall ticket PDFs.
          </p>
          <button id="btn-download-all" class="btn btn-accent btn-lg w-full">
            <span class="btn-icon">⬇️</span>
            Download All (ZIP)
          </button>
        </div>

        <div class="glass-card-static mt-24 animate-in animate-in-delay-3">
          <h3 class="heading-md mb-16">📂 Download by Batch</h3>
          ${Object.entries(batchGroups)
            .map(
              ([num, batchTickets]) => {
                const batch = batches[num - 1];
                const label = batch?.sourceFilename
                  ? batch.sourceFilename.replace(/\.[^/.]+$/, '')
                  : `Batch ${num}`;
                return `
            <div class="flex flex-between" style="align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
              <div>
                <span style="font-weight: 600;">${label}</span>
                <span class="text-muted" style="font-size: 0.8rem; margin-left: 8px;">
                  ${batchTickets.length} tickets · ${batch?.timeSlot || ''}
                </span>
              </div>
              <button class="btn btn-outline btn-sm batch-download-btn" data-batch="${num}">
                Download
              </button>
            </div>
          `;
              }
            )
            .join('')}
        </div>

        <div class="flex flex-center mt-32 animate-in animate-in-delay-4" style="gap: 16px;">
          <button id="btn-start-over" class="btn btn-outline">
            🔄 Generate More
          </button>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('btn-download-all').addEventListener('click', async () => {
    const btn = document.getElementById('btn-download-all');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div> Creating ZIP...';
    await buildAndDownloadZip(tickets, state.eventName);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">⬇️</span> Download All (ZIP)';
  });

  document.querySelectorAll('.batch-download-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const batchNum = parseInt(btn.dataset.batch);
      btn.disabled = true;
      btn.textContent = '...';
      await downloadSingleBatch(tickets, batchNum, state.eventName);
      btn.disabled = false;
      btn.textContent = 'Download';
    });
  });

  document.getElementById('btn-start-over').addEventListener('click', () => {
    // Reset state
    state.files = [];
    state.students = [];
    state.generatedTickets = [];
    state.batches = [];
    navigate('/');
  });
}
