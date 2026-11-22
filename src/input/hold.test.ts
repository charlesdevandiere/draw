import { describe, expect, it } from 'vitest';
import { LONG_PRESS_MS, createHold } from './hold';

describe('press and hold', () => {
  it('lasts 1.5 s, the same for every long press', () => {
    expect(LONG_PRESS_MS).toBe(1500);
    const hold = createHold();
    hold.press(0);
    expect(hold.complete(1499)).toBe(false);
    expect(hold.complete(1500)).toBe(true);
  });

  it('completes after the full duration only', () => {
    const hold = createHold();
    hold.press(1000);
    expect(hold.progress(1000)).toBe(0);
    expect(hold.progress(1000 + LONG_PRESS_MS / 2)).toBe(0.5);
    expect(hold.complete(1000 + LONG_PRESS_MS - 1)).toBe(false);
    expect(hold.complete(1000 + LONG_PRESS_MS)).toBe(true);
    expect(hold.progress(1000 + LONG_PRESS_MS * 2)).toBe(1);
  });

  it('a tap or an early release does not open', () => {
    const hold = createHold(3000);
    hold.press(0);
    hold.release();
    expect(hold.progress(5000)).toBe(0);
    expect(hold.complete(5000)).toBe(false);
  });

  it('starts over on a new press', () => {
    const hold = createHold(100);
    hold.press(0);
    hold.release();
    hold.press(500);
    expect(hold.progress(550)).toBe(0.5);
  });

  it('never goes below zero', () => {
    const hold = createHold(100);
    hold.press(50);
    expect(hold.progress(0)).toBe(0);
  });
});
