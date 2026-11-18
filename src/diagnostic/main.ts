import { APP_VERSION } from '../app-version';
import {
  createPalmRejector,
  type PalmRejectionStrategy,
  type PointerInput,
} from '../input/palm-rejection';
import { formatSample, toSample, type PointerSample } from './pointer-sample';
import {
  createGestureProtections,
  markIntentionalReload,
  watchIncidents,
} from './gesture-protections';
import { createIncidentCounter } from './incidents';
import { createStrokeRenderer } from './stroke-renderer';
import {
  createRateMeter,
  createRollingWindow,
  summarize,
  type RateMeter,
  type RollingWindow,
} from './timing-stats';

const COLORS: Record<string, string> = { pen: '#1f5fd6', touch: '#e07a10', mouse: '#2e9d4a' };
const FALLBACK_COLOR = '#888';
/** Panels are repainted at most every 100 ms (~10 Hz) so they do not skew the measurements. */
const PANEL_INTERVAL_MS = 100;
const RATE_WINDOW_MS = 1000;
const ROLLING_CAPACITY = 500;
/** Gaps longer than this between two painted frames are idle time, not frame durations. */
const MAX_FRAME_GAP_MS = 250;
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
const renderer = createStrokeRenderer(canvas);
const panel = requireElement('#panel', HTMLElement);
const timingOutput = requireElement('#timing', HTMLPreElement);
const incidentsOutput = requireElement('#incidents', HTMLPreElement);
const protectionsToggle = requireElement('#protections', HTMLInputElement);
const coalescedToggle = requireElement('#coalesced', HTMLInputElement);
const rawPointsToggle = requireElement('#raw-points', HTMLInputElement);

const strategySelect = requireElement('#strategy', HTMLSelectElement);
const graceInput = requireElement('#grace', HTMLInputElement);
const sessionInput = requireElement('#session', HTMLInputElement);
const touchStateOutput = requireElement('#touch-state', HTMLOutputElement);

requireElement('#version', HTMLSpanElement).textContent = APP_VERSION;

const hasCoalesced = typeof PointerEvent.prototype.getCoalescedEvents === 'function';
const hasPredicted = typeof PointerEvent.prototype.getPredictedEvents === 'function';

interface ActivePointer {
  sample: PointerSample;
  /** Rejected by palm rejection: the pointer no longer draws until it lifts. */
  ignored: boolean;
}

/** Latest sample and palm-rejection state for each active pointer. */
const active = new Map<number, ActivePointer>();
let lastCoalescedCount = 0;
let panelScheduled = false;
let touchStateTimer: number | undefined;

interface TypeTiming {
  /** pointermove events dispatched to the page. */
  events: RateMeter;
  /** Samples including coalesced ones (what is drawn when coalesced is on). */
  samples: RateMeter;
  coalescedPerMove: RollingWindow;
}

const timingByType = new Map<string, TypeTiming>();
const frameDurations = createRollingWindow(ROLLING_CAPACITY);
const inputLatencies = createRollingWindow(ROLLING_CAPACITY);
/** timeStamps of drawn events waiting for the next painted frame. */
let pendingEventTimes: number[] = [];
let previousFrameTime: number | null = null;

function timingFor(pointerType: string): TypeTiming {
  let timing = timingByType.get(pointerType);
  if (!timing) {
    timing = {
      events: createRateMeter(RATE_WINDOW_MS),
      samples: createRateMeter(RATE_WINDOW_MS),
      coalescedPerMove: createRollingWindow(ROLLING_CAPACITY),
    };
    timingByType.set(pointerType, timing);
  }
  return timing;
}

function recordMoveTiming(event: PointerEvent, coalesced: readonly PointerEvent[]): void {
  const timing = timingFor(event.pointerType);
  timing.coalescedPerMove.push(coalesced.length);
  // Rates are per pointer: two fingers interleaved would double (and reorder) the stamps.
  if (!event.isPrimary) return;
  timing.events.record(event.timeStamp);
  for (const sub of coalesced.length > 0 ? coalesced : [event])
    timing.samples.record(sub.timeStamp);
}

renderer.onFrame((frameTime) => {
  if (previousFrameTime !== null && frameTime - previousFrameTime <= MAX_FRAME_GAP_MS) {
    frameDurations.push(frameTime - previousFrameTime);
  }
  previousFrameTime = frameTime;
  const paintedAt = performance.now();
  for (const eventTime of pendingEventTimes) inputLatencies.push(paintedAt - eventTime);
  pendingEventTimes = [];
});

const protections = createGestureProtections(canvas);
const incidents = createIncidentCounter();
// Before setEnabled: a reload is counted under the state stored by the previous page.
watchIncidents((kind, protectionsOn) => {
  incidents.record(kind, protectionsOn ?? protections.isEnabled());
  schedulePanel();
});
protections.setEnabled(protectionsToggle.checked);

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
function markIgnored(pointerId: number, state: ActivePointer, x: number, y: number): void {
  state.ignored = true;
  ignoredCounts[currentStrategy()] += 1;
  renderer.endStroke(pointerId);
  renderer.markIgnored(x, y);
}

function onPointerDown(event: PointerEvent): void {
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Capture is a convenience: drawing still works without it.
  }
  const sample = toSample(event);
  const state: ActivePointer = { sample, ignored: false };
  active.set(event.pointerId, state);
  if (rejectorAccepts(event, 'down')) {
    const color = COLORS[sample.pointerType] ?? FALLBACK_COLOR;
    renderer.beginStroke(event.pointerId, sample.x, sample.y, color);
  } else {
    markIgnored(event.pointerId, state, sample.x, sample.y);
  }
  schedulePanel();
}

function onPointerMove(event: PointerEvent): void {
  const state = active.get(event.pointerId);
  if (!state) return;
  state.sample = toSample(event);
  const events = hasCoalesced ? event.getCoalescedEvents() : [];
  lastCoalescedCount = events.length;
  recordMoveTiming(event, events);
  schedulePanel();
  if (state.ignored) return;
  if (!rejectorAccepts(event, 'move')) {
    markIgnored(event.pointerId, state, event.clientX, event.clientY);
    return;
  }
  pendingEventTimes.push(event.timeStamp);
  const useCoalesced = coalescedToggle.checked && events.length > 0;
  for (const sub of useCoalesced ? events : [event]) {
    renderer.extendStroke(event.pointerId, sub.clientX, sub.clientY);
  }
}

function onPointerEnd(event: PointerEvent): void {
  // Only end contacts that began on the canvas, once: a stray or duplicate `up`
  // would otherwise release another pen still in contact.
  if (!active.delete(event.pointerId)) return;
  renderer.endStroke(event.pointerId);
  rejectorAccepts(event, 'up');
  schedulePanel();
}

/** Repaints the panels at most every PANEL_INTERVAL_MS; idle pages schedule nothing. */
function schedulePanel(): void {
  if (panelScheduled) return;
  panelScheduled = true;
  window.setTimeout(renderPanel, PANEL_INTERVAL_MS);
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

function formatNumber(value: number | null, digits = 1): string {
  return value === null ? 'n/d' : value.toFixed(digits);
}

function renderTiming(): void {
  const lines: string[] = [];
  for (const [type, timing] of timingByType) {
    const coalesced = summarize(timing.coalescedPerMove.values());
    lines.push(
      `${type} : ${formatNumber(timing.events.rate(), 0)} Hz sans coalesced, ` +
        `${formatNumber(timing.samples.rate(), 0)} Hz avec — ` +
        `coalesced/move moy. ${formatNumber(coalesced.mean)}`,
    );
  }
  const frames = summarize(frameDurations.values());
  const latency = summarize(inputLatencies.values());
  lines.push(
    `intervalle entre frames peintes : moy. ${formatNumber(frames.mean)} ms, p95 ${formatNumber(frames.p95)} ms`,
    `événement → rendu : moy. ${formatNumber(latency.mean)} ms, p95 ${formatNumber(latency.p95)} ms`,
  );
  timingOutput.textContent = lines.join('\n');
}

function formatIncidents(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  return entries.length === 0
    ? 'aucun'
    : entries.map(([kind, count]) => `${kind} ${count}`).join(', ');
}

function renderIncidents(): void {
  const { protectionsOn, protectionsOff } = incidents.snapshot();
  incidentsOutput.textContent = [
    `Incidents (protections on) : ${formatIncidents(protectionsOn)}`,
    `Incidents (protections off) : ${formatIncidents(protectionsOff)}`,
  ].join('\n');
}

function renderPanel(): void {
  panelScheduled = false;
  renderIncidents();
  renderTiming();
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
requireElement('#clear', HTMLButtonElement).addEventListener('click', () => renderer.clear());
requireElement('#toggle-panel', HTMLButtonElement).addEventListener('click', (event) => {
  const collapsed = panel.classList.toggle('collapsed');
  if (event.currentTarget instanceof HTMLButtonElement) {
    event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    event.currentTarget.textContent = collapsed ? 'Ouvrir' : 'Replier';
  }
});
rawPointsToggle.addEventListener('change', () =>
  renderer.setShowRawPoints(rawPointsToggle.checked),
);
coalescedToggle.disabled = !hasCoalesced;
protectionsToggle.addEventListener('change', () => {
  protections.setEnabled(protectionsToggle.checked);
  schedulePanel();
});
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
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    markIntentionalReload();
    window.location.reload();
  });
}

schedulePanel();
