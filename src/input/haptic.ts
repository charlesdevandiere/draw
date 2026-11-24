/**
 * Light haptic tick (spec/SPEC-ui-foundation.md, "Haptic feedback"): a slider step, a
 * completed long press. Pure: the vibration API is passed in (src/app/haptic.ts).
 */

/** Length of the tick, in milliseconds. */
export const HAPTIC_TICK_MS = 8;

/**
 * A tick through `navigator.vibrate` where the browser has it (Android Chrome); nothing
 * elsewhere (Safari has no vibration API). Best effort, never throws.
 *
 * DF-12: docs/device-fixes.md
 */
export function createHaptic(vibrate?: (milliseconds: number) => unknown): () => void {
  return () => {
    try {
      vibrate?.(HAPTIC_TICK_MS);
    } catch {
      // Best effort: a missing tick must never break or delay the action.
    }
  };
}
