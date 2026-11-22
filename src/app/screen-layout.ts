/**
 * DOM side of the layout fixed to the device (spec/SPEC-ui-foundation.md): turns the child
 * screens back when the device is held away from its design orientation, so every control
 * stays at the same place on the hardware. The math is pure (src/engine/screen-layout.ts);
 * the stylesheet reads `data-rotation` (container size, rotation, edge margins) and
 * `--layout-rotation` (icons turned upright).
 */
import { layoutRotation, windowFit, type QuarterTurn } from '../engine/screen-layout';

export interface ScreenLayout {
  /** Current clockwise turn of the screens. */
  rotation(): QuarterTurn;
}

/** The screen angle, from the Screen Orientation API or iOS's older `window.orientation`. */
function screenAngle(): number {
  if (typeof screen.orientation?.angle === 'number') return screen.orientation.angle;
  const legacy = (window as { orientation?: unknown }).orientation;
  return typeof legacy === 'number' ? legacy : Number.NaN;
}

export function initScreenLayout(container: HTMLElement): ScreenLayout {
  let rotation: QuarterTurn = 0;

  // Only a touch device held in the hand turns (a desktop window never does).
  const touch = window.matchMedia('(pointer: coarse)');

  function apply(): void {
    const { innerWidth: width, innerHeight: height } = window;
    // DF-11: docs/device-fixes.md (a phone tab in landscape only spans the long side).
    const fit = windowFit(width, height, screen.width, screen.height);
    rotation = touch.matches ? layoutRotation(width, height, screenAngle(), fit) : 0;
    // Applied at once, no transition: the browser already animates its own rotation.
    container.dataset.rotation = String(rotation);
    container.style.setProperty('--layout-rotation', `${rotation}deg`);
  }

  apply();
  window.addEventListener('resize', apply);
  screen.orientation?.addEventListener('change', apply);
  return { rotation: () => rotation };
}
