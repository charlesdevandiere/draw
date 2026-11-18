export interface Summary {
  count: number;
  mean: number | null;
  /** Nearest-rank 95th percentile. */
  p95: number | null;
}

export function summarize(values: readonly number[]): Summary {
  if (values.length === 0) return { count: 0, mean: null, p95: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const rank = Math.ceil(0.95 * sorted.length) - 1;
  return { count: sorted.length, mean, p95: sorted[rank] ?? null };
}

export interface RollingWindow {
  push(value: number): void;
  values(): readonly number[];
  clear(): void;
}

/** Keeps the last `capacity` values. */
export function createRollingWindow(capacity: number): RollingWindow {
  let items: number[] = [];
  return {
    push(value) {
      items.push(value);
      // In place: no reallocation of the whole window on every push once full.
      if (items.length > capacity) items.splice(0, items.length - capacity);
    },
    values: () => items,
    clear() {
      items = [];
    },
  };
}

export interface RateMeter {
  record(timeStamp: number): void;
  /** Frequency in Hz over the sliding window, or the last one measured; null if never measured. */
  rate(): number | null;
  reset(): void;
}

/**
 * Measures an event frequency from timestamps (ms) over a sliding window.
 * The rate is computed between the first and last timestamps of the window,
 * so it reflects the sampling rate during motion and survives pauses: a gap
 * longer than `maxGapMs` starts a new measurement instead of diluting the rate.
 */
export function createRateMeter(windowMs: number, maxGapMs = 100): RateMeter {
  let stamps: number[] = [];
  let lastRate: number | null = null;

  return {
    record(timeStamp) {
      const latest = stamps[stamps.length - 1];
      if (latest !== undefined && timeStamp < latest) return;
      if (latest !== undefined && timeStamp - latest > maxGapMs) stamps.length = 0;
      stamps.push(timeStamp);
      // Stamps are sorted: drop the expired head in place (hot path, no allocation).
      const cutoff = timeStamp - windowMs;
      let expired = 0;
      while ((stamps[expired] ?? Infinity) < cutoff) expired++;
      if (expired > 0) stamps.splice(0, expired);
      const first = stamps[0];
      if (stamps.length >= 2 && first !== undefined && timeStamp > first) {
        lastRate = ((stamps.length - 1) * 1000) / (timeStamp - first);
      }
    },
    rate: () => lastRate,
    reset() {
      stamps = [];
      lastRate = null;
    },
  };
}
