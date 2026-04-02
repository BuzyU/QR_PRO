import { supabase } from './supabase.js';

async function init() {
  const app = document.getElementById('verify-app');
  const params = new URLSearchParams(window.location.search);
  const studentId = params.get('id');

  if (!studentId) {
    renderError(app, 'No ticket ID provided. Please scan a valid QR code.');
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
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (error || !data) {
      renderError(app, 'Invalid or fabricated ticket. This QR code does not match any record in our database.');
      return;
    }

    renderVerified(app, data);
  } catch (err) {
    renderError(app, 'Could not verify ticket. Please try again later.');
  }
}

function renderVerified(app, student) {
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
