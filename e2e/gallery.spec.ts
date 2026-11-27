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
  // The blank "+" sheet comes first, then the drawings, each tilted under a tape.
  await expect(page.locator('.gallery-list > li').first()).toHaveClass('gallery-new');
  for (const card of await cards.all()) {
    const rotate = await card.evaluate((element) => getComputedStyle(element).rotate);
    expect(rotate).toMatch(/^-?\d+(\.\d+)?deg$/);
    expect(Math.abs(Number.parseFloat(rotate))).toBeGreaterThan(0);
    expect(Math.abs(Number.parseFloat(rotate))).toBeLessThanOrEqual(2.5);
    await expect(card.locator('.gallery-tape')).toBeVisible();
  }
  await expect(cards.locator('img')).toHaveCount(3);
  await page.screenshot({ path: test.info().outputPath('gallery.png') });

  // No play or share pebble on the cards: they live in the viewer.
  await expect(cards.getByRole('button')).toHaveCount(3);

  // The oldest one is last: open it in the viewer, continue it, it shows its own line only.
  await cards
    .last()
    .getByRole('button', { name: /Open the drawing/ })
    .click();
  await expect(page.locator('#viewer-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Continue this drawing' }).click();
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
  // An empty wall still offers the blank "+" sheet.
  await expect(page.getByRole('button', { name: 'New page' })).toBeVisible();
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

test('the wall keeps clear of the edge margins and scrolls under its header', async ({ page }) => {
  for (let i = 0; i < 12; i += 1) {
    await strokeAt(page, 0.2 + i * 0.05);
    await page.getByRole('button', { name: 'New page' }).click();
  }
  await page.getByRole('button', { name: 'My drawings' }).click();
  // Twelve drawings saved one after another: the last saves may land late under load.
  await expect(page.locator('.gallery-card')).toHaveCount(12, { timeout: 15_000 });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');
  const header = await page.locator('.gallery-header').boundingBox();
  const grid = await page.locator('#gallery-grid').boundingBox();
  if (!header || !grid) throw new Error('Gallery not visible');
  expect(header.y).toBeGreaterThanOrEqual(30);
  expect(grid.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(grid.y + grid.height).toBeLessThanOrEqual(viewport.height - 30);
  // The tiles of the first row sit inside the screen, at least two across.
  const first = await page.locator('.gallery-list > li').first().boundingBox();
  const second = await page.locator('.gallery-list > li').nth(1).boundingBox();
  if (!first || !second) throw new Error('No tiles');
  // Same row (the tilts move the boxes by a few pixels).
  expect(Math.abs(second.y - first.y)).toBeLessThan(12);
  expect(first.x).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: test.info().outputPath('wall.png') });
  // The list scrolls; the header stays.
  await page.locator('#gallery-grid').evaluate((element) => element.scrollTo(0, 10_000));
  await expect
    .poll(() => page.locator('#gallery-grid').evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect((await page.locator('.gallery-header').boundingBox())?.y).toBe(header.y);
});
