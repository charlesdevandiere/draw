/**
 * Replay schedule (pure): when each point of a drawing appears during its replay.
 *
 * All strokes share one timeline, their own drawing time, so strokes drawn at the same
 * time (several fingers) replay at the same time. That timeline is then compressed:
 * - a pause while nothing is being drawn is shortened to `maxPauseMs` at most;
 * - a finger held still inside a stroke (a gap longer than `maxHoldMs` while a stroke is
 *   in progress) is shortened to `maxHoldMs`;
 * - if the result is still longer than `maxDurationMs`, everything is sped up uniformly.
 *
 * Template steps (coloring pages...) are instants on the same timeline: each shows at its
 * drawing time `t`, compressed like the points around it.
 */
import { currentLayers, type Layers } from './layers';
import { POINT_STRIDE, pointCount, type Stroke, type TemplateStep } from './types';

export const REPLAY_MAX_PAUSE_MS = 300;
/** A finger held still longer than this inside a stroke is shortened to it. */
export const REPLAY_MAX_HOLD_MS = 1000;
export const REPLAY_MAX_DURATION_MS = 15_000;

export interface ReplayStroke {
  stroke: Stroke;
  /** Replay time (ms from the start) of each point. */
  times: number[];
}

/** A template step and when it shows in the replay. */
export interface ReplayStep {
  step: TemplateStep;
  /** Replay time (ms from the start). */
  time: number;
}

export interface ReplayPlan {
  strokes: ReplayStroke[];
  /** Template steps, in order; each one shows at its time (spec/SPEC-template-layers.md). */
  steps: ReplayStep[];
  duration: number;
}

export interface ReplayOptions {
  maxPauseMs?: number;
  maxHoldMs?: number;
  maxDurationMs?: number;
}

/** Drawing times of a stroke's points, never going backwards (guard against odd data). */
function strokeTimes(stroke: Stroke, count: number): number[] {
  const times: number[] = [];
  let last = stroke.points[POINT_STRIDE - 1] ?? 0;
  for (let i = 0; i < count; i += 1) {
    last = Math.max(last, stroke.points[i * POINT_STRIDE + 2] ?? last);
    times.push(last);
  }
  return times;
}

/** Periods when at least one stroke is in progress, sorted and merged. */
function busyPeriods(spans: readonly [number, number][]): [number, number][] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

// DF-07: docs/device-fixes.md
export function planReplay(
  strokes: readonly Stroke[],
  options: ReplayOptions = {},
  templates: readonly TemplateStep[] = [],
): ReplayPlan {
  const maxPause = options.maxPauseMs ?? REPLAY_MAX_PAUSE_MS;
  const maxDuration = options.maxDurationMs ?? REPLAY_MAX_DURATION_MS;
  const maxHold = options.maxHoldMs ?? REPLAY_MAX_HOLD_MS;

  const raw: { stroke: Stroke; times: number[] }[] = [];
  for (const stroke of strokes) {
    const count = pointCount(stroke);
    if (count > 0) raw.push({ stroke, times: strokeTimes(stroke, count) });
  }
  if (raw.length === 0 && templates.length === 0) return { strokes: [], steps: [], duration: 0 };

  // Compressed time of every drawing time stamp (points and template steps), in order. A
  // step is an instant: the time around it is a pause unless a stroke is in progress.
  const stepTimes = templates.map((step) => Math.max(0, step.t));
  const stamps = [...new Set([...raw.flatMap(({ times }) => times), ...stepTimes])].sort(
    (a, b) => a - b,
  );
  const busy = busyPeriods(raw.map(({ times }) => [times[0] ?? 0, times[times.length - 1] ?? 0]));
  const compressed = new Map<number, number>();
  let period = 0;
  let replayTime = 0;
  let previous = stamps[0] ?? 0;
  for (const stamp of stamps) {
    while ((busy[period]?.[1] ?? Number.POSITIVE_INFINITY) < previous) period += 1;
    const [busyStart, busyEnd] = busy[period] ?? [0, 0];
    const drawing = busyStart <= previous && stamp <= busyEnd;
    replayTime += Math.min(stamp - previous, drawing ? maxHold : maxPause);
    compressed.set(stamp, replayTime);
    previous = stamp;
  }

  let duration = replayTime;
  const factor = duration > maxDuration ? maxDuration / duration : 1;
  if (factor < 1) duration = maxDuration;
  return {
    strokes: raw.map(({ stroke, times }) => ({
      stroke,
      times: times.map((time) => (compressed.get(time) ?? 0) * factor),
    })),
    steps: templates.map((step, index) => ({
      step,
      time: (compressed.get(stepTimes[index] ?? 0) ?? 0) * factor,
    })),
    duration,
  };
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

/** The template layers shown at replay time `time`: the steps placed by then. */
export function layersAtReplayTime(plan: ReplayPlan, time: number): Layers {
  const shown = time >= plan.duration ? plan.steps : plan.steps.filter((s) => s.time <= time);
  return currentLayers(shown.map(({ step }) => step));
}
