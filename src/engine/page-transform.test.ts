import { describe, expect, it } from 'vitest';
import { backingSize, fitPage, pageToBacking, toPage, toScreen } from './page-transform';

describe('fitPage', () => {
  it('fills the width in portrait and centers vertically', () => {
    const transform = fitPage({ x: 8, y: 32, width: 396, height: 700 });
    expect(transform.size).toBe(396);
    expect(transform.scale).toBeCloseTo(0.396);
    expect(transform.offsetX).toBe(8);
    expect(transform.offsetY).toBe(32 + (700 - 396) / 2);
  });

  it('fills the height in landscape and centers horizontally', () => {
    const transform = fitPage({ x: 0, y: 32, width: 1180, height: 756 });
    expect(transform.size).toBe(756);
    expect(transform.offsetX).toBe((1180 - 756) / 2);
    expect(transform.offsetY).toBe(32);
  });

  it('collapses to nothing for an empty area', () => {
    const transform = fitPage({ x: 0, y: 0, width: 0, height: 500 });
    expect(transform.size).toBe(0);
    expect(toPage(transform, 10, 10)).toEqual([0, 0]);
  });
});

describe('screen ↔ page', () => {
  it.each([
    ['portrait', { x: 8, y: 223.5, width: 396, height: 396 }],
    ['landscape', { x: 184, y: 32, width: 756, height: 756 }],
    ['letterboxed', { x: 0, y: 0, width: 1000, height: 400 }],
  ])('round-trips in %s', (_label, area) => {
    const transform = fitPage(area);
    for (const [x, y] of [
      [0, 0],
      [1000, 1000],
      [123.4, 876.5],
    ] as const) {
      const [sx, sy] = toScreen(transform, x, y);
      const [px, py] = toPage(transform, sx, sy);
      expect(px).toBeCloseTo(x, 6);
      expect(py).toBeCloseTo(y, 6);
    }
  });

  it('maps the page corners to the fitted square', () => {
    const transform = fitPage({ x: 184, y: 32, width: 756, height: 756 });
    expect(toScreen(transform, 0, 0)).toEqual([184, 32]);
    expect(toScreen(transform, 1000, 1000)).toEqual([940, 788]);
    expect(toPage(transform, 562, 410)).toEqual([500, 500]);
  });
});

describe('backing store', () => {
  it.each([
    [396, 1, 396],
    [396, 2, 792],
    [396, 2.625, 1040],
    [756, 3, 2268],
  ])('%d CSS px at DPR %d → %d device px', (css, dpr, expected) => {
    expect(backingSize(css, dpr)).toBe(expected);
  });

  it('never returns an empty canvas and ignores a bogus ratio', () => {
    expect(backingSize(0, 2)).toBe(1);
    expect(backingSize(100, 0)).toBe(100);
  });

  it('scales page units to backing pixels', () => {
    expect(pageToBacking(2000)).toBe(2);
  });
});
