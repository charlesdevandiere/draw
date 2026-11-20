/** Size of the square page, in page units. Every stored coordinate is in page units. */
export const PAGE_SIZE = 1000;

/** Values per point in `Stroke.points`: x, y, t. */
export const POINT_STRIDE = 3;

export type Tool = 'pen' | 'eraser';

/** What a new stroke looks like: chosen with the tools before the stroke starts. */
export interface StrokeStyle {
  tool: Tool;
  /** CSS color; ignored by the eraser. */
  color: string;
  /** Diameter in page units. */
  width: number;
}

export interface Stroke extends StrokeStyle {
  /**
   * Flat list of x, y, t triplets: page units rounded to 0.1, t in whole milliseconds
   * since the drawing started. A stroke with a single point is a dot.
   */
  points: number[];
}

export interface Drawing {
  id: string;
  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
  strokes: Stroke[];
}

/** Number of points in a stroke. */
export function pointCount(stroke: Pick<Stroke, 'points'>): number {
  return Math.floor(stroke.points.length / POINT_STRIDE);
}

/** End time of a drawing (t of its last point), 0 when empty. */
export function drawingDuration(strokes: readonly Stroke[]): number {
  let end = 0;
  for (const stroke of strokes) {
    // t of the last whole triplet: a truncated trailing triplet (corrupt import) is ignored.
    const last = stroke.points[pointCount(stroke) * POINT_STRIDE - 1];
    if (last !== undefined && last > end) end = last;
  }
  return end;
}
