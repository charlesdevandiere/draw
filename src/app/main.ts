/**
 * Child app entry point. The markup lives in app.html (shared by every language folder);
 * texts are filled from the catalogs of the page's language.
 */
import '../styles/app.scss';
import { applyTranslations, documentLanguage } from '../i18n/apply';
import { createTranslator } from '../i18n/i18n';
import { createInputFilter } from '../input/input-mode';
import { checkForUpdate } from '../pwa/app-update';
import { createAutosave } from '../store/autosave';
import {
  deleteDrawing,
  listDrawings,
  loadDrawing,
  moveToTrash,
  purgeTrash,
  readSetting,
  saveDrawing,
  writeSetting,
} from '../store/db';
import {
  DEFAULT_INPUT_MODE,
  SETTING_KEYS,
  parseDrawingId,
  parseFingerSettings,
  parseInputModeState,
  parseToolState,
} from '../store/settings';
import { DEFAULT_TOOLS } from '../engine/palette';
import appHtml from './app.html?raw';
import {
  canRedo,
  canUndo,
  commitStroke,
  createHistory,
  redo,
  undo,
  type History,
} from '../engine/history';
import { styleFor } from '../engine/palette';
import type { Drawing } from '../engine/types';
import { newId } from '../store/id';
import { newDrawing } from '../store/schema';
import { requireElement } from './dom';
import { initDrawScreen } from './draw-screen';
import { initModeButton } from './mode-button';
import { initTools } from './tools';
import { protectGestures } from './gesture-protections';
import { initGallery } from './gallery-screen';
import { renderThumbnail } from './raster';
import { initHaptic } from './haptic';
import { initLongPress } from './long-press';
import { initViewer } from './viewer-screen';
import { shareFile } from './share';
import { encodeMagicPng } from './magic-image';
import { drawingFileName } from '../store/file-name';
import { showScreen } from './screens';

const translator = createTranslator(documentLanguage());
document.body.innerHTML = appHtml;
applyTranslations(document.body, translator.t);

// Every touch surface needs them: the drawing page and the viewer's page.
for (const id of ['page', 'viewer-page']) {
  const surface = document.getElementById(id);
  if (surface) protectGestures(surface);
}

const canvas = document.getElementById('drawing-layer');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Drawing canvas missing');
const modeButtonElement = document.getElementById('mode-button');
if (!(modeButtonElement instanceof HTMLButtonElement)) throw new Error('Mode button missing');
const inputFilter = createInputFilter(DEFAULT_INPUT_MODE);
/** Settings changed before `restore` finished: the stored ones must not override them. */
const changedBeforeRestore = { mode: false, tools: false };
const saveInputMode = (): void => {
  changedBeforeRestore.mode = true;
  writeSetting(SETTING_KEYS.inputMode, inputFilter.state()).catch(() => undefined);
};
const modeButton = initModeButton(modeButtonElement, inputFilter, translator.t, saveInputMode);

const toolsContainer = document.getElementById('tools-primary');
if (!toolsContainer) throw new Error('Tool bar missing');
const haptic = initHaptic();
const tools = initTools(
  toolsContainer,
  DEFAULT_TOOLS,
  translator.t,
  (state) => {
    changedBeforeRestore.tools = true;
    writeSetting(SETTING_KEYS.tools, state).catch(() => undefined);
  },
  {
    page: requireElement('page', HTMLElement),
    boxHost: requireElement('color-box', HTMLElement),
    haptic,
  },
);

/** The drawing on the slate: its identity, and its strokes in `history`. */
let current: { id: string; createdAt: number } = { id: newId(), createdAt: Date.now() };
let templates: Drawing['templates'] = [];
let history: History = createHistory();

const autosave = createAutosave({
  async save(drawing) {
    // The vectors come first: a thumbnail that fails, or that a hidden page (going to the
    // background, maybe killed) would delay, is skipped; the gallery renders it instead.
    const thumbnail =
      document.visibilityState === 'hidden'
        ? null
        : await renderThumbnail(drawing.strokes).catch(() => null);
    await saveDrawing(drawing, thumbnail);
    await writeSetting(SETTING_KEYS.lastDrawingId, drawing.id);
  },
  remove: deleteDrawing,
});

function currentDrawing(): Drawing {
  const count = history.strokes.length;
  // Undo can drop strokes a template step was placed after; a step's `at` beyond the
  // strokes would make the saved drawing unreadable (parseDrawing refuses it).
  const steps = templates.map((step) => (step.at > count ? { ...step, at: count } : step));
  return { ...current, updatedAt: Date.now(), strokes: [...history.strokes], templates: steps };
}
const undoButton = requireElement('undo', HTMLButtonElement);
const redoButton = requireElement('redo', HTMLButtonElement);
const newPageButton = requireElement('new-page', HTMLButtonElement);

function refreshHistoryButtons(): void {
  const focused = document.activeElement;
  undoButton.disabled = !canUndo(history);
  redoButton.disabled = !canRedo(history);
  newPageButton.disabled = !canUndo(history);
  // A focused button that gets disabled drops the focus to the body: keep it in the tool bar.
  if (focused instanceof HTMLButtonElement && focused.disabled) {
    // The new page button keeps the focus in its own group (pages), on the gallery button.
    const fallback =
      focused === newPageButton
        ? document.getElementById('open-gallery')
        : [undoButton, redoButton].find((button) => !button.disabled);
    (fallback ?? document.getElementById('mode-button'))?.focus();
  }
}

/** Shows a new history (undo, redo, new page): the canvas is repainted from its vectors. */
function setHistory(next: History): void {
  history = next;
  drawScreen.setStrokes(history.strokes);
  refreshHistoryButtons();
  autosave.changed(currentDrawing());
}

/**
 * Puts another drawing on the slate (a blank page, or one reopened from the gallery). The
 * flush takes the pending save at once: switching synchronously after it means a stroke
 * started while it writes lands on the new drawing instead of being lost.
 */
function switchDrawing(drawing: Drawing): Promise<void> {
  const saved = autosave.flush();
  current = { id: drawing.id, createdAt: drawing.createdAt };
  templates = drawing.templates;
  history = createHistory(drawing.strokes);
  drawScreen.setStrokes(history.strokes);
  refreshHistoryButtons();
  return saved;
}

/** Starts a blank page; the drawing left is already saved (or dropped if empty). */
async function startNewPage(): Promise<void> {
  const now = Date.now();
  await switchDrawing(newDrawing(newId(), now));
  // Strokes already drawn on the new page have saved it (and its id) themselves.
  if (history.strokes.length === 0) await writeSetting(SETTING_KEYS.lastDrawingId, current.id);
}

const drawScreen = initDrawScreen({
  canvas,
  hitArea: requireElement('draw-screen', HTMLElement),
  onStroke: (stroke) => {
    history = commitStroke(history, stroke);
    refreshHistoryButtons();
    autosave.changed(currentDrawing());
  },
  style: () => styleFor(tools.state()),
  accepts: (event, phase) => {
    const drawing = inputFilter.accepts({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      phase,
      width: event.width,
    });
    // The first pen may have switched the mode on its own: show it and remember it.
    if (phase === 'down' && modeButton.refresh()) saveInputMode();
    return drawing;
  },
});

// History buttons wait for strokes in progress to end: they would be lost otherwise.
undoButton.addEventListener('click', () => {
  if (!drawScreen.isDrawing()) setHistory(undo(history));
});
redoButton.addEventListener('click', () => {
  if (!drawScreen.isDrawing()) setHistory(redo(history));
});
newPageButton.addEventListener('click', () => {
  if (!drawScreen.isDrawing()) startNewPage().catch(() => undefined);
});

// The button pressed is hidden with its screen: move the focus to the other screen's button.
const openGallery = requireElement('open-gallery', HTMLButtonElement);
const backToDrawing = requireElement('back-to-drawing', HTMLButtonElement);

function showDrawScreen(): void {
  showScreen('draw');
  openGallery.focus();
}

const viewerScreen = requireElement('viewer-screen', HTMLElement);
const viewerShare = requireElement('viewer-share', HTMLButtonElement);
const viewerPlay = requireElement('viewer-play', HTMLButtonElement);

/** Back from the viewer to the wall. */
function showGallery(): void {
  viewer.close();
  showScreen('gallery');
  backToDrawing.focus();
}

const viewer = initViewer({
  canvas: requireElement('viewer-layer', HTMLCanvasElement),
  progress: requireElement('viewer-progress', HTMLElement),
  playButton: viewerPlay,
  restartButton: requireElement('viewer-restart', HTMLButtonElement),
  t: translator.t,
  onBack: showGallery,
});
requireElement('viewer-back', HTMLButtonElement).addEventListener('click', showGallery);

/** Puts a drawing from the gallery on the slate, to go on with it. */
function continueDrawing(drawing: Drawing): Promise<void> {
  if (drawing.id === current.id || drawScreen.isDrawing()) {
    showDrawScreen();
    return Promise.resolve();
  }
  // The card may be older than what is being saved: write first, then read it back.
  // The draw screen is shown only once the switch is done: a stroke started earlier
  // would be dropped by the switch, or land on the drawing being left.
  return autosave
    .flush()
    .then(() => loadDrawing(drawing.id))
    .then(async (record) => {
      const saved = switchDrawing(record?.drawing ?? drawing);
      showDrawScreen();
      await saved;
      await writeSetting(SETTING_KEYS.lastDrawingId, drawing.id);
    })
    .catch(() => {
      showDrawScreen();
    });
}

requireElement('viewer-continue', HTMLButtonElement).addEventListener('click', () => {
  const drawing = viewer.drawing();
  viewer.close();
  if (!drawing) return;
  // Inert while the drawing is put on the slate: back would be overridden by the draw
  // screen, and a trash press ending meanwhile would leave a trashed drawing on the slate.
  viewerScreen.inert = true;
  void continueDrawing(drawing).finally(() => {
    viewerScreen.inert = false;
  });
});

// Share: the drawing as a magic PNG. The share sheet needs a recent user gesture (iOS
// Safari): start encoding as soon as the finger lands, so the PNG is ready (or nearly)
// when the click arrives.
// Keyed by the drawing itself, not its id: a drawing continued since has new strokes.
let sharedFile: { drawing: Drawing; file: Promise<File> } | null = null;
function prepareShare(): Promise<File> | null {
  const drawing = viewer.drawing();
  if (!drawing) return null;
  if (sharedFile?.drawing !== drawing) {
    const file = encodeMagicPng(drawing).then(
      (blob) =>
        new File(
          [blob],
          drawingFileName(translator.t('file.prefix'), new Date(drawing.updatedAt)),
          { type: 'image/png' },
        ),
    );
    sharedFile = { drawing, file };
    // A failed encoding is tried again on the next press.
    file.catch(() => {
      if (sharedFile?.file === file) sharedFile = null;
    });
  }
  return sharedFile.file;
}
viewerShare.addEventListener('pointerdown', () => {
  prepareShare()?.catch(() => undefined);
});
viewerShare.addEventListener('click', () => {
  const drawing = viewer.drawing();
  const file = prepareShare();
  if (!file) return;
  viewerShare.disabled = true;
  file
    // Left the viewer (or opened another drawing) while it encoded: no share sheet.
    .then((ready) =>
      !viewerScreen.hidden && viewer.drawing() === drawing ? shareFile(ready) : undefined,
    )
    .catch(() => undefined)
    .finally(() => {
      viewerShare.disabled = false;
    });
});

// Move to the trash (long press): the drawing leaves the wall for 30 days. If it is the
// one on the slate, its last save lands first (it stays trashed: the save rule of
// spec/SPEC-trash.md) and the slate turns to a blank page. The viewer stays inert while
// it writes: "continue" would put the drawing being trashed back on the slate.
initLongPress(
  requireElement('viewer-trash', HTMLButtonElement),
  () => {
    const drawing = viewer.drawing();
    if (!drawing) return;
    viewer.close();
    viewerScreen.inert = true;
    const onSlate = drawing.id === current.id;
    void (onSlate ? autosave.flush() : Promise.resolve())
      .then(() => moveToTrash(drawing.id, Date.now()))
      .then(async () => {
        if (onSlate && current.id === drawing.id) await startNewPage();
      })
      .catch(() => undefined)
      .then(() => gallery.refresh())
      .catch(() => undefined)
      .finally(() => {
        viewerScreen.inert = false;
        showGallery();
      });
  },
  { haptic },
);

const gallery = initGallery({
  grid: requireElement('gallery-grid', HTMLElement),
  t: translator.t,
  language: translator.language,
  // Drawings saved without a thumbnail get one rendered from their vectors.
  // One at a time: iOS Safari caps the total canvas memory.
  list: async () => {
    const records = await listDrawings();
    for (const [index, record] of records.entries()) {
      if (record.thumbnail) continue;
      const thumbnail = await renderThumbnail(record.drawing.strokes).catch(() => null);
      records[index] = { ...record, thumbnail };
    }
    return records;
  },
  onNew: () => {
    startNewPage().catch(() => undefined);
    showDrawScreen();
  },
  onOpen: (drawing) => {
    showScreen('viewer');
    viewer.open(drawing);
    viewerPlay.focus();
  },
});

openGallery.addEventListener('click', () => {
  if (drawScreen.isDrawing()) return;
  // Save first so the drawing just made shows up in the gallery.
  void autosave
    .flush()
    .then(() => gallery.refresh())
    .catch(() => undefined)
    .finally(() => {
      // A stroke started during the save would be cut short by hiding its screen.
      if (drawScreen.isDrawing()) return;
      showScreen('gallery');
      backToDrawing.focus();
    });
});
backToDrawing.addEventListener('click', showDrawScreen);
initLongPress(
  requireElement('open-settings', HTMLButtonElement),
  () => {
    // DF-05: docs/device-fixes.md
    // Save before leaving the app page. Replace, not assign: a swipe back from the edge
    // must not bring the settings page back (see replaceHistoryOnLinks).
    void autosave.flush().finally(() => window.location.replace('settings.html'));
  },
  { haptic },
);

// Back from the settings page (`./#gallery`): open on the gallery, and forget the hash so a
// reload lands on the slate as usual.
if (window.location.hash === '#gallery') {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  void gallery
    .refresh()
    .catch(() => undefined)
    .finally(() => {
      // A stroke started on the slate while the gallery loaded would be cut short.
      if (drawScreen.isDrawing()) return;
      showScreen('gallery');
      backToDrawing.focus();
    });
}

// An installed app is resumed rather than reopened: look for a new version each time it
// comes back to the foreground (failures, e.g. offline, are silent).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate().catch(() => undefined);
  // Going to the background may be the last chance to write (the app can be killed).
  else void autosave.flush();
});
window.addEventListener('pagehide', () => void autosave.flush());
// Restored from the bfcache (a history entry another browser path left behind): the
// drawing on the slate may have been trashed in the settings page meanwhile, and a new stroke
// would save it again. Reload to start from the database.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});

// A new service worker took over (new deploy): reload so the page runs the new build.
// Skipped on first install, when the page had no controller yet.
if (navigator.serviceWorker?.controller) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // One waiting loop is enough, however many times the controller changes.
    if (reloading) return;
    reloading = true;
    reloadWhenIdle();
  });
}

/** Delay before trying again to save, then reload, after a failed save. */
const SAVE_RETRY_MS = 5000;

/** Reloads once no stroke is in progress, so a new version never cuts a stroke short. */
function reloadWhenIdle(): void {
  if (!drawScreen.isDrawing()) {
    void autosave.flush().then(() => {
      // A stroke may start while the flush writes: wait for it too.
      if (drawScreen.isDrawing()) reloadWhenIdle();
      // A save that failed is still pending: never trade the drawing for the update.
      // Retry later; the new version loads once the drawing is safe.
      else if (autosave.pending()) setTimeout(reloadWhenIdle, SAVE_RETRY_MS);
      else window.location.reload();
    });
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

/** Restores the settings and the last drawing, unless the child already started drawing. */
async function restore(): Promise<void> {
  const slate = current.id;
  const [modeValue, toolsValue, lastIdValue, fingerValue] = await Promise.all([
    readSetting(SETTING_KEYS.inputMode),
    readSetting(SETTING_KEYS.tools),
    readSetting(SETTING_KEYS.lastDrawingId),
    readSetting(SETTING_KEYS.fingerSettings),
  ]);
  inputFilter.setFingerSettings(parseFingerSettings(fingerValue));
  // A mode or tool chosen (or a pen switch) while reading wins over the stored one.
  if (!changedBeforeRestore.mode) {
    const mode = parseInputModeState(modeValue);
    inputFilter.setMode(mode.mode, mode.chosenByHand);
    modeButton.refresh();
  }
  if (!changedBeforeRestore.tools) tools.setState(parseToolState(toolsValue));

  const lastId = parseDrawingId(lastIdValue);
  const stored = lastId ? await loadDrawing(lastId) : null;
  // A last drawing moved to the trash is not reopened: a blank page, as on a first launch.
  const record = stored?.trashedAt === null ? stored : null;
  // Anything done on the slate meanwhile (strokes, undo, new page, drawing reopened) wins.
  const touched = current.id !== slate || canUndo(history) || canRedo(history);
  if (!record || touched || drawScreen.isDrawing()) return;
  current = { id: record.drawing.id, createdAt: record.drawing.createdAt };
  templates = record.drawing.templates;
  history = createHistory(record.drawing.strokes);
  drawScreen.setStrokes(history.strokes);
  refreshHistoryButtons();
}

/** In the installed app, ask the browser to keep the data (granted on iPad and Chrome). */
function requestPersistence(): void {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) navigator.storage?.persist?.().catch(() => undefined);
}

restore().catch(() => undefined);
requestPersistence();
// Drawings trashed 30 days ago or more go for good (spec/SPEC-trash.md); retried next start.
purgeTrash(Date.now()).catch(() => undefined);
