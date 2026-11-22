import type { QuarterTurn } from './screen-layout';
import { PAGE_SIZE } from './types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the square page sits on screen: CSS pixel = offset + page unit × scale, the page
 * possibly turned by `rotation` (clockwise quarter turns, when the screens are turned back
 * to keep the layout fixed to the device: spec/SPEC-ui-foundation.md). Built from the
 * area the page may use; the page is as large as possible and centered. A turned square
 * keeps the same axis-aligned box, so the area is the page's bounding rectangle either way.
 */
export interface PageTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  /** Side of the page in CSS pixels. */
  readonly size: number;
  readonly rotation: QuarterTurn;
}

export function fitPage(area: Rect, rotation: QuarterTurn = 0): PageTransform {
  const size = Math.max(0, Math.min(area.width, area.height));
  return {
    scale: size / PAGE_SIZE,
    offsetX: area.x + (area.width - size) / 2,
    offsetY: area.y + (area.height - size) / 2,
    size,
    rotation,
  };
}

/** Screen (CSS pixels, e.g. clientX / clientY) → page units. */
export function toPage(transform: PageTransform, x: number, y: number): [number, number] {
  const { scale, size, rotation } = transform;
  if (scale === 0) return [0, 0];
  // Position in the page's box, then undo the clockwise turn.
  const dx = x - transform.offsetX;
  const dy = y - transform.offsetY;
  const [u, v] =
    rotation === 90
      ? [dy, size - dx]
      : rotation === 180
        ? [size - dx, size - dy]
        : rotation === 270
          ? [size - dy, dx]
          : [dx, dy];
  return [u / scale, v / scale];
}

/** Page units → screen (CSS pixels). */
export function toScreen(transform: PageTransform, x: number, y: number): [number, number] {
  const { scale, size, rotation } = transform;
  const u = x * scale;
  const v = y * scale;
  const [dx, dy] =
    rotation === 90
      ? [size - v, u]
      : rotation === 180
        ? [size - u, size - v]
        : rotation === 270
          ? [v, size - u]
          : [u, v];
  return [transform.offsetX + dx, transform.offsetY + dy];
}

/**
 * Backing-store size of a canvas showing the page: device pixels, so strokes stay sharp
 * on high-density screens.
 */
export function backingSize(cssSize: number, devicePixelRatio: number): number {
  return Math.max(1, Math.round(cssSize * (devicePixelRatio > 0 ? devicePixelRatio : 1)));
}

/** Scale from page units to canvas backing pixels. */
export function pageToBacking(backingPixels: number): number {
  return backingPixels / PAGE_SIZE;
}

/**
 * Where a stroke starts for a contact at (x, y) CSS pixels: on the page, or within
 * `margin` CSS pixels around it (a child's finger aiming at the edge often lands just
 * outside), pulled onto the edge. Null when the contact is farther away.
 *
 * DF-06: docs/device-fixes.md
 */
export function strokeStart(
  transform: PageTransform,
  x: number,
  y: number,
  margin: number,
): [number, number] | null {
  if (transform.scale === 0) return null;
  const [pageX, pageY] = toPage(transform, x, y);
  const slack = margin / transform.scale;
  const outside = (value: number) => value < -slack || value > PAGE_SIZE + slack;
  if (outside(pageX) || outside(pageY)) return null;
  const clamp = (value: number) => Math.min(PAGE_SIZE, Math.max(0, value));
  return [clamp(pageX), clamp(pageY)];
}
