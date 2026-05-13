import { navigate } from '../app.js';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  sendPasswordReset,
  checkRedirectResult,
} from '../firebase.js';

let mode = 'login'; // 'login' | 'signup' | 'forgot'

export function renderAuth(container) {
  mode = 'login';
  renderPage(container);
  
  checkRedirectResult().catch((err) => {
    showError(getFriendlyError(err?.code));
  });
}

function renderPage(container) {
  container.innerHTML = `
    
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="auth-page">
      <div class="auth-card glass-card-static animate-in">
        <!-- Brand -->
        <div class="auth-brand">
          <h1 class="heading-lg">
            <span class="text-gradient">QR PRO</span>
          </h1>
          <p class="text-secondary" style="font-size: 0.85rem; margin-top: 4px;">
            Hall Ticket Management System
          </p>
        </div>

        ${mode === 'forgot' ? renderForgotForm() : renderAuthForm()}
      </div>
    </div>
  `;

  setupListeners(container);
}

// ────────────────────────────────────
// Login / Signup Form
// ────────────────────────────────────
function renderAuthForm() {
  const isLogin = mode === 'login';

  return `
    <div class="auth-form-wrapper" id="auth-form-wrapper">
      <!-- Tab Toggle -->
      <div class="auth-tabs">
        <button class="auth-tab ${isLogin ? 'active' : ''}" data-mode="login">Log In</button>
        <button class="auth-tab ${!isLogin ? 'active' : ''}" data-mode="signup">Sign Up</button>
        <div class="auth-tab-indicator" style="transform: translateX(${isLogin ? '0%' : '100%'})"></div>
      </div>

      <form id="auth-form" class="auth-form" autocomplete="on">
        ${!isLogin ? `
          <div class="form-group">
            <label class="form-label" for="auth-name">Full Name</label>
            <input class="form-input" type="text" id="auth-name"
              placeholder="Your full name" autocomplete="name" required>
          </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label" for="auth-email">Email Address</label>
          <input class="form-input" type="email" id="auth-email"
            placeholder="you@example.com" autocomplete="email" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="auth-password">Password</label>
          <div class="password-wrapper">
            <input class="form-input" type="password" id="auth-password"
              placeholder="${isLogin ? 'Enter your password' : 'Min 6 characters'}"
              autocomplete="${isLogin ? 'current-password' : 'new-password'}"
              minlength="6" required>
            <button type="button" class="password-toggle" id="toggle-password" aria-label="Toggle password visibility">
              <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>

        ${!isLogin ? `
          <div class="form-group">
            <label class="form-label" for="auth-confirm-password">Confirm Password</label>
            <input class="form-input" type="password" id="auth-confirm-password"
              placeholder="Re-enter your password" autocomplete="new-password"
              minlength="6" required>
          </div>
        ` : ''}

        <div class="auth-options">
          <label class="auth-remember" for="remember-me">
            <input type="checkbox" id="remember-me" ${isLogin ? 'checked' : ''}>
            <span class="checkbox-visual"></span>
            Remember me
          </label>
          ${isLogin ? `<button type="button" class="auth-forgot-link" id="forgot-link">Forgot password?</button>` : ''}
        </div>

        <div id="auth-error" class="auth-error hidden"></div>

        <button type="submit" class="btn btn-primary w-full" id="auth-submit">
          <span class="btn-text">${isLogin ? 'Sign In' : 'Create Account'}</span>
          <span class="btn-loader hidden" id="auth-loader">
            <span class="btn-spinner"></span>
          </span>
        </button>
      </form>

      <div class="auth-divider">
        <span>or</span>
      </div>

      <button class="auth-google-btn" id="google-btn">
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        <span>Continue with Google</span>
      </button>
    </div>
  `;
}

// ────────────────────────────────────
// Forgot Password Form
// ────────────────────────────────────
function renderForgotForm() {
  return `
    <div class="auth-form-wrapper" id="auth-form-wrapper">
      <div class="auth-forgot-header">
        <div class="auth-forgot-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 class="heading-md" style="margin-top: 16px;">Reset Password</h2>
        <p class="text-secondary" style="font-size: 0.85rem; margin-top: 6px;">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      <form id="auth-form" class="auth-form" style="margin-top: 24px;">
        <div class="form-group">
          <label class="form-label" for="auth-email">Email Address</label>
          <input class="form-input" type="email" id="auth-email"
            placeholder="you@example.com" autocomplete="email" required>
        </div>

        <div id="auth-error" class="auth-error hidden"></div>
        <div id="auth-success" class="auth-success hidden"></div>

        <button type="submit" class="btn btn-primary w-full" id="auth-submit">
          <span class="btn-text">Send Reset Link</span>
          <span class="btn-loader hidden" id="auth-loader">
            <span class="btn-spinner"></span>
          </span>
        </button>
      </form>

      <button class="auth-back-link" id="back-to-login">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to login
      </button>
    </div>
  `;
}

// ────────────────────────────────────
// Event Listeners
// ────────────────────────────────────
function setupListeners(container) {
  const form = document.getElementById('auth-form');
  const googleBtn = document.getElementById('google-btn');

  // Tab toggle
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      mode = tab.dataset.mode;
      renderPage(container);
    });
  });

  // Forgot password link
  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', () => {
      mode = 'forgot';
      renderPage(container);
    });
  }

  // Back to login link
  const backLink = document.getElementById('back-to-login');
  if (backLink) {
    backLink.addEventListener('click', () => {
      mode = 'login';
      renderPage(container);
    });
  }

  // Password toggle
  const toggleBtn = document.getElementById('toggle-password');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const input = document.getElementById('auth-password');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggleBtn.classList.toggle('active', !isPassword);
    });
  }

  // Form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMessages();

      if (mode === 'forgot') {
        await handleForgot();
      } else if (mode === 'login') {
        await handleLogin();
      } else {
        await handleSignup();
      }
    });
  }

  // Google sign-in
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      clearMessages();
      setLoading(true);
      try {
        const remember = document.getElementById('remember-me')?.checked ?? true;
        await signInWithGoogle(remember);
        navigate('/');
      } catch (err) {
        showError(getFriendlyError(err.code));
      } finally {
        setLoading(false);
      }
    });
  }
}

// ────────────────────────────────────
// Handlers
// ────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const remember = document.getElementById('remember-me')?.checked ?? false;

  if (!email || !password) {
    showError('Please fill in all fields.');
    return;
  }

  setLoading(true);
  try {
    await signInWithEmail(email, password, remember);
    navigate('/');
  } catch (err) {
    showError(getFriendlyError(err.code));
  } finally {
    setLoading(false);
  }
}

async function handleSignup() {
  const name = document.getElementById('auth-name').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const confirm = document.getElementById('auth-confirm-password').value;
  const remember = document.getElementById('remember-me')?.checked ?? false;

  if (!name || !email || !password || !confirm) {
    showError('Please fill in all fields.');
    return;
  }
  if (password.length < 6) {
    showError('Password must be at least 6 characters.');
    return;
  }
  if (password !== confirm) {
    showError('Passwords do not match.');
    return;
  }

  setLoading(true);
  try {
    await signUpWithEmail(name, email, password, remember);
    navigate('/');
  } catch (err) {
    showError(getFriendlyError(err.code));
  } finally {
    setLoading(false);
  }
}

async function handleForgot() {
  const email = document.getElementById('auth-email').value.trim();

  if (!email) {
    showError('Please enter your email address.');
    return;
  }

  setLoading(true);
  try {
    await sendPasswordReset(email);
    showSuccess('Password reset email sent! Check your inbox.');
    document.getElementById('auth-form').reset();
  } catch (err) {
    showError(getFriendlyError(err.code));
  } finally {
    setLoading(false);
  }
}

// ────────────────────────────────────
// UI Helpers
// ────────────────────────────────────
function setLoading(loading) {
  const submit = document.getElementById('auth-submit');
  const loader = document.getElementById('auth-loader');
  const text = submit?.querySelector('.btn-text');

  if (submit) submit.disabled = loading;
  if (loader) loader.classList.toggle('hidden', !loading);
  if (text) text.style.opacity = loading ? '0' : '1';

  const googleBtn = document.getElementById('google-btn');
  if (googleBtn) googleBtn.disabled = loading;
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

function showSuccess(msg) {
  const el = document.getElementById('auth-success');
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

function clearMessages() {
  const errEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
  if (successEl) { successEl.textContent = ''; successEl.classList.add('hidden'); }
}

/**
 * Map Firebase error codes to user-friendly messages.
 */
function getFriendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-blocked': 'Pop-up blocked. Please allow pop-ups for this site.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
