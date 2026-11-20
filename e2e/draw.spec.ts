import { expect, test } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';

const INK = [0x21, 0x21, 0x21];

test.use({ locale: 'en-US' });

test.beforeEach(async ({ page }) => {
  await page.goto('en/');
});

test('a pen stroke draws along its path', async ({ page }) => {
  const canvas = page.locator('#drawing-layer');
  const from = await pagePoint(page, 0.2, 0.3);
  const to = await pagePoint(page, 0.8, 0.3);
  await drawStrokes(page, [{ points: line(from, to), pointerType: 'pen' }]);

  expect(isColor(await pixelAt(canvas, await pagePoint(page, 0.5, 0.3)), INK)).toBe(true);
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.6)))).toBe(true);
});

test('a tap without movement draws a dot', async ({ page }) => {
  const canvas = page.locator('#drawing-layer');
  const point = await pagePoint(page, 0.4, 0.7);
  await drawStrokes(page, [{ points: [point], pointerType: 'touch' }]);
  expect(isColor(await pixelAt(canvas, point), INK)).toBe(true);
});

test('a hovering pen does not draw', async ({ page }) => {
  const canvas = page.locator('#drawing-layer');
  const points = line(await pagePoint(page, 0.2, 0.5), await pagePoint(page, 0.8, 0.5));
  // Pen down at the start (a dot), then moves with no button pressed: only the dot shows.
  await page.evaluate((path) => {
    const target = document.getElementById('drawing-layer');
    const send = (type: string, [x, y]: readonly [number, number], buttons: number) =>
      target?.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: y,
          pointerType: 'pen',
          pointerId: 5,
          buttons,
        }),
      );
    const [first] = path;
    if (!first) return;
    send('pointerdown', first, 1);
    for (const point of path.slice(1)) send('pointermove', point, 0);
    send('pointerup', first, 0);
  }, points);
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.5)))).toBe(true);
});

test('the drawing survives a rotation of the screen', async ({ page }) => {
  const canvas = page.locator('#drawing-layer');
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, 0.5), await pagePoint(page, 0.9, 0.5)),
      pointerType: 'pen',
    },
  ]);
  const size = page.viewportSize();
  if (!size) throw new Error('No viewport');
  await page.setViewportSize({ width: size.height, height: size.width });
  await expect
    .poll(async () => isColor(await pixelAt(canvas, await pagePoint(page, 0.5, 0.5)), INK))
    .toBe(true);
  await page.screenshot({ path: test.info().outputPath('rotated.png') });
});
