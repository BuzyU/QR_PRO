import { navigate, state } from '../app.js';
import { getProfile, updateProfile, saveSMTP, testSMTP, rotateApiKey, saveColumnMapping } from '../utils/api.js';
import { wakeServer } from '../utils/api.js';

export function renderProfile(container) {
  container.innerHTML += `
    <div class="bg-orbs"><div class="orb orb-2"></div></div>
    <div class="page-container">
      <div style="max-width:680px;margin:0 auto;">
        <h1 class="heading-lg text-center animate-in mb-8">
          <span class="text-gradient">Profile & Settings</span>
        </h1>
        <p class="text-secondary text-center animate-in animate-in-delay-1 mb-24">
          Manage your account, SMTP configuration, and column mapping.
        </p>

        <div id="profile-content">
          <div class="text-center" style="padding:40px 0;">
            <div class="spinner"></div>
            <p class="loading-text">Loading profile...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  loadProfile();
}

async function loadProfile() {
  const content = document.getElementById('profile-content');
  const user = state.currentUser;

  // Try to load from server; if server is asleep, show offline state
  let profile = null;
  try {
    const serverAwake = await wakeServer();
    if (serverAwake) {
      const res = await getProfile();
      profile = res.profile;
    }
  } catch {
    // Server unavailable — show basic profile from Firebase
  }

  content.innerHTML = `
    <!-- Account Section -->
    <div class="glass-card-static animate-in mb-24">
      <h3 class="heading-md mb-16">👤 Account</h3>
      <div class="form-group">
        <label class="form-label" for="profile-name">Display Name</label>
        <input class="form-input" type="text" id="profile-name"
          value="${user.displayName || ''}" placeholder="Your name">
      </div>
      <div class="form-group">
        <label class="form-label" for="profile-institution">Institution Name</label>
        <input class="form-input" type="text" id="profile-institution"
          value="${profile?.institution_name || ''}" placeholder="e.g., Dr. D.Y. Patil University">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" type="text" value="${user.email || ''}" disabled
          style="opacity:0.6;cursor:not-allowed;">
      </div>
      <button class="btn btn-primary btn-sm" id="save-account">Save Changes</button>
    </div>

    <!-- API Key Section -->
    <div class="glass-card-static animate-in animate-in-delay-1 mb-24">
      <h3 class="heading-md mb-8">🔑 API Key</h3>
      <p class="text-muted mb-16" style="font-size:0.82rem;">
        Used in Google Apps Script to connect forms to your account. Keep it secret.
      </p>
      <div class="api-key-box">
        <code id="api-key-display">${profile?.api_key || 'Connect to server to view'}</code>
        <button class="btn btn-outline btn-sm" id="copy-api-key" title="Copy">📋 Copy</button>
      </div>
      <button class="btn btn-outline btn-sm mt-16" id="rotate-api-key" style="color:var(--color-warning);">
        🔄 Rotate Key
      </button>
      <p class="text-muted mt-8" style="font-size:0.75rem;">
        Rotating will invalidate your current key. Update your Apps Script after rotating.
      </p>
    </div>

    <!-- SMTP Section -->
    <div class="glass-card-static animate-in animate-in-delay-2 mb-24">
      <h3 class="heading-md mb-8">📧 Gmail SMTP</h3>
      <p class="text-muted mb-16" style="font-size:0.82rem;">
        Configure your Gmail to send hall ticket emails. Requires a Gmail App Password.
        <a href="#/setup" style="color:var(--color-primary-light);">See setup guide →</a>
      </p>
      ${profile?.smtp_configured ? `
        <div class="smtp-status smtp-ok">
          <span>✅ Configured</span>
          <span class="text-muted">${profile.smtp_email || 'Email configured'}</span>
        </div>
      ` : `
        <div class="smtp-status smtp-none">
          <span>⚠️ Not configured</span>
          <span class="text-muted">Email sending is disabled</span>
        </div>
      `}
      <div class="form-group mt-16">
        <label class="form-label" for="smtp-email">Gmail Address</label>
        <input class="form-input" type="email" id="smtp-email" placeholder="you@gmail.com">
      </div>
      <div class="form-group">
        <label class="form-label" for="smtp-pass">App Password</label>
        <input class="form-input" type="password" id="smtp-pass" placeholder="16-character app password">
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" id="test-smtp">📤 Test Connection</button>
        <button class="btn btn-primary btn-sm" id="save-smtp">💾 Save SMTP</button>
      </div>
      <div id="smtp-result" class="mt-16"></div>
    </div>

    <!-- Column Mapping Section -->
    <div class="glass-card-static animate-in animate-in-delay-3 mb-24">
      <h3 class="heading-md mb-8">📋 Column Mapping</h3>
      <p class="text-muted mb-16" style="font-size:0.82rem;">
        Define which columns from your uploaded files or Google Form map to Name, Email, and ticket fields.
        These settings are reused across all your uploads and form submissions.
      </p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="map-name">Name Column</label>
          <input class="form-input" type="text" id="map-name"
            value="${profile?.column_mapping?.name_field || ''}"
            placeholder="e.g., Student Name">
        </div>
        <div class="form-group">
          <label class="form-label" for="map-email">Email Column</label>
          <input class="form-input" type="text" id="map-email"
            value="${profile?.column_mapping?.email_field || ''}"
            placeholder="e.g., Email ID">
        </div>
      </div>

      <div id="custom-fields-list" class="mb-16">
        <label class="form-label">Custom Fields</label>
        <p class="text-muted mb-8" style="font-size:0.75rem;">
          Add columns from your data. Toggle visibility to show/hide on the ticket.
        </p>
        <div id="fields-container"></div>
        <button class="btn btn-outline btn-sm mt-8" id="add-field-btn">+ Add Field</button>
      </div>

      <button class="btn btn-primary btn-sm" id="save-mapping">Save Mapping</button>
    </div>
  `;

  // Populate existing custom fields
  const fields = profile?.column_mapping?.fields || [];
  const fieldsContainer = document.getElementById('fields-container');
  fields.forEach((f) => addFieldRow(fieldsContainer, f));

  setupProfileListeners(profile);
}

function addFieldRow(container, field = {}) {
  const row = document.createElement('div');
  row.className = 'custom-field-row';
  row.innerHTML = `
    <input class="form-input field-source" type="text" value="${field.source || ''}" placeholder="Column name in file">
    <input class="form-input field-label" type="text" value="${field.label || ''}" placeholder="Display label">
    <label class="field-visible-toggle">
      <input type="checkbox" class="field-visible" ${field.visible_on_ticket !== false ? 'checked' : ''}>
      <span class="text-muted" style="font-size:0.75rem;">On ticket</span>
    </label>
    <button class="btn-remove-field" title="Remove">✕</button>
  `;
  row.querySelector('.btn-remove-field').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function setupProfileListeners(profile) {
  // Save account
  document.getElementById('save-account')?.addEventListener('click', async () => {
    const btn = document.getElementById('save-account');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await updateProfile({
        display_name: document.getElementById('profile-name').value.trim(),
        institution_name: document.getElementById('profile-institution').value.trim(),
      });
      btn.textContent = '✓ Saved';
      setTimeout(() => { btn.textContent = 'Save Changes'; btn.disabled = false; }, 2000);
    } catch (err) {
      btn.textContent = 'Error';
      btn.disabled = false;
    }
  });

  // Copy API key
  document.getElementById('copy-api-key')?.addEventListener('click', () => {
    const key = document.getElementById('api-key-display').textContent;
    navigator.clipboard.writeText(key);
    const btn = document.getElementById('copy-api-key');
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
  });

  // Rotate API key
  document.getElementById('rotate-api-key')?.addEventListener('click', async () => {
    if (!confirm('Rotate your API key? Your current key will stop working immediately.')) return;
    try {
      const res = await rotateApiKey();
      document.getElementById('api-key-display').textContent = res.api_key;
    } catch (err) {
      alert('Failed to rotate: ' + err.message);
    }
  });

  // Test SMTP
  document.getElementById('test-smtp')?.addEventListener('click', async () => {
    const email = document.getElementById('smtp-email').value.trim();
    const pass = document.getElementById('smtp-pass').value.trim();
    const result = document.getElementById('smtp-result');
    if (!email || !pass) { result.innerHTML = '<p class="auth-error">Enter both fields</p>'; return; }
    result.innerHTML = '<p class="text-muted">Testing...</p>';
    try {
      await testSMTP(email, pass);
      result.innerHTML = '<p class="auth-success">✅ Test email sent! Check your inbox.</p>';
    } catch (err) {
      result.innerHTML = `<p class="auth-error">❌ ${err.message}</p>`;
    }
  });

  // Save SMTP
  document.getElementById('save-smtp')?.addEventListener('click', async () => {
    const email = document.getElementById('smtp-email').value.trim();
    const pass = document.getElementById('smtp-pass').value.trim();
    const result = document.getElementById('smtp-result');
    if (!email || !pass) { result.innerHTML = '<p class="auth-error">Enter both fields</p>'; return; }
    try {
      await saveSMTP(email, pass);
      result.innerHTML = '<p class="auth-success">✅ SMTP credentials saved (encrypted)</p>';
    } catch (err) {
      result.innerHTML = `<p class="auth-error">❌ ${err.message}</p>`;
    }
  });

  // Add field
  document.getElementById('add-field-btn')?.addEventListener('click', () => {
    addFieldRow(document.getElementById('fields-container'));
  });

  // Save mapping
  document.getElementById('save-mapping')?.addEventListener('click', async () => {
    const nameField = document.getElementById('map-name').value.trim();
    const emailField = document.getElementById('map-email').value.trim();
    if (!nameField || !emailField) { alert('Name and Email columns are required'); return; }

    const fields = [];
    document.querySelectorAll('.custom-field-row').forEach((row) => {
      const source = row.querySelector('.field-source').value.trim();
      const label = row.querySelector('.field-label').value.trim();
      const visible = row.querySelector('.field-visible').checked;
      if (source) {
        fields.push({ source, label: label || source, visible_on_ticket: visible });
      }
    });

    try {
      await saveColumnMapping({ name_field: nameField, email_field: emailField, fields });
      const btn = document.getElementById('save-mapping');
      btn.textContent = '✓ Saved';
      setTimeout(() => { btn.textContent = 'Save Mapping'; }, 2000);
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  });
}
