/**
 * Light haptic tick (spec/SPEC-ui-foundation.md, "Haptic feedback"): a slider step, a
 * completed long press. Pure: the platform means are passed in (src/app/haptic.ts).
 */

/** Length of the tick on Android, in milliseconds. */
export const HAPTIC_TICK_MS = 8;

export interface HapticMeans {
  /** `navigator.vibrate` (Android Chrome); missing on iOS. */
  vibrate?: (milliseconds: number) => unknown;
  /** Toggles a hidden `<input type="checkbox" switch>` (iOS 18+ system haptic). */
  tapSwitch?: () => void;
}

/** A tick through the vibration API, else the switch; best effort, never throws. */
export function createHaptic(means: HapticMeans): () => void {
  return () => {
    try {
      if (means.vibrate) means.vibrate(HAPTIC_TICK_MS);
      else means.tapSwitch?.();
    } catch {
      // Best effort: a missing tick must never break or delay the action.
    }
  };
}
