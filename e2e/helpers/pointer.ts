import type { Locator, Page } from '@playwright/test';

export type Point = readonly [x: number, y: number];

export interface StrokeInput {
  /** Points in CSS pixels, relative to the viewport. */
  points: readonly Point[];
  pointerType?: 'pen' | 'touch' | 'mouse';
  pointerId?: number;
  /** Contact width in CSS pixels (touch size). */
  width?: number;
}

/**
 * Draws strokes with synthetic Pointer Events (WebKit and Chromium alike; Playwright has
 * no pen nor multi-touch input). `pointerdown` goes to the element under the first point;
 * moves and `pointerup` go to that same element, as with pointer capture on a device.
 * Several strokes are interleaved point by point, as simultaneous contacts would be.
 */
export async function drawStrokes(page: Page, strokes: readonly StrokeInput[]): Promise<void> {
  await page.evaluate((input) => {
    const captured = new Map<number, Element>();
    const fire = (
      type: string,
      stroke: (typeof input)[number],
      index: number,
      [x, y]: readonly [number, number],
    ) => {
      const target = captured.get(index) ?? document.elementFromPoint(x, y) ?? document.body;
      if (type === 'pointerdown') captured.set(index, target);
      const init: PointerEventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        pointerId: stroke.pointerId ?? index + 1,
        pointerType: stroke.pointerType ?? 'pen',
        isPrimary: index === 0,
        buttons: type === 'pointerup' ? 0 : 1,
        button: type === 'pointermove' ? -1 : 0,
        width: stroke.width ?? 1,
        height: stroke.width ?? 1,
        pressure: type === 'pointerup' ? 0 : 0.5,
      };
      // A synthetic move has no coalesced events unless given some: one per move, so
      // the coalesced drawing path is exercised like on a real device (ignored where
      // the browser does not support the init member).
      const coalescedEvents = type === 'pointermove' ? [new PointerEvent(type, init)] : [];
      target.dispatchEvent(new PointerEvent(type, { ...init, coalescedEvents }));
    };
    const longest = Math.max(...input.map((stroke) => stroke.points.length));
    input.forEach((stroke, index) => {
      const first = stroke.points[0];
      if (first) fire('pointerdown', stroke, index, first);
    });
    for (let step = 1; step < longest; step += 1) {
      input.forEach((stroke, index) => {
        const point = stroke.points[step];
        if (point) fire('pointermove', stroke, index, point);
      });
    }
    input.forEach((stroke, index) => {
      const last = stroke.points.at(-1);
      if (last) fire('pointerup', stroke, index, last);
    });
  }, strokes);
}

/** Straight line from `from` to `to` sampled every `step` CSS pixels. */
export function line(from: Point, to: Point, step = 4): Point[] {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const count = Math.max(1, Math.round(length / step));
  return Array.from({ length: count + 1 }, (_, i): Point => [
    from[0] + ((to[0] - from[0]) * i) / count,
    from[1] + ((to[1] - from[1]) * i) / count,
  ]);
}

/** RGBA of the canvas pixel under a viewport point (CSS pixels), after the next frame. */
export async function canvasPixel(canvas: Locator, [x, y]: Point): Promise<number[]> {
  return canvas.evaluate(
    async (element, [px, py]) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const target = element as HTMLCanvasElement;
      const box = target.getBoundingClientRect();
      const scaleX = target.width / box.width;
      const scaleY = target.height / box.height;
      const context = target.getContext('2d');
      if (!context) throw new Error('No 2D context');
      const data = context.getImageData(
        Math.floor((px - box.left) * scaleX),
        Math.floor((py - box.top) * scaleY),
        1,
        1,
      ).data;
      return [...data];
    },
    [x, y] as const,
  );
}
