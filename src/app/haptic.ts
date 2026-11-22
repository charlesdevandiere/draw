/**
 * DOM side of the haptic tick (src/input/haptic.ts): the vibration API where it exists,
 * else a hidden iOS switch. Toggling an `<input type="checkbox" switch>` through its label
 * during a user gesture plays the system haptic on iOS 18+; elsewhere it does nothing.
 * Best effort (spec/SPEC-ui-foundation.md): the result on the iPad is recorded in
 * docs/device-fixes.md.
 */
import { createHaptic } from '../input/haptic';

export function initHaptic(root: HTMLElement = document.body): () => void {
  // Out of sight and of the accessibility tree; never focusable, never hit by a finger.
  const label = document.createElement('label');
  label.className = 'haptic-switch';
  label.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.append(input);
  root.append(label);

  const vibrate =
    typeof navigator.vibrate === 'function'
      ? (milliseconds: number) => navigator.vibrate(milliseconds)
      : undefined;
  // WebKit focuses the control of a clicked label: give the focus back, so the hidden
  // switch (aria-hidden) never holds it.
  const tapSwitch = (): void => {
    const previous = document.activeElement;
    label.click();
    if (previous instanceof HTMLElement && previous !== document.activeElement) {
      previous.focus({ preventScroll: true });
    }
  };
  return createHaptic({ vibrate, tapSwitch });
}
