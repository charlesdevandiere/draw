/**
 * Child app entry point. The markup lives in app.html (shared by every language folder);
 * texts are filled from the catalogs of the page's language.
 */
import '../styles/app.scss';
import { applyTranslations, documentLanguage } from '../i18n/apply';
import { createTranslator } from '../i18n/i18n';
import { checkForUpdate } from '../pwa/app-update';
import appHtml from './app.html?raw';
import { initDrawScreen } from './draw-screen';
import { protectGestures } from './gesture-protections';
import { showScreen } from './screens';

const translator = createTranslator(documentLanguage());
document.body.innerHTML = appHtml;
applyTranslations(document.body, translator.t);

const page = document.getElementById('page');
if (page) protectGestures(page);

const canvas = document.getElementById('drawing-layer');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Drawing canvas missing');
const drawScreen = initDrawScreen({
  canvas,
  style: () => ({ tool: 'pen', color: '#212121', width: 8 }),
});

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
  navigator.serviceWorker.addEventListener('controllerchange', () => reloadWhenIdle());
}

/** Reloads once no stroke is in progress, so a new version never cuts a stroke short. */
function reloadWhenIdle(): void {
  if (!drawScreen.isDrawing()) {
    window.location.reload();
    return;
  }
  // A stroke ends on pointerup, or on pointercancel (system gesture): retry after either.
  const retry = (): void => {
    window.removeEventListener('pointerup', retry);
    window.removeEventListener('pointercancel', retry);
    setTimeout(reloadWhenIdle, 0);
  };
  window.addEventListener('pointerup', retry);
  window.addEventListener('pointercancel', retry);
}
