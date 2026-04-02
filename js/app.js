import { renderLanding } from './pages/landing.js';
import { renderDetails } from './pages/details.js';
import { renderGenerator } from './pages/generator.js';
import { renderDownload } from './pages/download.js';

// --- Global App State ---
export const state = {
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

// --- Router ---
const routes = {
  '/': renderLanding,
  '/details': renderDetails,
  '/generator': renderGenerator,
  '/download': renderDownload,
};

export function navigate(path) {
  window.location.hash = path;
}

function router() {
  const hash = window.location.hash.slice(1) || '/';
  const renderFn = routes[hash];
  const app = document.getElementById('app');

  if (renderFn && app) {
    // Fade out transition
    app.style.opacity = '0';
    app.style.transform = 'translateY(10px)';

    setTimeout(() => {
      app.innerHTML = '';
      renderFn(app);
      // Fade in
      requestAnimationFrame(() => {
        app.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        app.style.opacity = '1';
        app.style.transform = 'translateY(0)';
      });
    }, 200);
  }
}

// --- Init ---
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  }
  router();
});
