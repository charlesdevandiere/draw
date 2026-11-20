import { describe, expect, it } from 'vitest';
import {
  REPLAY_MAX_DURATION_MS,
  REPLAY_MAX_HOLD_MS,
  REPLAY_MAX_PAUSE_MS,
  planReplay,
  visiblePoints,
} from './replay';
import type { Stroke } from './types';

/** A stroke from points [x, y, t]... given as t values only. */
function stroke(...times: number[]): Stroke {
  return { tool: 'pen', color: '#000000', width: 8, points: times.flatMap((t, i) => [i, i, t]) };
}

describe('planReplay', () => {
  it('keeps real time inside a stroke and starts at zero', () => {
    const plan = planReplay([stroke(5000, 5100, 5250)]);
    expect(plan.strokes[0]?.times).toEqual([0, 100, 250]);
    expect(plan.duration).toBe(250);
  });

  it('shortens long pauses between strokes, keeps short ones', () => {
    const plan = planReplay([stroke(0, 100), stroke(150, 200), stroke(10_000, 10_050)]);
    expect(plan.strokes.map((s) => s.times)).toEqual([
      [0, 100],
      [150, 200],
      [200 + REPLAY_MAX_PAUSE_MS, 250 + REPLAY_MAX_PAUSE_MS],
    ]);
  });

  it('shortens a finger held still in the middle of a stroke', () => {
    const plan = planReplay([stroke(0, 100, 120_100, 120_200), stroke(120_250)]);
    expect(plan.strokes[0]?.times).toEqual([
      0,
      100,
      100 + REPLAY_MAX_HOLD_MS,
      200 + REPLAY_MAX_HOLD_MS,
    ]);
    expect(plan.duration).toBe(250 + REPLAY_MAX_HOLD_MS);
  });

  it('plays overlapping (simultaneous) strokes one after the other', () => {
    const plan = planReplay([stroke(0, 500), stroke(100, 300)]);
    expect(plan.strokes[1]?.times).toEqual([500, 700]);
  });

  it('a 20-second drawing replays at real speed, pauses shortened', () => {
    const strokes = Array.from({ length: 10 }, (_, i) => stroke(i * 2000, i * 2000 + 1000));
    const plan = planReplay(strokes);
    expect(plan.duration).toBe(10 * 1000 + 9 * REPLAY_MAX_PAUSE_MS);
  });

  it('fits a 10-minute drawing into the maximum duration, uniformly', () => {
    const strokes = Array.from({ length: 600 }, (_, i) => stroke(i * 1000, i * 1000 + 900));
    const plan = planReplay(strokes);
    expect(plan.duration).toBe(REPLAY_MAX_DURATION_MS);
    expect(plan.strokes.at(-1)?.times.at(-1)).toBeCloseTo(REPLAY_MAX_DURATION_MS);
    const [a, b] = plan.strokes;
    // Proportions are kept: stroke length (900 ms) vs pause (100 ms, under the cap).
    expect((a?.times[1] ?? 0) / ((b?.times[0] ?? 0) - (a?.times[1] ?? 0))).toBeCloseTo(900 / 100);
  });

  it('accepts options', () => {
    const plan = planReplay([stroke(0, 10), stroke(1000, 1010)], {
      maxPauseMs: 0,
      maxHoldMs: 5,
      maxDurationMs: 10,
    });
    expect(plan.duration).toBe(10);
  });

  it('handles an empty drawing, empty strokes, dots and odd times', () => {
    expect(planReplay([])).toEqual({ strokes: [], duration: 0 });
    const empty: Stroke = { tool: 'pen', color: '#000000', width: 8, points: [] };
    const plan = planReplay([empty, stroke(50), stroke(80, 70)]);
    expect(plan.strokes.map((s) => s.times)).toEqual([[0], [30, 30]]);
  });
});

describe('visiblePoints', () => {
  const times = [0, 100, 100, 250];

  it('counts the points shown at a given time', () => {
    expect(visiblePoints(times, -1)).toBe(0);
    expect(visiblePoints(times, 0)).toBe(1);
    expect(visiblePoints(times, 99)).toBe(1);
    expect(visiblePoints(times, 100)).toBe(3);
    expect(visiblePoints(times, 1000)).toBe(4);
    expect(visiblePoints([], 5)).toBe(0);
  });
});
