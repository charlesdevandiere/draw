import { expect, test, type Page } from '@playwright/test';
import { isBlank, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';

test.use({ locale: 'en-US' });

async function strokeAt(page: Page, y: number) {
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, y), await pagePoint(page, 0.9, y)),
      pointerType: 'pen',
    },
  ]);
}

async function blankAt(page: Page, y: number) {
  return isBlank(await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, y)));
}

test.beforeEach(async ({ page }) => {
  await page.goto('en/');
});

test('the gallery lists every drawing, newest first, and reopens one to continue it', async ({
  page,
}) => {
  // Three drawings: lines at 0.2, then 0.5, then 0.8.
  for (const y of [0.2, 0.5, 0.8]) {
    await strokeAt(page, y);
    if (y !== 0.8) await page.getByRole('button', { name: 'New page' }).click();
  }
  await page.getByRole('button', { name: 'My drawings' }).click();
  const cards = page.locator('.gallery-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('img')).toHaveCount(3);
  await page.screenshot({ path: test.info().outputPath('gallery.png') });

  // The oldest one is last: reopen it, it shows its own line only.
  await cards
    .last()
    .getByRole('button', { name: /Open the drawing/ })
    .click();
  await expect(page.locator('#draw-screen')).toBeVisible();
  await expect.poll(() => blankAt(page, 0.2)).toBe(false);
  expect(await blankAt(page, 0.5)).toBe(true);

  // Continue it, and its history is there.
  await strokeAt(page, 0.6);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await blankAt(page, 0.2)).toBe(true);
});

test('an empty page never appears in the gallery', async ({ page }) => {
  await page.getByRole('button', { name: 'My drawings' }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to drawing' }).click();
  await strokeAt(page, 0.5);
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'My drawings' }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(0);
});

test('a new page from the gallery opens a blank slate', async ({ page }) => {
  await strokeAt(page, 0.5);
  await page.getByRole('button', { name: 'My drawings' }).click();
  await page.locator('#gallery-new-page').click();
  await expect(page.locator('#draw-screen')).toBeVisible();
  expect(await blankAt(page, 0.5)).toBe(true);
});
