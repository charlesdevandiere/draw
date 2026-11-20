/**
 * DOM side of the drawing screen: canvas sizing, Pointer Events → strokes, painting.
 * Strokes in progress are painted incrementally, frame by frame, straight onto the
 * drawing canvas (an eraser must act on what is already drawn); the whole drawing is
 * repainted from its vectors only when needed (resize, load).
 */
import {
  backingSize,
  fitPage,
  pageToBacking,
  toPage,
  type PageTransform,
} from '../engine/page-transform';
import { renderDrawing, renderStroke, setPageScale } from '../engine/render';
import { createDrawingClock, startStroke, type StrokeBuilder } from '../engine/stroke-builder';
import { PAGE_SIZE, drawingDuration, type Stroke, type StrokeStyle } from '../engine/types';

/** Pause inserted in drawing time when a reopened drawing is continued. */
const RESUME_PAUSE_MS = 500;

export type PointerPhase = 'down' | 'move' | 'up';

/** Decides whether a contact draws (input modes plug in here). */
export type PointerFilter = (event: PointerEvent, phase: PointerPhase) => boolean;

export interface DrawScreenOptions {
  canvas: HTMLCanvasElement;
  /** Style of the next stroke, read when a stroke starts. */
  style: () => StrokeStyle;
  accepts?: PointerFilter;
  /** A stroke was finished and added to the drawing. */
  onStroke?: (stroke: Stroke) => void;
}

export interface DrawScreen {
  /** Replaces the drawing shown (strokes in progress are dropped). */
  setStrokes(strokes: readonly Stroke[]): void;
  strokes(): readonly Stroke[];
  /** True while a contact is drawing. */
  isDrawing(): boolean;
}

interface ActiveStroke {
  builder: StrokeBuilder;
  /** Points already painted. */
  drawn: number;
}

export function initDrawScreen(options: DrawScreenOptions): DrawScreen {
  const { canvas } = options;
  const accepts = options.accepts ?? (() => true);
  const contextOrNull = canvas.getContext('2d');
  if (!contextOrNull) throw new Error('Canvas 2D is not available');
  const context = contextOrNull;

  let strokes: Stroke[] = [];
  const active = new Map<number, ActiveStroke>();
  /** Contacts that started on the canvas, drawing or not: the filter must see them end. */
  const contacts = new Set<number>();
  let clock: ((timeStamp: number) => number) | null = null;
  let frameRequested = false;
  let pixelsPerUnit = 1;

  function repaint(): void {
    renderDrawing(context, strokes, pixelsPerUnit, PAGE_SIZE);
    for (const entry of active.values()) entry.drawn = renderStroke(context, entry.builder.stroke);
  }

  function resize(): void {
    const size = canvas.getBoundingClientRect().width;
    const backing = backingSize(size, window.devicePixelRatio);
    if (canvas.width !== backing || canvas.height !== backing) {
      canvas.width = backing;
      canvas.height = backing;
    }
    pixelsPerUnit = pageToBacking(backing);
    repaint();
  }

  function paintFrame(): void {
    frameRequested = false;
    setPageScale(context, pixelsPerUnit);
    for (const entry of active.values()) {
      entry.drawn = renderStroke(context, entry.builder.stroke, entry.drawn);
    }
  }

  function requestFrame(): void {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(paintFrame);
  }

  /** Page transform of the canvas: read once per event (each read forces a layout). */
  function currentTransform(): PageTransform {
    return fitPage(canvas.getBoundingClientRect());
  }

  function sampleOf(event: PointerEvent, transform: PageTransform) {
    const [x, y] = toPage(transform, event.clientX, event.clientY);
    return { x, y, t: (clock ?? createClock(event.timeStamp))(event.timeStamp) };
  }

  function createClock(timeStamp: number) {
    const resumeAt = strokes.length > 0 ? drawingDuration(strokes) + RESUME_PAUSE_MS : 0;
    clock = createDrawingClock(resumeAt, timeStamp);
    return clock;
  }

  function finish(pointerId: number): void {
    const entry = active.get(pointerId);
    if (!entry) return;
    // Paint what the last frames have not painted yet, then hand the stroke over.
    setPageScale(context, pixelsPerUnit);
    renderStroke(context, entry.builder.stroke, entry.drawn);
    active.delete(pointerId);
    // Strokes are stored in the order they end. Simultaneous overlapping strokes may stack
    // differently after a repaint than they did live: rare, and accepted for the MVP.
    strokes = [...strokes, entry.builder.stroke];
    options.onStroke?.(entry.builder.stroke);
  }

  canvas.addEventListener('pointerdown', (event) => {
    // Only the main button draws (not a mouse right button nor a pen's eraser end).
    if (event.button !== 0) return;
    contacts.add(event.pointerId);
    if (!accepts(event, 'down')) return;
    // Laid out at zero size (screen hidden): there is no page to draw on.
    if (canvas.getBoundingClientRect().width === 0) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a convenience: drawing still works without it.
    }
    active.set(event.pointerId, {
      builder: startStroke(options.style(), sampleOf(event, currentTransform())),
      drawn: 0,
    });
    requestFrame();
  });

  canvas.addEventListener('pointermove', (event) => {
    const entry = active.get(event.pointerId);
    // Hover (pen above the screen, buttons = 0) never draws.
    if (!entry || event.buttons === 0) return;
    if (!accepts(event, 'move')) {
      finish(event.pointerId);
      return;
    }
    const coalesced =
      typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    const transform = currentTransform();
    for (const sub of coalesced.length > 0 ? coalesced : [event]) {
      entry.builder.add(sampleOf(sub, transform));
    }
    requestFrame();
  });

  const end = (event: PointerEvent): void => {
    if (!contacts.delete(event.pointerId)) return;
    accepts(event, 'up');
    finish(event.pointerId);
  };
  // On window: a contact lifted outside the canvas (without capture) must still end.
  window.addEventListener('pointerup', end);
  // A cancelled contact (system gesture) keeps what it drew.
  window.addEventListener('pointercancel', end);

  new ResizeObserver(resize).observe(canvas);
  resize();

  return {
    setStrokes(next) {
      active.clear();
      strokes = [...next];
      clock = null;
      repaint();
    },
    strokes: () => strokes,
    isDrawing: () => active.size > 0,
  };
}
