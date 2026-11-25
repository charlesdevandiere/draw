import { expect, test } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { storedSetting } from './helpers/storage';

const INK = [0x21, 0x21, 0x21];

test.use({ locale: 'en-US' });

test('turning the palm filter off lets a wide contact draw in Finger mode', async ({ page }) => {
  await page.goto('en/settings.html');
  const filter = page.getByLabel('Ignore contacts as wide as a palm');
  await expect(filter).toBeChecked();
  await expect(page.getByLabel('Widest contact that still draws (px)')).toHaveValue('80');
  await filter.uncheck();
  await expect(page.getByLabel('Widest contact that still draws (px)')).toBeDisabled();
  // The save is not awaited by the page: wait for it before leaving.
  await expect.poll(() => storedSetting(page, 'fingerSettings')).toEqual({ widthThreshold: null });

  await page.goto('en/');
  // Wait for the stored settings to be applied at startup.
  await page.waitForTimeout(300);
  const points = line(await pagePoint(page, 0.1, 0.5), await pagePoint(page, 0.9, 0.5));
  await drawStrokes(page, [{ points, pointerType: 'touch', width: 200 }]);
  const pixel = await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5));
  expect(isColor(pixel, INK)).toBe(true);
});

test('settings are kept within bounds and can be reset', async ({ page }) => {
  await page.goto('en/settings.html');
  const threshold = page.getByLabel('Widest contact that still draws (px)');
  await threshold.fill('9999');
  await threshold.blur();
  await expect(threshold).toHaveValue('400');
  await expect.poll(() => storedSetting(page, 'fingerSettings')).toEqual({ widthThreshold: 400 });
  await page.reload();
  await expect(threshold).toHaveValue('400');
  await page.getByRole('button', { name: 'Restore the defaults' }).click();
  await expect(threshold).toHaveValue('80');
});

test('the default filter still ignores a palm in the app', async ({ page }) => {
  await page.goto('en/');
  const points = line(await pagePoint(page, 0.1, 0.5), await pagePoint(page, 0.9, 0.5));
  await drawStrokes(page, [{ points, pointerType: 'touch', width: 200 }]);
  const pixel = await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5));
  expect(isBlank(pixel)).toBe(true);
});
