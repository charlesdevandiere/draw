import { APP_VERSION } from '../app-version';
import {
  createPalmRejector,
  type PalmRejectionStrategy,
  type PointerInput,
} from '../input/palm-rejection';
import { formatSample, toSample, type PointerSample } from './pointer-sample';

const COLORS: Record<string, string> = { pen: '#1f5fd6', touch: '#e07a10', mouse: '#2e9d4a' };
const FALLBACK_COLOR = '#888';
const LINE_WIDTH = 3;
const IGNORED_COLOR = '#b3261e';
const IGNORED_MARK_SIZE = 6;
/** How often the « doigt ignoré » indicator is re-evaluated while it is on. */
const TOUCH_STATE_REFRESH_MS = 250;

function requireElement<T extends Element>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Élément introuvable : ${selector}`);
  return element;
}

const canvas = requireElement('#surface', HTMLCanvasElement);
const pointersOutput = requireElement('#pointers', HTMLPreElement);
const supportOutput = requireElement('#support', HTMLPreElement);
const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2D indisponible');
const ctx = context;

const strategySelect = requireElement('#strategy', HTMLSelectElement);
const graceInput = requireElement('#grace', HTMLInputElement);
const sessionInput = requireElement('#session', HTMLInputElement);
const touchStateOutput = requireElement('#touch-state', HTMLOutputElement);

requireElement('#version', HTMLSpanElement).textContent = APP_VERSION;

const hasCoalesced = typeof PointerEvent.prototype.getCoalescedEvents === 'function';
const hasPredicted = typeof PointerEvent.prototype.getPredictedEvents === 'function';

interface ActivePointer {
  sample: PointerSample;
  lastX: number;
  lastY: number;
  /** Rejected by palm rejection: the pointer no longer draws until it lifts. */
  ignored: boolean;
}

/** Latest sample and last drawn point for each active pointer. */
const active = new Map<number, ActivePointer>();
let lastCoalescedCount = 0;
let panelScheduled = false;
let touchStateTimer: number | undefined;

const ignoredCounts: Record<PalmRejectionStrategy, number> = {
  none: 0,
  'during-stroke': 0,
  'pen-session': 0,
};

function currentStrategy(): PalmRejectionStrategy {
  const value = strategySelect.value;
  return value === 'none' || value === 'pen-session' ? value : 'during-stroke';
}

function readNumber(input: HTMLInputElement, fallback: number): number {
  const value = input.valueAsNumber;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function buildRejector() {
  return createPalmRejector({
    strategy: currentStrategy(),
    graceMs: readNumber(graceInput, 500),
    sessionMs: readNumber(sessionInput, 10) * 1000,
  });
}

let rejector = buildRejector();

function rejectorAccepts(event: PointerEvent, phase: PointerInput['phase']): boolean {
  return rejector.accepts({ pointerType: event.pointerType, phase, timeStamp: event.timeStamp });
}

/** Marks a contact ignored by palm rejection and counts it once. */
function markIgnored(state: ActivePointer, x: number, y: number): void {
  state.ignored = true;
  ignoredCounts[currentStrategy()] += 1;
  ctx.strokeStyle = IGNORED_COLOR;
  ctx.beginPath();
  ctx.moveTo(x - IGNORED_MARK_SIZE, y - IGNORED_MARK_SIZE);
  ctx.lineTo(x + IGNORED_MARK_SIZE, y + IGNORED_MARK_SIZE);
  ctx.moveTo(x + IGNORED_MARK_SIZE, y - IGNORED_MARK_SIZE);
  ctx.lineTo(x - IGNORED_MARK_SIZE, y + IGNORED_MARK_SIZE);
  ctx.stroke();
}

function resizeCanvas(): void {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (width === canvas.width && height === canvas.height) return;
  // Changing the canvas size wipes its bitmap: keep a copy to paint back.
  const previous = canvas.width > 0 && canvas.height > 0 ? snapshotCanvas() : null;
  canvas.width = width;
  canvas.height = height;
  if (previous) ctx.drawImage(previous, 0, 0);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = LINE_WIDTH;
}

function snapshotCanvas(): HTMLCanvasElement {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')?.drawImage(canvas, 0, 0);
  return copy;
}

function drawSegment(fromX: number, fromY: number, toX: number, toY: number, type: string): void {
  ctx.strokeStyle = COLORS[type] ?? FALLBACK_COLOR;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

function onPointerDown(event: PointerEvent): void {
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Capture is a convenience: drawing still works without it.
  }
  const sample = toSample(event);
  const state: ActivePointer = { sample, lastX: sample.x, lastY: sample.y, ignored: false };
  active.set(event.pointerId, state);
  if (rejectorAccepts(event, 'down')) {
    drawSegment(sample.x, sample.y, sample.x, sample.y, sample.pointerType);
  } else {
    markIgnored(state, sample.x, sample.y);
  }
  schedulePanel();
}

function onPointerMove(event: PointerEvent): void {
  const state = active.get(event.pointerId);
  if (!state) return;
  state.sample = toSample(event);
  schedulePanel();
  if (state.ignored) return;
  if (!rejectorAccepts(event, 'move')) {
    markIgnored(state, event.clientX, event.clientY);
    return;
  }
  const events = hasCoalesced ? event.getCoalescedEvents() : [];
  lastCoalescedCount = events.length;
  for (const sub of events.length > 0 ? events : [event]) {
    drawSegment(state.lastX, state.lastY, sub.clientX, sub.clientY, event.pointerType);
    state.lastX = sub.clientX;
    state.lastY = sub.clientY;
  }
}

function onPointerEnd(event: PointerEvent): void {
  // Only end contacts that began on the canvas, once: a stray or duplicate `up`
  // would otherwise release another pen still in contact.
  if (!active.delete(event.pointerId)) return;
  rejectorAccepts(event, 'up');
  schedulePanel();
}

/** Repaints the panel on the next frame; idle pages schedule no frames. */
function schedulePanel(): void {
  if (panelScheduled) return;
  panelScheduled = true;
  requestAnimationFrame(renderPanel);
}

function renderTouchState(): void {
  const blocked = rejector.isTouchBlocked(performance.now());
  touchStateOutput.dataset['blocked'] = String(blocked);
  touchStateOutput.textContent =
    `Doigt : ${blocked ? 'ignoré' : 'actif'} — ignorés : ` +
    `aucune ${ignoredCounts.none} · trait ${ignoredCounts['during-stroke']} · ` +
    `session ${ignoredCounts['pen-session']}`;
  // While blocked, re-check periodically so the indicator flips back without new input.
  window.clearTimeout(touchStateTimer);
  if (blocked) touchStateTimer = window.setTimeout(schedulePanel, TOUCH_STATE_REFRESH_MS);
}

function renderPanel(): void {
  panelScheduled = false;
  renderTouchState();
  supportOutput.textContent = [
    `getCoalescedEvents: ${hasCoalesced ? 'oui' : 'non'}`,
    `getPredictedEvents: ${hasPredicted ? 'oui' : 'non'}`,
    `coalesced (dernier move): ${lastCoalescedCount}`,
  ].join('\n');
  pointersOutput.textContent =
    active.size === 0
      ? 'Aucun pointeur actif.'
      : [...active.entries()]
          .map(
            ([id, { sample, ignored }]) =>
              `— pointerId ${id}${ignored ? ' (ignoré)' : ''}\n${formatSample(sample)}`,
          )
          .join('\n\n');
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
// On window: without pointer capture, a contact lifted off the canvas must still end.
window.addEventListener('pointerup', onPointerEnd);
window.addEventListener('pointercancel', onPointerEnd);
requireElement('#clear', HTMLButtonElement).addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
window.addEventListener('resize', resizeCanvas);
for (const control of [strategySelect, graceInput, sessionInput]) {
  control.addEventListener('change', () => {
    rejector = buildRejector();
    // The new rejector starts blank: tell it about pens still in contact.
    for (const { sample } of active.values()) {
      if (sample.pointerType === 'pen') {
        rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: performance.now() });
      }
    }
    schedulePanel();
  });
}

// A new service worker took over (new deploy): reload so the page runs the new build.
// Skipped on first install, when the page had no controller yet.
if (navigator.serviceWorker?.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

resizeCanvas();
schedulePanel();
