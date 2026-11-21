import { APP_VERSION } from '../app-version';
import { replaceHistoryOnLinks } from '../app/dom';
import {
  createPalmRejector,
  type PalmRejectionStrategy,
  type PointerInput,
} from '../input/palm-rejection';
import { formatSample, toSample, type PointerSample } from './pointer-sample';
import {
  collectEnvironment,
  formatEnvironment,
  requestPersistence,
  type EnvironmentInfo,
} from './environment';
import {
  createGestureProtections,
  markIntentionalReload,
  resetReloadCount,
  watchIncidents,
} from './gesture-protections';
import { checkForUpdate, resetAppCache } from '../pwa/app-update';
import { applyTranslations, documentLanguage } from '../i18n/apply';
import { createTranslator } from '../i18n/i18n';
import diagnosticHtml from './diagnostic.html?raw';
import { createIncidentCounter } from './incidents';
import { createPointerStats } from './pointer-stats';
import { buildReport } from './report';
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
/** How often the "finger ignored" indicator is re-evaluated while it is on. */
const TOUCH_STATE_REFRESH_MS = 250;

const { t } = createTranslator(documentLanguage());
document.body.innerHTML = diagnosticHtml;
applyTranslations(document.body, t);
replaceHistoryOnLinks(document.body);

function requireElement<T extends Element>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Element not found: ${selector}`);
  return element;
}

const canvas = requireElement('#surface', HTMLCanvasElement);
const pointersOutput = requireElement('#pointers', HTMLPreElement);
const contactOutput = requireElement('#contact-size', HTMLOutputElement);
const supportOutput = requireElement('#support', HTMLPreElement);
const renderer = createStrokeRenderer(canvas);
const panel = requireElement('#panel', HTMLElement);
const timingOutput = requireElement('#timing', HTMLPreElement);
const incidentsOutput = requireElement('#incidents', HTMLPreElement);
const protectionsToggle = requireElement('#protections', HTMLInputElement);
const environmentOutput = requireElement('#environment', HTMLPreElement);
const persistButton = requireElement('#persist', HTMLButtonElement);
const checkUpdateButton = requireElement('#check-update', HTMLButtonElement);
const resetCacheButton = requireElement('#reset-cache', HTMLButtonElement);
const updateStatus = requireElement('#update-status', HTMLOutputElement);
const reportFallback = requireElement('#report-fallback', HTMLTextAreaElement);
const shareButton = requireElement('#share-report', HTMLButtonElement);
const reportStatus = requireElement('#report-status', HTMLOutputElement);
const coalescedToggle = requireElement('#coalesced', HTMLInputElement);
const rawPointsToggle = requireElement('#raw-points', HTMLInputElement);

const strategySelect = requireElement('#strategy', HTMLSelectElement);
const singleTouchToggle = requireElement('#single-touch', HTMLInputElement);
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
/** Contact size, always in view in the panel header: tunes the Finger mode palm filter. */
let lastContact: { width: number; height: number } | null = null;
let widestContact = 0;

function recordContact(sample: { width: number; height: number }): void {
  lastContact = { width: sample.width, height: sample.height };
  widestContact = Math.max(widestContact, sample.width);
}
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

let environmentRequest = 0;
let environmentTimer: number | undefined;

let latestEnvironment: EnvironmentInfo | null = null;
const pointerStats = createPointerStats();

async function refreshEnvironment(): Promise<void> {
  // Overlapping calls (resize bursts, persist click) may resolve out of order: keep the latest.
  const request = ++environmentRequest;
  const info = await collectEnvironment();
  if (request !== environmentRequest) return;
  latestEnvironment = info;
  environmentOutput.textContent = formatEnvironment(info, t);
}

/** Coalesces bursts of resize events (rotation, toolbar animation) into one refresh. */
function scheduleEnvironmentRefresh(): void {
  window.clearTimeout(environmentTimer);
  environmentTimer = window.setTimeout(() => void refreshEnvironment(), PANEL_INTERVAL_MS);
}

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
let ignoredBySingleTouch = 0;

function currentStrategy(): PalmRejectionStrategy {
  const value = strategySelect.value;
  return value === 'none' || value === 'pen-session' ? value : 'during-stroke';
}

function readNumber(input: HTMLInputElement, fallback: number): number {
  const value = input.valueAsNumber;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Palm-rejection settings as applied to the rejector (and reported). */
function rejectorConfig() {
  return {
    strategy: currentStrategy(),
    graceMs: readNumber(graceInput, 500),
    sessionMs: readNumber(sessionInput, 10) * 1000,
    singleTouch: singleTouchToggle.checked,
  };
}

function buildRejector() {
  return createPalmRejector(rejectorConfig());
}

let rejector = buildRejector();

function rejectorAccepts(event: PointerEvent, phase: PointerInput['phase']): boolean {
  return rejector.accepts({
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    phase,
    timeStamp: event.timeStamp,
  });
}

/** Marks a contact ignored by palm rejection and counts it once. */
function markIgnored(pointerId: number, state: ActivePointer, x: number, y: number): void {
  state.ignored = true;
  // A touch ignored while no pen blocks touches was refused by the single-touch option.
  if (rejector.isSlotTaken(pointerId) && !rejector.isTouchBlocked(performance.now())) {
    ignoredBySingleTouch += 1;
  } else {
    ignoredCounts[currentStrategy()] += 1;
  }
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
  pointerStats.record(sample);
  recordContact(sample);
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
  recordContact(state.sample);
  const events = hasCoalesced ? event.getCoalescedEvents() : [];
  lastCoalescedCount = events.length;
  recordMoveTiming(event, events);
  for (const sub of events.length > 0 ? events : [event]) pointerStats.record(toSample(sub));
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
  touchStateOutput.textContent = t('diag.touchState', {
    state: blocked ? 'blocked' : 'active',
    none: ignoredCounts.none,
    stroke: ignoredCounts['during-stroke'],
    session: ignoredCounts['pen-session'],
    single: ignoredBySingleTouch,
  });
  // While blocked, re-check periodically so the indicator flips back without new input.
  window.clearTimeout(touchStateTimer);
  if (blocked) touchStateTimer = window.setTimeout(schedulePanel, TOUCH_STATE_REFRESH_MS);
}

function yesNo(value: boolean): string {
  return t(value ? 'common.yes' : 'common.no');
}

function formatNumber(value: number | null, digits = 1): string {
  return value === null ? t('common.notAvailableShort') : value.toFixed(digits);
}

function renderTiming(): void {
  const lines: string[] = [];
  for (const [type, timing] of timingByType) {
    const coalesced = summarize(timing.coalescedPerMove.values());
    lines.push(
      t('diag.timingType', {
        type,
        events: formatNumber(timing.events.rate(), 0),
        samples: formatNumber(timing.samples.rate(), 0),
        coalesced: formatNumber(coalesced.mean),
      }),
    );
  }
  const frames = summarize(frameDurations.values());
  const latency = summarize(inputLatencies.values());
  lines.push(
    t('diag.frameInterval', { mean: formatNumber(frames.mean), p95: formatNumber(frames.p95) }),
    t('diag.eventToRender', { mean: formatNumber(latency.mean), p95: formatNumber(latency.p95) }),
  );
  timingOutput.textContent = lines.join('\n');
}

function formatIncidents(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  return entries.length === 0
    ? t('diag.none')
    : entries.map(([kind, count]) => `${kind} ${count}`).join(', ');
}

function renderIncidents(): void {
  const { protectionsOn, protectionsOff } = incidents.snapshot();
  incidentsOutput.textContent = [
    t('diag.incidentsOn', { list: formatIncidents(protectionsOn) }),
    t('diag.incidentsOff', { list: formatIncidents(protectionsOff) }),
  ].join('\n');
}

function renderPanel(): void {
  panelScheduled = false;
  renderIncidents();
  renderTiming();
  renderTouchState();
  supportOutput.textContent = [
    `getCoalescedEvents: ${yesNo(hasCoalesced)}`,
    `getPredictedEvents: ${yesNo(hasPredicted)}`,
    t('diag.lastCoalesced', { count: lastCoalescedCount }),
  ].join('\n');
  contactOutput.textContent = lastContact
    ? t('diag.contact', {
        width: Math.round(lastContact.width),
        height: Math.round(lastContact.height),
        max: Math.round(widestContact),
      })
    : t('diag.contactHint');
  pointersOutput.textContent =
    active.size === 0
      ? t('diag.noPointer')
      : [...active.entries()]
          .map(
            ([id, { sample, ignored }]) =>
              `— pointerId ${id}${ignored ? ` ${t('diag.ignored')}` : ''}\n` +
              formatSample(sample, t('common.notAvailableShort')),
          )
          .join('\n\n');
}

function timingSummary(timing: TypeTiming) {
  return {
    eventsHz: timing.events.rate(),
    samplesHz: timing.samples.rate(),
    coalescedPerMove: summarize(timing.coalescedPerMove.values()),
  };
}

function currentReport() {
  const byType: Record<string, ReturnType<typeof timingSummary>> = {};
  for (const [type, timing] of timingByType) byType[type] = timingSummary(timing);
  return buildReport({
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    environment: latestEnvironment,
    support: { coalescedEvents: hasCoalesced, predictedEvents: hasPredicted },
    drawingOptions: {
      coalescedDrawing: hasCoalesced && coalescedToggle.checked,
      rawPoints: rawPointsToggle.checked,
    },
    pointers: pointerStats.snapshot(),
    timing: {
      byType,
      frameIntervalMs: summarize(frameDurations.values()),
      eventToRenderMs: summarize(inputLatencies.values()),
    },
    incidents: { protectionsEnabled: protections.isEnabled(), ...incidents.snapshot() },
    palmRejection: {
      ...rejectorConfig(),
      ignoredByStrategy: { ...ignoredCounts },
      ignoredBySingleTouch,
    },
  });
}

/** Last resort when neither clipboard nor share work: a selectable text area. */
function showReportFallback(json: string): void {
  reportFallback.hidden = false;
  reportFallback.value = json;
  reportFallback.focus();
  // iOS Safari ignores select() on text fields: set the range explicitly.
  reportFallback.setSelectionRange(0, json.length);
}

async function copyReport(): Promise<void> {
  const json = JSON.stringify(currentReport(), null, 2);
  try {
    await navigator.clipboard.writeText(json);
    reportFallback.hidden = true;
    reportStatus.textContent = t('diag.reportCopied');
  } catch {
    reportStatus.textContent = t('diag.copyFailed');
    showReportFallback(json);
  }
}

async function shareReport(): Promise<void> {
  const json = JSON.stringify(currentReport(), null, 2);
  try {
    await navigator.share({ title: `Diagnostic ${t('app.name')} ${APP_VERSION}`, text: json });
    reportFallback.hidden = true;
    reportStatus.textContent = t('diag.reportShared');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    reportStatus.textContent = t('diag.shareFailed');
    showReportFallback(json);
  }
}

function resetMeasurements(): void {
  pointerStats.reset();
  for (const timing of timingByType.values()) {
    timing.events.reset();
    timing.samples.reset();
    timing.coalescedPerMove.clear();
  }
  frameDurations.clear();
  inputLatencies.clear();
  pendingEventTimes = [];
  previousFrameTime = null;
  incidents.reset();
  resetReloadCount();
  for (const strategy of Object.keys(ignoredCounts) as PalmRejectionStrategy[]) {
    ignoredCounts[strategy] = 0;
  }
  ignoredBySingleTouch = 0;
  lastCoalescedCount = 0;
  renderer.clear();
  reportFallback.hidden = true;
  reportStatus.textContent = t('diag.measurementsReset');
  schedulePanel();
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
// On window: without pointer capture, a contact lifted off the canvas must still end.
window.addEventListener('pointerup', onPointerEnd);
window.addEventListener('pointercancel', onPointerEnd);
requireElement('#clear', HTMLButtonElement).addEventListener('click', () => {
  renderer.clear();
  // A new measure starts (the child's finger, then the palm).
  lastContact = null;
  widestContact = 0;
  schedulePanel();
});
requireElement('#toggle-panel', HTMLButtonElement).addEventListener('click', (event) => {
  const collapsed = panel.classList.toggle('collapsed');
  if (event.currentTarget instanceof HTMLButtonElement) {
    event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    event.currentTarget.textContent = t(collapsed ? 'diag.expand' : 'diag.collapse');
  }
});
rawPointsToggle.addEventListener('change', () =>
  renderer.setShowRawPoints(rawPointsToggle.checked),
);
coalescedToggle.disabled = !hasCoalesced;
requireElement('#copy-report', HTMLButtonElement).addEventListener(
  'click',
  () => void copyReport(),
);
shareButton.hidden = typeof navigator.share !== 'function';
shareButton.addEventListener('click', () => void shareReport());
requireElement('#reset', HTMLButtonElement).addEventListener('click', resetMeasurements);
persistButton.addEventListener('click', async () => {
  persistButton.disabled = true;
  try {
    const granted = await requestPersistence();
    persistButton.textContent = t('diag.persistResult', {
      state: granted === null ? 'unavailable' : granted ? 'granted' : 'refused',
    });
    await refreshEnvironment();
  } finally {
    persistButton.disabled = false;
  }
});
// Viewport, DPR and display mode change with rotation, toolbars, zoom and installation.
window.addEventListener('resize', scheduleEnvironmentRefresh);
for (const mode of ['standalone', 'fullscreen', 'minimal-ui', 'browser']) {
  window
    .matchMedia(`(display-mode: ${mode})`)
    .addEventListener?.('change', scheduleEnvironmentRefresh);
}
void refreshEnvironment();
protectionsToggle.addEventListener('change', () => {
  protections.setEnabled(protectionsToggle.checked);
  schedulePanel();
});
for (const control of [strategySelect, graceInput, sessionInput, singleTouchToggle]) {
  // 'input' (not 'change'): a typed value applies before the field loses focus.
  control.addEventListener('input', () => {
    rejector = buildRejector();
    // The new rejector starts blank: tell it about pens still in contact, then
    // about touches still drawing (the first one takes the single-touch slot).
    const now = performance.now();
    for (const [pointerId, { sample }] of active) {
      if (sample.pointerType === 'pen') {
        rejector.accepts({ pointerId, pointerType: 'pen', phase: 'down', timeStamp: now });
      }
    }
    for (const [pointerId, { sample, ignored }] of active) {
      if (sample.pointerType === 'touch' && !ignored) {
        rejector.accepts({ pointerId, pointerType: 'touch', phase: 'down', timeStamp: now });
      }
    }
    schedulePanel();
  });
}

const UPDATE_MESSAGES = {
  updating: t('update.updating'),
  'up-to-date': t('update.upToDate', { version: APP_VERSION }),
  'no-service-worker': t('update.noServiceWorker'),
} as const;

checkUpdateButton.addEventListener('click', async () => {
  checkUpdateButton.disabled = true;
  updateStatus.textContent = t('update.checking');
  try {
    updateStatus.textContent = UPDATE_MESSAGES[await checkForUpdate()];
  } catch {
    updateStatus.textContent = t('update.checkFailed');
  } finally {
    checkUpdateButton.disabled = false;
  }
});

resetCacheButton.addEventListener('click', async () => {
  resetCacheButton.disabled = true;
  updateStatus.textContent = t('update.clearing');
  try {
    await resetAppCache(markIntentionalReload);
  } catch {
    updateStatus.textContent = t('update.clearFailed');
    resetCacheButton.disabled = false;
  }
});

// An installed app is resumed rather than reopened: look for a new version each time it
// comes back to the foreground. Failures (offline) are silent, the buttons stay available.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate().catch(() => undefined);
});

// A new service worker took over (new deploy): reload so the page runs the new build.
// Skipped on first install, when the page had no controller yet.
if (navigator.serviceWorker?.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    markIntentionalReload();
    window.location.reload();
  });
}

schedulePanel();
