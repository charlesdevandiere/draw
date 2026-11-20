import { PAGE_SIZE } from './types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the square page sits on screen: CSS pixel = offset + page unit × scale.
 * Built from the area the page may use; the page is as large as possible and centered.
 */
export interface PageTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  /** Side of the page in CSS pixels. */
  readonly size: number;
}

export function fitPage(area: Rect): PageTransform {
  const size = Math.max(0, Math.min(area.width, area.height));
  return {
    scale: size / PAGE_SIZE,
    offsetX: area.x + (area.width - size) / 2,
    offsetY: area.y + (area.height - size) / 2,
    size,
  };
}

/** Screen (CSS pixels, e.g. clientX / clientY) → page units. */
export function toPage(transform: PageTransform, x: number, y: number): [number, number] {
  if (transform.scale === 0) return [0, 0];
  return [(x - transform.offsetX) / transform.scale, (y - transform.offsetY) / transform.scale];
}

/** Page units → screen (CSS pixels). */
export function toScreen(transform: PageTransform, x: number, y: number): [number, number] {
  return [transform.offsetX + x * transform.scale, transform.offsetY + y * transform.scale];
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
