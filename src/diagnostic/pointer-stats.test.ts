import { describe, expect, it } from 'vitest';
import type { PointerSample } from './pointer-sample';
import { createPointerStats } from './pointer-stats';

function sample(overrides: Partial<PointerSample> = {}): PointerSample {
  return {
    pointerId: 1,
    pointerType: 'pen',
    isPrimary: true,
    pressure: 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    width: 1,
    height: 1,
    buttons: 1,
    x: 0,
    y: 0,
    timeStamp: 0,
    ...overrides,
  };
}

describe('createPointerStats', () => {
  it('has no entry before any sample', () => {
    expect(createPointerStats().snapshot()).toEqual({});
  });

  it('counts events per pointerType', () => {
    const stats = createPointerStats();
    stats.record(sample());
    stats.record(sample());
    stats.record(sample({ pointerType: 'touch' }));

    const snapshot = stats.snapshot();
    expect(snapshot['pen']?.events).toBe(2);
    expect(snapshot['touch']?.events).toBe(1);
  });

  it('tracks the pressure range and its distinct values', () => {
    const stats = createPointerStats();
    [0.5, 0.5, 0.2, 0.9].forEach((pressure) => stats.record(sample({ pressure })));

    expect(stats.snapshot()['pen']?.pressure).toEqual({
      min: 0.2,
      max: 0.9,
      distinctCount: 3,
      distinctValues: [0.2, 0.5, 0.9],
    });
  });

  it('reveals a constant pressure (no real pressure sensing)', () => {
    const stats = createPointerStats();
    for (let i = 0; i < 50; i += 1) stats.record(sample({ pressure: 0.5 }));

    expect(stats.snapshot()['pen']?.pressure.distinctCount).toBe(1);
  });

  it('lists at most 10 distinct pressure values but counts them all', () => {
    const stats = createPointerStats();
    for (let i = 1; i <= 20; i += 1) stats.record(sample({ pressure: i / 100 }));

    const pressure = stats.snapshot()['pen']?.pressure;
    expect(pressure?.distinctCount).toBe(20);
    expect(pressure?.distinctValues).toHaveLength(10);
  });

  it('tracks tilt, width and height ranges', () => {
    const stats = createPointerStats();
    stats.record(sample({ tiltX: -30, tiltY: 10, width: 1, height: 2 }));
    stats.record(sample({ tiltX: 45, tiltY: -5, width: 20, height: 18 }));

    const pen = stats.snapshot()['pen'];
    expect(pen?.tiltX).toEqual({ min: -30, max: 45 });
    expect(pen?.tiltY).toEqual({ min: -5, max: 10 });
    expect(pen?.width).toEqual({ min: 1, max: 20 });
    expect(pen?.height).toEqual({ min: 2, max: 18 });
  });

  it('reports a null altitude range when the browser never provided it', () => {
    const stats = createPointerStats();
    stats.record(sample());

    expect(stats.snapshot()['pen']?.altitudeAngle).toBeNull();
  });

  it('tracks the altitude range when provided', () => {
    const stats = createPointerStats();
    stats.record(sample({ altitudeAngle: 0.8 }));
    stats.record(sample({ altitudeAngle: 1.4 }));

    expect(stats.snapshot()['pen']?.altitudeAngle).toEqual({ min: 0.8, max: 1.4 });
  });

  it('flags twist only when a non-zero value was seen', () => {
    const stats = createPointerStats();
    stats.record(sample({ twist: 0 }));
    expect(stats.snapshot()['pen']?.twistSeen).toBe(false);

    stats.record(sample({ twist: 90 }));
    expect(stats.snapshot()['pen']?.twistSeen).toBe(true);
  });

  it('can be reset', () => {
    const stats = createPointerStats();
    stats.record(sample());
    stats.reset();

    expect(stats.snapshot()).toEqual({});
  });
});
