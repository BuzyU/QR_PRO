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

// --- Profile ---

export async function getProfile() {
  return apiRequest('/api/profile');
}

export async function updateProfile(data) {
  return apiRequest('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function saveSMTP(gmailUser, gmailAppPassword) {
  return apiRequest('/api/profile/smtp', {
    method: 'PUT',
    body: JSON.stringify({ gmail_user: gmailUser, gmail_app_password: gmailAppPassword }),
  });
}

export async function testSMTP(gmailUser, gmailAppPassword) {
  return apiRequest('/api/profile/smtp/test', {
    method: 'POST',
    body: JSON.stringify({ gmail_user: gmailUser, gmail_app_password: gmailAppPassword }),
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

// --- Admin ---

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

// --- File Upload (server-side) ---

export async function uploadFileToServer(file, metadata) {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata.institution) formData.append('institution', metadata.institution);
  if (metadata.event) formData.append('event', metadata.event);
  if (metadata.year) formData.append('year', metadata.year);

  return apiRequest('/api/upload', {
    method: 'POST',
    body: formData,
  });
}

// --- Verification ---

export async function verifyToken(token) {
  const res = await fetch(`${SERVER_URL}/api/verify?token=${token}`);
  return res.json();
}
