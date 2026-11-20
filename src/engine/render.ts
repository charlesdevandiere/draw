import { POINT_STRIDE, pointCount, type Stroke } from './types';

/** The part of CanvasRenderingContext2D the renderer uses (a fake one in tests). */
export interface RenderContext {
  globalCompositeOperation: string;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
  stroke(): void;
}

/** Eraser strokes remove what is under them; the white page shows through. */
function applyStyle(context: RenderContext, stroke: Stroke): void {
  const erasing = stroke.tool === 'eraser';
  context.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
  const color = erasing ? '#000000' : stroke.color;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
}

/**
 * Draws the part of a stroke from point `from` on (0 = the whole stroke), joined to the
 * point before it, and returns the number of points now drawn. Strokes in progress are
 * drawn this way frame after frame. Coordinates are page units: the context transform
 * (see `setPageScale`) maps them to pixels. A single point is drawn as a dot, since the
 * canvas paints nothing for a zero-length segment.
 */
export function renderStroke(context: RenderContext, stroke: Stroke, from = 0): number {
  const count = pointCount(stroke);
  if (count === 0 || from >= count) return count;
  const { points } = stroke;
  applyStyle(context, stroke);
  context.beginPath();
  if (count === 1) {
    context.arc(points[0] ?? 0, points[1] ?? 0, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    return count;
  }
  const start = Math.max(0, from - 1);
  context.moveTo(points[start * POINT_STRIDE] ?? 0, points[start * POINT_STRIDE + 1] ?? 0);
  for (let i = Math.max(1, from); i < count; i += 1) {
    context.lineTo(points[i * POINT_STRIDE] ?? 0, points[i * POINT_STRIDE + 1] ?? 0);
  }
  context.stroke();
  return count;
}

/** Maps page units to the canvas pixels (`pixelsPerUnit` = backing size / page size). */
export function setPageScale(context: RenderContext, pixelsPerUnit: number): void {
  context.setTransform(pixelsPerUnit, 0, 0, pixelsPerUnit, 0, 0);
}

/** Clears the canvas and draws every stroke, in order. */
export function renderDrawing(
  context: RenderContext,
  strokes: readonly Stroke[],
  pixelsPerUnit: number,
  pageSize: number,
): void {
  setPageScale(context, pixelsPerUnit);
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, pageSize, pageSize);
  for (const stroke of strokes) renderStroke(context, stroke);
}
