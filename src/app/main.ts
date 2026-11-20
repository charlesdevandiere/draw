/**
 * Child app entry point. The markup lives in app.html (shared by every language folder);
 * texts are filled from the catalogs of the page's language.
 */
import '../styles/app.scss';
import { applyTranslations, documentLanguage } from '../i18n/apply';
import { createTranslator } from '../i18n/i18n';
import { createInputFilter } from '../input/input-mode';
import { checkForUpdate } from '../pwa/app-update';
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
import { DEFAULT_TOOLS, styleFor } from '../engine/palette';
import { requireElement } from './dom';
import { initDrawScreen } from './draw-screen';
import { initModeButton } from './mode-button';
import { initTools } from './tools';
import { protectGestures } from './gesture-protections';
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
const inputFilter = createInputFilter({ mode: 'finger', chosenByHand: false });
const modeButton = initModeButton(modeButtonElement, inputFilter, translator.t, () => undefined);

const toolsContainer = document.getElementById('tools-primary');
if (!toolsContainer) throw new Error('Tool bar missing');
const tools = initTools(toolsContainer, DEFAULT_TOOLS, translator.t, () => undefined);

let history: History = createHistory();
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
}

const drawScreen = initDrawScreen({
  canvas,
  onStroke: (stroke) => {
    history = commitStroke(history, stroke);
    refreshHistoryButtons();
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
    // The first pen may have switched the mode on its own.
    if (phase === 'down') modeButton.refresh();
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
  if (!drawScreen.isDrawing()) setHistory(createHistory());
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
