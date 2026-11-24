/**
 * DOM side of the haptic tick (src/input/haptic.ts): `navigator.vibrate` where the browser
 * has it. Safari has none: no tick on the iPad until it does.
 *
 * DF-12: docs/device-fixes.md
 */
import { createHaptic } from '../input/haptic';

export function initHaptic(): () => void {
  return createHaptic(
    typeof navigator.vibrate === 'function'
      ? (milliseconds: number) => navigator.vibrate(milliseconds)
      : undefined,
  );
}
