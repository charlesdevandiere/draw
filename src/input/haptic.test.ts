import { describe, expect, it, vi } from 'vitest';
import { HAPTIC_TICK_MS, createHaptic } from './haptic';

describe('createHaptic', () => {
  it('vibrates once for 8 ms where the vibration API exists (Android)', () => {
    const vibrate = vi.fn(() => true);
    createHaptic(vibrate)();
    expect(HAPTIC_TICK_MS).toBe(8);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('does nothing without it (Safari)', () => {
    expect(() => createHaptic()()).not.toThrow();
  });

  it('never throws', () => {
    const failing = () => {
      throw new Error('blocked');
    };
    expect(() => createHaptic(failing)()).not.toThrow();
  });
});
