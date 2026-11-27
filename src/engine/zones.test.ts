import { describe, expect, it } from 'vitest';
import { ZONE_SEARCH_UNITS, labelZones, zoneAt } from './zones';

/** A mask from rows of text: '#' a barrier, '.' free. */
function mask(rows: string[]): { mask: Uint8Array; size: number } {
  const size = rows.length;
  const data = new Uint8Array(size * size);
  rows.forEach((row, y) => [...row].forEach((c, x) => (data[y * size + x] = c === '#' ? 1 : 0)));
  return { mask: data, size };
}

describe('labelZones', () => {
  it('a line splits the page in two zones', () => {
    const { mask: m, size } = mask(['..#..', '..#..', '..#..', '..#..', '..#..']);
    const labels = labelZones(m, size);
    expect(labels[0]).toBe(1);
    expect(labels[2]).toBe(0);
    expect(labels[3]).toBe(2);
    expect(new Set(labels)).toEqual(new Set([0, 1, 2]));
  });

  it('a ring: its inside and the outside are two zones, a hole inside a third', () => {
    const { mask: m, size } = mask([
      '.......',
      '.#####.',
      '.#...#.',
      '.#.#.#.',
      '.#...#.',
      '.#####.',
      '.......',
    ]);
    const labels = labelZones(m, size);
    const at = (x: number, y: number) => labels[y * size + x];
    expect(at(0, 0)).toBe(at(6, 6));
    expect(at(2, 2)).not.toBe(at(0, 0));
    expect(at(2, 2)).toBe(at(4, 4));
    expect(at(2, 2)).toBeGreaterThan(0);
  });

  it('a one-pixel gap joins two zones (outlines must be closed)', () => {
    const { mask: m, size } = mask(['..#..', '..#..', '.....', '..#..', '..#..']);
    const labels = labelZones(m, size);
    expect(labels[0]).toBe(labels[4]);
  });

  it('labels a full-size mask without recursion', () => {
    const size = 1000;
    const big = new Uint8Array(size * size);
    // A spiral-ish comb: many long thin zones.
    for (let x = 10; x < size; x += 20)
      for (let y = 0; y < size - 10; y += 1) big[y * size + x] = 1;
    const labels = labelZones(big, size);
    expect(labels[0]).toBe(1);
    expect(labels[(size - 1) * size + (size - 1)]).toBe(1);
  });
});

describe('zoneAt', () => {
  // 100 px for a 1000-unit page: 10 units per pixel. A vertical barrier at x = 50.
  const size = 100;
  const m = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) m[y * size + 50] = 1;
  const labels = labelZones(m, size);

  it('the zone under a point, keeping the point', () => {
    expect(zoneAt(labels, size, 200, 300)).toEqual({ label: 1, point: [200, 300] });
    expect(zoneAt(labels, size, 800, 300)?.label).toBe(2);
  });

  it('on a barrier, the nearest zone and a point inside it', () => {
    const hit = zoneAt(labels, size, 503, 300);
    expect(hit?.label).toBeGreaterThan(0);
    expect(hit?.point[0]).not.toBe(503);
    expect(Math.abs((hit?.point[0] ?? 0) - 503)).toBeLessThanOrEqual(ZONE_SEARCH_UNITS);
  });

  it('none when the nearest zone is too far', () => {
    const thick = new Uint8Array(size * size).fill(1);
    thick[0] = 0;
    const lonely = labelZones(thick, size);
    expect(zoneAt(lonely, size, 500, 500)).toBeNull();
    expect(zoneAt(lonely, size, 1, 1)?.label).toBe(1);
  });

  it('points off the page are pulled onto it, the returned point too', () => {
    expect(zoneAt(labels, size, -40, 2000)).toEqual({ label: 1, point: [5, 995] });
    expect(zoneAt(labels, size, 1200, -5)).toEqual({ label: 2, point: [995, 5] });
    expect(zoneAt(labels, size, 1000, 300)).toEqual({ label: 2, point: [995, 300] });
  });

  it('the returned point is rounded as stored, on the same pixel', () => {
    // 499.97 is in zone 1 (pixel 49) but rounds to 500.0, on the barrier (pixel 50).
    expect(zoneAt(labels, size, 499.97, 300.04)).toEqual({ label: 1, point: [495, 300] });
    expect(zoneAt(labels, size, 200.04, 300.06)).toEqual({ label: 1, point: [200, 300.1] });
  });
});
