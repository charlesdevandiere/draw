/**
 * DOM side of a long-press button (spec/SPEC-ui-foundation.md, "Long press"): held for
 * `LONG_PRESS_MS` (1.5 s), the button grows and fills from the bottom (`--progress`, styled
 * by `.long-press`), then gives a haptic tick and runs its action. Releasing, cancelling or
 * leaving earlier cancels; a tap does nothing.
 */
import { createHold } from '../input/hold';

export interface LongPressOptions {
  /** The light tick played on completion, before the action (src/app/haptic.ts). */
  haptic?: () => void;
}

export function initLongPress(
  button: HTMLButtonElement,
  onComplete: () => void,
  options: LongPressOptions = {},
): void {
  button.classList.add('long-press');
  const hold = createHold();
  let frame = 0;
  /** The pointer holding the button: other contacts neither restart nor cancel it. */
  let holder: number | null = null;

  function show(progress: number): void {
    button.style.setProperty('--progress', String(progress));
    button.toggleAttribute('data-holding', progress > 0);
  }

  function release(): void {
    hold.release();
    cancelAnimationFrame(frame);
    show(0);
  }

  function tick(now: number): void {
    show(hold.progress(now));
    if (hold.complete(now)) {
      holder = null;
      release();
      options.haptic?.();
      onComplete();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function end(event: PointerEvent): void {
    if (event.pointerId !== holder) return;
    holder = null;
    release();
  }

  button.addEventListener('pointerdown', (event) => {
    // Only the main button (a touch, a pen, a left click) holds; a right click never does.
    if (holder !== null || event.button !== 0) return;
    holder = event.pointerId;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Without capture, leaving the button cancels (pointerleave below).
    }
    hold.press(performance.now());
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  });
  for (const type of [
    'pointerup',
    'pointercancel',
    'lostpointercapture',
    'pointerleave',
  ] as const) {
    button.addEventListener(type, end);
  }
  // A click alone (tap, keyboard) never runs the action.
  button.addEventListener('click', (event) => event.preventDefault());
  // No callout or menu on a long press.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}
