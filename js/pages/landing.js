import { navigate, state } from '../app.js';
import { wakeServer, getEvents, createEvent, deleteEvent } from '../utils/api.js';

let serverOnline = false;

export function renderLanding(container) {
  container.innerHTML += `
    
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="page-container">
      <div class="text-center animate-in" style="max-width: 700px; margin: 0 auto;">
        <p class="text-secondary mb-8" style="font-size: 0.9rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;">
          Hall Ticket Management System
        </p>
        <h1 class="heading-xl mb-16">
          <span class="text-gradient">QR PRO</span>
        </h1>
        <p class="text-secondary animate-in animate-in-delay-1" style="font-size: 1.05rem; line-height: 1.7; max-width: 540px; margin: 0 auto;">
          Create events, design tickets, and send them to attendees with verified QR codes.
        </p>
      </div>

      <!-- Events Section -->
      <div class="animate-in animate-in-delay-2" style="max-width: 900px; margin: 40px auto 0;">
        <div class="flex flex-between" style="align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
          <h2 class="heading-md" style="margin: 0;">Your Events</h2>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div id="server-indicator" class="server-status">
              <span class="server-dot"></span><span class="server-label">Connecting...</span>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-create-event">
              <span style="margin-right: 6px;">+</span> New Event
            </button>
          </div>
        </div>

        <div id="events-grid">
          <div class="text-center" style="padding: 60px 20px;">
            <div class="spinner"></div>
            <p class="loading-text">Loading events...</p>
          </div>
        </div>
      </div>

      <!-- Quick Generate Card -->
      <div class="animate-in animate-in-delay-3" style="max-width: 900px; margin: 40px auto 0;">
        <div class="glass-card mode-card" id="mode-manual" style="cursor: pointer;">
          <div class="mode-card-icon">📤</div>
          <h3 class="mode-card-title">Quick Generate (Offline)</h3>
          <p class="mode-card-desc">
            Upload CSV/Excel files and generate hall tickets with QR codes locally.
            <strong>No server needed — works offline.</strong>
          </p>
          <div class="mode-card-features">
            <span class="mode-feature">Upload Files</span>
            <span class="mode-feature">Generate PDFs</span>
            <span class="mode-feature">Download ZIP</span>
          </div>
          <span class="mode-card-action">Start Generating →</span>
        </div>
      </div>
    </div>

    <!-- Create Event Modal -->
    <div class="modal-overlay hidden" id="create-event-modal">
      <div class="modal-card glass-card-static" style="max-width: 480px; width: 100%;">
        <h3 class="heading-md mb-16">Create New Event</h3>
        <div class="form-group">
          <label class="form-label" for="new-event-name">Event Name</label>
          <input class="form-input" type="text" id="new-event-name"
            placeholder="e.g., Annual Day 2026, Tech Fest">
        </div>
        <div class="form-group">
          <label class="form-label" for="new-event-desc">Description (optional)</label>
          <textarea class="form-input" id="new-event-desc" rows="3"
            placeholder="Brief description of the event..."></textarea>
        </div>
        <div id="create-event-error" class="mb-16"></div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn btn-outline" id="cancel-create">Cancel</button>
          <button class="btn btn-primary" id="confirm-create">Create Event</button>
        </div>
      </div>
    </div>
  `;

  setupListeners();
  initEvents();
}

function setupListeners() {
  document.getElementById('mode-manual')?.addEventListener('click', () => navigate('/details'));

  // Create event modal
  const modal = document.getElementById('create-event-modal');
  document.getElementById('btn-create-event')?.addEventListener('click', () => {
    modal.classList.remove('hidden');
    document.getElementById('new-event-name').focus();
  });
  document.getElementById('cancel-create')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    document.getElementById('new-event-name').value = '';
    document.getElementById('new-event-desc').value = '';
    document.getElementById('create-event-error').innerHTML = '';
  });
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.getElementById('cancel-create').click();
    }
  });

  document.getElementById('confirm-create')?.addEventListener('click', handleCreateEvent);

  // Enter key to create
  document.getElementById('new-event-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCreateEvent();
  });
}

async function initEvents() {
  const indicator = document.getElementById('server-indicator');

  // Wake server
  if (indicator) {
    indicator.innerHTML = '<span class="server-dot waking"></span><span>Waking server...</span>';
  }

  serverOnline = await wakeServer();

  if (indicator) {
    indicator.innerHTML = serverOnline
      ? '<span class="server-dot awake"></span><span>Online</span>'
      : '<span class="server-dot asleep"></span><span>Offline</span>';
  }

  if (serverOnline) {
    await loadEvents();
  } else {
    renderOfflineState();
  }
}

async function loadEvents() {
  const grid = document.getElementById('events-grid');
  if (!grid) return;

  try {
    const { events } = await getEvents();

    if (!events || events.length === 0) {
      renderEmptyState(grid);
      return;
    }

    grid.innerHTML = `<div class="events-card-grid">${events.map(renderEventCard).join('')}</div>`;

    // Event card click handlers
    grid.querySelectorAll('.event-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        // Don't navigate if they clicked a button
        if (e.target.closest('.event-card-action')) return;
        const eventId = card.dataset.id;
        navigate(`/event/${eventId}`);
      });
    });

    // Delete handlers
    grid.querySelectorAll('.event-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const eventId = btn.dataset.id;
        const eventName = btn.dataset.name;
        if (!confirm(`Delete "${eventName}" and all its tickets? This cannot be undone.`)) return;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await deleteEvent(eventId);
          await loadEvents();
        } catch (err) {
          alert('Delete failed: ' + err.message);
          btn.disabled = false;
          btn.textContent = '🗑';
        }
      });
    });
  } catch (err) {
    grid.innerHTML = `
      <div class="glass-card-static text-center" style="padding: 40px;">
        <p style="color: var(--color-danger);">Failed to load events: ${err.message}</p>
        <button class="btn btn-outline btn-sm mt-16" onclick="window.location.reload()">Retry</button>
      </div>
    `;
  }
}

function renderEventCard(event) {
  const stats = event.stats || { total: 0, sent: 0, present: 0 };
  const statusColors = {
    draft: 'var(--text-muted)',
    active: 'var(--color-success)',
    completed: 'var(--color-primary-light)',
  };
  const statusLabels = { draft: 'Draft', active: 'Active', completed: 'Completed' };
  const created = new Date(event.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  // Config completeness
  const hasFields = (event.custom_fields || []).length > 0;
  const hasMapping = !!(event.column_mapping?.name_field);
  const hasEmailTpl = !!(event.email_template?.subject || event.email_template?.raw_html);
  const configDone = hasFields && hasMapping;
  const configLabel = configDone ? 'Ready' : 'Setup needed';
  const configColor = configDone ? 'var(--color-success)' : 'var(--color-warning)';

  return `
    <div class="event-card glass-card" data-id="${event.id}" style="cursor: pointer;">
      <div class="event-card-header">
        <div>
          <h3 class="event-card-title">${event.name}</h3>
          ${event.description ? `<p class="event-card-desc">${event.description}</p>` : ''}
        </div>
        <div class="event-card-actions">
          <span class="event-status-badge" style="color: ${statusColors[event.status]};">
            ${statusLabels[event.status]}
          </span>
          <button class="event-card-action event-delete-btn" data-id="${event.id}" data-name="${event.name}" title="Delete">🗑</button>
        </div>
      </div>

      <div class="event-card-stats">
        <div class="event-stat">
          <span class="event-stat-value">${stats.total}</span>
          <span class="event-stat-label">Tickets</span>
        </div>
        <div class="event-stat">
          <span class="event-stat-value" style="color: var(--color-success);">${stats.sent}</span>
          <span class="event-stat-label">Sent</span>
        </div>
        <div class="event-stat">
          <span class="event-stat-value" style="color: var(--color-primary-light);">${stats.present}</span>
          <span class="event-stat-label">Present</span>
        </div>
      </div>

      <div class="event-card-footer">
        <span class="event-card-date">${created}</span>
        <span class="event-config-badge" style="color: ${configColor}; font-size: 0.75rem;">
          ${configLabel}
        </span>
      </div>
    </div>
  `;
}

function renderEmptyState(container) {
  container.innerHTML = `
    <div class="glass-card-static text-center" style="padding: 60px 24px;">
      <div style="font-size: 3rem; margin-bottom: 16px;">📋</div>
      <h3 class="heading-md mb-8">No events yet</h3>
      <p class="text-muted mb-24" style="max-width: 400px; margin-left: auto; margin-right: auto;">
        Create your first event to start generating tickets with QR codes, email delivery, and attendance tracking.
      </p>
      <button class="btn btn-primary" id="empty-create-btn">
        <span style="margin-right: 6px;">+</span> Create Your First Event
      </button>
    </div>
  `;

  document.getElementById('empty-create-btn')?.addEventListener('click', () => {
    document.getElementById('create-event-modal')?.classList.remove('hidden');
    document.getElementById('new-event-name')?.focus();
  });
}

function renderOfflineState() {
  const grid = document.getElementById('events-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="glass-card-static text-center" style="padding: 40px;">
      <div style="font-size: 2rem; margin-bottom: 12px;">😴</div>
      <h3 class="heading-md mb-8">Server is waking up</h3>
      <p class="text-muted mb-16">
        The Render server is starting. This takes ~30 seconds on the free tier.
      </p>
      <button class="btn btn-outline btn-sm" onclick="window.location.reload()">Try Again</button>
    </div>
  `;
}

async function handleCreateEvent() {
  const nameInput = document.getElementById('new-event-name');
  const descInput = document.getElementById('new-event-desc');
  const errorDiv = document.getElementById('create-event-error');
  const btn = document.getElementById('confirm-create');

  const name = nameInput.value.trim();
  if (!name) {
    errorDiv.innerHTML = '<p class="auth-error">Event name is required</p>';
    nameInput.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating...';
  errorDiv.innerHTML = '';

  try {
    const { event } = await createEvent({
      name,
      description: descInput.value.trim(),
    });

    // Close modal
    document.getElementById('create-event-modal').classList.add('hidden');
    nameInput.value = '';
    descInput.value = '';

    // Navigate to the new event
    navigate(`/event/${event.id}`);
  } catch (err) {
    errorDiv.innerHTML = `<p class="auth-error">${err.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Event';
  }
}
