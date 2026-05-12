import { state } from '../app.js';

export function renderSetupWizard(container) {
  const user = state.currentUser;
  container.innerHTML += `
    </div>
    <div class="page-container">
      <div style="max-width:720px;margin:0 auto;">
        <h1 class="heading-lg text-center animate-in mb-8"><span class="text-gradient">Setup Guide</span></h1>
        <p class="text-secondary text-center animate-in animate-in-delay-1 mb-32">
          Follow these steps to configure your events, email delivery, and Google Forms integration.
        </p>

        <!-- Step 1: Create an Event -->
        <div class="glass-card-static animate-in animate-in-delay-2 mb-24">
          <div class="setup-step-header"><span class="setup-step-num">1</span><h3 class="heading-md">Create an Event</h3></div>
          <div class="setup-step-body">
            <p>Everything in QR PRO is now organized by Event. Start by creating one:</p>
            <ol class="setup-list">
              <li>Go to your <a href="#/">Dashboard</a> and click <strong>New Event</strong>.</li>
              <li>Give it a name and description.</li>
              <li>Click on the event card to open the <strong>Event Details</strong> dashboard.</li>
            </ol>
          </div>
        </div>

        <!-- Step 2: Custom Fields & Mapping -->
        <div class="glass-card-static animate-in animate-in-delay-3 mb-24">
          <div class="setup-step-header"><span class="setup-step-num">2</span><h3 class="heading-md">Configure Fields & Data</h3></div>
          <div class="setup-step-body">
            <p>Tell QR PRO what data you want to collect and display for this event:</p>
            <ol class="setup-list">
              <li>In your Event Dashboard, go to the <strong>Custom Fields</strong> tab.</li>
              <li>Add fields like "Roll No" or "Department", and choose if they appear on the ticket or email.</li>
              <li>Go to the <strong>Column Mapping</strong> tab.</li>
              <li>Enter the EXACT column headers from your CSV or Google Form (e.g., "Email Address" or "Student Name").</li>
            </ol>
          </div>
        </div>

        <!-- Step 3: Email Delivery -->
        <div class="glass-card-static animate-in animate-in-delay-4 mb-24">
          <div class="setup-step-header"><span class="setup-step-num">3</span><h3 class="heading-md">Email Delivery Setup</h3></div>
          <div class="setup-step-body">
            <p>Configure how tickets are sent for this event. Each event can have its own sender.</p>
            <ol class="setup-list">
              <li>Go to the <strong>Delivery</strong> tab in your Event Dashboard.</li>
              <li>Choose your provider: <strong>Gmail API</strong> (Free, unlimited*) or <strong>Resend</strong>.</li>
              <li>For Gmail: Create OAuth credentials in Google Cloud, enter your Client ID & Secret, and click <strong>Connect Gmail</strong>.</li>
              <li>Click <strong>Send Test Email</strong> to verify your configuration.</li>
            </ol>
            <div class="setup-note">
              <strong>Gmail Limits:</strong> Regular Gmail accounts can send 500 emails/day. Google Workspace accounts can send 2,000/day.
            </div>
          </div>
        </div>

        <!-- Step 4: Google Forms -->
        <div class="glass-card-static animate-in animate-in-delay-5 mb-24">
          <div class="setup-step-header"><span class="setup-step-num">4</span><h3 class="heading-md">Google Forms Integration</h3></div>
          <div class="setup-step-body">
            <p>Connect a Google Form to auto-generate tickets on submission:</p>
            <ol class="setup-list">
              <li>Create a Google Form. Make sure the question titles exactly match your <strong>Column Mapping</strong>.</li>
              <li>Open the form → click <strong>⋮ → Script editor</strong></li>
              <li>Delete existing code and paste the script below</li>
              <li>Replace <code>YOUR_API_KEY_HERE</code> (from <a href="#/profile">Profile</a>), <code>YOUR_SERVER_URL_HERE</code>, and <code>YOUR_EVENT_ID_HERE</code> (from the URL of your event dashboard).</li>
              <li>Click <strong>Run → onFormSubmit</strong> to authorize Google to run the script.</li>
              <li>Go to <strong>Triggers (⏰)</strong> → Add Trigger → <code>onFormSubmit</code> → On form submit.</li>
            </ol>

            <div class="setup-code-block mt-16">
              <div class="setup-code-header">
                <span>Google Apps Script</span>
                <button class="btn btn-outline btn-sm" id="copy-script">📋 Copy</button>
              </div>
              <pre class="setup-code"><code>// ═══ USER CONFIGURATION ═══
const API_KEY = 'YOUR_API_KEY_HERE';
const SERVER_URL = 'YOUR_SERVER_URL_HERE';
const EVENT_ID = 'YOUR_EVENT_ID_HERE';

function onFormSubmit(e) {
  pingServer();
  var data = {};
  var responses = e.response.getItemResponses();
  for (var i = 0; i &lt; responses.length; i++) {
    data[responses[i].getItem().getTitle()] = responses[i].getResponse();
  }
  data.event_id = EVENT_ID;
  sendToServer(data);
}

function pingServer() {
  try { UrlFetchApp.fetch(SERVER_URL + '/ping', {muteHttpExceptions:true}); } catch(e) {}
}

function sendToServer(data) {
  for (var attempt = 0; attempt &lt; 3; attempt++) {
    try {
      var res = UrlFetchApp.fetch(SERVER_URL + '/api/ticket', {
        method: 'post', contentType: 'application/json',
        headers: {'x-api-key': API_KEY},
        payload: JSON.stringify(data), muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) return;
      if (attempt &lt; 2) Utilities.sleep([5000,15000][attempt]);
    } catch(e) { if (attempt &lt; 2) Utilities.sleep([5000,15000][attempt]); }
  }
}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('copy-script')?.addEventListener('click', () => {
    const code = document.querySelector('.setup-code code')?.textContent || '';
    navigator.clipboard.writeText(code);
    const btn = document.getElementById('copy-script');
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
  });
}

