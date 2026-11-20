/**
 * Always-on gesture protections for the child app (list and measurements in
 * docs/diagnostic/conclusions.md). CSS does most of the work (app.scss); these listeners
 * cancel what CSS cannot: context menu, selection, double-tap zoom, pinch, and the
 * magnifier / callout started by touches on the drawing surface.
 */

const DOCUMENT_EVENTS = ['contextmenu', 'selectstart', 'dblclick', 'gesturestart'] as const;
const SURFACE_EVENTS = ['touchstart', 'touchmove'] as const;

function cancel(event: Event): void {
  // Leave form fields usable (the adult screens will have some): selecting their text.
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return;
  }
  event.preventDefault();
}

export function protectGestures(surface: HTMLElement): void {
  for (const type of DOCUMENT_EVENTS) document.addEventListener(type, cancel, { passive: false });
  for (const type of SURFACE_EVENTS) surface.addEventListener(type, cancel, { passive: false });
}
