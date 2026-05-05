import { renderLanding } from './pages/landing.js';
import { renderDetails } from './pages/details.js';
import { renderGenerator } from './pages/generator.js';
import { renderDownload } from './pages/download.js';
import { renderAuth } from './pages/auth.js';
import { renderProfile } from './pages/profile.js';
import { renderAdmin } from './pages/admin.js';
import { renderSetupWizard } from './pages/setup-wizard.js';
import { onAuthStateChanged, signOutUser } from './firebase.js';

// --- Global App State ---
export const state = {
  currentUser: null,
  institutionName: '',
  eventName: '',
  year: '',
  files: [],
  nameCol: '',
  urnCol: '',
  students: [],
  batches: [],
  generatedTickets: [],
};

// Expose state for API client
window.__qrProApp = { state };

// --- Router ---
const routes = {
  '/': renderLanding,
  '/details': renderDetails,
  '/generator': renderGenerator,
  '/download': renderDownload,
  '/auth': renderAuth,
  '/profile': renderProfile,
  '/admin': renderAdmin,
  '/setup': renderSetupWizard,
};

export function navigate(path) {
  window.location.hash = path;
}

function router() {
  const hash = window.location.hash.slice(1) || '/';
  const app = document.getElementById('app');
  if (!app) return;

  // --- Auth Guard ---
  if (!state.currentUser && hash !== '/auth') {
    window.location.hash = '/auth';
    return;
  }
  if (state.currentUser && hash === '/auth') {
    window.location.hash = '/';
    return;
  }

  const renderFn = routes[hash];
  if (!renderFn) return;

  // Fade out transition
  app.style.opacity = '0';
  app.style.transform = 'translateY(10px)';

  setTimeout(() => {
    app.innerHTML = '';

    // Add navbar on authenticated pages
    if (state.currentUser && hash !== '/auth') {
      app.appendChild(createNavbar(hash));
    }

    renderFn(app);

    // Fade in
    requestAnimationFrame(() => {
      app.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      app.style.opacity = '1';
      app.style.transform = 'translateY(0)';
    });
  }, 200);
}

// --- Navbar Component ---
function createNavbar(currentPath) {
  const user = state.currentUser;
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const photoURL = user.photoURL;

  let avatarHtml;
  if (photoURL) {
    avatarHtml = `<img src="${photoURL}" alt="" class="nav-avatar-img" referrerpolicy="no-referrer">`;
  } else {
    const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    avatarHtml = `<span class="nav-avatar-initials">${initials}</span>`;
  }

  const navLinks = [
    { path: '/', label: 'Dashboard', icon: '◆' },
    { path: '/admin', label: 'Pipeline', icon: '⚡' },
    { path: '/profile', label: 'Profile', icon: '●' },
    { path: '/setup', label: 'Setup', icon: '◎' },
  ];

  const nav = document.createElement('nav');
  nav.className = 'app-navbar';
  nav.innerHTML = `
    <div class="nav-inner">
      <div class="nav-left">
        <a href="#/" class="nav-brand">
          <span class="text-gradient" style="font-weight:800;font-size:1.1rem;">QR PRO</span>
        </a>
        <div class="nav-links">
          ${navLinks
            .map(
              (link) => `
            <a href="#${link.path}" class="nav-link ${currentPath === link.path ? 'active' : ''}">
              <span class="nav-link-icon">${link.icon}</span>
              <span class="nav-link-label">${link.label}</span>
            </a>
          `
            )
            .join('')}
        </div>
      </div>
      <div class="nav-right">
        <div class="nav-user" id="nav-user-menu">
          <div class="nav-avatar">${avatarHtml}</div>
          <span class="nav-username">${displayName}</span>
          <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
        <div class="nav-dropdown hidden" id="nav-dropdown">
          <a href="#/profile" class="nav-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profile
          </a>
          <a href="#/setup" class="nav-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Setup Guide
          </a>
          <div class="nav-dropdown-divider"></div>
          <button class="nav-dropdown-item nav-signout" id="nav-signout-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  `;

  // Dropdown toggle + sign out
  setTimeout(() => {
    const userMenu = document.getElementById('nav-user-menu');
    const dropdown = document.getElementById('nav-dropdown');
    const signoutBtn = document.getElementById('nav-signout-btn');

    if (userMenu && dropdown) {
      userMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });
      document.addEventListener('click', () => dropdown.classList.add('hidden'));
    }

    if (signoutBtn) {
      signoutBtn.addEventListener('click', async () => {
        await signOutUser();
      });
    }
  }, 0);

  return nav;
}

// --- Init with Auth Listener ---
let initialized = false;

onAuthStateChanged((user) => {
  state.currentUser = user || null;

  const app = document.getElementById('app');
  if (app && !initialized) {
    app.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    initialized = true;
  }

  router();
});

window.addEventListener('hashchange', router);
