import { navigate, state } from '../app.js';
import {
  getEvent,
  updateEvent,
  saveEventFields,
  saveEventColumnMapping,
  getEventTickets,
  getEventAttendance,
  resendEmail,
  getEventEmailConfig,
  saveEventEmailConfig,
  getGmailAuthUrl,
  testEventEmail,
  disconnectGmail,
  getProfile,
} from '../utils/api.js';
import { renderEmailEditor } from '../editors/email-editor.js';
import { renderTicketEditor } from '../editors/ticket-editor.js';

let currentEvent = null;
let currentStats = null;

export async function renderEventDetail(container, eventId) {
  container.innerHTML += `
    </div>
    <div class="page-container">
      <div style="max-width: 900px; margin: 0 auto;">
        <div id="event-detail-content">
          <div class="text-center" style="padding: 60px 0;">
            <div class="spinner"></div>
            <p class="loading-text">Loading event...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const { event, stats } = await getEvent(eventId);
    currentEvent = event;
    currentStats = stats;
    renderContent(eventId);
  } catch (err) {
    document.getElementById('event-detail-content').innerHTML = `
      <div class="glass-card-static text-center">
        <p style="color: var(--color-danger);">Failed to load event: ${err.message}</p>
        <button class="btn btn-outline mt-16" onclick="window.location.hash='/'">← Back to Events</button>
      </div>
    `;
  }
}

function renderContent(eventId) {
  const content = document.getElementById('event-detail-content');
  const e = currentEvent;
  const s = currentStats;

  const statusOptions = ['draft', 'active', 'completed']
    .map((st) => `<option value="${st}" ${e.status === st ? 'selected' : ''}>${st.charAt(0).toUpperCase() + st.slice(1)}</option>`)
    .join('');

  const fields = e.custom_fields || [];
  const mapping = e.column_mapping || {};

  content.innerHTML = `
    <!-- Header -->
    <div class="flex flex-between animate-in" style="align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 32px;">
      <div>
        <button class="btn-link" onclick="window.location.hash='/'">← Back to Events</button>
        <h1 class="heading-lg mt-8">
          <span class="text-gradient">${e.name}</span>
        </h1>
        ${e.description ? `<p class="text-secondary mt-4">${e.description}</p>` : ''}
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <select class="form-select" id="event-status" style="min-width: 120px;">
          ${statusOptions}
        </select>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="stats-grid animate-in animate-in-delay-1" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-bottom: 32px;">
      <div class="stat-card">
        <div class="stat-value">${s.total}</div>
        <div class="stat-label">Total Tickets</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--color-success);">${s.sent}</div>
        <div class="stat-label">Emails Sent</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--color-primary-light);">${s.present}</div>
        <div class="stat-label">Present</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--color-warning);">${s.scanned}</div>
        <div class="stat-label">Scanned</div>
      </div>
    </div>

    <!-- Configuration Tabs -->
    <div class="event-tabs animate-in animate-in-delay-2">
      <button class="event-tab active" data-tab="fields">Custom Fields</button>
      <button class="event-tab" data-tab="mapping">Column Mapping</button>
      <button class="event-tab" data-tab="delivery">Delivery</button>
      <button class="event-tab" data-tab="email-tpl">Email Template</button>
      <button class="event-tab" data-tab="ticket-tpl">Ticket / PDF</button>
      <button class="event-tab" data-tab="tickets">Tickets</button>
      <button class="event-tab" data-tab="attendance">Attendance</button>
      <button class="event-tab" data-tab="integrations">Integrations</button>
    </div>

    <!-- Tab Content -->
    <div class="event-tab-content animate-in animate-in-delay-3" id="tab-content">
      <!-- Default: fields tab -->
    </div>
  `;

  // Tab switching
  content.querySelectorAll('.event-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      content.querySelectorAll('.event-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderTab(tab.dataset.tab, eventId);
    });
  });

  // Status change
  document.getElementById('event-status')?.addEventListener('change', async (ev) => {
    try {
      await updateEvent(eventId, { status: ev.target.value });
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  });

  // Render default tab
  renderTab('fields', eventId);
}

// ─── Tab Renderers ──────────────────────────────────────────────────

function renderTab(tab, eventId) {
  const container = document.getElementById('tab-content');
  switch (tab) {
    case 'fields':
      renderFieldsTab(container, eventId);
      break;
    case 'mapping':
      renderMappingTab(container, eventId);
      break;
    case 'delivery':
      renderDeliveryTab(container, eventId);
      break;
    case 'email-tpl':
      renderEmailTemplateTab(container, eventId);
      break;
    case 'ticket-tpl':
      renderTicketTemplateTab(container, eventId);
      break;
    case 'tickets':
      renderTicketsTab(container, eventId);
      break;
    case 'attendance':
      renderAttendanceTab(container, eventId);
      break;
    case 'integrations':
      renderIntegrationsTab(container, eventId);
      break;
    default:
      container.innerHTML = '<p>Unknown tab</p>';
  }
}

// ─── Fields Tab ─────────────────────────────────────────────────────

function renderFieldsTab(container, eventId) {
  const fields = currentEvent.custom_fields || [];

  container.innerHTML = `
    <div class="glass-card-static">
      <h3 class="heading-md mb-8">Custom Fields</h3>
      <p class="text-muted mb-16" style="font-size: 0.82rem;">
        Define the data fields for this event. These fields determine what appears on tickets, in emails, and in the PDF.
        Add fields that match the columns in your CSV/Google Form.
      </p>

      <div id="fields-list">
        ${fields.map((f, i) => renderFieldRow(f, i)).join('')}
      </div>

      <button class="btn btn-outline btn-sm mt-16" id="add-field-btn">+ Add Field</button>

      <div class="mt-24" style="display: flex; gap: 12px; align-items: center;">
        <button class="btn btn-primary btn-sm" id="save-fields-btn">Save Fields</button>
        <span id="fields-status" class="text-muted" style="font-size: 0.8rem;"></span>
      </div>
    </div>
  `;

  document.getElementById('add-field-btn')?.addEventListener('click', () => {
    const list = document.getElementById('fields-list');
    const index = list.querySelectorAll('.field-config-row').length;
    list.insertAdjacentHTML('beforeend', renderFieldRow({}, index));
    attachFieldRowListeners(list.lastElementChild);
  });

  // Attach listeners to existing rows
  container.querySelectorAll('.field-config-row').forEach(attachFieldRowListeners);

  document.getElementById('save-fields-btn')?.addEventListener('click', () => saveFields(eventId));
}

function renderFieldRow(field = {}, index) {
  return `
    <div class="field-config-row" data-index="${index}">
      <div class="field-config-inputs">
        <input class="form-input field-key" type="text" value="${field.key || ''}"
          placeholder="Field key (e.g., roll_no)">
        <input class="form-input field-label" type="text" value="${field.label || ''}"
          placeholder="Display label (e.g., Roll Number)">
        <select class="form-select field-type">
          <option value="text" ${field.type === 'text' || !field.type ? 'selected' : ''}>Text</option>
          <option value="number" ${field.type === 'number' ? 'selected' : ''}>Number</option>
          <option value="email" ${field.type === 'email' ? 'selected' : ''}>Email</option>
          <option value="date" ${field.type === 'date' ? 'selected' : ''}>Date</option>
        </select>
      </div>
      <div class="field-config-toggles">
        <label class="field-toggle-label">
          <input type="checkbox" class="field-required" ${field.required ? 'checked' : ''}>
          <span>Required</span>
        </label>
        <label class="field-toggle-label">
          <input type="checkbox" class="field-on-ticket" ${field.on_ticket !== false ? 'checked' : ''}>
          <span>On Ticket</span>
        </label>
        <label class="field-toggle-label">
          <input type="checkbox" class="field-in-email" ${field.in_email !== false ? 'checked' : ''}>
          <span>In Email</span>
        </label>
        <button class="btn-remove-field" title="Remove">✕</button>
      </div>
    </div>
  `;
}

function attachFieldRowListeners(row) {
  row.querySelector('.btn-remove-field')?.addEventListener('click', () => row.remove());
}

async function saveFields(eventId) {
  const status = document.getElementById('fields-status');
  const btn = document.getElementById('save-fields-btn');
  btn.disabled = true;
  status.textContent = 'Saving...';

  const rows = document.querySelectorAll('.field-config-row');
  const fields = [];

  for (const row of rows) {
    const key = row.querySelector('.field-key').value.trim();
    const label = row.querySelector('.field-label').value.trim();
    if (!key) continue;

    fields.push({
      key,
      label: label || key,
      type: row.querySelector('.field-type').value,
      required: row.querySelector('.field-required').checked,
      on_ticket: row.querySelector('.field-on-ticket').checked,
      in_email: row.querySelector('.field-in-email').checked,
    });
  }

  try {
    await saveEventFields(eventId, fields);
    currentEvent.custom_fields = fields;
    status.textContent = '✓ Saved';
    status.style.color = 'var(--color-success)';
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.style.color = 'var(--color-danger)';
  } finally {
    btn.disabled = false;
    setTimeout(() => {
      if (status) { status.textContent = ''; status.style.color = ''; }
    }, 3000);
  }
}

// ─── Column Mapping Tab ─────────────────────────────────────────────

function renderMappingTab(container, eventId) {
  const mapping = currentEvent.column_mapping || {};
  const fields = currentEvent.custom_fields || [];
  const fieldMap = mapping.field_map || {};

  container.innerHTML = `
    <div class="glass-card-static">
      <h3 class="heading-md mb-8">Column Mapping</h3>
      <p class="text-muted mb-16" style="font-size: 0.82rem;">
        Map column headers from your CSV/Google Form to the event fields.
        This tells QR PRO which column contains the attendee's name, email, and custom fields.
      </p>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="map-name-field">Name Column</label>
          <input class="form-input" type="text" id="map-name-field"
            value="${mapping.name_field || ''}" placeholder="e.g., Student Name">
        </div>
        <div class="form-group">
          <label class="form-label" for="map-email-field">Email Column</label>
          <input class="form-input" type="text" id="map-email-field"
            value="${mapping.email_field || ''}" placeholder="e.g., Email ID">
        </div>
      </div>

      ${fields.length > 0 ? `
        <div class="mt-16">
          <label class="form-label">Custom Field Column Mapping</label>
          <p class="text-muted mb-8" style="font-size: 0.75rem;">
            Map each custom field to the exact column header in your CSV/Form.
          </p>
          ${fields.map((f) => `
            <div class="form-row" style="margin-bottom: 8px;">
              <div class="form-group" style="flex: 1;">
                <span class="text-muted" style="font-size: 0.8rem;">${f.label}</span>
              </div>
              <div class="form-group" style="flex: 2;">
                <input class="form-input field-map-input" type="text"
                  data-key="${f.key}"
                  value="${fieldMap[f.key] || f.key}"
                  placeholder="Column header in CSV/Form">
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <p class="text-muted mt-16" style="font-size: 0.82rem;">
          Add custom fields first in the "Custom Fields" tab to configure their column mapping.
        </p>
      `}

      <div class="mt-24" style="display: flex; gap: 12px; align-items: center;">
        <button class="btn btn-primary btn-sm" id="save-mapping-btn">Save Mapping</button>
        <span id="mapping-status" class="text-muted" style="font-size: 0.8rem;"></span>
      </div>
    </div>
  `;

  document.getElementById('save-mapping-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('mapping-status');
    const btn = document.getElementById('save-mapping-btn');
    btn.disabled = true;
    status.textContent = 'Saving...';

    const nameField = document.getElementById('map-name-field').value.trim();
    const emailField = document.getElementById('map-email-field').value.trim();

    if (!nameField || !emailField) {
      status.textContent = 'Name and Email columns are required';
      status.style.color = 'var(--color-danger)';
      btn.disabled = false;
      return;
    }

    const fieldMapInputs = document.querySelectorAll('.field-map-input');
    const field_map = {};
    fieldMapInputs.forEach((input) => {
      field_map[input.dataset.key] = input.value.trim() || input.dataset.key;
    });

    try {
      await saveEventColumnMapping(eventId, {
        name_field: nameField,
        email_field: emailField,
        field_map,
      });
      currentEvent.column_mapping = { name_field: nameField, email_field: emailField, field_map };
      status.textContent = '✓ Saved';
      status.style.color = 'var(--color-success)';
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.style.color = 'var(--color-danger)';
    } finally {
      btn.disabled = false;
      setTimeout(() => { if (status) { status.textContent = ''; status.style.color = ''; } }, 3000);
    }
  });
}
// ─── Delivery Tab ─────────────────────────────────────────────────

async function renderDeliveryTab(container, eventId) {
  container.innerHTML = `
    <div class="glass-card-static">
      <div class="text-center" style="padding: 24px;"><div class="spinner"></div></div>
    </div>
  `;

  let config;
  try {
    config = await getEventEmailConfig(eventId);
  } catch {
    config = { configured: false, provider: null };
  }

  const provider = config.provider || 'resend';
  const gmailConnected = config.gmail_connected || false;
  const gmailEmail = config.gmail_email || '';

  container.innerHTML = `
    <div class="glass-card-static">
      <h3 class="heading-md mb-8">Email Delivery</h3>
      <p class="text-muted mb-16" style="font-size: 0.82rem;">
        Configure how this event sends ticket emails. Each event can use its own email provider and credentials.
      </p>

      <!-- Provider Selection -->
      <div class="delivery-provider-toggle mb-24">
        <label class="delivery-provider-option ${provider === 'gmail' ? 'active' : ''}">
          <input type="radio" name="email-provider" value="gmail" ${provider === 'gmail' ? 'checked' : ''}>
          <div class="delivery-provider-card">
            <div class="delivery-provider-icon">📧</div>
            <div>
              <strong>Gmail API</strong>
              <p class="text-muted" style="font-size: 0.75rem; margin: 2px 0 0;">Send via your Gmail account (OAuth2). Free, no limits.</p>
            </div>
          </div>
        </label>
        <label class="delivery-provider-option ${provider === 'resend' ? 'active' : ''}">
          <input type="radio" name="email-provider" value="resend" ${provider === 'resend' ? 'checked' : ''}>
          <div class="delivery-provider-card">
            <div class="delivery-provider-icon">⚡</div>
            <div>
              <strong>Resend</strong>
              <p class="text-muted" style="font-size: 0.75rem; margin: 2px 0 0;">HTTP email API. Custom domain support. 100 free/day.</p>
            </div>
          </div>
        </label>
      </div>

      <!-- Gmail Section -->
      <div id="gmail-config-section" style="display: ${provider === 'gmail' ? 'block' : 'none'};">
        <div class="delivery-section-header">
          <h4 class="heading-sm">Gmail Configuration</h4>
          ${gmailConnected
      ? `<span class="badge badge-success">Connected · ${gmailEmail}</span>`
      : '<span class="badge badge-pending">Not Connected</span>'
    }
        </div>
        <p class="text-muted mb-16" style="font-size: 0.78rem;">
          Create OAuth2 credentials in your
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color: var(--color-primary-light);">Google Cloud Console</a>.
          Enable the Gmail API and create OAuth Client ID credentials. Set the redirect URI to:
        </p>
        <div class="delivery-redirect-uri mb-16">
          <code id="gmail-redirect-uri-display">Loading...</code>
          <button class="btn btn-outline btn-sm" id="copy-redirect-uri-btn" title="Copy">📋</button>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="gmail-client-id">Client ID</label>
            <input class="form-input" type="text" id="gmail-client-id"
              placeholder="123456789.apps.googleusercontent.com" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="gmail-client-secret">Client Secret</label>
            <input class="form-input" type="password" id="gmail-client-secret"
              placeholder="GOCSPX-..." autocomplete="off">
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 16px;">
          <button class="btn btn-primary btn-sm" id="save-gmail-creds-btn">Save Credentials</button>
          ${gmailConnected
      ? `<button class="btn btn-outline btn-sm" id="disconnect-gmail-btn" style="border-color: var(--color-danger); color: var(--color-danger);">Disconnect Gmail</button>`
      : `<button class="btn btn-outline btn-sm" id="connect-gmail-btn" ${config.configured ? '' : 'disabled'}>
                Connect Gmail →
              </button>`
    }
          <span id="gmail-status" class="text-muted" style="font-size: 0.8rem;"></span>
        </div>
      </div>

      <!-- Resend Section -->
      <div id="resend-config-section" style="display: ${provider === 'resend' ? 'block' : 'none'};">
        <h4 class="heading-sm mb-16">Resend Configuration</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="resend-api-key">Resend API Key</label>
            <input class="form-input" type="password" id="resend-api-key"
              placeholder="re_..." autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="resend-from-email">From Email</label>
            <input class="form-input" type="email" id="resend-from-email"
              placeholder="tickets@yourdomain.com">
          </div>
        </div>
        <div style="margin-top: 16px;">
          <button class="btn btn-primary btn-sm" id="save-resend-btn">Save Resend Config</button>
          <span id="resend-status" class="text-muted" style="font-size: 0.8rem; margin-left: 12px;"></span>
        </div>
      </div>

      <!-- Shared: From Name + Test -->
      <div class="mt-24" style="border-top: 1px solid var(--border-color); padding-top: 20px;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="delivery-from-name">Sender Display Name</label>
            <input class="form-input" type="text" id="delivery-from-name"
              value="${escapeAttr(config.from_name || currentEvent?.name || '')}"
              placeholder="e.g., TechFest 2026">
            <p class="form-hint">Recipients will see this as the sender name.</p>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: center; margin-top: 16px;">
          <button class="btn btn-outline btn-sm" id="test-email-btn">📧 Send Test Email</button>
          <span id="test-email-status" class="text-muted" style="font-size: 0.8rem;"></span>
        </div>
      </div>
    </div>
  `;

  // Load redirect URI
  const uriDisplay = document.getElementById('gmail-redirect-uri-display');
  if (uriDisplay) {
    try {
      const { redirectUri } = await getGmailAuthUrl(eventId).catch(() => ({ redirectUri: '' }));
      uriDisplay.textContent = redirectUri || `${window.API_BASE_URL || ''}/api/events/gmail/callback`;
    } catch {
      uriDisplay.textContent = 'Save credentials first to see redirect URI';
    }
  }

  // Provider toggle
  document.querySelectorAll('input[name="email-provider"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const val = radio.value;
      document.getElementById('gmail-config-section').style.display = val === 'gmail' ? 'block' : 'none';
      document.getElementById('resend-config-section').style.display = val === 'resend' ? 'block' : 'none';
      document.querySelectorAll('.delivery-provider-option').forEach((opt) => {
        opt.classList.toggle('active', opt.querySelector('input').value === val);
      });
    });
  });

  // Copy redirect URI
  document.getElementById('copy-redirect-uri-btn')?.addEventListener('click', () => {
    const uri = document.getElementById('gmail-redirect-uri-display')?.textContent;
    if (uri) navigator.clipboard.writeText(uri);
  });

  // Save Gmail credentials
  document.getElementById('save-gmail-creds-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('gmail-status');
    const clientId = document.getElementById('gmail-client-id').value.trim();
    const clientSecret = document.getElementById('gmail-client-secret').value.trim();
    const fromName = document.getElementById('delivery-from-name').value.trim();

    if (!clientId || !clientSecret) {
      status.textContent = 'Client ID and Secret are required';
      status.style.color = 'var(--color-danger)';
      return;
    }

    status.textContent = 'Saving...';
    status.style.color = '';

    try {
      await saveEventEmailConfig(eventId, {
        provider: 'gmail',
        gmail_client_id: clientId,
        gmail_client_secret: clientSecret,
        from_name: fromName,
      });
      status.textContent = '✓ Saved! Click "Connect Gmail" to authorize.';
      status.style.color = 'var(--color-success)';

      const connectBtn = document.getElementById('connect-gmail-btn');
      if (connectBtn) connectBtn.disabled = false;
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.style.color = 'var(--color-danger)';
    }
  });

  // Connect Gmail (OAuth flow)
  document.getElementById('connect-gmail-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('gmail-status');
    status.textContent = 'Redirecting to Google...';
    status.style.color = '';

    try {
      const { authUrl } = await getGmailAuthUrl(eventId);
      window.location.href = authUrl;
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.style.color = 'var(--color-danger)';
    }
  });

  // Disconnect Gmail
  document.getElementById('disconnect-gmail-btn')?.addEventListener('click', async () => {
    if (!confirm('Disconnect Gmail from this event? Emails will stop sending until reconnected.')) return;

    try {
      await disconnectGmail(eventId);
      renderDeliveryTab(container, eventId); // re-render
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  });

  // Save Resend config
  document.getElementById('save-resend-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('resend-status');
    const resendKey = document.getElementById('resend-api-key').value.trim();
    const fromEmail = document.getElementById('resend-from-email').value.trim();
    const fromName = document.getElementById('delivery-from-name').value.trim();

    if (!resendKey) {
      status.textContent = 'API key is required';
      status.style.color = 'var(--color-danger)';
      return;
    }

    status.textContent = 'Saving...';

    try {
      await saveEventEmailConfig(eventId, {
        provider: 'resend',
        resend_key: resendKey,
        from_email: fromEmail,
        from_name: fromName,
      });
      status.textContent = '✓ Saved';
      status.style.color = 'var(--color-success)';
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.style.color = 'var(--color-danger)';
    }
  });

  // Test email
  document.getElementById('test-email-btn')?.addEventListener('click', async () => {
    const status = document.getElementById('test-email-status');
    status.textContent = 'Sending test...';
    status.style.color = '';

    try {
      const result = await testEventEmail(eventId);
      if (result.success) {
        status.textContent = '✓ Test email sent!';
        status.style.color = 'var(--color-success)';
      } else {
        status.textContent = '✕ ' + (result.error || 'Failed');
        status.style.color = 'var(--color-danger)';
      }
    } catch (err) {
      status.textContent = '✕ ' + err.message;
      status.style.color = 'var(--color-danger)';
    }
  });

  // Handle Gmail OAuth callback query params
  const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
  if (urlParams.get('gmail') === 'success') {
    const gmailStatusEl = document.getElementById('gmail-status');
    if (gmailStatusEl) {
      gmailStatusEl.textContent = '✓ Gmail connected: ' + (urlParams.get('email') || '');
      gmailStatusEl.style.color = 'var(--color-success)';
    }
    // Clean URL
    window.history.replaceState(null, '', window.location.hash.split('?')[0]);
  } else if (urlParams.get('gmail') === 'error') {
    const gmailStatusEl = document.getElementById('gmail-status');
    if (gmailStatusEl) {
      gmailStatusEl.textContent = '✕ OAuth failed: ' + (urlParams.get('reason') || 'Unknown');
      gmailStatusEl.style.color = 'var(--color-danger)';
    }
  }
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Email Template Tab ───────────────────────────────────────────

function renderEmailTemplateTab(container, eventId) {
  renderEmailEditor(container, currentEvent);
}

// ─── Ticket/PDF Template Tab ──────────────────────────────────────

function renderTicketTemplateTab(container, eventId) {
  renderTicketEditor(container, currentEvent);
}

// ─── Tickets Tab ────────────────────────────────────────────────────

async function renderTicketsTab(container, eventId) {
  container.innerHTML = `
    <div class="glass-card-static">
      <div class="flex flex-between" style="align-items: center; flex-wrap: wrap; gap: 12px;">
        <h3 class="heading-md">Tickets</h3>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline btn-sm" id="refresh-tickets-btn">↻ Refresh</button>
        </div>
      </div>
      <div id="tickets-table-area" class="mt-16">
        <div class="text-center" style="padding: 24px;"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  document.getElementById('refresh-tickets-btn')?.addEventListener('click', () => loadTicketsForEvent(eventId));
  await loadTicketsForEvent(eventId);
}

async function loadTicketsForEvent(eventId, page = 1) {
  const area = document.getElementById('tickets-table-area');
  if (!area) return;

  try {
    const { tickets, pagination } = await getEventTickets(eventId, page);

    if (!tickets || tickets.length === 0) {
      area.innerHTML = `
        <p class="text-muted text-center" style="padding: 24px;">
          No tickets generated yet. Upload a CSV or connect a Google Form to create tickets.
        </p>
      `;
      return;
    }

    let html = '<div class="data-table-wrapper"><table class="data-table"><thead><tr>';
    html += '<th>Name</th><th>Email</th><th>Email</th><th>Scans</th><th>Status</th><th></th>';
    html += '</tr></thead><tbody>';

    for (const t of tickets) {
      const emailBadge = t.email_sent
        ? '<span class="badge badge-success">Sent</span>'
        : '<span class="badge badge-pending">Pending</span>';
      const attendBadge = t.attendance_status === 'present'
        ? '<span class="badge badge-success">Present</span>'
        : '<span class="badge badge-muted">Absent</span>';

      html += `<tr>
        <td>${t.student_name}</td>
        <td style="font-size:0.8rem;">${t.email || '—'}</td>
        <td>${emailBadge}</td>
        <td>${t.scan_count || 0}</td>
        <td>${attendBadge}</td>
        <td><button class="btn btn-outline btn-sm resend-btn" data-id="${t.id}">Resend</button></td>
      </tr>`;
    }

    html += '</tbody></table></div>';

    // Pagination
    if (pagination.totalPages > 1) {
      html += '<div class="mt-16 text-center">';
      for (let p = 1; p <= pagination.totalPages; p++) {
        html += `<button class="btn btn-sm ${p === pagination.page ? 'btn-primary' : 'btn-outline'} page-btn" data-page="${p}" style="margin: 0 4px;">${p}</button>`;
      }
      html += '</div>';
    }

    area.innerHTML = html;

    // Resend handlers
    area.querySelectorAll('.resend-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await resendEmail(btn.dataset.id);
          btn.textContent = '✓';
        } catch {
          btn.textContent = '✕';
        }
      });
    });

    // Pagination handlers
    area.querySelectorAll('.page-btn').forEach((btn) => {
      btn.addEventListener('click', () => loadTicketsForEvent(eventId, parseInt(btn.dataset.page)));
    });
  } catch (err) {
    area.innerHTML = `<p class="text-muted text-center" style="padding: 24px;">Failed to load: ${err.message}</p>`;
  }
}

// ─── Attendance Tab ─────────────────────────────────────────────────

async function renderAttendanceTab(container, eventId) {
  container.innerHTML = `
    <div class="glass-card-static">
      <div class="flex flex-between" style="align-items: center; flex-wrap: wrap; gap: 12px;">
        <h3 class="heading-md">Attendance</h3>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline btn-sm" id="export-attendance-btn">📥 Export CSV</button>
          <button class="btn btn-outline btn-sm" id="refresh-attendance-btn">↻ Refresh</button>
        </div>
      </div>
      <div id="attendance-area" class="mt-16">
        <div class="text-center" style="padding: 24px;"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  document.getElementById('refresh-attendance-btn')?.addEventListener('click', () => loadAttendance(eventId));
  document.getElementById('export-attendance-btn')?.addEventListener('click', () => exportAttendance(eventId));
  await loadAttendance(eventId);
}

async function loadAttendance(eventId) {
  const area = document.getElementById('attendance-area');
  if (!area) return;

  try {
    const data = await getEventAttendance(eventId);

    const pct = data.total > 0 ? Math.round((data.presentCount / data.total) * 100) : 0;

    let html = `
      <div class="stats-grid mb-24" style="grid-template-columns: repeat(3, 1fr);">
        <div class="stat-card">
          <div class="stat-value">${data.total}</div>
          <div class="stat-label">Registered</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: var(--color-success);">${data.presentCount}</div>
          <div class="stat-label">Present</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: var(--color-danger);">${data.absentCount}</div>
          <div class="stat-label">Absent</div>
        </div>
      </div>

      <div class="progress-container mb-24">
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="progress-text">
          <span>Attendance Rate</span>
          <span>${pct}%</span>
        </div>
      </div>
    `;

    if (data.attendees && data.attendees.length > 0) {
      html += '<div class="data-table-wrapper"><table class="data-table"><thead><tr>';
      html += '<th>Name</th><th>Email</th><th>Status</th><th>Scans</th><th>Checked In</th>';
      html += '</tr></thead><tbody>';

      for (const a of data.attendees) {
        const badge = a.attendance_status === 'present'
          ? '<span class="badge badge-success">Present</span>'
          : '<span class="badge badge-muted">Absent</span>';
        const checkedIn = a.attended_at
          ? new Date(a.attended_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : '—';

        html += `<tr>
          <td>${a.student_name}</td>
          <td style="font-size:0.8rem;">${a.email || '—'}</td>
          <td>${badge}</td>
          <td>${a.scan_count || 0}</td>
          <td>${checkedIn}</td>
        </tr>`;
      }

      html += '</tbody></table></div>';
    }

    area.innerHTML = html;
  } catch (err) {
    area.innerHTML = `<p class="text-muted text-center">${err.message}</p>`;
  }
}

async function exportAttendance(eventId) {
  try {
    const data = await getEventAttendance(eventId);
    const rows = data.attendees || [];
    if (!rows.length) { alert('No data to export'); return; }

    const keys = ['student_name', 'email', 'attendance_status', 'scan_count', 'attended_at'];
    let csv = keys.join(',') + '\n';
    rows.forEach((row) => {
      csv += keys.map((k) => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `attendance_${currentEvent?.name || 'export'}.csv`;
    a.click();
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
}

// ─── Integrations Tab ────────────────────────────────────────────────

/**
 * Escape a string for safe insertion into HTML text content (inside tags, not attributes).
 * Handles <, >, &, ", ' so code blocks with operators render correctly.
 */
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

a// ─── Integrations Tab ────────────────────────────────────────────────
// REPLACEMENT for renderIntegrationsTab in js/pages/event-detail.js
// The old version generated a script hitting /api/events/:id/webhook
// which doesn't exist. This uses the real /api/ticket endpoint.

async function renderIntegrationsTab(container, eventId) {
  container.innerHTML = `
    <div class="glass-card-static">
      <div class="text-center" style="padding: 24px;"><div class="spinner"></div></div>
    </div>
  `;

  try {
    const res = await getProfile();
    const apiKey = res.profile?.api_key;

    if (!apiKey) throw new Error('API Key not found. Go to Profile and reload.');

    const backendUrl = 'https://qr-pro-server.onrender.com';

    // ── The Apps Script uses /api/ticket (the real endpoint) ──────────
    // It sends all form fields as-is; the server uses the event's
    // column_mapping to find name + email, and event_id routes it
    // to the right event.
    const appsScriptCode = `/**
 * QR PRO – Auto Hall Ticket Generator
 * Event: ${currentEvent?.name || eventId}
 *
 * HOW TO INSTALL:
 * 1. Open your Google Form.
 * 2. Click ⋮ (top-right) → "Script editor".
 * 3. Delete all existing code and paste this entire script.
 * 4. Click 💾 Save.
 * 5. Click the Triggers icon (🕐) on the left sidebar.
 * 6. Click "+ Add Trigger" (bottom-right).
 *    - Function: onFormSubmit
 *    - Event source: From form
 *    - Event type: On form submit
 * 7. Click Save and grant permissions when Google asks.
 *
 * IMPORTANT: Make sure your Google Form question titles
 * EXACTLY match the Column Mapping you set in QR PRO
 * (Event → Column Mapping tab).
 */

// ── CONFIG (pre-filled for this event) ──────────────────────────
var API_KEY    = "${apiKey}";
var SERVER_URL = "${backendUrl}";
var EVENT_ID   = "${eventId}";
// ────────────────────────────────────────────────────────────────

function onFormSubmit(e) {
  // Wake the server first (free Render tier may be sleeping)
  try {
    UrlFetchApp.fetch(SERVER_URL + "/ping", { muteHttpExceptions: true });
  } catch (err) { /* ignore – server may still be cold-starting */ }

  // Collect every form answer into a flat key→value object.
  // Keys are the exact question titles from your Google Form.
  var payload = { event_id: EVENT_ID };
  var responses = e.response.getItemResponses();
  for (var i = 0; i < responses.length; i++) {
    var item = responses[i];
    payload[item.getItem().getTitle()] = item.getResponse();
  }

  // Send to QR PRO with retry + back-off
  var delays = [0, 8000, 20000]; // immediate, 8 s, 20 s
  for (var attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) Utilities.sleep(delays[attempt]);
    try {
      var response = UrlFetchApp.fetch(SERVER_URL + "/api/ticket", {
        method          : "post",
        contentType     : "application/json",
        headers         : { "x-api-key": API_KEY },
        payload         : JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      var body = {};
      try { body = JSON.parse(response.getContentText()); } catch (pe) {}

      if (code === 200 && body.success) {
        logResult(payload, "SUCCESS", "Ticket ID: " + (body.ticketId || "?"));
        return; // done
      }

      // 503 / 502 = server still waking – retry
      if (code === 503 || code === 502) continue;

      // Any other error – log and stop retrying
      logResult(payload, "FAILED", "HTTP " + code + " – " + (body.error || "unknown"));
      return;
    } catch (fetchErr) {
      if (attempt < delays.length - 1) continue;
      logResult(payload, "ERROR", fetchErr.toString());
    }
  }
}

// ── Logging helper ───────────────────────────────────────────────
function logResult(payload, status, detail) {
  try {
    var ss = getLinkedSheet();
    if (!ss) return;
    var sheet = ss.getSheetByName("QR PRO Log")
               || ss.insertSheet("QR PRO Log");

    // Add header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Status", "Detail", "Raw Payload"]);
      sheet.getRange("1:1").setFontWeight("bold");
    }

    var name = payload["Name"] || payload["Student Name"]
             || payload["Full Name"] || Object.values(payload)[0] || "";
    sheet.appendRow([new Date().toISOString(), name, status, detail,
                     JSON.stringify(payload)]);
  } catch (logErr) {
    console.error("Logging failed: " + logErr);
  }
}

function getLinkedSheet() {
  try {
    var form = FormApp.getActiveForm();
    var destId = form.getDestinationId();
    if (destId) return SpreadsheetApp.openById(destId);
  } catch (e) {}
  return null;
}

// ── Manual test (run from Script editor to verify config) ────────
function testConfiguration() {
  Logger.log("--- QR PRO Config Test ---");
  Logger.log("API Key : " + API_KEY.substring(0, 8) + "...");
  Logger.log("Server  : " + SERVER_URL);
  Logger.log("Event ID: " + EVENT_ID);

  try {
    var ping = UrlFetchApp.fetch(SERVER_URL + "/ping", { muteHttpExceptions: true });
    Logger.log("Ping    : HTTP " + ping.getResponseCode() + " – " + ping.getContentText());
  } catch (e) {
    Logger.log("Ping    : FAILED – " + e);
  }
  Logger.log("--- done ---");
}`;

    container.innerHTML = `
      <div class="glass-card-static animate-in">
        <h3 class="heading-md mb-8">Google Forms Integration</h3>
        <p class="text-muted mb-24" style="font-size: 0.88rem; max-width: 700px;">
          When someone submits your Google Form, QR PRO will automatically generate their
          ticket and email it to them. Make sure the <strong>Column Mapping</strong> tab is
          configured first so the server knows which question is the attendee's name and email.
        </p>

        <!-- What the script does -->
        <div style="background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.2); border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.7;">
          <strong style="color: var(--color-primary-light);">What this script does:</strong><br>
          On every form submission it collects all answers and POSTs them to
          <code style="font-size:0.78rem; color:var(--color-primary-light);">${backendUrl}/api/ticket</code>
          with your API key and event ID. The server maps the answers using your
          Column Mapping config, creates the ticket, generates the QR, and sends the email.
        </div>

        <h4 class="heading-sm mb-12">Setup Instructions</h4>
        <ol class="mb-24" style="font-size: 0.85rem; color: var(--text-secondary); padding-left: 20px; line-height: 2;">
          <li>Open your target Google Form.</li>
          <li>Click <strong>⋮</strong> (top-right) → <strong>"Script editor"</strong>.</li>
          <li>Delete any existing code. Paste the script below.</li>
          <li>Click <strong>💾 Save</strong>.</li>
          <li>Click the <strong>Triggers (🕐)</strong> icon in the left sidebar.</li>
          <li>Click <strong>+ Add Trigger</strong> → Function: <strong>onFormSubmit</strong> → Event type: <strong>On form submit</strong> → Save.</li>
          <li>Grant Google the permissions it asks for.</li>
          <li>Submit a test form response to verify everything works — check the <strong>"QR PRO Log"</strong> sheet in your linked spreadsheet.</li>
        </ol>

        <div style="position: relative; margin-bottom: 8px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <h4 class="heading-sm" style="margin:0;">Apps Script</h4>
            <button class="btn btn-primary btn-sm" id="copy-script-btn">📋 Copy Script</button>
          </div>
          <pre style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 0.78rem; border: 1px solid var(--border-color); white-space: pre; max-height: 420px; overflow-y: auto;"><code id="apps-script-code">${escapeHtmlContent(appsScriptCode)}</code></pre>
        </div>

        <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; padding: 12px 16px; font-size: 0.8rem; color: var(--color-warning);">
          ⚠️ Your API key is embedded in this script. Only share it with people you trust to send tickets on behalf of this event.
        </div>
      </div>
    `;

    document.getElementById('copy-script-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(appsScriptCode).then(() => {
        const btn = document.getElementById('copy-script-btn');
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy Script'; }, 2500);
      });
    });

  } catch (err) {
    container.innerHTML = `
      <div class="glass-card-static text-center" style="padding: 32px;">
        <p style="color: var(--color-danger);">${err.message}</p>
        <p class="text-muted mt-8" style="font-size: 0.8rem;">Please try reloading the page.</p>
      </div>
    `;
  }
}

// ── helper (add alongside existing escapeAttr in the file) ──────────
function escapeHtmlContent(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}