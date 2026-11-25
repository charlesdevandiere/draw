import { describe, expect, it } from 'vitest';
import { MAX_TILT_DEG, TAPE_COUNT, tileLook } from './wall';

describe('wall tile look', () => {
  it('is stable for an id', () => {
    expect(tileLook('abc-123')).toEqual(tileLook('abc-123'));
  });

  it('tilts within the bounds, never flat, and picks a tape', () => {
    for (let i = 0; i < 200; i += 1) {
      const { tilt, tape } = tileLook(`drawing-${i}`);
      expect(Math.abs(tilt)).toBeLessThanOrEqual(MAX_TILT_DEG);
      expect(Math.abs(tilt)).toBeGreaterThanOrEqual(0.5);
      expect(Number.isInteger(tape)).toBe(true);
      expect(tape).toBeGreaterThanOrEqual(0);
      expect(tape).toBeLessThan(TAPE_COUNT);
    }
  });

  it('spreads ids over both directions, several tilts and every tape', () => {
    // Drawing ids are UUIDs; short ids too.
    const uuids = Array.from({ length: 60 }, (_, i) =>
      tileLook(`3f2a1c9e-0b4d-4c7a-9e21-${String(i).padStart(12, '0')}`),
    );
    const short = Array.from({ length: 60 }, (_, i) => tileLook(`id-${i}`));
    for (const set of [uuids, short]) {
      expect(set.some(({ tilt }) => tilt < 0)).toBe(true);
      expect(set.some(({ tilt }) => tilt > 0)).toBe(true);
      expect(new Set(set.map(({ tilt }) => tilt)).size).toBeGreaterThan(4);
      expect(new Set(set.map(({ tape }) => tape)).size).toBe(TAPE_COUNT);
    }
  });

  it('gives neighbouring ids different looks', () => {
    expect(tileLook('a')).not.toEqual(tileLook('b'));
  });
});
