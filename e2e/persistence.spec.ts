import { expect, test, type Page } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { lastDrawingId, savedStrokeCounts, savedStrokes } from './helpers/storage';
import { barColor, pickColor } from './helpers/tools';

const RED = [0xe5, 0x39, 0x35];

test.use({ locale: 'en-US' });

async function strokeAt(page: Page, y: number) {
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, y), await pagePoint(page, 0.9, y)),
      pointerType: 'pen',
    },
  ]);
}

async function pixel(page: Page, y: number) {
  return pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, y));
}

/** Simulates the app going to the background, which flushes the autosave at once. */
async function goToBackground(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('en/');
});

test('the drawing is there after a relaunch, and the colors and mode too', async ({ page }) => {
  await pickColor(page, 'Red');
  await strokeAt(page, 0.5);
  await expect(page.locator('#mode-button')).toHaveAttribute('data-mode', 'pen');
  // The batched save happens within about a second.
  await expect.poll(() => savedStrokes(page)).toBe(1);

  await page.reload();
  await expect.poll(async () => isColor(await pixel(page, 0.5), RED)).toBe(true);
  await expect(barColor(page, 'Red')).toBeChecked();
  await expect(page.locator('#mode-button')).toHaveAttribute('data-mode', 'pen');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('going to the background saves at once', async ({ page }) => {
  await strokeAt(page, 0.3);
  await goToBackground(page);
  // Well before the one-second batch delay.
  await expect.poll(() => savedStrokes(page), { timeout: 800 }).toBe(1);
  await page.reload();
  await expect.poll(async () => isBlank(await pixel(page, 0.3))).toBe(false);
});

test('undo is saved too, and a new page reopens blank', async ({ page }) => {
  await strokeAt(page, 0.3);
  await strokeAt(page, 0.6);
  await page.getByRole('button', { name: 'Undo' }).click();
  await goToBackground(page);
  await expect.poll(() => savedStrokes(page)).toBe(1);
  await page.reload();
  await expect.poll(async () => isBlank(await pixel(page, 0.3))).toBe(false);
  expect(isBlank(await pixel(page, 0.6))).toBe(true);

  await page.getByRole('button', { name: 'New page' }).click();
  // The new (empty) page is the one to reopen: its id is remembered, though never saved.
  await expect
    .poll(async () => {
      const [lastId, counts] = await Promise.all([lastDrawingId(page), savedStrokeCounts(page)]);
      return typeof lastId === 'string' && !(lastId in counts);
    })
    .toBe(true);
  const before = await savedStrokes(page);
  await page.reload();
  await page.waitForTimeout(300);
  expect(isBlank(await pixel(page, 0.3))).toBe(true);
  expect(await savedStrokes(page)).toBe(before);
});
