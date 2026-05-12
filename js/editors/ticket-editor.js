/**
 * Ticket/PDF Template Editor — Visual / Templates / Code + Live Preview
 * Renders inside the event detail page's "Ticket / PDF" tab.
 */

import { TICKET_TEMPLATES, renderTicketPreview, interpolate } from './default-templates.js';
import { saveEventTicketTemplate } from '../utils/api.js';

let currentConfig = {};
let currentMode = 'visual';
let eventRef = null;
let previewTimer = null;

/**
 * Render the ticket/PDF editor into a container.
 * @param {HTMLElement} container
 * @param {Object} event - full event object
 */
export function renderTicketEditor(container, event) {
  eventRef = event;
  const saved = event.ticket_template || {};
  currentMode = saved.mode || 'visual';
  currentConfig = { ...getDefaultConfig(), ...saved };

  container.innerHTML = `
    <div class="editor-layout">
      <!-- Left: Editor Panel -->
      <div class="editor-panel">
        <div class="editor-header">
          <h3 class="heading-md">Ticket / PDF Template</h3>
          <div class="editor-mode-tabs">
            <button class="editor-mode-tab ${currentMode === 'visual' ? 'active' : ''}" data-mode="visual">Visual</button>
            <button class="editor-mode-tab ${currentMode === 'templates' ? 'active' : ''}" data-mode="templates">Templates</button>
            <button class="editor-mode-tab ${currentMode === 'code' ? 'active' : ''}" data-mode="code">Code</button>
          </div>
        </div>

        <div id="ticket-editor-body"></div>

        <div class="editor-footer">
          <button class="btn btn-primary btn-sm" id="save-ticket-tpl-btn">Save Template</button>
          <span id="ticket-tpl-status" class="text-muted" style="font-size: 0.8rem;"></span>
        </div>
      </div>

      <!-- Right: Live Preview -->
      <div class="editor-preview-panel">
        <div class="editor-preview-header">
          <span class="text-muted" style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Ticket Preview</span>
        </div>
        <div class="editor-preview-frame" id="ticket-preview-frame" style="background: #f5f5fa; padding: 24px;">
          <!-- Preview rendered here -->
        </div>
      </div>
    </div>
  `;

  // Mode tab switching
  container.querySelectorAll('.editor-mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.editor-mode-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.mode;
      currentConfig.mode = currentMode;
      renderEditorBody();
    });
  });

  // Save
  document.getElementById('save-ticket-tpl-btn')?.addEventListener('click', () => saveTemplate());

  renderEditorBody();
  updatePreview();
}

function getDefaultConfig() {
  return {
    mode: 'visual',
    header_text: '{{event_name}}',
    sub_header: 'Hall Ticket',
    primary_color: '#2a2478',
    accent_color: '#6c63ff',
    layout: 'centered',
    show_border: true,
    show_watermark: false,
    font_style: 'sans-serif',
    template_id: '',
    raw_html: '',
  };
}

function renderEditorBody() {
  const body = document.getElementById('ticket-editor-body');
  if (!body) return;

  switch (currentMode) {
    case 'visual':
      renderVisualMode(body);
      break;
    case 'templates':
      renderTemplatesMode(body);
      break;
    case 'code':
      renderCodeMode(body);
      break;
  }
}

// ─── Visual Mode ────────────────────────────────────────────────────

function renderVisualMode(body) {
  const c = currentConfig;

  body.innerHTML = `
    <div class="editor-form">
      <div class="form-group">
        <label class="form-label">Header Title</label>
        <input class="form-input" type="text" id="ttpl-header" value="${escapeAttr(c.header_text || '')}"
          placeholder="e.g., {{event_name}} or {{institution}}">
        <p class="form-hint">Use {{event_name}}, {{institution}} as placeholders.</p>
      </div>

      <div class="form-group">
        <label class="form-label">Sub-Header</label>
        <input class="form-input" type="text" id="ttpl-subheader" value="${escapeAttr(c.sub_header || '')}"
          placeholder="e.g., Hall Ticket, Entry Pass">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Primary Color</label>
          <div class="color-picker-row">
            <input type="color" id="ttpl-primary-color" value="${c.primary_color || '#2a2478'}" class="color-input">
            <input class="form-input" type="text" id="ttpl-primary-color-text" value="${c.primary_color || '#2a2478'}" style="flex:1;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Accent Color</label>
          <div class="color-picker-row">
            <input type="color" id="ttpl-accent-color" value="${c.accent_color || '#6c63ff'}" class="color-input">
            <input class="form-input" type="text" id="ttpl-accent-color-text" value="${c.accent_color || '#6c63ff'}" style="flex:1;">
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Layout</label>
          <select class="form-select" id="ttpl-layout">
            <option value="centered" ${c.layout === 'centered' ? 'selected' : ''}>Centered</option>
            <option value="left-aligned" ${c.layout === 'left-aligned' ? 'selected' : ''}>Left-Aligned (Side QR)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Font Style</label>
          <select class="form-select" id="ttpl-font">
            <option value="sans-serif" ${c.font_style === 'sans-serif' ? 'selected' : ''}>Sans-Serif (Modern)</option>
            <option value="serif" ${c.font_style === 'serif' ? 'selected' : ''}>Serif (Classic)</option>
          </select>
        </div>
      </div>

      <div class="form-group" style="display: flex; gap: 20px; flex-wrap: wrap;">
        <label class="field-toggle-label">
          <input type="checkbox" id="ttpl-show-border" ${c.show_border ? 'checked' : ''}>
          <span>Show colored border</span>
        </label>
        <label class="field-toggle-label">
          <input type="checkbox" id="ttpl-show-watermark" ${c.show_watermark ? 'checked' : ''}>
          <span>Show watermark</span>
        </label>
      </div>
    </div>
  `;

  // Auto-update preview on change
  body.querySelectorAll('input, textarea, select').forEach((input) => {
    input.addEventListener('input', () => {
      syncVisualToConfig();
      debouncePreview();
    });
    input.addEventListener('change', () => {
      syncVisualToConfig();
      debouncePreview();
    });
  });

  syncColorPickers('ttpl-primary-color', 'ttpl-primary-color-text');
  syncColorPickers('ttpl-accent-color', 'ttpl-accent-color-text');
}

function syncVisualToConfig() {
  currentConfig.header_text = document.getElementById('ttpl-header')?.value || '';
  currentConfig.sub_header = document.getElementById('ttpl-subheader')?.value || '';
  currentConfig.primary_color = document.getElementById('ttpl-primary-color')?.value || '#2a2478';
  currentConfig.accent_color = document.getElementById('ttpl-accent-color')?.value || '#6c63ff';
  currentConfig.layout = document.getElementById('ttpl-layout')?.value || 'centered';
  currentConfig.font_style = document.getElementById('ttpl-font')?.value || 'sans-serif';
  currentConfig.show_border = document.getElementById('ttpl-show-border')?.checked || false;
  currentConfig.show_watermark = document.getElementById('ttpl-show-watermark')?.checked || false;
}

// ─── Templates Mode ─────────────────────────────────────────────────

function renderTemplatesMode(body) {
  const templates = Object.values(TICKET_TEMPLATES);

  body.innerHTML = `
    <div class="template-grid">
      ${templates.map((tpl) => `
        <div class="template-card ${currentConfig.template_id === tpl.id ? 'selected' : ''}" data-id="${tpl.id}">
          <div class="template-card-preview" style="background: linear-gradient(135deg, ${tpl.preview_color}, ${tpl.config.accent_color || '#6c63ff'});">
            <span style="color:#fff;font-weight:700;font-size:0.9rem;">${tpl.name}</span>
          </div>
          <div class="template-card-info">
            <h4 class="template-card-name">${tpl.name}</h4>
            <p class="template-card-desc">${tpl.description}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  body.querySelectorAll('.template-card').forEach((card) => {
    card.addEventListener('click', () => {
      const tplId = card.dataset.id;
      const tpl = TICKET_TEMPLATES[tplId];
      if (!tpl) return;

      currentConfig = { ...currentConfig, ...tpl.config, template_id: tplId, mode: 'templates' };

      body.querySelectorAll('.template-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');

      updatePreview();
    });
  });
}

// ─── Code Mode ──────────────────────────────────────────────────────

function renderCodeMode(body) {
  if (!currentConfig.raw_html) {
    currentConfig.raw_html = renderTicketPreview(currentConfig, getSampleData());
  }

  body.innerHTML = `
    <div class="editor-form">
      <div class="form-group">
        <label class="form-label">HTML Code</label>
        <p class="form-hint">Use {{name}}, {{event_name}}, {{institution}} as placeholders. This HTML is used for both the on-screen ticket and the PDF attachment.</p>
        <textarea class="form-input code-textarea" id="ttpl-raw-html" rows="20"
          spellcheck="false">${escapeHtml(currentConfig.raw_html || '')}</textarea>
      </div>
    </div>
  `;

  document.getElementById('ttpl-raw-html')?.addEventListener('input', () => {
    currentConfig.raw_html = document.getElementById('ttpl-raw-html').value;
    debouncePreview();
  });
}

// ─── Preview ────────────────────────────────────────────────────────

function getSampleData() {
  const fields = (eventRef?.custom_fields || [])
    .filter((f) => f.on_ticket)
    .map((f) => ({ label: f.label, value: `Sample ${f.label}` }));

  return {
    name: 'John Doe',
    event_name: eventRef?.name || 'Sample Event',
    institution: 'Sample Institution',
    year: '2026',
    fields,
  };
}

function updatePreview() {
  const frame = document.getElementById('ticket-preview-frame');
  if (!frame) return;

  const data = getSampleData();

  if (currentMode === 'code' && currentConfig.raw_html) {
    frame.innerHTML = interpolate(currentConfig.raw_html, {
      name: data.name,
      event_name: data.event_name,
      institution: data.institution,
      year: data.year,
    });
  } else {
    frame.innerHTML = renderTicketPreview(currentConfig, data);
  }
}

function debouncePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => updatePreview(), 200);
}

// ─── Save ───────────────────────────────────────────────────────────

async function saveTemplate() {
  const btn = document.getElementById('save-ticket-tpl-btn');
  const status = document.getElementById('ticket-tpl-status');
  btn.disabled = true;
  status.textContent = 'Saving...';
  status.style.color = '';

  try {
    await saveEventTicketTemplate(eventRef.id, {
      ticket_template: { ...currentConfig, mode: currentMode },
    });
    eventRef.ticket_template = { ...currentConfig, mode: currentMode };
    status.textContent = '✓ Saved';
    status.style.color = 'var(--color-success)';
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.style.color = 'var(--color-danger)';
  } finally {
    btn.disabled = false;
    setTimeout(() => { if (status) { status.textContent = ''; status.style.color = ''; } }, 3000);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function syncColorPickers(colorId, textId) {
  const color = document.getElementById(colorId);
  const text = document.getElementById(textId);
  if (!color || !text) return;

  color.addEventListener('input', () => {
    text.value = color.value;
    syncVisualToConfig();
    debouncePreview();
  });

  text.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(text.value)) {
      color.value = text.value;
    }
    syncVisualToConfig();
    debouncePreview();
  });
}
