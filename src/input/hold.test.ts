import { describe, expect, it } from 'vitest';
import { PARENT_HOLD_MS, createHold } from './hold';

describe('press and hold', () => {
  it('completes after the full duration only', () => {
    const hold = createHold();
    hold.press(1000);
    expect(hold.progress(1000)).toBe(0);
    expect(hold.progress(1000 + PARENT_HOLD_MS / 2)).toBe(0.5);
    expect(hold.complete(1000 + PARENT_HOLD_MS - 1)).toBe(false);
    expect(hold.complete(1000 + PARENT_HOLD_MS)).toBe(true);
    expect(hold.progress(1000 + PARENT_HOLD_MS * 2)).toBe(1);
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
