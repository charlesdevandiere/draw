import { POINT_STRIDE, pointCount, type Stroke, type StrokeStyle } from './types';

/** A point already converted to page units, with its drawing time in ms. */
export interface Sample {
  x: number;
  y: number;
  t: number;
}

/** Page coordinates are stored with one decimal: plenty for a 1000-unit page. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface StrokeBuilder {
  readonly stroke: Stroke;
  /** Adds a sample; returns false when it repeats the last point (nothing stored). */
  add(sample: Sample): boolean;
}

/** Starts a stroke at its first sample (alone, it is a dot). */
export function startStroke(style: StrokeStyle, first: Sample): StrokeBuilder {
  // Only the style fields: an object with more properties must not leak into storage.
  const stroke: Stroke = { tool: style.tool, color: style.color, width: style.width, points: [] };
  let lastX = Number.NaN;
  let lastY = Number.NaN;
  let lastT = Number.NEGATIVE_INFINITY;

  const add = (sample: Sample): boolean => {
    const x = roundCoordinate(sample.x);
    const y = roundCoordinate(sample.y);
    if (x === lastX && y === lastY) return false;
    // Time never goes backwards inside a stroke (coalesced samples may share a stamp).
    const t = Math.max(Math.round(sample.t), lastT);
    stroke.points.push(x, y, t);
    lastX = x;
    lastY = y;
    lastT = t;
    return true;
  };
  add(first);
  return { stroke, add };
}

/**
 * Converts event time stamps into drawing time. A drawing reopened later continues after
 * its last point: `startAt` is that point's t (plus a pause), `origin` the time stamp at
 * which the clock starts.
 */
export function createDrawingClock(startAt: number, origin: number): (timeStamp: number) => number {
  return (timeStamp) => Math.max(startAt, Math.round(startAt + timeStamp - origin));
}

/** Last point of a stroke as [x, y], or null for an empty stroke. */
export function lastPoint(stroke: Stroke): [number, number] | null {
  // Aligned on whole triplets: a truncated trailing triplet (corrupt import) is ignored.
  const count = pointCount(stroke);
  if (count === 0) return null;
  const start = (count - 1) * POINT_STRIDE;
  return [stroke.points[start] ?? 0, stroke.points[start + 1] ?? 0];
}
