/**
 * Child app entry point. The markup lives in app.html (shared by every language folder);
 * texts are filled from the catalogs of the page's language.
 */
import '../styles/app.scss';
import { applyTranslations, documentLanguage } from '../i18n/apply';
import { createTranslator } from '../i18n/i18n';
import { checkForUpdate } from '../pwa/app-update';
import appHtml from './app.html?raw';
import { protectGestures } from './gesture-protections';
import { showScreen } from './screens';

const translator = createTranslator(documentLanguage());
document.body.innerHTML = appHtml;
applyTranslations(document.body, translator.t);

const page = document.getElementById('page');
if (page) protectGestures(page);

// The button pressed is hidden with its screen: move the focus to the other screen's button.
const openGallery = document.getElementById('open-gallery');
const backToDrawing = document.getElementById('back-to-drawing');
openGallery?.addEventListener('click', () => {
  showScreen('gallery');
  backToDrawing?.focus();
});
backToDrawing?.addEventListener('click', () => {
  showScreen('draw');
  openGallery?.focus();
});

// An installed app is resumed rather than reopened: look for a new version each time it
// comes back to the foreground (failures, e.g. offline, are silent).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate().catch(() => undefined);
});

// A new service worker took over (new deploy): reload so the page runs the new build.
// Skipped on first install, when the page had no controller yet.
if (navigator.serviceWorker?.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}
