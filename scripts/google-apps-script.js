/**
 * ================================================================
 * QR PRO — Google Apps Script for Google Forms Integration
 * ================================================================
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Open your Google Form
 * 2. Click the 3-dot menu → "Script editor"
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Update YOUR_API_KEY and SERVER_URL below
 * 6. Click "Run" → "onFormSubmit" to authorize
 * 7. Go to Triggers (clock icon) → Add Trigger:
 *    - Function: onFormSubmit
 *    - Event type: On form submit
 * 8. Save and test by submitting a form response
 *
 * ================================================================
 */

// ╔══════════════════════════════════════════════════════════╗
// ║  USER CONFIGURATION — Update these values               ║
// ╚══════════════════════════════════════════════════════════╝

const API_KEY = 'YOUR_API_KEY_HERE';      // Get from QR PRO → Profile → API Key
const SERVER_URL = 'YOUR_SERVER_URL_HERE'; // e.g., https://qr-pro-server.onrender.com
const EVENT_ID = 'YOUR_EVENT_ID_HERE';     // Get from QR PRO → Events → click event → copy ID from URL

// ╔══════════════════════════════════════════════════════════╗
// ║  FORM FIELD MAPPING                                      ║
// ║  Map your Google Form question titles to field names.     ║
// ║  The server will use your saved column mapping to          ║
// ║  determine which is name, email, etc.                     ║
// ║                                                           ║
// ║  You do NOT need to change anything here unless your      ║
// ║  form has unusual question titles.                        ║
// ╚══════════════════════════════════════════════════════════╝

// The script automatically sends ALL form fields as-is.
// Your QR PRO column mapping config handles the rest.

// ================================================================
// DO NOT EDIT BELOW THIS LINE
// ================================================================

/**
 * Trigger function — called automatically when a form is submitted.
 */
function onFormSubmit(e) {
  try {
    // Wake up the server first (Render free tier may be sleeping)
    pingServer();

    // Collect all form responses as key-value pairs
    const responses = e.response.getItemResponses();
    const data = {};

    for (const itemResponse of responses) {
      const title = itemResponse.getItem().getTitle();
      const answer = itemResponse.getResponse();
      data[title] = answer;
    }

    // Send to QR PRO server
    const result = sendToServer(data);

    // Log result
    logResult(data, result);

  } catch (error) {
    logError(error.toString());
  }
}

/**
 * Ping the server to wake it up (Render free tier cold start).
 */
function pingServer() {
  try {
    UrlFetchApp.fetch(SERVER_URL + '/ping', {
      method: 'get',
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'QR-PRO-Apps-Script' },
    });
  } catch (e) {
    // Server might be waking up — that's OK, we'll retry in sendToServer
  }
}

/**
 * Send form data to the QR PRO server with retry + exponential backoff.
 */
function sendToServer(data) {
  const maxRetries = 3;
  const backoffMs = [5000, 15000, 45000]; // 5s, 15s, 45s

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(SERVER_URL + '/api/ticket', {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'x-api-key': API_KEY,
          'User-Agent': 'QR-PRO-Apps-Script',
        },
        payload: JSON.stringify({ ...data, event_id: EVENT_ID }),
        muteHttpExceptions: true,
      });

      const code = response.getResponseCode();
      const body = JSON.parse(response.getContentText());

      if (code === 200 && body.success) {
        return { success: true, ticketId: body.ticketId, attempt: attempt + 1 };
      }

      // If 503 (server waking up), retry
      if (code === 503 || code === 502 || code === 504) {
        if (attempt < maxRetries - 1) {
          Utilities.sleep(backoffMs[attempt]);
          continue;
        }
      }

      return { success: false, error: body.error || 'Unknown error', code: code };

    } catch (error) {
      if (attempt < maxRetries - 1) {
        Utilities.sleep(backoffMs[attempt]);
        continue;
      }
      return { success: false, error: error.toString() };
    }
  }

  return { success: false, error: 'All retries exhausted' };
}

/**
 * Log successful results to the "QR PRO Log" sheet.
 */
function logResult(data, result) {
  const sheet = getOrCreateLogSheet();
  const timestamp = new Date().toISOString();
  const name = Object.values(data)[0] || 'Unknown';
  const status = result.success ? 'SUCCESS' : 'FAILED';
  const detail = result.success
    ? 'Ticket ID: ' + result.ticketId
    : 'Error: ' + result.error;

  sheet.appendRow([timestamp, name, status, detail, JSON.stringify(data)]);
}

/**
 * Log errors to the log sheet.
 */
function logError(message) {
  const sheet = getOrCreateLogSheet();
  sheet.appendRow([new Date().toISOString(), '', 'ERROR', message, '']);
}

/**
 * Get or create the log sheet in the form's linked spreadsheet.
 */
function getOrCreateLogSheet() {
  const form = FormApp.getActiveForm();
  const destId = form.getDestinationId();

  let ss;
  if (destId) {
    ss = SpreadsheetApp.openById(destId);
  } else {
    // If no linked spreadsheet, create one
    ss = SpreadsheetApp.create('QR PRO Form Responses');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  }

  let logSheet = ss.getSheetByName('QR PRO Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('QR PRO Log');
    logSheet.appendRow(['Timestamp', 'Name', 'Status', 'Details', 'Raw Data']);
    logSheet.getRange('1:1').setFontWeight('bold');
    logSheet.setColumnWidth(1, 180);
    logSheet.setColumnWidth(2, 200);
    logSheet.setColumnWidth(3, 80);
    logSheet.setColumnWidth(4, 300);
    logSheet.setColumnWidth(5, 400);
  }

  return logSheet;
}

/**
 * Manual test function — run this to verify your configuration.
 * Go to Run → testConfiguration in the Apps Script editor.
 */
function testConfiguration() {
  // Test 1: Ping server
  Logger.log('Testing server connection...');
  try {
    const pingResponse = UrlFetchApp.fetch(SERVER_URL + '/ping', {
      method: 'get',
      muteHttpExceptions: true,
    });
    Logger.log('Ping response: ' + pingResponse.getContentText());
  } catch (e) {
    Logger.log('Ping failed: ' + e.toString());
  }

  // Test 2: Verify API key
  Logger.log('Testing API key...');
  try {
    const testData = { test: 'configuration_check' };
    const response = UrlFetchApp.fetch(SERVER_URL + '/api/ticket', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': API_KEY },
      payload: JSON.stringify({ test: 'configuration_check', event_id: EVENT_ID }),
      muteHttpExceptions: true,
    });
    Logger.log('API response (' + response.getResponseCode() + '): ' + response.getContentText());
  } catch (e) {
    Logger.log('API test failed: ' + e.toString());
  }

  Logger.log('Configuration test complete. Check the logs above.');
}
