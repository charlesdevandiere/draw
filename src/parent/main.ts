/**
 * Parent page (adult screen, Bootstrap): language, storage, application. Reached from the
 * gallery's padlock (press and hold). Texts come from the same catalogs as the app.
 */
import '../styles/parent.scss';
import { APP_VERSION } from '../app-version';
import { requireElement } from '../app/dom';
import {
  applyTranslations,
  documentLanguage,
  readLanguageOverride,
  writeLanguageOverride,
} from '../i18n/apply';
import { createTranslator, isLanguage } from '../i18n/i18n';
import { checkForUpdate, resetAppCache } from '../pwa/app-update';
import { deleteDrawing, listDrawings, readSetting, saveDrawing, writeSetting } from '../store/db';
import { initDrawingsSection } from './drawings';
import { initInputSettings } from './input-settings';
import { initTransferSection } from './transfer';
import { renderThumbnail } from '../app/raster';
import parentHtml from './parent.html?raw';

const translator = createTranslator(documentLanguage());
const { t } = translator;
document.documentElement.lang = translator.language;
document.title = `${t('parent.title')} — ${t('app.name')}`;
document.body.innerHTML = parentHtml;
applyTranslations(document.body, t);

// Drawings: list and deletion.
const drawings = initDrawingsSection({
  t,
  language: translator.language,
  list: listDrawings,
  remove: deleteDrawing,
});
drawings.refresh().catch(() => undefined);

// Export and import of magic PNGs.
initTransferSection({
  t,
  list: listDrawings,
  selected: () => drawings.selected(),
  // Thumbnail rendered now, so the list here and the gallery show it (null if it fails:
  // the gallery then renders one).
  save: async (drawing) =>
    saveDrawing(drawing, await renderThumbnail(drawing.strokes).catch(() => null)),
  onImported: () => void drawings.refresh().catch(() => undefined),
});

// Finger mode settings.
initInputSettings({ read: readSetting, write: writeSetting }).catch(() => undefined);

// Language: an override of the folder's language, for this browser.
const languageSelect = requireElement('language-select', HTMLSelectElement);
languageSelect.value = readLanguageOverride() ?? '';
languageSelect.addEventListener('change', () => {
  const value = languageSelect.value;
  writeLanguageOverride(isLanguage(value) ? value : null);
  window.location.reload();
});

// Storage: persistence and space used.
const persistedText = requireElement('storage-persisted', HTMLParagraphElement);
const usageText = requireElement('storage-usage', HTMLParagraphElement);
const persistButton = requireElement('storage-persist', HTMLButtonElement);
const megabytes = (bytes: number): string =>
  t('diag.env.megabytes', { value: (bytes / 1_048_576).toFixed(1) });

async function refreshStorage(): Promise<void> {
  const persisted = (await navigator.storage?.persisted?.().catch(() => null)) ?? null;
  persistedText.textContent = t('parent.storage.persisted', {
    state: persisted === null ? 'unknown' : persisted ? 'yes' : 'no',
  });
  persistButton.hidden = persisted !== false;
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  usageText.textContent =
    estimate?.usage !== undefined && estimate.quota !== undefined
      ? t('parent.storage.usage', {
          used: megabytes(estimate.usage),
          quota: megabytes(estimate.quota),
        })
      : '';
}

persistButton.addEventListener('click', () => {
  persistButton.disabled = true;
  void (navigator.storage?.persist?.() ?? Promise.resolve(false))
    .catch(() => false)
    .then(() => refreshStorage())
    .finally(() => {
      persistButton.disabled = false;
    });
});
void refreshStorage();

// Application: version and updates.
requireElement('app-version', HTMLParagraphElement).textContent = t('parent.version', {
  version: APP_VERSION,
});
const updateStatus = requireElement('update-status', HTMLOutputElement);
const checkButton = requireElement('check-update', HTMLButtonElement);
const resetButton = requireElement('reset-cache', HTMLButtonElement);
const UPDATE_MESSAGES = {
  updating: t('update.updating'),
  'up-to-date': t('update.upToDate', { version: APP_VERSION }),
  'no-service-worker': t('update.noServiceWorker'),
} as const;

checkButton.addEventListener('click', async () => {
  checkButton.disabled = true;
  updateStatus.textContent = t('update.checking');
  try {
    updateStatus.textContent = UPDATE_MESSAGES[await checkForUpdate()];
  } catch {
    updateStatus.textContent = t('update.checkFailed');
  } finally {
    checkButton.disabled = false;
  }
});

resetButton.addEventListener('click', async () => {
  resetButton.disabled = true;
  updateStatus.textContent = t('update.clearing');
  try {
    await resetAppCache(() => undefined);
  } catch {
    updateStatus.textContent = t('update.clearFailed');
    resetButton.disabled = false;
  }
});

// An installed app resumes on the page it was left on: look for a new version each time
// it comes back to the foreground (failures, e.g. offline, are silent).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate().catch(() => undefined);
});

// A new version took over while this page was open: load it.
if (navigator.serviceWorker?.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}
