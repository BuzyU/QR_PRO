/**
 * Email Template Editor — Visual / Templates / Code + Live Preview
 * Renders inside the event detail page's "Email Template" tab.
 */

import { EMAIL_TEMPLATES, renderEmailPreview, interpolate } from './default-templates.js';
import { saveEventEmailTemplate } from '../utils/api.js';

let currentConfig = {};
let currentMode = 'visual';
let eventRef = null;
let previewTimer = null;

/**
 * Render the email editor into a container.
 * @param {HTMLElement} container
 * @param {Object} event - full event object
 */
export function renderEmailEditor(container, event) {
  eventRef = event;
  const saved = event.email_template || {};
  currentMode = saved.mode || 'visual';
  currentConfig = { ...getDefaultConfig(), ...saved };

  container.innerHTML = `
    <div class="editor-layout">
      <!-- Left: Editor Panel -->
      <div class="editor-panel">
        <div class="editor-header">
          <h3 class="heading-md">Email Template</h3>
          <div class="editor-mode-tabs">
            <button class="editor-mode-tab ${currentMode === 'visual' ? 'active' : ''}" data-mode="visual">Visual</button>
            <button class="editor-mode-tab ${currentMode === 'templates' ? 'active' : ''}" data-mode="templates">Templates</button>
            <button class="editor-mode-tab ${currentMode === 'code' ? 'active' : ''}" data-mode="code">Code</button>
          </div>
        </div>

        <div id="email-editor-body"></div>

        <div class="editor-footer">
          <button class="btn btn-primary btn-sm" id="save-email-tpl-btn">Save Template</button>
          <span id="email-tpl-status" class="text-muted" style="font-size: 0.8rem;"></span>
        </div>
      </div>

      <!-- Right: Live Preview -->
      <div class="editor-preview-panel">
        <div class="editor-preview-header">
          <span class="text-muted" style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Live Preview</span>
        </div>
        <div class="editor-preview-frame" id="email-preview-frame">
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

  // Save button
  document.getElementById('save-email-tpl-btn')?.addEventListener('click', () => saveTemplate());

  renderEditorBody();
  updatePreview();
}

function getDefaultConfig() {
  return {
    mode: 'visual',
    subject: 'Your Hall Ticket — {{event_name}}',
    greeting: 'Dear {{name}},',
    body_text: 'Your hall ticket has been generated. Present the QR code below at the venue for verification.',
    primary_color: '#6c63ff',
    accent_color: '#e056a0',
    show_footer: true,
    footer_text: 'This is a computer-generated ticket. Do not reply.',
    template_id: '',
    raw_html: '',
  };
}

function renderEditorBody() {
  const body = document.getElementById('email-editor-body');
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
        <label class="form-label">Email Subject</label>
        <input class="form-input" type="text" id="etpl-subject" value="${escapeAttr(c.subject || '')}"
          placeholder="e.g., Your Hall Ticket — {{event_name}}">
        <p class="form-hint">Use {{event_name}}, {{name}}, {{institution}} as placeholders.</p>
      </div>

      <div class="form-group">
        <label class="form-label">Greeting Line</label>
        <input class="form-input" type="text" id="etpl-greeting" value="${escapeAttr(c.greeting || '')}"
          placeholder="e.g., Dear {{name}},">
      </div>

      <div class="form-group">
        <label class="form-label">Body Text</label>
        <textarea class="form-input" id="etpl-body" rows="4" placeholder="Main email content...">${c.body_text || ''}</textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Primary Color</label>
          <div class="color-picker-row">
            <input type="color" id="etpl-primary-color" value="${c.primary_color || '#6c63ff'}" class="color-input">
            <input class="form-input" type="text" id="etpl-primary-color-text" value="${c.primary_color || '#6c63ff'}" style="flex:1;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Accent Color</label>
          <div class="color-picker-row">
            <input type="color" id="etpl-accent-color" value="${c.accent_color || '#e056a0'}" class="color-input">
            <input class="form-input" type="text" id="etpl-accent-color-text" value="${c.accent_color || '#e056a0'}" style="flex:1;">
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Footer Text</label>
        <input class="form-input" type="text" id="etpl-footer" value="${escapeAttr(c.footer_text || '')}"
          placeholder="Footer text (leave empty to hide)">
      </div>

      <div class="form-group">
        <label class="field-toggle-label">
          <input type="checkbox" id="etpl-show-footer" ${c.show_footer !== false ? 'checked' : ''}>
          <span>Show footer section</span>
        </label>
      </div>
    </div>
  `;

  // Auto-update preview on change
  const inputs = body.querySelectorAll('input, textarea');
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      syncVisualToConfig();
      debouncePreview();
    });
  });

  // Color picker sync
  syncColorPickers('etpl-primary-color', 'etpl-primary-color-text');
  syncColorPickers('etpl-accent-color', 'etpl-accent-color-text');
}

function syncVisualToConfig() {
  currentConfig.subject = document.getElementById('etpl-subject')?.value || '';
  currentConfig.greeting = document.getElementById('etpl-greeting')?.value || '';
  currentConfig.body_text = document.getElementById('etpl-body')?.value || '';
  currentConfig.primary_color = document.getElementById('etpl-primary-color')?.value || '#6c63ff';
  currentConfig.accent_color = document.getElementById('etpl-accent-color')?.value || '#e056a0';
  currentConfig.footer_text = document.getElementById('etpl-footer')?.value || '';
  currentConfig.show_footer = document.getElementById('etpl-show-footer')?.checked !== false;
}

// ─── Templates Mode ─────────────────────────────────────────────────

function renderTemplatesMode(body) {
  const templates = Object.values(EMAIL_TEMPLATES);

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
      const tpl = EMAIL_TEMPLATES[tplId];
      if (!tpl) return;

      // Apply template config
      currentConfig = { ...currentConfig, ...tpl.config, template_id: tplId, mode: 'templates' };

      // Mark selected
      body.querySelectorAll('.template-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');

      updatePreview();
    });
  });
}

// ─── Code Mode ──────────────────────────────────────────────────────

function renderCodeMode(body) {
  // If no raw HTML, generate from current config
  if (!currentConfig.raw_html) {
    currentConfig.raw_html = renderEmailPreview(currentConfig, getSampleData());
  }

  body.innerHTML = `
    <div class="editor-form">
      <div class="form-group">
        <label class="form-label">Subject Line</label>
        <input class="form-input" type="text" id="etpl-code-subject" value="${escapeAttr(currentConfig.subject || '')}"
          placeholder="Email subject...">
      </div>
      <div class="form-group">
        <label class="form-label">HTML Code</label>
        <p class="form-hint">Use {{name}}, {{event_name}}, {{institution}} as placeholders. They'll be replaced with real data.</p>
        <textarea class="form-input code-textarea" id="etpl-raw-html" rows="20"
          spellcheck="false">${escapeHtml(currentConfig.raw_html || '')}</textarea>
      </div>
    </div>
  `;

  document.getElementById('etpl-raw-html')?.addEventListener('input', () => {
    currentConfig.raw_html = document.getElementById('etpl-raw-html').value;
    currentConfig.subject = document.getElementById('etpl-code-subject')?.value || currentConfig.subject;
    debouncePreview();
  });

  document.getElementById('etpl-code-subject')?.addEventListener('input', () => {
    currentConfig.subject = document.getElementById('etpl-code-subject').value;
  });
}

// ─── Preview ────────────────────────────────────────────────────────

function getSampleData() {
  const fields = (eventRef?.custom_fields || [])
    .filter((f) => f.in_email)
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
  const frame = document.getElementById('email-preview-frame');
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
    frame.innerHTML = renderEmailPreview(currentConfig, data);
  }
}

function debouncePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => updatePreview(), 200);
}

// ─── Save ───────────────────────────────────────────────────────────

async function saveTemplate() {
  const btn = document.getElementById('save-email-tpl-btn');
  const status = document.getElementById('email-tpl-status');
  btn.disabled = true;
  status.textContent = 'Saving...';
  status.style.color = '';

  try {
    await saveEventEmailTemplate(eventRef.id, { ...currentConfig, mode: currentMode });
    eventRef.email_template = { ...currentConfig, mode: currentMode };
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
