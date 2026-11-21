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

test('a contact just outside the page starts a stroke on its edge', async ({ page }) => {
  const canvas = page.locator('#drawing-layer');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No page');
  const y = box.y + box.height * 0.4;
  // 6 px left of the page (within the margin), into the page.
  await drawStrokes(page, [
    { points: line([box.x - 6, y], [box.x + box.width * 0.3, y]), pointerType: 'touch' },
  ]);
  expect(isColor(await pixelAt(canvas, [box.x + 2, y]), INK)).toBe(true);
  expect(isColor(await pixelAt(canvas, [box.x + box.width * 0.2, y]), INK)).toBe(true);

  // 40 px above the page (beyond the margin): nothing.
  const y2 = box.y + box.height * 0.7;
  await drawStrokes(page, [
    {
      points: line([box.x + box.width * 0.5, box.y - 40], [box.x + box.width * 0.5, y2]),
      pointerType: 'touch',
    },
  ]);
  expect(isBlank(await pixelAt(canvas, [box.x + box.width * 0.5, y2 - 10]))).toBe(true);
});

test('a tap on a tool bar next to the page never draws', async ({ page }) => {
  const canvas = page.locator('#drawing-layer');
  const tools = await page.locator('#tools-primary').boundingBox();
  const box = await canvas.boundingBox();
  if (!tools || !box) throw new Error('Layout missing');
  // The gap between the bar's edge and its first button, right next to the page.
  const below = tools.y > box.y + box.height - 1;
  const nearest = below
    ? [box.x + box.width / 2, tools.y + 1]
    : [tools.x + tools.width - 1, box.y + box.height / 2];
  // Only meaningful when the bar lies within the edge margin (24 px) of the page.
  const distance = below ? tools.y + 1 - (box.y + box.height) : box.x - (tools.x + tools.width - 1);
  test.skip(distance > 24, 'The tool bar is beyond the edge margin in this layout');
  await drawStrokes(page, [{ points: [nearest as [number, number]], pointerType: 'touch' }]);
  expect(await page.locator('#undo').isDisabled()).toBe(true);
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
