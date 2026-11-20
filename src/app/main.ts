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
  readSetting,
  saveDrawing,
  writeSetting,
} from '../store/db';
import {
  DEFAULT_INPUT_MODE,
  SETTING_KEYS,
  parseDrawingId,
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
import { requireElement } from './dom';
import { initDrawScreen } from './draw-screen';
import { initModeButton } from './mode-button';
import { initTools } from './tools';
import { protectGestures } from './gesture-protections';
import { initGallery } from './gallery-screen';
import { renderThumbnail } from './raster';
import { shareFile } from './share';
import { encodeMagicPng } from '../store/magic-png';
import { drawingFileName } from '../store/file-name';
import { showScreen } from './screens';

const translator = createTranslator(documentLanguage());
document.body.innerHTML = appHtml;
applyTranslations(document.body, translator.t);

const page = document.getElementById('page');
if (page) protectGestures(page);

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
const tools = initTools(toolsContainer, DEFAULT_TOOLS, translator.t, (state) => {
  changedBeforeRestore.tools = true;
  writeSetting(SETTING_KEYS.tools, state).catch(() => undefined);
});

/** The drawing on the slate: its identity, and its strokes in `history`. */
let current: { id: string; createdAt: number } = { id: crypto.randomUUID(), createdAt: Date.now() };
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
  return { ...current, updatedAt: Date.now(), strokes: [...history.strokes] };
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
    const fallback = [undoButton, redoButton].find((button) => !button.disabled);
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
  history = createHistory(drawing.strokes);
  drawScreen.setStrokes(history.strokes);
  refreshHistoryButtons();
  return saved;
}

/** Starts a blank page; the drawing left is already saved (or dropped if empty). */
async function startNewPage(): Promise<void> {
  const now = Date.now();
  await switchDrawing({ id: crypto.randomUUID(), createdAt: now, updatedAt: now, strokes: [] });
  // Strokes already drawn on the new page have saved it (and its id) themselves.
  if (history.strokes.length === 0) await writeSetting(SETTING_KEYS.lastDrawingId, current.id);
}

const drawScreen = initDrawScreen({
  canvas,
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
      timeStamp: event.timeStamp,
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

/** A gallery card's share button: the drawing as a magic PNG. */
function shareButton(drawing: Drawing): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tool-button';
  button.setAttribute('aria-label', translator.t('gallery.share'));
  button.innerHTML = '<svg><use href="#icon-share" /></svg>';
  // The share sheet needs a recent user gesture (iOS Safari): start encoding as soon as the
  // finger lands, so the PNG is ready (or nearly) when the click arrives.
  let file: Promise<File> | null = null;
  const prepare = (): Promise<File> =>
    (file ??= encodeMagicPng(drawing).then(
      (blob) =>
        new File(
          [blob],
          drawingFileName(translator.t('file.prefix'), new Date(drawing.updatedAt)),
          { type: 'image/png' },
        ),
    ));
  const forget = (): void => {
    file = null;
  };
  button.addEventListener('pointerdown', () => {
    prepare().catch(forget);
  });
  button.addEventListener('click', () => {
    button.disabled = true;
    prepare()
      .then(shareFile)
      .catch(forget)
      .finally(() => {
        button.disabled = false;
      });
  });
  return button;
}

const gallery = initGallery({
  grid: requireElement('gallery-grid', HTMLElement),
  t: translator.t,
  language: translator.language,
  // Drawings saved without a thumbnail get one rendered from their vectors.
  list: async () =>
    Promise.all(
      (await listDrawings()).map(async (record) =>
        record.thumbnail
          ? record
          : {
              ...record,
              thumbnail: await renderThumbnail(record.drawing.strokes).catch(() => null),
            },
      ),
    ),
  actions: (drawing) => [shareButton(drawing)],
  onOpen: (drawing) => {
    if (drawing.id !== current.id && !drawScreen.isDrawing()) {
      // The card may be older than what is being saved: write first, then read it back.
      autosave
        .flush()
        .then(() => loadDrawing(drawing.id))
        .then(async (record) => {
          await switchDrawing(record?.drawing ?? drawing);
          await writeSetting(SETTING_KEYS.lastDrawingId, drawing.id);
        })
        .catch(() => undefined);
    }
    showDrawScreen();
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
requireElement('gallery-new-page', HTMLButtonElement).addEventListener('click', () => {
  startNewPage().catch(() => undefined);
  showDrawScreen();
});

// An installed app is resumed rather than reopened: look for a new version each time it
// comes back to the foreground (failures, e.g. offline, are silent).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate().catch(() => undefined);
  // Going to the background may be the last chance to write (the app can be killed).
  else void autosave.flush();
});
window.addEventListener('pagehide', () => void autosave.flush());

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
  const [modeValue, toolsValue, lastIdValue] = await Promise.all([
    readSetting(SETTING_KEYS.inputMode),
    readSetting(SETTING_KEYS.tools),
    readSetting(SETTING_KEYS.lastDrawingId),
  ]);
  // A mode or tool chosen (or a pen switch) while reading wins over the stored one.
  if (!changedBeforeRestore.mode) {
    const mode = parseInputModeState(modeValue);
    inputFilter.setMode(mode.mode, mode.chosenByHand);
    modeButton.refresh();
  }
  if (!changedBeforeRestore.tools) tools.setState(parseToolState(toolsValue));

  const lastId = parseDrawingId(lastIdValue);
  const record = lastId ? await loadDrawing(lastId) : null;
  // Anything done on the slate meanwhile (strokes, undo, new page, drawing reopened) wins.
  const touched = current.id !== slate || canUndo(history) || canRedo(history);
  if (!record || touched || drawScreen.isDrawing()) return;
  current = { id: record.drawing.id, createdAt: record.drawing.createdAt };
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
