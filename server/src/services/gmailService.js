/**
 * Gmail OAuth2 + Email Sending Service (Per-Event Credentials)
 *
 * Each event stores its own Google OAuth Client ID + Secret.
 * The host goes through consent once per event, and we store
 * the refresh token encrypted in the event's email_config.
 *
 * No server-level Google credentials needed — the customer provides everything.
 */

import { google } from 'googleapis';
import { encrypt, decrypt } from '../config/crypto.js';
import { supabase } from '../config/supabase.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Generate the Gmail OAuth2 consent URL for an event.
 * Uses the host's own Client ID + Secret stored in the event.
 *
 * @param {Object} params
 * @param {string} params.clientId - host's Google OAuth Client ID
 * @param {string} params.clientSecret - host's Google OAuth Client Secret
 * @param {string} params.redirectUri - callback URL
 * @param {string} params.eventId - event ID (passed as state)
 * @returns {string} consent URL
 */
export function generateAuthUrl({ clientId, clientSecret, redirectUri, eventId }) {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: eventId,
  });
}

/**
 * Exchange an authorization code for tokens.
 *
 * @param {Object} params
 * @param {string} params.code - auth code from Google callback
 * @param {string} params.clientId
 * @param {string} params.clientSecret
 * @param {string} params.redirectUri
 * @returns {Promise<Object>} tokens { access_token, refresh_token, expiry_date }
 */
export async function exchangeCode({ code, clientId, clientSecret, redirectUri }) {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Send an email via Gmail API using per-event credentials.
 *
 * @param {Object} params
 * @param {Object} params.emailConfig - decrypted event email_config
 * @param {string} params.to - recipient email
 * @param {string} params.subject - email subject
 * @param {string} params.html - email body HTML
 * @param {string} params.fromName - sender display name
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendViaGmail({ emailConfig, to, subject, html, fromName }) {
  const {
    gmail_client_id,
    gmail_client_secret,
    gmail_refresh_token,
    gmail_email,
  } = emailConfig;

  if (!gmail_client_id || !gmail_client_secret || !gmail_refresh_token) {
    return { success: false, error: 'Gmail not connected — missing OAuth tokens' };
  }

  // We don't need a redirect URI here — just need it to refresh tokens
  const oauth2Client = new google.auth.OAuth2(gmail_client_id, gmail_client_secret);

  oauth2Client.setCredentials({
    refresh_token: gmail_refresh_token,
  });

  // Refresh the access token
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
  } catch (err) {
    return { success: false, error: `Token refresh failed: ${err.message}. Re-connect Gmail.` };
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Build the MIME message
  const from = fromName ? `${fromName} <${gmail_email}>` : gmail_email;
  const rawMessage = buildMimeMessage({ from, to, subject, html });

  try {
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    return { success: true, messageId: result.data.id };
  } catch (err) {
    return { success: false, error: `Gmail send failed: ${err.message}` };
  }
}

/**
 * Get the Gmail profile (email address) for the connected account.
 */
export async function getGmailProfile({ clientId, clientSecret, accessToken }) {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });

  try {
    const userInfo = await oauth2.userinfo.get();
    return userInfo.data.email;
  } catch (err) {
    console.error('Failed to get user info:', err.message);
    return null;
  }
}

/**
 * Build a base64url-encoded MIME message for the Gmail API.
 */
function buildMimeMessage({ from, to, subject, html }) {
  const boundary = `boundary_${Date.now()}`;

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf-8').toString('base64'),
    '',
    `--${boundary}--`,
  ];

  const raw = lines.join('\r\n');
  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Helper: Read decrypted email_config from an event.
 */
export function decryptEmailConfig(encryptedConfig) {
  if (!encryptedConfig) return null;
  try {
    return JSON.parse(decrypt(encryptedConfig));
  } catch {
    return null;
  }
}

/**
 * Helper: Encrypt email_config for storage.
 */
export function encryptEmailConfig(config) {
  return encrypt(JSON.stringify(config));
}
