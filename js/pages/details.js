import { navigate, state } from '../app.js';
import { parseFile, detectNameColumn, detectUrnColumn } from '../utils/file-parser.js';

let uploadedFiles = [];

export function renderDetails(container) {
  container.innerHTML = `
    <div class="bg-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>

    <div class="page-container">
      ${renderSteps(2)}

      <div style="max-width: 680px; margin: 0 auto;">
        <h1 class="heading-lg text-center animate-in mb-8">
          <span class="text-gradient">Event Details</span>
        </h1>
        <p class="text-secondary text-center animate-in animate-in-delay-1 mb-24">
          Enter the event information and upload your student data files.
        </p>

        <div class="glass-card-static animate-in animate-in-delay-2">
          <div class="form-group">
            <label class="form-label" for="institution-name">Institution Name</label>
            <input class="form-input" type="text" id="institution-name"
              placeholder="e.g., Dr. D.Y. Patil University" value="${state.institutionName || ''}">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="event-name">Event / Committee Name</label>
              <input class="form-input" type="text" id="event-name"
                placeholder="e.g., Aptikida" value="${state.eventName || ''}">
            </div>
            <div class="form-group">
              <label class="form-label" for="event-year">Year</label>
              <input class="form-input" type="text" id="event-year"
                placeholder="e.g., 2026" value="${state.year || ''}">
            </div>
          </div>

          <div class="form-group mt-8">
            <label class="form-label">Upload Student Data</label>
            <div class="upload-zone" id="upload-zone">
              <span class="upload-zone-icon">📁</span>
              <p class="upload-zone-text">Drag & drop files here or click to browse</p>
              <p class="upload-zone-hint">Supports .csv, .xlsx, .xls files</p>
            </div>
            <input type="file" id="file-input" accept=".csv,.xlsx,.xls" multiple style="display:none;">
            <div id="file-list" class="file-list"></div>
          </div>

          <div id="column-mapping" class="hidden mt-16">
            <label class="form-label">Column Mapping</label>
            <p class="text-muted mb-8" style="font-size: 0.8rem;">
              Select which columns contain student names and URN numbers.
            </p>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="name-col" style="font-size:0.75rem;">Name Column</label>
                <select class="form-select" id="name-col"></select>
              </div>
              <div class="form-group">
                <label class="form-label" for="urn-col" style="font-size:0.75rem;">URN Column (optional)</label>
                <select class="form-select" id="urn-col">
                  <option value="">— None —</option>
                </select>
              </div>
            </div>
          </div>

          <div id="data-preview" class="hidden mt-16">
            <label class="form-label">Data Preview</label>
            <div id="preview-table-wrapper" class="data-table-wrapper"></div>
            <p id="preview-count" class="text-muted mt-8" style="font-size:0.8rem;"></p>
          </div>
        </div>

        <div class="flex flex-center mt-32 animate-in animate-in-delay-3" style="gap: 16px;">
          <button id="btn-back" class="btn btn-outline">← Back</button>
          <button id="btn-continue" class="btn btn-primary" disabled>
            Continue →
          </button>
        </div>
      </div>
    </div>
  `;

  uploadedFiles = state.files ? [...state.files] : [];
  if (uploadedFiles.length > 0) {
    renderFileList();
    handleFileParsing();
  }

  setupEventListeners();
}

function setupEventListeners() {
  const zone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(isValidFile);
    addFiles(files);
  });

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files).filter(isValidFile);
    addFiles(files);
    e.target.value = '';
  });

  document.getElementById('btn-back').addEventListener('click', () => navigate('/'));
  document.getElementById('btn-continue').addEventListener('click', handleContinue);
}

function isValidFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  return ['csv', 'xlsx', 'xls'].includes(ext);
}

function addFiles(files) {
  uploadedFiles.push(...files);
  // Sort alphabetically by filename immediately so browser's arbitrary
  // file order never leaks into the pipeline. This is the single source
  // of truth for file ordering throughout the entire app.
  uploadedFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  renderFileList();
  handleFileParsing();
}

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  renderFileList();
  if (uploadedFiles.length === 0) {
    document.getElementById('column-mapping').classList.add('hidden');
    document.getElementById('data-preview').classList.add('hidden');
    document.getElementById('btn-continue').disabled = true;
  } else {
    handleFileParsing();
  }
}

function renderFileList() {
  const list = document.getElementById('file-list');
  list.innerHTML = uploadedFiles
    .map(
      (f, i) => `
    <div class="file-item">
      <div class="file-item-info">
        <span class="file-item-icon">📄</span>
        <div>
          <div class="file-item-name">${f.name}</div>
          <div class="file-item-meta">${(f.size / 1024).toFixed(1)} KB</div>
        </div>
      </div>
      <button class="file-item-remove" data-index="${i}" title="Remove">✕</button>
    </div>
  `
    )
    .join('');

  list.querySelectorAll('.file-item-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeFile(parseInt(btn.dataset.index)));
  });
}

async function handleFileParsing() {
  if (uploadedFiles.length === 0) return;

  try {
    const firstFile = uploadedFiles[0];
    const { headers, rows } = await parseFile(firstFile);

    // Show column mapping
    const nameCol = document.getElementById('name-col');
    const urnCol = document.getElementById('urn-col');

    nameCol.innerHTML = headers.map((h) => `<option value="${h}">${h}</option>`).join('');
    urnCol.innerHTML =
      '<option value="">— None —</option>' +
      headers.map((h) => `<option value="${h}">${h}</option>`).join('');

    // Auto-select
    const detectedName = detectNameColumn(headers);
    const detectedUrn = detectUrnColumn(headers);
    if (detectedName) nameCol.value = detectedName;
    if (detectedUrn) urnCol.value = detectedUrn;

    document.getElementById('column-mapping').classList.remove('hidden');

    // Show preview
    showPreview(headers, rows);

    // Listen for column changes
    nameCol.addEventListener('change', () => showPreview(headers, rows));
    urnCol.addEventListener('change', () => showPreview(headers, rows));

    document.getElementById('btn-continue').disabled = false;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showPreview(headers, rows) {
  const previewDiv = document.getElementById('data-preview');
  const wrapper = document.getElementById('preview-table-wrapper');
  const countEl = document.getElementById('preview-count');

  const previewRows = rows.slice(0, 5);
  const nameCol = document.getElementById('name-col').value;
  const urnCol = document.getElementById('urn-col').value;

  const displayHeaders = [nameCol];
  if (urnCol) displayHeaders.push(urnCol);

  let html = '<table class="data-table"><thead><tr>';
  html += displayHeaders.map((h) => `<th>${h}</th>`).join('');
  html += '</tr></thead><tbody>';
  previewRows.forEach((row) => {
    html += '<tr>';
    html += displayHeaders.map((h) => `<td>${row[h] || ''}</td>`).join('');
    html += '</tr>';
  });
  html += '</tbody></table>';

  wrapper.innerHTML = html;
  countEl.textContent = `Showing ${previewRows.length} of ${rows.length} rows from first file`;
  previewDiv.classList.remove('hidden');
}

async function handleContinue() {
  const institutionName = document.getElementById('institution-name').value.trim();
  const eventName = document.getElementById('event-name').value.trim();
  const year = document.getElementById('event-year').value.trim();
  const nameCol = document.getElementById('name-col').value;
  const urnCol = document.getElementById('urn-col').value;

  if (!institutionName) {
    showToast('Please enter institution name.', 'error');
    return;
  }
  if (!eventName) {
    showToast('Please enter event name.', 'error');
    return;
  }
  if (uploadedFiles.length === 0) {
    showToast('Please upload at least one file.', 'error');
    return;
  }

  // Save state
  state.institutionName = institutionName;
  state.eventName = eventName;
  state.year = year;
  state.files = [...uploadedFiles];
  state.nameCol = nameCol;
  state.urnCol = urnCol;

  navigate('/generator');
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function renderSteps(active) {
  const steps = [
    { num: 1, label: 'Home' },
    { num: 2, label: 'Details' },
    { num: 3, label: 'Generate' },
    { num: 4, label: 'Download' },
  ];

  return `
    <div class="step-indicator animate-in">
      ${steps
        .map(
          (s, i) => `
        <div class="step ${s.num === active ? 'active' : s.num < active ? 'completed' : ''}">
          <span class="step-number">${s.num < active ? '✓' : s.num}</span>
          <span>${s.label}</span>
        </div>
        ${i < steps.length - 1 ? `<div class="step-line ${s.num < active ? 'completed' : ''}"></div>` : ''}
      `
        )
        .join('')}
    </div>
  `;
}
