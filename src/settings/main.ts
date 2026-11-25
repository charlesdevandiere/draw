/**
 * Settings page (adult screen, Bootstrap, spec/SPEC-settings.md). Reached from the
 * gallery's settings pebble (press and hold); back leads to the gallery. Texts come from
 * the same catalogs as the app.
 */
import '../styles/settings.scss';
import { APP_BUILD_DATE, APP_VERSION } from '../app-version';
import { replaceHistoryOnLinks, requireElement } from '../app/dom';
import {
  applyTranslations,
  documentLanguage,
  readLanguageOverride,
  writeLanguageOverride,
} from '../i18n/apply';
import { createTranslator, isLanguage } from '../i18n/i18n';
import { checkForUpdate, resetAppCache } from '../pwa/app-update';
import {
  listDrawings,
  listTrash,
  purgeTrash,
  readSetting,
  emptyTrash,
  restoreFromTrash,
  saveDrawing,
  writeSetting,
} from '../store/db';
import { backupSummary, drawingBytes } from './format';
import { initInputSettings } from './input-settings';
import { initTransferSection } from './transfer';
import { initTrashSection } from './trash';
import { initHaptic } from '../app/haptic';
import { renderThumbnail } from '../app/raster';
import settingsHtml from './settings.html?raw';

const translator = createTranslator(documentLanguage());
const { t } = translator;
document.documentElement.lang = translator.language;
document.title = `${t('settings.title')} — ${t('app.name')}`;
document.body.innerHTML = settingsHtml;
applyTranslations(document.body, t);
replaceHistoryOnLinks(document.body);

// Backup: how many drawings, how much room (outside the trash).
const backupSummaryText = requireElement('backup-summary', HTMLSpanElement);
/** Only the latest refresh writes the line (an earlier, slower one would show a stale count). */
let backupRefreshes = 0;
async function refreshBackup(): Promise<void> {
  const refresh = ++backupRefreshes;
  const records = await listDrawings();
  if (refresh !== backupRefreshes) return;
  const bytes = records.reduce(
    (sum, { drawing, thumbnail }) => sum + drawingBytes(drawing, thumbnail?.size ?? 0),
    0,
  );
  backupSummaryText.textContent = backupSummary(translator, records.length, bytes);
}
// Trash: restore, or empty for good with a long press.
const trash = initTrashSection({
  translator,
  list: listTrash,
  thumbnail: (record) => renderThumbnail(record.drawing.strokes),
  restore: restoreFromTrash,
  empty: emptyTrash,
  haptic: initHaptic(),
  onChanged: () => void refreshBackup().catch(() => undefined),
});

// Drawings trashed 30 days ago or more go for good (spec/SPEC-trash.md); retried next time.
purgeTrash(Date.now())
  .catch(() => undefined)
  .finally(() => {
    void refreshBackup().catch(() => undefined);
    void trash.refresh().catch(() => undefined);
  });

// Export and import of magic PNGs.
const transfer = initTransferSection({
  t,
  list: listDrawings,
  trashedIds: async () => (await listTrash()).map(({ drawing }) => drawing.id),
  restore: restoreFromTrash,
  // Thumbnail rendered now, so the gallery shows it (null if it fails: the gallery then
  // renders one).
  save: async (drawing) =>
    saveDrawing(drawing, await renderThumbnail(drawing.strokes).catch(() => null)),
  onImported: () => {
    void refreshBackup().catch(() => undefined);
    // An import may bring a drawing back from the trash.
    void trash.refresh().catch(() => undefined);
  },
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

// Share the sketchbook: the app's link (the root redirects to the visitor's language).
const shareButton = requireElement('share-app', HTMLButtonElement);
const shareStatus = requireElement('share-status', HTMLOutputElement);
async function shareAppLink(url: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: t('app.name'), url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Refused (no user activation, unsupported data): copy instead.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    shareStatus.textContent = t('settings.share.copied', { url });
  } catch {
    shareStatus.textContent = t('settings.share.manual', { url });
  }
}
shareButton.addEventListener('click', () => {
  shareStatus.textContent = '';
  // One share at a time: a second tap while the sheet is open would be refused
  // (InvalidStateError) and fall back to the clipboard behind the sheet.
  shareButton.disabled = true;
  void shareAppLink(new URL('../', window.location.href).href).finally(() => {
    shareButton.disabled = false;
  });
});

// Persistence: are the drawings protected from the browser's automatic cleanup?
const persistedText = requireElement('storage-persisted', HTMLParagraphElement);
const persistedDetail = requireElement('storage-detail', HTMLParagraphElement);
const storageCard = requireElement('section-storage', HTMLElement);
const persistButton = requireElement('storage-persist', HTMLButtonElement);

async function refreshStorage(): Promise<void> {
  const persisted = (await navigator.storage?.persisted?.().catch(() => null)) ?? null;
  persistedText.textContent = t(
    persisted === null
      ? 'settings.storage.unknown'
      : persisted
        ? 'settings.storage.protected'
        : 'settings.storage.unprotected',
  );
  persistedDetail.textContent =
    persisted === null
      ? ''
      : t(persisted ? 'settings.storage.protectedDetail' : 'settings.storage.unprotectedDetail');
  storageCard.toggleAttribute('data-protected', persisted === true);
  persistButton.hidden = persisted !== false;
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

// Update: version and build date, a badge once checked.
requireElement('app-version', HTMLParagraphElement).textContent = APP_BUILD_DATE
  ? t('settings.versionDate', {
      version: APP_VERSION,
      date: new Intl.DateTimeFormat(translator.language, { dateStyle: 'long' }).format(
        new Date(APP_BUILD_DATE),
      ),
    })
  : t('settings.version', { version: APP_VERSION });
const updateBadge = requireElement('update-badge', HTMLSpanElement);
function showBadge(state: 'up-to-date' | 'updating' | null): void {
  updateBadge.hidden = state === null;
  updateBadge.dataset['state'] = state ?? '';
  updateBadge.textContent =
    state === 'up-to-date'
      ? t('settings.update.upToDate')
      : state === 'updating'
        ? t('settings.update.updating')
        : '';
}
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
  showBadge(null);
  try {
    const outcome = await checkForUpdate();
    updateStatus.textContent = UPDATE_MESSAGES[outcome];
    showBadge(outcome === 'no-service-worker' ? null : outcome);
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

// A new version took over while this page was open: load it, once no export or import
// is running (coming back from the file picker checks for an update, see above).
const TRANSFER_RETRY_MS = 500;
function reloadWhenIdle(): void {
  // DF-04: docs/device-fixes.md
  if (transfer.busy()) setTimeout(reloadWhenIdle, TRANSFER_RETRY_MS);
  else window.location.reload();
}
if (navigator.serviceWorker?.controller) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    reloadWhenIdle();
  });
}
