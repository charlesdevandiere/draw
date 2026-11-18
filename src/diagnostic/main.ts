import { APP_VERSION } from '../app-version';
import { formatSample, toSample, type PointerSample } from './pointer-sample';

const COLORS: Record<string, string> = { pen: '#1f5fd6', touch: '#e07a10', mouse: '#2e9d4a' };
const FALLBACK_COLOR = '#888';
const LINE_WIDTH = 3;

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

requireElement('#version', HTMLSpanElement).textContent = APP_VERSION;

const hasCoalesced = typeof PointerEvent.prototype.getCoalescedEvents === 'function';
const hasPredicted = typeof PointerEvent.prototype.getPredictedEvents === 'function';

/** Latest sample and last drawn point for each active pointer. */
const active = new Map<number, { sample: PointerSample; lastX: number; lastY: number }>();
let lastCoalescedCount = 0;
let panelScheduled = false;

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
  canvas.setPointerCapture(event.pointerId);
  const sample = toSample(event);
  active.set(event.pointerId, { sample, lastX: sample.x, lastY: sample.y });
  drawSegment(sample.x, sample.y, sample.x, sample.y, sample.pointerType);
  schedulePanel();
}

function onPointerMove(event: PointerEvent): void {
  const state = active.get(event.pointerId);
  if (!state) return;
  const events = hasCoalesced ? event.getCoalescedEvents() : [];
  lastCoalescedCount = events.length;
  for (const sub of events.length > 0 ? events : [event]) {
    drawSegment(state.lastX, state.lastY, sub.clientX, sub.clientY, event.pointerType);
    state.lastX = sub.clientX;
    state.lastY = sub.clientY;
  }
  state.sample = toSample(event);
  schedulePanel();
}

function onPointerEnd(event: PointerEvent): void {
  active.delete(event.pointerId);
  schedulePanel();
}

/** Repaints the panel on the next frame; idle pages schedule no frames. */
function schedulePanel(): void {
  if (panelScheduled) return;
  panelScheduled = true;
  requestAnimationFrame(renderPanel);
}

function renderPanel(): void {
  panelScheduled = false;
  supportOutput.textContent = [
    `getCoalescedEvents: ${hasCoalesced ? 'oui' : 'non'}`,
    `getPredictedEvents: ${hasPredicted ? 'oui' : 'non'}`,
    `coalesced (dernier move): ${lastCoalescedCount}`,
  ].join('\n');
  pointersOutput.textContent =
    active.size === 0
      ? 'Aucun pointeur actif.'
      : [...active.entries()]
          .map(([id, { sample }]) => `— pointerId ${id}\n${formatSample(sample)}`)
          .join('\n\n');
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerEnd);
canvas.addEventListener('pointercancel', onPointerEnd);
requireElement('#clear', HTMLButtonElement).addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
window.addEventListener('resize', resizeCanvas);

// A new service worker took over (new deploy): reload so the page runs the new build.
// Skipped on first install, when the page had no controller yet.
if (navigator.serviceWorker?.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

resizeCanvas();
schedulePanel();
