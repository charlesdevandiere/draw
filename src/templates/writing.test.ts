import { describe, expect, it } from 'vitest';
import { checkTemplateSvg } from './svg-check';
import { NOMINAL_PX_PER_CM, linesSvg, unitsPerCmFor } from './writing';

/** Page units per cm on a phone (page 360 CSS px wide) and a tablet (700 px). */
const PHONE = unitsPerCmFor(360);
const TABLET = unitsPerCmFor(700);

/** The y of every horizontal line ("M0 y H1000") of a path, by stroke color. */
function horizontalLines(svg: string): Record<string, number[]> {
  const lines: Record<string, number[]> = {};
  for (const path of svg.matchAll(/<path d="([^"]*)"[^>]*stroke="([^"]*)"/g)) {
    const ys = [...(path[1] ?? '').matchAll(/M0 ([\d.]+)H1000/g)].map((m) => Number(m[1]));
    lines[path[2] ?? ''] = [...(lines[path[2] ?? ''] ?? []), ...ys];
  }
  return lines;
}

describe('unitsPerCmFor', () => {
  it('converts the page width on screen to page units per centimeter', () => {
    expect(unitsPerCmFor(1000)).toBe(NOMINAL_PX_PER_CM);
    expect(PHONE).toBeCloseTo((1000 * 55) / 360, 1);
    expect(PHONE).toBeGreaterThan(TABLET);
  });
});

describe('linesSvg', () => {
  it('small squares: a line every 5 mm, the same size in cm on any screen', () => {
    for (const unitsPerCm of [PHONE, TABLET]) {
      const svg = linesSvg('small-squares', unitsPerCm);
      const [ys = []] = Object.values(horizontalLines(svg));
      expect(ys[0]).toBeCloseTo(unitsPerCm / 2, 0);
      expect((ys[1] ?? 0) - (ys[0] ?? 0)).toBeCloseTo(unitsPerCm / 2, 0);
      // Lines down to the bottom of the page, never past it.
      expect(ys.at(-1)).toBeLessThan(1000);
      expect(1000 - (ys.at(-1) ?? 0)).toBeLessThanOrEqual(unitsPerCm / 2);
      // Vertical lines as many as horizontal ones.
      expect(svg.match(/V1000/g)).toHaveLength(ys.length);
    }
    // More squares on a tablet: each one is smaller in page units.
    const count = (u: number) => Object.values(horizontalLines(linesSvg('small-squares', u)))[0];
    expect(count(TABLET)?.length).toBeGreaterThan(count(PHONE)?.length ?? 0);
  });

  it('Seyès: thin lines every 2 mm, a thick one every 8 mm, vertical lines every 8 mm', () => {
    for (const unitsPerCm of [PHONE, TABLET]) {
      const svg = linesSvg('seyes', unitsPerCm);
      const lines = horizontalLines(svg);
      const [thin = [], thick = []] = Object.values(lines);
      const interval = 0.2 * unitsPerCm;
      expect(thick[0]).toBeCloseTo(4 * interval, 0);
      expect((thick[1] ?? 0) - (thick[0] ?? 0)).toBeCloseTo(4 * interval, 0);
      expect(thin.slice(0, 3).map((y) => Math.round(y / interval))).toEqual([1, 2, 3]);
      // Every line on the 2 mm ruling, each one thin or thick, down to the bottom.
      const all = [...thin, ...thick].sort((a, b) => a - b);
      expect(all.map((y) => Math.round(y / interval))).toEqual(all.map((_, i) => i + 1));
      expect(thick.every((y) => Math.round(y / interval) % 4 === 0)).toBe(true);
      expect(1000 - (all.at(-1) ?? 0)).toBeLessThanOrEqual(interval);
      expect(svg.match(/V1000/g)).toHaveLength(thick.length);
    }
  });

  it('draws nothing, rather than hanging, for a meaningless size', () => {
    for (const unitsPerCm of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(linesSvg('small-squares', unitsPerCm)).not.toContain('<path');
      expect(linesSvg('seyes', unitsPerCm)).not.toContain('<path');
    }
  });

  it('is deterministic, valid and small', () => {
    for (const kind of ['small-squares', 'seyes'] as const) {
      for (const unitsPerCm of [PHONE, TABLET, unitsPerCmFor(1400)]) {
        const svg = linesSvg(kind, unitsPerCm);
        expect(linesSvg(kind, unitsPerCm)).toBe(svg);
        expect(checkTemplateSvg(svg, 64 * 1024)).toBeNull();
      }
    }
  });
});
