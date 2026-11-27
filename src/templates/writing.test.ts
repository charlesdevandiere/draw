import { describe, expect, it } from 'vitest';
import capitals from './glyphs/capitals.json';
import cursive from './glyphs/cursive.json';
import digits from './glyphs/digits.json';
import { checkTemplateSvg } from './svg-check';
import {
  LETTER_SETS,
  WRITING_VERSION,
  glyphPreviewSvg,
  lettersLayer,
  linesLayer,
  templateKey,
  NOMINAL_PX_PER_CM,
  letterGrid,
  lettersSvg,
  linesSvg,
  seyesPaths,
  unitsPerCmFor,
} from './writing';

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

  it('Seyès shifted: thick lines through the offset, no line above or on the top edge', () => {
    for (const offset of [-35, 0, 20, 20.0000000001, 19.9999999999, 47.5]) {
      const lines = horizontalLines(`<svg>${seyesPaths(10, offset)}</svg>`);
      const all = Object.values(lines).flat();
      expect(Math.min(...all), `offset ${offset}`).toBeGreaterThan(0.05);
      const thick = lines['#8f7fd6'] ?? [];
      expect(thick.length).toBeGreaterThan(0);
      for (const y of thick) {
        const phase = (((y - offset) % 40) + 40) % 40;
        expect(Math.min(phase, 40 - phase), `offset ${offset}`).toBeLessThan(0.15);
      }
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

describe('letterGrid', () => {
  it('capitals: 2 cm high, rows 1 cm apart, whole copies inside the margins', () => {
    for (const unitsPerCm of [PHONE, TABLET]) {
      const layout = letterGrid('capitals', 'J', unitsPerCm);
      if (!layout) throw new Error('no layout');
      expect(layout.height).toBeCloseTo(2 * unitsPerCm, 0);
      const margin = 0.5 * unitsPerCm;
      const [first = 0, second] = layout.baselines;
      const last = layout.baselines.at(-1) ?? 0;
      const left = layout.xs[0] ?? 0;
      const right = (layout.xs.at(-1) ?? 0) + layout.width;
      expect(first - layout.height).toBeGreaterThanOrEqual(margin - 0.1);
      expect(last).toBeLessThanOrEqual(1000 - margin + 0.1);
      expect(left).toBeGreaterThanOrEqual(margin - 0.1);
      expect(right).toBeLessThanOrEqual(1000 - margin + 0.1);
      if (second !== undefined) expect(second - first).toBeCloseTo(3 * unitsPerCm, 0);
    }
  });

  it('fewer rows and copies on a phone than on a tablet', () => {
    const phone = letterGrid('capitals', 'J', PHONE);
    const tablet = letterGrid('capitals', 'J', TABLET);
    expect(phone?.baselines).toHaveLength(2);
    expect(tablet?.baselines.length).toBeGreaterThanOrEqual(4);
    expect(tablet?.xs.length).toBeGreaterThan(phone?.xs.length ?? 0);
    expect(phone?.xs.length).toBeGreaterThanOrEqual(2);
  });

  it('a wide letter gets fewer copies than a narrow one, never cut', () => {
    const wide = letterGrid('capitals', 'W', PHONE);
    const narrow = letterGrid('capitals', 'I', PHONE);
    expect(wide?.xs.length).toBeLessThan(narrow?.xs.length ?? 0);
    expect(wide?.xs.length).toBeGreaterThanOrEqual(1);
  });

  it('cursive: a 4 mm x-height, baselines on every other thick Seyès line', () => {
    for (const unitsPerCm of [PHONE, TABLET, 21, 40, 54, 65, 81, 110]) {
      const layout = letterGrid('cursive', 'm', unitsPerCm);
      if (!layout) throw new Error('no layout');
      const interval = 0.4 * unitsPerCm;
      expect(layout.height).toBeCloseTo(interval, 0);
      const first = layout.baselines[0] ?? 0;
      for (const [index, y] of layout.baselines.entries()) {
        expect((y - first) / interval).toBeCloseTo(8 * index, 1);
        expect(y + 2 * interval).toBeLessThanOrEqual(1000);
      }
      // Ascenders (3 intervals) a margin away from the top edge; every letter on the same rows.
      expect(first - 3 * interval).toBeGreaterThanOrEqual(0.5 * unitsPerCm);
      for (const char of LETTER_SETS.cursive) {
        expect(letterGrid('cursive', char, unitsPerCm)?.baselines, char).toEqual(layout.baselines);
      }
      expect(layout.baselines.length).toBeGreaterThanOrEqual(2);
      // The ruling has a thick line on each baseline.
      const svg = lettersSvg('cursive', 'm', unitsPerCm);
      const thickPath = /<path d="([^"]*)" fill="none" stroke="#8f7fd6"/.exec(svg)?.[1] ?? '';
      const thick = [...thickPath.matchAll(/M0 (-?[\d.]+)H/g)].map((match) => Number(match[1]));
      for (const y of layout.baselines) {
        expect(thick.some((line) => Math.abs(line - y) <= 0.15)).toBe(true);
      }
    }
  });

  it('digits are laid out like capitals; unknown characters have no layout', () => {
    expect(letterGrid('digits', '8', TABLET)?.height).toBeCloseTo(2 * TABLET, 0);
    expect(letterGrid('capitals', 'a', TABLET)).toBeNull();
    expect(letterGrid('digits', 'toString', TABLET)).toBeNull();
    expect(letterGrid('capitals', 'A', 0)).toBeNull();
  });

  it('keeps the ink of every glyph, outline included, a margin away from the edges', () => {
    const fonts = { capitals, cursive, digits };
    for (const set of ['capitals', 'cursive', 'digits'] as const) {
      const pad = set === 'cursive' ? 0.04 * cursive.xHeight : 0;
      for (const char of LETTER_SETS[set]) {
        const glyph = (fonts[set].glyphs as Record<string, { d: string }>)[char];
        const numbers = (glyph?.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        const xs = numbers.filter((_, index) => index % 2 === 0);
        const ys = numbers.filter((_, index) => index % 2 === 1);
        for (const unitsPerCm of [PHONE, TABLET]) {
          const layout = letterGrid(set, char, unitsPerCm);
          if (!layout) throw new Error('no layout');
          const margin = 0.5 * unitsPerCm - 0.2;
          const { scale } = layout;
          const left = (layout.xs[0] ?? 0) + (Math.min(...xs) - pad) * scale;
          const right = (layout.xs.at(-1) ?? 0) + (Math.max(...xs) + pad) * scale;
          const top = (layout.baselines[0] ?? 0) + (Math.min(...ys) - pad) * scale;
          const bottom = (layout.baselines.at(-1) ?? 0) + (Math.max(...ys) + pad) * scale;
          expect(left, `${set} ${char}`).toBeGreaterThanOrEqual(margin);
          expect(right, `${set} ${char}`).toBeLessThanOrEqual(1000 - margin);
          expect(top, `${set} ${char}`).toBeGreaterThanOrEqual(margin);
          expect(bottom, `${set} ${char}`).toBeLessThanOrEqual(1000 - margin);
        }
      }
    }
  });

  it('every character of every set has a layout', () => {
    for (const set of ['capitals', 'cursive', 'digits'] as const) {
      expect(LETTER_SETS[set].length).toBe(set === 'digits' ? 10 : 26);
      for (const char of LETTER_SETS[set]) expect(letterGrid(set, char, PHONE)).not.toBeNull();
    }
  });
});

describe('lettersSvg', () => {
  it('defines the glyph once and repeats it', () => {
    const layout = letterGrid('capitals', 'J', TABLET);
    const svg = lettersSvg('capitals', 'J', TABLET);
    expect(svg.match(/<path id="g"/g)).toHaveLength(1);
    expect(svg.match(/<use /g)).toHaveLength(
      (layout?.baselines.length ?? 0) * (layout?.xs.length ?? 0),
    );
  });

  it('is deterministic, valid and small for every character', () => {
    for (const set of ['capitals', 'cursive', 'digits'] as const) {
      for (const char of LETTER_SETS[set]) {
        for (const unitsPerCm of [PHONE, TABLET]) {
          const svg = lettersSvg(set, char, unitsPerCm);
          expect(lettersSvg(set, char, unitsPerCm)).toBe(svg);
          expect(checkTemplateSvg(svg, 64 * 1024)).toBeNull();
        }
      }
    }
  });

  it('an unknown character gives an empty page', () => {
    expect(lettersSvg('capitals', '?', TABLET)).not.toContain('<use');
  });
});

describe('layers', () => {
  it('ruled paper goes in the background with its size', () => {
    const layer = linesLayer('seyes', TABLET);
    expect(layer).toEqual({
      slot: 'background',
      template: 'lines/seyes',
      version: WRITING_VERSION,
      params: { unitsPerCm: TABLET },
      svg: linesSvg('seyes', TABLET),
    });
    expect(templateKey(layer)).toBe('lines/seyes');
  });

  it('a letter carries its character and size', () => {
    const layer = lettersLayer('cursive', 'f', PHONE);
    expect(layer.params).toEqual({ char: 'f', unitsPerCm: PHONE });
    expect(layer.template).toBe('letters/cursive');
    expect(layer.svg).toBe(lettersSvg('cursive', 'f', PHONE));
    expect(templateKey(layer)).toBe('letters/cursive:f');
  });

  it('previews one character framed by its ink', () => {
    const preview = glyphPreviewSvg('capitals', 'J');
    expect(preview).toMatch(/^<svg [^>]*viewBox="-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+">/);
    expect(preview.match(/<path /g)).toHaveLength(1);
    expect(glyphPreviewSvg('cursive', 'a')).toContain('stroke-width');
    expect(glyphPreviewSvg('digits', 'x')).not.toContain('<path');
  });
});
