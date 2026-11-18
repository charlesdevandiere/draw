/**
 * DOM side of F5: switches the anti-gesture protections on and off, and reports
 * the system-gesture incidents the browser lets through. Counting lives in incidents.ts.
 */

const PROTECTED_CLASS = 'gesture-protected';
const VIEWPORT_NO_ZOOM = 'maximum-scale=1, user-scalable=no';
const RELOAD_FLAG_KEY = 'diagnostic:loaded';
/** Protection state last applied in this tab, so a reload is counted under it. */
const STATE_KEY = 'diagnostic:protections';
/** Reloads counted so far in this tab, per protection state (`on` / `off`). */
const RELOADS_KEY = 'diagnostic:reloads';
/** Set just before a reload the page triggers itself (service-worker update). */
const INTENTIONAL_RELOAD_KEY = 'diagnostic:intentional-reload';
const ZOOM_EPSILON = 0.01;

export interface GestureProtections {
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

/** sessionStorage access that degrades to a no-op when storage is unavailable (private mode). */
function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable: reloads are simply not counted.
  }
}

/** Call before a reload the page triggers on purpose so it is not counted as an incident. */
export function markIntentionalReload(): void {
  writeSession(INTENTIONAL_RELOAD_KEY, '1');
}

function preventDefault(event: Event): void {
  // Leave the panel's form fields usable (editing G/S, selecting their text).
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
    return;
  }
  event.preventDefault();
}

/** Document-level events whose default action the protections cancel. */
const DOCUMENT_EVENTS = ['contextmenu', 'selectstart', 'dblclick', 'gesturestart'] as const;
/** Surface-level touch events cancelled (non-passive) to stop callouts and magnifier. */
const SURFACE_EVENTS = ['touchstart', 'touchmove'] as const;

export function createGestureProtections(surface: HTMLElement): GestureProtections {
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const viewportDefault = viewport?.getAttribute('content') ?? '';
  const viewportProtected = viewportDefault
    ? `${viewportDefault}, ${VIEWPORT_NO_ZOOM}`
    : VIEWPORT_NO_ZOOM;
  let enabled = false;

  function setEnabled(next: boolean): void {
    writeSession(STATE_KEY, next ? 'on' : 'off');
    if (next === enabled) return;
    enabled = next;
    document.documentElement.classList.toggle(PROTECTED_CLASS, enabled);
    viewport?.setAttribute('content', enabled ? viewportProtected : viewportDefault);
    for (const type of DOCUMENT_EVENTS) {
      if (enabled) document.addEventListener(type, preventDefault, { passive: false });
      else document.removeEventListener(type, preventDefault);
    }
    for (const type of SURFACE_EVENTS) {
      if (enabled) surface.addEventListener(type, preventDefault, { passive: false });
      else surface.removeEventListener(type, preventDefault);
    }
  }

  return { setEnabled, isEnabled: () => enabled };
}

/**
 * Reports incidents: system gestures that reached the page or took over a contact.
 * Listeners are passive observers and never cancel anything themselves.
 * `protectionsOn` is only given when the incident happened under a known state
 * other than the current one (a reload, counted under the previous page's state).
 * Call before the protections are first applied, so the previous state is still stored.
 */
export function watchIncidents(onIncident: (kind: string, protectionsOn?: boolean) => void): void {
  window.addEventListener('pointercancel', (event) => {
    onIncident(`pointercancel:${event.pointerType || 'inconnu'}`);
  });
  window.addEventListener('touchcancel', () => onIncident('touchcancel'), { passive: true });
  // Capture phase so the event is seen even when the protections cancel it.
  // Observed in the capture phase, before any protection cancels them; the verdict is read
  // once dispatch is over, so the report tells blocked gestures from those that got through.
  for (const type of ['contextmenu', 'dblclick', 'gesturestart'] as const) {
    document.addEventListener(
      type,
      (event) => {
        setTimeout(() => onIncident(event.defaultPrevented ? `${type}:bloqué` : type), 0);
      },
      { capture: true },
    );
  }
  // selectionchange fires on every extension of a selection: count each selection once.
  let selecting = false;
  document.addEventListener('selectionchange', () => {
    const selection = document.getSelection();
    const nowSelecting =
      selection !== null && !selection.isCollapsed && selection.toString().length > 0;
    if (nowSelecting && !selecting) onIncident('selection');
    selecting = nowSelecting;
  });

  let zoomed = false;
  window.visualViewport?.addEventListener('resize', () => {
    const scale = window.visualViewport?.scale ?? 1;
    const nowZoomed = Math.abs(scale - 1) > ZOOM_EPSILON;
    if (nowZoomed && !zoomed) onIncident('zoom');
    zoomed = nowZoomed;
  });

  let scrolled = false;
  window.addEventListener(
    'scroll',
    () => {
      const nowScrolled = window.scrollX !== 0 || window.scrollY !== 0;
      if (nowScrolled && !scrolled) onIncident('scroll');
      scrolled = nowScrolled;
    },
    { passive: true },
  );

  // A flag already set in this tab's session means the page was reloaded (pull-to-refresh,
  // accidental reload). The in-memory counters restart at each load, so the reload count
  // is kept in sessionStorage and replayed, each one under the state it happened in.
  const reloads: Record<'on' | 'off', number> = { on: 0, off: 0 };
  try {
    Object.assign(reloads, JSON.parse(readSession(RELOADS_KEY) ?? '{}'));
  } catch {
    // Corrupted value: start over.
  }
  const reloaded = readSession(RELOAD_FLAG_KEY) !== null;
  const intentional = readSession(INTENTIONAL_RELOAD_KEY) !== null;
  if (reloaded && !intentional) {
    reloads[readSession(STATE_KEY) === 'off' ? 'off' : 'on'] += 1;
    writeSession(RELOADS_KEY, JSON.stringify(reloads));
  }
  writeSession(INTENTIONAL_RELOAD_KEY, null);
  writeSession(RELOAD_FLAG_KEY, '1');
  for (const state of ['on', 'off'] as const) {
    for (let i = 0; i < reloads[state]; i += 1) onIncident('reload', state === 'on');
  }
}
