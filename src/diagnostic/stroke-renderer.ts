const LINE_WIDTH = 3;
const RAW_POINT_RADIUS = 1.5;
const RAW_POINT_COLOR = '#111';
const IGNORED_COLOR = '#b3261e';
const IGNORED_MARK_SIZE = 6;

interface Stroke {
  color: string;
  /** Flat list of CSS-pixel coordinates: x0, y0, x1, y1, … */
  points: number[];
  /** Number of points already painted on the canvas. */
  drawn: number;
}

export interface StrokeRenderer {
  beginStroke(pointerId: number, x: number, y: number, color: string): void;
  extendStroke(pointerId: number, x: number, y: number): void;
  endStroke(pointerId: number): void;
  markIgnored(x: number, y: number): void;
  setShowRawPoints(show: boolean): void;
  clear(): void;
  /** Called once per painted frame with the frame's start time (rAF timestamp). */
  onFrame(listener: (frameTime: number) => void): void;
}

/**
 * Paints strokes incrementally in requestAnimationFrame. Every stroke is kept so
 * that a resize or rotation can repaint the whole drawing at the new pixel ratio.
 */
export function createStrokeRenderer(canvas: HTMLCanvasElement): StrokeRenderer {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponible');
  const ctx = context;

  const strokes: Stroke[] = [];
  /** Strokes with points not yet painted: frames only visit these, not the whole drawing. */
  const dirty = new Set<Stroke>();
  const marks: number[] = [];
  let marksDrawn = 0;
  const activeStrokes = new Map<number, Stroke>();
  const frameListeners: ((frameTime: number) => void)[] = [];
  let showRawPoints = false;
  let frameRequested = false;

  function requestFrame(): void {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(paint);
  }

  function paintStroke(stroke: Stroke): void {
    const total = stroke.points.length / 2;
    if (stroke.drawn >= total) return;
    // Restart one point back so the new segment joins the painted one.
    const start = Math.max(0, stroke.drawn - 1);
    ctx.strokeStyle = stroke.color;
    ctx.beginPath();
    ctx.moveTo(stroke.points[start * 2] ?? 0, stroke.points[start * 2 + 1] ?? 0);
    for (let i = start; i < total; i++) {
      ctx.lineTo(stroke.points[i * 2] ?? 0, stroke.points[i * 2 + 1] ?? 0);
    }
    ctx.stroke();
    // Canvas prunes zero-length segments, so a tap (the dot of an « i ») would paint
    // nothing: draw the first point as a disc the width of the line.
    if (stroke.drawn === 0) {
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(stroke.points[0] ?? 0, stroke.points[1] ?? 0, LINE_WIDTH / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (showRawPoints) {
      ctx.fillStyle = RAW_POINT_COLOR;
      // From `start`: the new segment's round cap just covered the previous frame's last dot.
      for (let i = start; i < total; i++) {
        ctx.beginPath();
        ctx.arc(
          stroke.points[i * 2] ?? 0,
          stroke.points[i * 2 + 1] ?? 0,
          RAW_POINT_RADIUS,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    stroke.drawn = total;
  }

  function paintMarks(): void {
    if (marksDrawn >= marks.length) return;
    ctx.strokeStyle = IGNORED_COLOR;
    ctx.beginPath();
    for (let i = marksDrawn; i < marks.length; i += 2) {
      const x = marks[i] ?? 0;
      const y = marks[i + 1] ?? 0;
      ctx.moveTo(x - IGNORED_MARK_SIZE, y - IGNORED_MARK_SIZE);
      ctx.lineTo(x + IGNORED_MARK_SIZE, y + IGNORED_MARK_SIZE);
      ctx.moveTo(x + IGNORED_MARK_SIZE, y - IGNORED_MARK_SIZE);
      ctx.lineTo(x - IGNORED_MARK_SIZE, y + IGNORED_MARK_SIZE);
    }
    ctx.stroke();
    marksDrawn = marks.length;
  }

  /** Matches the backing store to the CSS size × devicePixelRatio; true if it changed. */
  function syncSize(): boolean {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width === canvas.width && height === canvas.height) return false;
    canvas.width = width;
    canvas.height = height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = LINE_WIDTH;
    return true;
  }

  /** Forgets what is painted so the next frame repaints everything (no frame request). */
  function invalidateAll(): void {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    dirty.clear(); // Refilled in drawing order so older strokes stay underneath.
    for (const stroke of strokes) {
      stroke.drawn = 0;
      dirty.add(stroke);
    }
    marksDrawn = 0;
  }

  function repaintAll(): void {
    invalidateAll();
    requestFrame();
  }

  function paint(frameTime: number): void {
    frameRequested = false;
    if (syncSize()) invalidateAll();
    for (const stroke of dirty) paintStroke(stroke);
    dirty.clear();
    paintMarks();
    for (const listener of frameListeners) listener(frameTime);
  }

  /** Watches the current pixel ratio; re-armed on each change since the query is ratio-specific. */
  function watchPixelRatio(): void {
    window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        requestFrame();
        watchPixelRatio();
      },
      { once: true },
    );
  }

  window.addEventListener('resize', requestFrame);
  watchPixelRatio();
  syncSize();

  return {
    beginStroke(pointerId, x, y, color) {
      const stroke: Stroke = { color, points: [x, y], drawn: 0 };
      strokes.push(stroke);
      dirty.add(stroke);
      activeStrokes.set(pointerId, stroke);
      requestFrame();
    },
    extendStroke(pointerId, x, y) {
      const stroke = activeStrokes.get(pointerId);
      if (!stroke) return;
      stroke.points.push(x, y);
      dirty.add(stroke);
      requestFrame();
    },
    endStroke(pointerId) {
      activeStrokes.delete(pointerId);
    },
    markIgnored(x, y) {
      marks.push(x, y);
      requestFrame();
    },
    setShowRawPoints(show) {
      showRawPoints = show;
      repaintAll();
    },
    clear() {
      strokes.length = 0;
      marks.length = 0;
      // Strokes in progress keep drawing from their latest point after the wipe.
      for (const stroke of activeStrokes.values()) {
        stroke.points = stroke.points.slice(-2);
        stroke.drawn = 0;
        strokes.push(stroke);
      }
      repaintAll();
    },
    onFrame(listener) {
      frameListeners.push(listener);
    },
  };
}
