/**
 * DOM side of the parent padlock: a press held for 3 s (with a filling ring) opens the
 * parent page; releasing earlier cancels. A child tapping it gets nothing.
 */
import { createHold } from '../input/hold';

export function initPadlock(button: HTMLButtonElement, onOpen: () => void): void {
  const hold = createHold();
  let frame = 0;
  /** The pointer holding the padlock: other contacts neither restart nor cancel it. */
  let holder: number | null = null;

  function show(progress: number): void {
    button.style.setProperty('--progress', String(progress));
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
      onOpen();
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
    if (holder !== null) return;
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
  // A click alone (tap, keyboard) never opens the parent page.
  button.addEventListener('click', (event) => event.preventDefault());
  // No callout or menu on a long press.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}
