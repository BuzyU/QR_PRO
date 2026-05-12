/**
 * QR PRO Backend API Client
 * Handles server communication with wake-up detection, retries, and auth headers.
 */

const SERVER_URL = 'https://qr-pro-server.onrender.com';

let _serverAwake = false;
let _lastPing = 0;
const PING_CACHE_MS = 10 * 60 * 1000; // 10 min

/**
 * Get the current user's Firebase UID for auth headers.
 */
function getUserId() {
  // Import dynamically to avoid circular dependency
  const { state } = window.__qrProApp || {};
  return state?.currentUser?.uid || '';
}

/**
 * Wake up the Render server. Returns a promise that resolves when alive.
 * Shows a loading indicator if provided.
 * @param {Function} [onWaking] - callback when wake-up starts
 * @returns {Promise<boolean>}
 */
export async function wakeServer(onWaking) {
  // Skip if recently pinged
  if (_serverAwake && Date.now() - _lastPing < PING_CACHE_MS) {
    return true;
  }

  if (onWaking) onWaking();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const res = await fetch(`${SERVER_URL}/ping`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      _serverAwake = true;
      _lastPing = Date.now();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Make an authenticated API request to the backend.
 * @param {string} path - API path (e.g., '/api/tickets')
 * @param {Object} options - fetch options
 * @returns {Promise<Object>} parsed JSON response
 */
async function apiRequest(path, options = {}) {
  const url = `${SERVER_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getUserId()}`,
    ...options.headers,
  };

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

// ─── Profile ────────────────────────────────────────────────────────

export async function getProfile() {
  return apiRequest('/api/profile');
}

export async function updateProfile(data) {
  return apiRequest('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function saveSMTP(fromEmail, resendKey) {
  return apiRequest('/api/profile/smtp', {
    method: 'PUT',
    body: JSON.stringify({ from_email: fromEmail, resend_key: resendKey }),
  });
}

export async function testSMTP(fromEmail, resendKey) {
  return apiRequest('/api/profile/smtp/test', {
    method: 'POST',
    body: JSON.stringify({ from_email: fromEmail, resend_key: resendKey }),
  });
}

export async function rotateApiKey() {
  return apiRequest('/api/profile/api-key/rotate', { method: 'POST' });
}

export async function saveColumnMapping(mapping) {
  return apiRequest('/api/profile/column-mapping', {
    method: 'PUT',
    body: JSON.stringify(mapping),
  });
}

export async function saveTicketTemplate(template) {
  return apiRequest('/api/profile/ticket-template', {
    method: 'PUT',
    body: JSON.stringify(template),
  });
}

export async function getTicketTemplate() {
  return apiRequest('/api/profile/ticket-template');
}

// ─── Events ─────────────────────────────────────────────────────────

export async function getEvents() {
  return apiRequest('/api/events');
}

export async function getEvent(eventId) {
  return apiRequest(`/api/events/${eventId}`);
}

export async function createEvent(data) {
  return apiRequest('/api/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEvent(eventId, data) {
  return apiRequest(`/api/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEvent(eventId) {
  return apiRequest(`/api/events/${eventId}`, { method: 'DELETE' });
}

export async function saveEventFields(eventId, custom_fields) {
  return apiRequest(`/api/events/${eventId}/fields`, {
    method: 'PUT',
    body: JSON.stringify({ custom_fields }),
  });
}

export async function saveEventColumnMapping(eventId, mapping) {
  return apiRequest(`/api/events/${eventId}/column-mapping`, {
    method: 'PUT',
    body: JSON.stringify(mapping),
  });
}

export async function saveEventEmailTemplate(eventId, email_template) {
  return apiRequest(`/api/events/${eventId}/email-template`, {
    method: 'PUT',
    body: JSON.stringify({ email_template }),
  });
}

export async function saveEventTicketTemplate(eventId, data) {
  return apiRequest(`/api/events/${eventId}/ticket-template`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getEventTickets(eventId, page = 1, limit = 50) {
  return apiRequest(`/api/events/${eventId}/tickets?page=${page}&limit=${limit}`);
}

export async function getEventAttendance(eventId) {
  return apiRequest(`/api/events/${eventId}/attendance`);
}

// ─── Per-Event Email Delivery ───────────────────────────────────────

export async function getEventEmailConfig(eventId) {
  return apiRequest(`/api/events/${eventId}/email-config`);
}

export async function saveEventEmailConfig(eventId, config) {
  return apiRequest(`/api/events/${eventId}/email-config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function getGmailAuthUrl(eventId) {
  return apiRequest(`/api/events/${eventId}/gmail/auth-url`);
}

export async function testEventEmail(eventId, to) {
  return apiRequest(`/api/events/${eventId}/email-config/test`, {
    method: 'POST',
    body: JSON.stringify({ to }),
  });
}

export async function disconnectGmail(eventId) {
  return apiRequest(`/api/events/${eventId}/gmail/disconnect`, {
    method: 'DELETE',
  });
}

// ─── Admin (legacy / global) ────────────────────────────────────────

export async function getTickets(page = 1, limit = 50) {
  return apiRequest(`/api/tickets?page=${page}&limit=${limit}`);
}

export async function resendEmail(ticketId) {
  return apiRequest(`/api/resend/${ticketId}`, { method: 'POST' });
}

export async function getBatches() {
  return apiRequest('/api/batches');
}

export async function exportTickets() {
  return apiRequest('/api/export');
}

export async function getQueueStats() {
  return apiRequest('/api/queue-stats');
}

// ─── File Upload (server-side) ──────────────────────────────────────

export async function uploadFileToServer(file, metadata) {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata.institution) formData.append('institution', metadata.institution);
  if (metadata.event) formData.append('event', metadata.event);
  if (metadata.year) formData.append('year', metadata.year);
  if (metadata.eventId) formData.append('eventId', metadata.eventId);

  return apiRequest('/api/upload', {
    method: 'POST',
    body: formData,
  });
}

// ─── Verification ───────────────────────────────────────────────────

export async function verifyToken(token) {
  const res = await fetch(`${SERVER_URL}/api/verify?token=${token}`);
  return res.json();
}
