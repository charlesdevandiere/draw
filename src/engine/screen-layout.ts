/**
 * Screen layout of the child screens (spec/SPEC-ui-foundation.md, "Layout fixed to the
 * device"). Pure: sizes and angles are passed in.
 *
 * - The device class never changes with the orientation: a tablet has both viewport sides
 *   at least Bootstrap's `sm` breakpoint (rotating swaps them, the test stays the same).
 * - Each class has a design orientation (phone portrait, tablet landscape). Held the other
 *   way, the browser rotates the viewport; the app turns its screens back by a quarter
 *   turn so every control stays at the same place on the hardware.
 */

/** Bootstrap `sm` breakpoint (`$grid-breakpoints`), in CSS pixels. */
export const TABLET_MIN_SIDE = 576;

/** The same test for `matchMedia` and the stylesheets. */
export const TABLET_QUERY = `(min-width: ${TABLET_MIN_SIDE}px) and (min-height: ${TABLET_MIN_SIDE}px)`;

export type DeviceClass = 'phone' | 'tablet';

/** Clockwise quarter turns, in degrees (the CSS `rotate` direction). */
export type QuarterTurn = 0 | 90 | 180 | 270;

export function deviceClass(width: number, height: number): DeviceClass {
  return width >= TABLET_MIN_SIDE && height >= TABLET_MIN_SIDE ? 'tablet' : 'phone';
}

function quarterTurn(degrees: number): QuarterTurn {
  return ((((Math.round(degrees / 90) * 90) % 360) + 360) % 360) as QuarterTurn;
}

/**
 * Rotation to apply to the child screens for a viewport of `width` × `height` CSS pixels
 * and a screen at `screenAngle` degrees (`screen.orientation.angle`). 0 in the design
 * orientation of the device class, whichever way up; otherwise the quarter turn that
 * brings the layout back to its design angle (phone 0°, tablet 90°). Direction checked on
 * the iPad 11 (decision gate, tasks/ui-foundation/todo.md).
 *
 * `fit` (see `windowFit`): DF-11, docs/device-fixes.md. A window sharing the screen is
 * never turned. An angle matching the viewport's shape is trusted as long as the window
 * spans the screen's long side: a phone browser tab in landscape loses a fifth of its
 * height to the bars. An angle that does not match needs a window filling the screen.
 */
export function layoutRotation(
  width: number,
  height: number,
  screenAngle: number,
  fit: WindowFit = 'full',
): QuarterTurn {
  if (width === height) return 0;
  const tablet = deviceClass(width, height) === 'tablet';
  const landscape = width > height;
  if (landscape === tablet) return 0;
  const designAngle = tablet ? 90 : 0;
  const reported = Number.isFinite(screenAngle) ? quarterTurn(screenAngle) : -1;
  const consistent = landscape
    ? reported === 90 || reported === 270
    : reported === 0 || reported === 180;
  // A window sharing the screen (iPad Split View or Stage Manager, Android split screen)
  // says nothing about how the device is held: no turn.
  if (fit === 'shared') return 0;
  if (consistent) return quarterTurn(designAngle - reported);
  // The angle does not match the window's shape: only a window filling the screen turns
  // (a landscape-natural device or a missing angle). The turn must still be ±90° (never
  // 0° or 180°), taken from a portrait-natural device.
  if (fit !== 'full') return 0;
  return quarterTurn(designAngle - (landscape ? 90 : 0));
}

/**
 * Share of the screen's sides a window must cover to count as "the app fills the screen"
 * (an installed app or a browser tab, minus system and browser bars).
 */
const FULL_SCREEN_SHARE = 0.85;

/**
 * How a window covers the screen: `full` (an installed app), `long-side` (it spans the
 * screen's long side only: a phone browser tab in landscape, under its bars, DF-11) or
 * `shared` (iPad Split View or Stage Manager, Android split screen, a desktop window).
 */
export type WindowFit = 'full' | 'long-side' | 'shared';

export function windowFit(
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number,
): WindowFit {
  if (fillsScreen(width, height, screenWidth, screenHeight)) return 'full';
  const long = Math.max(screenWidth, screenHeight);
  return long > 0 && Math.max(width, height) >= long * FULL_SCREEN_SHARE ? 'long-side' : 'shared';
}

/**
 * Whether a `width` × `height` window fills a `screenWidth` × `screenHeight` screen,
 * whichever way each is reported. Browser bars make a phone tab in landscape fail this
 * test (DF-11): see `windowFit`.
 */
export function fillsScreen(
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number,
): boolean {
  const long = Math.max(screenWidth, screenHeight);
  const short = Math.min(screenWidth, screenHeight);
  if (short <= 0) return false;
  return (
    Math.max(width, height) >= long * FULL_SCREEN_SHARE &&
    Math.min(width, height) >= short * FULL_SCREEN_SHARE
  );
}
