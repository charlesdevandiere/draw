import { expect, test, type Page } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';

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

test('the tool bar shows 8 colors, 2 widths and the eraser, all large enough', async ({ page }) => {
  const tools = page.locator('#tools-primary button');
  await expect(tools).toHaveCount(11);
  for (const tool of await tools.all()) {
    const box = await tool.boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(48);
  }
  await expect(page.getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: test.info().outputPath('tools.png') });
});

test('a picked color draws in that color', async ({ page }) => {
  await page.getByRole('button', { name: 'Red' }).click();
  await expect(page.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
  await stroke(page, 0.5);
  const pixel = await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5));
  expect(isColor(pixel, RED)).toBe(true);
});

test('the thick width draws a wider line than the thin one', async ({ page }) => {
  await stroke(page, 0.3);
  await page.getByRole('button', { name: 'Thick line' }).click();
  await stroke(page, 0.7);
  const canvas = page.locator('#drawing-layer');
  // 0.8 % of the page above each line (thin radius 0.4 %, thick 1.2 %): only the thick one reaches it.
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.3 - 0.008)))).toBe(true);
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.7 - 0.008)))).toBe(false);
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
