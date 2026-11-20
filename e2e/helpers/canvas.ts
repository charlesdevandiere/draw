import type { Locator, Page } from '@playwright/test';
import { canvasPixel, type Point } from './pointer';

/** True when a pixel is (nearly) opaque and close to the given RGB color. */
export function isColor(pixel: number[], rgb: readonly number[]): boolean {
  const [alpha = 0] = pixel.slice(3);
  return alpha > 200 && rgb.every((value, i) => Math.abs((pixel[i] ?? 0) - value) < 40);
}

/** True when a pixel has nothing drawn on it (transparent canvas over the white page). */
export function isBlank(pixel: number[]): boolean {
  const [alpha = 0] = pixel.slice(3);
  return alpha < 30;
}

/** Viewport point at a fraction of a page square (0..1 on both axes). */
export async function pagePoint(
  page: Page,
  fx: number,
  fy: number,
  square = '#page',
): Promise<Point> {
  const box = await page.locator(square).boundingBox();
  if (!box) throw new Error('Page not visible');
  return [box.x + box.width * fx, box.y + box.height * fy];
}

export async function pixelAt(canvas: Locator, point: Point): Promise<number[]> {
  return canvasPixel(canvas, point);
}
