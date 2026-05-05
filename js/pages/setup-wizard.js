import { state } from '../app.js';

export function renderSetupWizard(container) {
  const user = state.currentUser;
  container.innerHTML += `
    <div class="bg-orbs"><div class="orb orb-3"></div></div>
    <div class="page-container">
      <div style="max-width:720px;margin:0 auto;">
        <h1 class="heading-lg text-center animate-in mb-8"><span class="text-gradient">Setup Guide</span></h1>
        <p class="text-secondary text-center animate-in animate-in-delay-1 mb-32">
          Follow these steps to configure email sending and Google Forms integration.
        </p>

        <!-- Step 1: Gmail SMTP -->
        <div class="glass-card-static animate-in animate-in-delay-2 mb-24">
          <div class="setup-step-header"><span class="setup-step-num">1</span><h3 class="heading-md">Gmail SMTP Setup</h3></div>
          <div class="setup-step-body">
            <p>Enable your Gmail to send hall ticket emails:</p>
            <ol class="setup-list">
              <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener">Google Account → Security</a></li>
              <li>Enable <strong>2-Step Verification</strong> if not already on</li>
              <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener">App Passwords</a></li>
              <li>Select app: <strong>Mail</strong>, device: <strong>Other</strong> → name it "QR PRO"</li>
              <li>Copy the 16-character password</li>
              <li>Go to <a href="#/profile">Profile → Gmail SMTP</a> and enter your Gmail + App Password</li>
              <li>Click <strong>Test Connection</strong> to verify</li>
            </ol>
            <div class="setup-note">
              <strong>Free limit:</strong> Gmail allows 500 emails/day. For higher volume, use Google Workspace (2,000/day).
            </div>
          </div>
        </div>

        <!-- Step 2: Column Mapping -->
        <div class="glass-card-static animate-in animate-in-delay-3 mb-24">
          <div class="setup-step-header"><span class="setup-step-num">2</span><h3 class="heading-md">Column Mapping</h3></div>
          <div class="setup-step-body">
            <p>Tell QR PRO which columns in your data correspond to Name, Email, etc:</p>
            <ol class="setup-list">
              <li>Go to <a href="#/profile">Profile → Column Mapping</a></li>
              <li>Enter the exact column header names from your CSV/Form</li>
              <li>Add custom fields (Roll No, Department, etc.)</li>
              <li>Toggle <strong>"On ticket"</strong> for fields you want visible on the hall ticket</li>
              <li>Fields NOT toggled will still be stored but won't appear on tickets</li>
            </ol>
          </div>
        </div>

        <!-- Step 3: Google Forms -->
        <div class="glass-card-static animate-in animate-in-delay-4 mb-24">
          <div class="setup-step-header"><span class="setup-step-num">3</span><h3 class="heading-md">Google Forms Integration</h3></div>
          <div class="setup-step-body">
            <p>Connect a Google Form to auto-generate tickets on submission:</p>
            <ol class="setup-list">
              <li>Create your Google Form with fields matching your column mapping</li>
              <li>Open the form → click <strong>⋮ → Script editor</strong></li>
              <li>Delete existing code and paste the script below</li>
              <li>Replace <code>YOUR_API_KEY_HERE</code> with your API key from <a href="#/profile">Profile</a></li>
              <li>Replace <code>YOUR_SERVER_URL_HERE</code> with your Render server URL</li>
              <li>Click <strong>Run → onFormSubmit</strong> to authorize</li>
              <li>Go to <strong>Triggers (⏰)</strong> → Add Trigger → onFormSubmit → On form submit</li>
              <li>Submit a test form entry to verify</li>
            </ol>

            <div class="setup-code-block">
              <div class="setup-code-header">
                <span>Google Apps Script</span>
                <button class="btn btn-outline btn-sm" id="copy-script">📋 Copy</button>
              </div>
              <pre class="setup-code"><code>// ═══ USER CONFIGURATION ═══
const API_KEY = 'YOUR_API_KEY_HERE';
const SERVER_URL = 'YOUR_SERVER_URL_HERE';

function onFormSubmit(e) {
  pingServer();
  var data = {};
  var responses = e.response.getItemResponses();
  for (var i = 0; i &lt; responses.length; i++) {
    data[responses[i].getItem().getTitle()] = responses[i].getResponse();
  }
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
