/**
 * Replay schedule (pure): when each point of a drawing appears during its replay.
 *
 * - inside a stroke, the drawing's own timing is kept, except that a finger held still
 *   (a gap between two points longer than `maxHoldMs`) is shortened to it;
 * - each pause between two strokes is shortened to `maxPauseMs` at most;
 * - if the result is still longer than `maxDurationMs`, everything is sped up uniformly.
 *
 * Strokes play one after the other, in their stored order (simultaneous strokes too).
 */
import { POINT_STRIDE, pointCount, type Stroke } from './types';

export const REPLAY_MAX_PAUSE_MS = 300;
/** A finger held still longer than this inside a stroke is shortened to it. */
export const REPLAY_MAX_HOLD_MS = 1000;
export const REPLAY_MAX_DURATION_MS = 15_000;

export interface ReplayStroke {
  stroke: Stroke;
  /** Replay time (ms from the start) of each point. */
  times: number[];
}

export interface ReplayPlan {
  strokes: ReplayStroke[];
  duration: number;
}

export interface ReplayOptions {
  maxPauseMs?: number;
  maxHoldMs?: number;
  maxDurationMs?: number;
}

export function planReplay(strokes: readonly Stroke[], options: ReplayOptions = {}): ReplayPlan {
  const maxPause = options.maxPauseMs ?? REPLAY_MAX_PAUSE_MS;
  const maxDuration = options.maxDurationMs ?? REPLAY_MAX_DURATION_MS;
  const maxHold = options.maxHoldMs ?? REPLAY_MAX_HOLD_MS;
  const planned: ReplayStroke[] = [];
  let cursor = 0;
  let previousEnd: number | null = null;

  for (const stroke of strokes) {
    const count = pointCount(stroke);
    if (count === 0) continue;
    const start = stroke.points[POINT_STRIDE - 1] ?? 0;
    const gap = previousEnd === null ? 0 : Math.min(Math.max(start - previousEnd, 0), maxPause);
    const origin = cursor + gap;
    const times: number[] = [];
    let last = start;
    let elapsed = 0;
    for (let i = 0; i < count; i += 1) {
      // Times inside a stroke never go backwards; guard against odd stored data anyway.
      const t = Math.max(last, stroke.points[i * POINT_STRIDE + 2] ?? last);
      // A finger held still mid-stroke is a pause too: shortened like the others.
      elapsed += Math.min(t - last, maxHold);
      last = t;
      times.push(origin + elapsed);
    }
    cursor = times[times.length - 1] ?? origin;
    previousEnd = last;
    planned.push({ stroke, times });
  }

  if (cursor > maxDuration) {
    const factor = maxDuration / cursor;
    for (const entry of planned) entry.times = entry.times.map((time) => time * factor);
    cursor = maxDuration;
  }
  return { strokes: planned, duration: cursor };
}

/** Number of points of a planned stroke visible at replay time `time`. */
export function visiblePoints(times: readonly number[], time: number): number {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((times[middle] ?? Number.POSITIVE_INFINITY) <= time) low = middle + 1;
    else high = middle;
  }
  return low;
}
