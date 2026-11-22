import { describe, expect, it, vi } from 'vitest';
import { HAPTIC_TICK_MS, createHaptic } from './haptic';

describe('createHaptic', () => {
  it('vibrates once for 8 ms where the vibration API exists (Android)', () => {
    const vibrate = vi.fn(() => true);
    const tapSwitch = vi.fn();
    createHaptic({ vibrate, tapSwitch })();
    expect(HAPTIC_TICK_MS).toBe(8);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith(8);
    expect(tapSwitch).not.toHaveBeenCalled();
  });

  it('toggles the switch without the vibration API (iOS 18+)', () => {
    const tapSwitch = vi.fn();
    createHaptic({ tapSwitch })();
    expect(tapSwitch).toHaveBeenCalledOnce();
  });

  it('does nothing where neither exists', () => {
    expect(() => createHaptic({})()).not.toThrow();
  });

  it('never throws', () => {
    const failing = () => {
      throw new Error('blocked');
    };
    expect(() => createHaptic({ vibrate: failing })()).not.toThrow();
    expect(() => createHaptic({ tapSwitch: failing })()).not.toThrow();
  });
});
