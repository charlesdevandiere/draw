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

/**
 * The pixel the child sees at a viewport point of the page: every canvas of the page
 * (template layers and drawing) composited in document order, over the white page.
 */
export async function pagePixel(page: Page, [x, y]: Point, square = '#page'): Promise<number[]> {
  return page.evaluate(
    async ({ x, y, square }) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const host = document.querySelector(square);
      if (!host) throw new Error(`${square} missing`);
      const out = document.createElement('canvas');
      out.width = 1;
      out.height = 1;
      const context = out.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('No 2D context');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 1, 1);
      for (const canvas of host.querySelectorAll('canvas')) {
        const box = canvas.getBoundingClientRect();
        if (box.width === 0) continue;
        const scale = canvas.width / box.width;
        const sx = Math.floor((x - box.left) * scale);
        const sy = Math.floor((y - box.top) * scale);
        context.drawImage(canvas, sx, sy, 1, 1, 0, 0, 1, 1);
      }
      return [...context.getImageData(0, 0, 1, 1).data];
    },
    { x, y, square },
  );
}
