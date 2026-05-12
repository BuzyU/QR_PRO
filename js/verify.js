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
      await verifyWithToken(app, token);
    } else {
      await verifyWithId(app, studentId);
    }
  } catch (err) {
    renderError(app, 'Could not verify ticket. Please try again later.');
  }
}

/**
 * Token-based verification via the Render backend.
 * Shows attendance status on first/repeat scans.
 */
async function verifyWithToken(app, token) {
  try {
    const result = await verifyToken(token);

    if (result.status === 'VERIFIED') {
      renderVerifiedToken(app, result.ticket, result.isFirstScan);
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
 * Shows dynamic fields from event config + attendance status.
 */
function renderVerifiedToken(app, ticket, isFirstScan) {
  // Build dynamic field rows from the event's visible fields
  const fieldRows = (ticket.fields || [])
    .map((f) => `
      <div class="verify-field">
        <span class="verify-field-label">${f.label}</span>
        <span class="verify-field-value">${f.value || '—'}</span>
      </div>
    `)
    .join('');

  // Fallback: render metadata directly if no event fields available
  const metadataRows = !ticket.fields?.length
    ? Object.entries(ticket.metadata || {})
        .map(([key, value]) => `
          <div class="verify-field">
            <span class="verify-field-label">${key}</span>
            <span class="verify-field-value">${value || '—'}</span>
          </div>
        `)
        .join('')
    : '';

  // Attendance status UI
  const isPresent = ticket.attendanceStatus === 'present';
  let attendanceBanner;

  if (isFirstScan) {
    attendanceBanner = `
      <div class="attendance-banner attendance-granted">
        <span class="attendance-icon">🟢</span>
        <div>
          <strong>Entry Granted</strong>
          <span class="attendance-detail">First scan — welcome!</span>
        </div>
      </div>
    `;
  } else if (isPresent) {
    attendanceBanner = `
      <div class="attendance-banner attendance-warning">
        <span class="attendance-icon">🟡</span>
        <div>
          <strong>Already Entered</strong>
          <span class="attendance-detail">Checked in at ${ticket.attendedAt ? new Date(ticket.attendedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
        </div>
      </div>
    `;
  } else {
    attendanceBanner = '';
  }

  app.innerHTML = `
    
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

          ${attendanceBanner}

          <div class="verify-field">
            <span class="verify-field-label">Name</span>
            <span class="verify-field-value">${ticket.name}</span>
          </div>

          ${ticket.event ? `
          <div class="verify-field">
            <span class="verify-field-label">Event</span>
            <span class="verify-field-value">${ticket.event}</span>
          </div>` : ''}

          ${fieldRows}
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
