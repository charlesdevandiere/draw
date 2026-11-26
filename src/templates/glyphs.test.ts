import { describe, expect, it } from 'vitest';
import capitals from './glyphs/capitals.json';
import cursive from './glyphs/cursive.json';
import digits from './glyphs/digits.json';
import { utf8Bytes } from './svg-check';

const range = (from: string, to: string) =>
  Array.from({ length: to.charCodeAt(0) - from.charCodeAt(0) + 1 }, (_, i) =>
    String.fromCharCode(from.charCodeAt(0) + i),
  );

describe.each([
  ['capitals', capitals, range('A', 'Z')],
  ['cursive', cursive, range('a', 'z')],
  ['digits', digits, range('0', '9')],
] as const)('glyph data: %s', (_, data, chars) => {
  it('has every character, with an outline and an advance', () => {
    const glyphs: Record<string, { d: string; advance: number }> = data.glyphs;
    expect(Object.keys(glyphs).sort()).toEqual([...chars].sort());
    for (const char of chars) {
      expect(glyphs[char]?.d).toMatch(/^M[-\d]/);
      expect(glyphs[char]?.advance).toBeGreaterThan(0);
    }
  });

  it('closes every contour', () => {
    const glyphs: Record<string, { d: string }> = data.glyphs;
    for (const char of chars) {
      const d = glyphs[char]?.d ?? '';
      expect(d.endsWith('Z')).toBe(true);
      expect(d.split('M').length - 1).toBe(d.split('Z').length - 1);
    }
  });

  it('has the metrics the layout needs', () => {
    expect(data.unitsPerEm).toBeGreaterThan(0);
    expect(data.capHeight).toBeGreaterThan(0);
    expect(data.xHeight).toBeGreaterThan(0);
    expect(data.license).toBe('SIL Open Font License 1.1');
  });

  it('stays small', () => {
    expect(utf8Bytes(JSON.stringify(data))).toBeLessThan(60 * 1024);
  });
});
