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
  strokeStart,
} from '../engine/page-transform';
import { renderDrawing, renderStroke, setPageScale } from '../engine/render';
import {
  createDrawingClock,
  startStroke,
  strokeReach,
  type StrokeBuilder,
} from '../engine/stroke-builder';
import { currentLayers } from '../engine/layers';
import {
  PAGE_SIZE,
  drawingDuration,
  type Stroke,
  type StrokeStyle,
  type TemplateStep,
} from '../engine/types';
import { createLayerCanvas, type LayerCanvas } from './layer-canvas';

/** Pause inserted in drawing time when a reopened drawing is continued. */
const RESUME_PAUSE_MS = 500;
/**
 * A contact this close to the page (CSS pixels) still starts a stroke, on its edge.
 *
 * DF-06: docs/device-fixes.md
 */
const EDGE_MARGIN_PX = 24;
/**
 * A contact that never went farther than this (page units, 2 % of the page) from where it
 * landed has not really drawn: when it is cancelled or turned away by the input filter,
 * it is a palm, and its dot is removed. A tap lifted normally keeps its dot.
 *
 * DF-09: docs/device-fixes.md
 */
const STRAY_REACH = 20;

export type PointerPhase = 'down' | 'move' | 'up';

/** Decides whether a contact draws (input modes plug in here). */
export type PointerFilter = (event: PointerEvent, phase: PointerPhase) => boolean;

export interface DrawScreenOptions {
  canvas: HTMLCanvasElement;
  /**
   * Element around the canvas that receives the contacts (default: the canvas). A contact
   * landing on it within EDGE_MARGIN_PX of the page starts a stroke on the page edge.
   */
  hitArea?: HTMLElement;
  /** Style of the next stroke, read when a stroke starts. */
  style: () => StrokeStyle;
  accepts?: PointerFilter;
  /** A stroke was finished and added to the drawing. */
  onStroke?: (stroke: Stroke) => void;
  /** Canvases of the template layers, under and above the drawing canvas. */
  background?: HTMLCanvasElement;
  overlay?: HTMLCanvasElement;
  /** Overlay outline width kept constant (CSS pixels), or null to scale it. */
  fixedOutline?: () => number | null;
}

export interface DrawScreen {
  /** Replaces the drawing shown (strokes in progress are dropped). */
  setStrokes(strokes: readonly Stroke[]): void;
  strokes(): readonly Stroke[];
  /** Replaces the template steps; the layers they leave are shown. */
  setTemplates(templates: readonly TemplateStep[]): void;
  /** Drawing time now (ms, the clock of the stroke points), for a template step. */
  drawingTime(): number;
  /** Repaints the template layers (a setting changed). */
  refreshLayers(): void;
  /** Resolves once the template layers are painted. */
  layersReady(): Promise<void>;
  /** True while a contact is drawing. */
  isDrawing(): boolean;
}

interface ActiveStroke {
  builder: StrokeBuilder;
  /** Points already painted. */
  drawn: number;
  /** Where the contact landed (page units), before being pulled onto the page edge. */
  origin: [number, number];
}

export function initDrawScreen(options: DrawScreenOptions): DrawScreen {
  const { canvas } = options;
  const hitArea = options.hitArea ?? canvas;
  const accepts = options.accepts ?? (() => true);
  const contextOrNull = canvas.getContext('2d');
  if (!contextOrNull) throw new Error('Canvas 2D is not available');
  const context = contextOrNull;

  let strokes: Stroke[] = [];
  let templates: readonly TemplateStep[] = [];
  const background = options.background && createLayerCanvas(options.background);
  const overlay =
    options.overlay && createLayerCanvas(options.overlay, { fixedOutline: options.fixedOutline });
  const layerCanvases = [background, overlay].filter(
    (layer): layer is LayerCanvas => layer !== undefined,
  );
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
    for (const layer of layerCanvases) layer.resize(backing);
    repaint();
  }

  function showLayers(): void {
    const layers = currentLayers(templates);
    background?.set(layers.background);
    overlay?.set(layers.overlay);
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

  /** Drawing time a new clock starts at: after the last point or template step. */
  function resumeAt(): number {
    const end = Math.max(drawingDuration(strokes), ...templates.map((step) => step.t));
    return strokes.length > 0 || templates.length > 0 ? end + RESUME_PAUSE_MS : 0;
  }

  function createClock(timeStamp: number) {
    clock = createDrawingClock(resumeAt(), timeStamp);
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

  /**
   * A palm lands edge first, narrow enough to start a stroke, then iPadOS cancels it or it
   * grows wider than the palm filter allows: a contact that ends that way before moving
   * leaves nothing (whatever it drew is repainted away). One that drew keeps its stroke.
   */
  function dropOrFinish(pointerId: number): void {
    const entry = active.get(pointerId);
    if (!entry) return;
    if (strokeReach(entry.builder.stroke, entry.origin) > STRAY_REACH) {
      finish(pointerId);
      return;
    }
    active.delete(pointerId);
    repaint();
  }

  hitArea.addEventListener('pointerdown', (event) => {
    // Only the main button draws (not a mouse right button nor a pen's eraser end).
    if (event.button !== 0) return;
    // DF-06: docs/device-fixes.md
    // The tools sit right next to the page: a tap on a tool bar (button or gap) never draws.
    if (event.target instanceof Element && event.target.closest('button, [role="toolbar"]')) {
      return;
    }
    const transform = currentTransform();
    // On the page or just around it; null too when laid out at zero size (screen hidden).
    const start = strokeStart(transform, event.clientX, event.clientY, EDGE_MARGIN_PX);
    if (!start) return;
    contacts.add(event.pointerId);
    if (!accepts(event, 'down')) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a convenience: drawing still works without it.
    }
    const [x, y] = start;
    const landing = sampleOf(event, transform);
    active.set(event.pointerId, {
      builder: startStroke(options.style(), { ...landing, x, y }),
      drawn: 0,
      origin: [landing.x, landing.y],
    });
    requestFrame();
  });

  // On the hit area: moves reach it from the canvas (captured) or from around the page.
  hitArea.addEventListener('pointermove', (event) => {
    const entry = active.get(event.pointerId);
    // Hover (pen above the screen, buttons = 0) never draws.
    if (!entry || event.buttons === 0) return;
    if (!accepts(event, 'move')) {
      dropOrFinish(event.pointerId);
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
    // A cancelled contact (system gesture, iPadOS palm rejection) keeps what it drew,
    // unless it never moved: a palm's dot.
    if (event.type === 'pointercancel') dropOrFinish(event.pointerId);
    else finish(event.pointerId);
  };
  // On window: a contact lifted outside the canvas (without capture) must still end.
  window.addEventListener('pointerup', end);
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
    setTemplates(next) {
      templates = next;
      showLayers();
    },
    drawingTime() {
      // Without a running clock, no clock is started: time spent in a panel that ends up
      // changing nothing must not open a gap before the next stroke.
      return clock ? clock(performance.now()) : resumeAt();
    },
    refreshLayers() {
      for (const layer of layerCanvases) layer.resize(canvas.width);
    },
    layersReady: () => Promise.all(layerCanvases.map((layer) => layer.ready())).then(() => {}),
    isDrawing: () => active.size > 0,
  };
}
