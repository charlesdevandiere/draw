import { describe, expect, it } from 'vitest';
import { createRateMeter, createRollingWindow, summarize } from './timing-stats';

describe('summarize', () => {
  it('returns null statistics for an empty series', () => {
    expect(summarize([])).toEqual({ count: 0, mean: null, p95: null });
  });

  it('returns the value itself for a single sample', () => {
    expect(summarize([8])).toEqual({ count: 1, mean: 8, p95: 8 });
  });

  it('computes the mean and the nearest-rank 95th percentile', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100

    expect(summarize(values)).toEqual({ count: 100, mean: 50.5, p95: 95 });
  });

  it('does not depend on the input order', () => {
    expect(summarize([30, 10, 20]).p95).toBe(30);
  });
});

describe('createRollingWindow', () => {
  it('keeps only the most recent values up to its capacity', () => {
    const window = createRollingWindow(3);
    [1, 2, 3, 4, 5].forEach((value) => window.push(value));

    expect(window.values()).toEqual([3, 4, 5]);
  });

  it('starts empty and can be cleared', () => {
    const window = createRollingWindow(3);
    window.push(1);
    window.clear();

    expect(window.values()).toEqual([]);
  });
});

describe('createRateMeter', () => {
  it('reports null before two timestamps were recorded', () => {
    const meter = createRateMeter(1_000);
    meter.record(0);

    expect(meter.rate()).toBeNull();
  });

  it('computes the frequency in Hz from the recorded timestamps', () => {
    const meter = createRateMeter(1_000);
    for (let t = 0; t <= 100; t += 1000 / 120) meter.record(t);

    expect(meter.rate()).toBeCloseTo(120, 5);
  });

  it('only uses timestamps inside the sliding window', () => {
    const meter = createRateMeter(100, 1_000);
    meter.record(0);
    meter.record(50); // 20 Hz pair, will slide out
    for (let t = 1_000; t <= 1_100; t += 10) meter.record(t);

    expect(meter.rate()).toBeCloseTo(100, 5);
  });

  it('remembers the last measured rate across a pause', () => {
    const meter = createRateMeter(100);
    for (let t = 0; t <= 100; t += 10) meter.record(t);
    meter.record(5_000);

    expect(meter.rate()).toBeCloseTo(100, 5);
  });

  it('does not dilute the rate with a short pause inside the window', () => {
    const meter = createRateMeter(1_000, 100);
    for (let t = 0; t <= 100; t += 10) meter.record(t);
    for (let t = 500; t <= 550; t += 10) meter.record(t);

    expect(meter.rate()).toBeCloseTo(100, 5);
  });

  it('ignores a timestamp older than the previous one', () => {
    const meter = createRateMeter(1_000);
    meter.record(0);
    meter.record(10);
    meter.record(5);

    expect(meter.rate()).toBeCloseTo(100, 5);
  });

  it('can be reset', () => {
    const meter = createRateMeter(1_000);
    meter.record(0);
    meter.record(10);
    meter.reset();

    expect(meter.rate()).toBeNull();
  });
});
