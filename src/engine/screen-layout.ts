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
 * brings the layout back to its design angle (phone 0°, tablet 90°). The direction of the
 * turn is an assumption until checked on the reference devices (decision gate,
 * tasks/ui-foundation/todo.md); if it is wrong, only the sign here changes.
 */
export function layoutRotation(width: number, height: number, screenAngle: number): QuarterTurn {
  if (width === height) return 0;
  const tablet = deviceClass(width, height) === 'tablet';
  const landscape = width > height;
  if (landscape === tablet) return 0;
  const designAngle = tablet ? 90 : 0;
  // The turn must be ±90°. An angle that does not match the viewport's orientation (a
  // device whose natural orientation is landscape, a missing or non-finite angle) would
  // give 0° or 180°: fall back to the angle of a portrait-natural device.
  const reported = Number.isFinite(screenAngle) ? quarterTurn(screenAngle) : -1;
  const consistent = landscape
    ? reported === 90 || reported === 270
    : reported === 0 || reported === 180;
  const angle = consistent ? reported : landscape ? 90 : 0;
  return quarterTurn(designAngle - angle);
}
