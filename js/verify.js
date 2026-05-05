import { supabase } from './supabase.js';
import { verifyToken } from './utils/api.js';

async function init() {
  const app = document.getElementById('verify-app');
  const params = new URLSearchParams(window.location.search);
  const studentId = params.get('id');
  const token = params.get('token');

  if (!studentId && !token) {
    renderError(app, 'No ticket ID or token provided. Please scan a valid QR code.');
    return;
  }

  // Show loading state
  app.innerHTML = `
    <div class="bg-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>
    <div class="page-center" style="position: relative; z-index: 1;">
      <div class="verify-container text-center">
        <div class="spinner"></div>
        <p class="loading-text">Verifying ticket...</p>
      </div>
    </div>
  `;

  try {
    if (token) {
      // NEW: Token-based verification via backend
      await verifyWithToken(app, token);
    } else {
      // LEGACY: Direct Supabase lookup by UUID
      await verifyWithId(app, studentId);
    }
  } catch (err) {
    renderError(app, 'Could not verify ticket. Please try again later.');
  }
}

/**
 * Token-based verification via the Render backend.
 * Handles server cold-start with a loading message.
 */
async function verifyWithToken(app, token) {
  try {
    const result = await verifyToken(token);

    if (result.status === 'VERIFIED') {
      renderVerifiedToken(app, result.ticket);
    } else if (result.status === 'NOT_FOUND') {
      renderError(app, 'This QR code does not match any record. The ticket may be invalid or fabricated.');
    } else {
      renderError(app, result.error || 'Verification failed. Token may be invalid.');
    }
  } catch {
    renderError(app, 'Could not reach the verification server. It may be waking up — please try again in 30 seconds.');
  }
}

/**
 * Legacy verification via direct Supabase query.
 */
async function verifyWithId(app, studentId) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    renderError(app, 'Invalid or fabricated ticket. This QR code does not match any record in our database.');
    return;
  }

  renderVerifiedLegacy(app, data);
}

/**
 * Render verified state for token-based tickets.
 * Dynamically renders all metadata fields.
 */
function renderVerifiedToken(app, ticket) {
  // Build dynamic field rows from metadata
  const metadata = ticket.metadata || {};
  const metadataRows = Object.entries(metadata)
    .map(([key, value]) => `
      <div class="verify-field">
        <span class="verify-field-label">${key}</span>
        <span class="verify-field-value">${value || '—'}</span>
      </div>
    `)
    .join('');

  app.innerHTML = `
    <div class="bg-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>
    <div class="page-center" style="position: relative; z-index: 1;">
      <div class="verify-container">
        <div class="glass-card-static animate-in">
          <div class="text-center mb-24">
            <span style="font-size: 3rem; display: block; margin-bottom: 12px;">✅</span>
            <span class="verify-badge verified">
              <span>●</span> Verified Ticket
            </span>
          </div>

          <div class="verify-field">
            <span class="verify-field-label">Name</span>
            <span class="verify-field-value">${ticket.name}</span>
          </div>

          ${ticket.urn ? `
          <div class="verify-field">
            <span class="verify-field-label">URN</span>
            <span class="verify-field-value">${ticket.urn}</span>
          </div>` : ''}

          ${ticket.institution ? `
          <div class="verify-field">
            <span class="verify-field-label">Institution</span>
            <span class="verify-field-value">${ticket.institution}</span>
          </div>` : ''}

          ${ticket.event ? `
          <div class="verify-field">
            <span class="verify-field-label">Event</span>
            <span class="verify-field-value">${ticket.event}${ticket.year ? ' — ' + ticket.year : ''}</span>
          </div>` : ''}

          ${ticket.batch ? `
          <div class="verify-field">
            <span class="verify-field-label">Batch</span>
            <span class="verify-field-value">Batch ${ticket.batch}</span>
          </div>` : ''}

          ${ticket.timeSlot ? `
          <div class="verify-field">
            <span class="verify-field-label">Time Slot</span>
            <span class="verify-field-value">${ticket.timeSlot}</span>
          </div>` : ''}

          ${metadataRows}

          <div class="verify-field" style="border-top: 1px solid var(--border-color); margin-top: 16px; padding-top: 16px;">
            <span class="verify-field-label">Scan Count</span>
            <span class="verify-field-value">${ticket.scanCount}</span>
          </div>
        </div>

        <p class="text-muted text-center mt-24" style="font-size: 0.75rem;">
          Verified at: ${new Date(ticket.lastScanned).toLocaleString()}
        </p>
      </div>
    </div>
  `;
}

/**
 * Render verified state for legacy (ID-based) tickets.
 */
function renderVerifiedLegacy(app, student) {
  app.innerHTML = `
    <div class="bg-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>
    <div class="page-center" style="position: relative; z-index: 1;">
      <div class="verify-container">
        <div class="glass-card-static animate-in">
          <div class="text-center mb-24">
            <span style="font-size: 3rem; display: block; margin-bottom: 12px;">✅</span>
            <span class="verify-badge verified">
              <span>●</span> Verified Ticket
            </span>
          </div>

          <div class="verify-field">
            <span class="verify-field-label">Student Name</span>
            <span class="verify-field-value">${student.student_name}</span>
          </div>

          <div class="verify-field">
            <span class="verify-field-label">URN</span>
            <span class="verify-field-value">${student.urn || 'N/A'}</span>
          </div>

          <div class="verify-field">
            <span class="verify-field-label">Time Slot</span>
            <span class="verify-field-value">${student.time_slot}</span>
          </div>

          <div class="verify-field">
            <span class="verify-field-label">Batch</span>
            <span class="verify-field-value">Batch ${student.batch_number}</span>
          </div>

          <div class="verify-field">
            <span class="verify-field-label">Institution</span>
            <span class="verify-field-value">${student.institution_name}</span>
          </div>

          <div class="verify-field">
            <span class="verify-field-label">Event</span>
            <span class="verify-field-value">${student.event_name}${student.year ? ' — ' + student.year : ''}</span>
          </div>
        </div>

        <p class="text-muted text-center mt-24" style="font-size: 0.75rem;">
          Ticket ID: ${student.id}<br>
          Verified at: ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  `;
}

function renderError(app, message) {
  app.innerHTML = `
    <div class="bg-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>
    <div class="page-center" style="position: relative; z-index: 1;">
      <div class="verify-container">
        <div class="glass-card-static animate-in text-center">
          <span style="font-size: 3rem; display: block; margin-bottom: 12px;">❌</span>
          <span class="verify-badge invalid">
            <span>●</span> Verification Failed
          </span>

          <p style="color: var(--text-secondary); margin-top: 24px; font-size: 0.95rem; line-height: 1.6;">
            ${message}
          </p>
        </div>
      </div>
    </div>
  `;
}

// Initialize
init();
