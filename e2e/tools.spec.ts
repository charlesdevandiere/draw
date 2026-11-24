import { expect, test, type Page } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { colorRadio, pickColor, setSize } from './helpers/tools';

const RED = [0xe5, 0x39, 0x35];

test.use({ locale: 'en-US' });

async function stroke(page: Page, y: number) {
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, y), await pagePoint(page, 0.9, y)),
      pointerType: 'pen',
    },
  ]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('en/');
});

test('the tools: black and size 8 at first, the slider and the eraser', async ({ page }) => {
  await expect(colorRadio(page, 'Black')).toBeChecked();
  await expect(page.getByRole('slider', { name: 'Stroke size' })).toHaveValue('1');
  await expect(page.getByRole('button', { name: 'Eraser' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('tools.png') });
});

test('a picked color draws in that color', async ({ page }) => {
  await pickColor(page, 'Red');
  await expect(colorRadio(page, 'Red')).toBeChecked();
  await stroke(page, 0.5);
  const pixel = await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5));
  expect(isColor(pixel, RED)).toBe(true);
});

test('each size step draws a wider line and grows the preview at the page scale', async ({
  page,
}) => {
  const canvas = page.locator('#drawing-layer');
  const page1000 = (await page.locator('#page').boundingBox())?.width ?? 0;
  const sizes = [4, 8, 16, 24, 40, 64];
  for (const [step, units] of sizes.entries()) {
    await setSize(page, step);
    await expect
      .poll(
        async () =>
          await page
            .locator('.size-preview')
            .evaluate((element) => Number.parseFloat(getComputedStyle(element, '::before').width)),
      )
      .toBeCloseTo(Math.max(2, (units * page1000) / 1000), 0);
  }
  // The largest step reaches 2.5 % of the page above its line (radius 3.2 %), 8 units do not.
  await setSize(page, 1);
  await stroke(page, 0.3);
  await setSize(page, 5);
  await stroke(page, 0.7);
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.3 - 0.025)))).toBe(true);
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.7 - 0.025)))).toBe(false);
});

test('each slider step gives a light haptic tick', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: number[] = [];
    (window as unknown as { ticks: number[] }).ticks = calls;
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: number) => calls.push(pattern) > 0,
    });
  });
  await page.reload();
  await setSize(page, 4);
  await setSize(page, 2);
  await setSize(page, 2);
  expect(await page.evaluate(() => (window as unknown as { ticks: number[] }).ticks)).toEqual([
    8, 8,
  ]);
});

test('the eraser takes the slider size', async ({ page }) => {
  await setSize(page, 5);
  await stroke(page, 0.5);
  await page.getByRole('button', { name: 'Eraser' }).click();
  await setSize(page, 0);
  await expect(page.getByRole('button', { name: 'Eraser' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.5, 0.3), await pagePoint(page, 0.5, 0.7)),
      pointerType: 'pen',
    },
  ]);
  // A 4-unit eraser through a 64-unit line: the line's edges around it stay.
  const canvas = page.locator('#drawing-layer');
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.5)))).toBe(true);
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.51, 0.5)))).toBe(false);
});

test('tapping the color kept while erasing goes back to the pen', async ({ page }) => {
  const eraser = page.getByRole('button', { name: 'Eraser' });
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed', 'true');
  await expect(colorRadio(page, 'Black')).toBeChecked();
  await pickColor(page, 'Black');
  await expect(eraser).toHaveAttribute('aria-pressed', 'false');
});

test('the eraser clears what is under it', async ({ page }) => {
  await stroke(page, 0.5);
  await page.getByRole('button', { name: 'Eraser' }).click();
  await expect(page.getByRole('button', { name: 'Eraser' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.5, 0.3), await pagePoint(page, 0.5, 0.7)),
      pointerType: 'pen',
    },
  ]);
  const canvas = page.locator('#drawing-layer');
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.5)))).toBe(true);
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.2, 0.5)))).toBe(false);
});
