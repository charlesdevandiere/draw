import { expect, test, type Page } from '@playwright/test';
import { isBlank, pagePoint, pixelAt } from './helpers/canvas';
import { savedStrokeCounts, seedDatabase, trashedIds } from './helpers/storage';
import { colorRadio } from './helpers/tools';

/**
 * Trash (spec/SPEC-trash.md): trashed drawings stay 30 days, out of the gallery, then are
 * purged at startup. The viewer moves a drawing there with a long press
 * (spec/SPEC-gallery-viewer.md); other tests seed the database directly.
 */
test.use({ locale: 'en-US' });

const DAY = 24 * 60 * 60 * 1000;

test('at startup, the trash is purged after 30 days and stays out of the gallery', async ({
  page,
}) => {
  const now = Date.now();
  await seedDatabase(page, [
    { id: 'kept', updatedAt: now - 3 * DAY, lineAt: 200 },
    { id: 'recent', updatedAt: now - 2 * DAY, lineAt: 500, trashedAt: now - DAY },
    { id: 'old', updatedAt: now - 40 * DAY, lineAt: 800, trashedAt: now - 31 * DAY },
  ]);
  await page.goto('en/');
  await expect
    .poll(async () => Object.keys(await savedStrokeCounts(page)).sort())
    .toEqual(['kept', 'recent']);

  await page.getByRole('button', { name: 'My drawings' }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(1);
});

test('the settings page counts only drawings outside the trash, and purges too', async ({
  page,
}) => {
  const now = Date.now();
  await seedDatabase(page, [
    { id: 'kept', updatedAt: now - 3 * DAY, lineAt: 200 },
    { id: 'recent', updatedAt: now - 2 * DAY, lineAt: 500, trashedAt: now - DAY },
    { id: 'old', updatedAt: now - 40 * DAY, lineAt: 800, trashedAt: now - 31 * DAY },
  ]);
  await page.goto('en/settings.html');
  // Only the drawing outside the trash counts in the backup.
  await expect(page.locator('#backup-summary')).toHaveText(/^1 drawing, /);
  await expect
    .poll(async () => Object.keys(await savedStrokeCounts(page)).sort())
    .toEqual(['kept', 'recent']);
});

test('a last drawing in the trash is not reopened: the app starts on a blank page', async ({
  page,
}) => {
  const now = Date.now();
  await seedDatabase(
    page,
    [{ id: 'thrown', updatedAt: now - DAY, lineAt: 500, trashedAt: now - 1000 }],
    // The stored tools come back first: a sign that the startup restore ran.
    { lastDrawingId: 'thrown', tools: { tool: 'pen', color: 'red', width: 'thin' } },
  );
  await page.goto('en/');
  await expect(colorRadio(page, 'Red')).toBeChecked();
  // The drawing is read right after the settings: leave it time to (wrongly) show up.
  await page.waitForTimeout(500);
  await expect(page.locator('#undo')).toBeDisabled();
  expect(
    isBlank(await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5))),
  ).toBe(true);
});

test('the same last drawing outside the trash is reopened (control)', async ({ page }) => {
  const now = Date.now();
  await seedDatabase(page, [{ id: 'kept', updatedAt: now - DAY, lineAt: 500 }], {
    lastDrawingId: 'kept',
  });
  await page.goto('en/');
  await expect(page.locator('#undo')).toBeEnabled();
  await expect
    .poll(async () =>
      isBlank(await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5))),
    )
    .toBe(false);
});

async function press(page: Page, selector: string) {
  await page.locator(selector).dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    buttons: 1,
  });
}

async function release(page: Page, selector: string) {
  await page.locator(selector).dispatchEvent('pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    buttons: 0,
  });
}

async function openInViewer(page: Page, index: number) {
  await page.getByRole('button', { name: 'My drawings' }).click();
  await page
    .locator('.gallery-card')
    .nth(index)
    .getByRole('button', { name: /Open the drawing/ })
    .click();
  await expect(page.locator('#viewer-screen')).toBeVisible();
}

test('the viewer moves a drawing to the trash after a 1.5 s press, not before', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: number) => {
        const calls = JSON.parse(sessionStorage.getItem('haptics') ?? '[]') as unknown[];
        sessionStorage.setItem('haptics', JSON.stringify([...calls, pattern]));
        return true;
      },
    });
  });
  const now = Date.now();
  await seedDatabase(page, [
    { id: 'older', updatedAt: now - 2 * DAY, lineAt: 200 },
    { id: 'newer', updatedAt: now - DAY, lineAt: 500 },
  ]);
  await page.goto('en/');
  await openInViewer(page, 0);

  // A tap and a short press do nothing.
  const trash = page.getByRole('button', { name: /Move to the trash/ });
  await expect(trash).toHaveClass(/\blong-press\b/);
  await trash.click();
  await press(page, '#viewer-trash');
  await page.waitForTimeout(700);
  await release(page, '#viewer-trash');
  await page.waitForTimeout(1200);
  await expect(page.locator('#viewer-screen')).toBeVisible();
  expect(await trashedIds(page)).toEqual([]);

  // Held: it fills with light red, then the drawing goes to the trash and the wall shows.
  await press(page, '#viewer-trash');
  await expect
    .poll(() => trash.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain('rgb(239, 154, 154)');
  await expect(page.locator('#gallery-screen')).toBeVisible({ timeout: 4000 });
  expect(await trashedIds(page)).toEqual(['newer']);
  await expect(page.locator('.gallery-card')).toHaveCount(1);
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem('haptics') ?? '[]') as unknown[]),
  ).toEqual([8]);
});

test('trashing the drawing on the slate leaves a blank slate, also after a reload', async ({
  page,
}) => {
  await page.goto('en/');
  const box = await page.locator('#page').boundingBox();
  if (!box) throw new Error('Page not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await openInViewer(page, 0);
  await press(page, '#viewer-trash');
  await expect(page.locator('#gallery-screen')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('.gallery-card')).toHaveCount(0);
  expect(await trashedIds(page)).toHaveLength(1);

  await page.getByRole('button', { name: 'Back to drawing' }).click();
  const center = await pagePoint(page, 0.5, 0.5);
  expect(isBlank(await pixelAt(page.locator('#drawing-layer'), center))).toBe(true);
  await page.reload();
  await expect(page.locator('#draw-screen')).toBeVisible();
  // Leave the startup restore time to (wrongly) bring it back.
  await page.waitForTimeout(500);
  expect(isBlank(await pixelAt(page.locator('#drawing-layer'), center))).toBe(true);
  expect(await trashedIds(page)).toHaveLength(1);
});

test('the settings list the trash newest first; restore brings a drawing back', async ({
  page,
}) => {
  const now = Date.now();
  await seedDatabase(page, [
    { id: 'kept', updatedAt: now - 30 * DAY, lineAt: 200 },
    { id: 'six', updatedAt: now - 10 * DAY, lineAt: 400, trashedAt: now - 6 * DAY - 60_000 },
    { id: 'one', updatedAt: now - 3 * DAY, lineAt: 500, trashedAt: now - DAY - 60_000 },
    { id: 'old', updatedAt: now - 40 * DAY, lineAt: 800, trashedAt: now - 24 * DAY - 60_000 },
  ]);
  await page.goto('en/settings.html');
  await expect(page.locator('#trash-summary')).toHaveText(
    '3 drawings: they are deleted for good 30 days after being thrown away.',
  );
  await expect(page.locator('.trash-when')).toHaveText([
    'Deleted yesterday',
    'Deleted 6 days ago',
    'Deleted 24 days ago',
  ]);
  await expect(page.locator('.trash-thumbnail img')).toHaveCount(3);
  await expect(page.locator('#backup-summary')).toHaveText(/^1 drawing, /);

  await page.getByRole('button', { name: 'Restore the drawing deleted 6 days ago' }).click();
  await expect(page.locator('.trash-when')).toHaveText([
    'Deleted yesterday',
    'Deleted 24 days ago',
  ]);
  await expect(page.locator('#backup-summary')).toHaveText(/^2 drawings, /);
  expect(await trashedIds(page)).toEqual(['old', 'one']);

  await page.getByRole('link', { name: 'Back to my drawings' }).click();
  await expect(page.locator('#gallery-screen')).toBeVisible();
  await expect(page.locator('.gallery-card')).toHaveCount(2, { timeout: 15_000 });
});

test('emptying the trash takes a 1.5 s press, then the button goes', async ({ page }) => {
  const now = Date.now();
  await seedDatabase(page, [
    { id: 'kept', updatedAt: now - 3 * DAY, lineAt: 200 },
    { id: 'thrown', updatedAt: now - 2 * DAY, lineAt: 500, trashedAt: now - DAY },
  ]);
  await page.goto('en/settings.html');
  const empty = page.getByRole('button', { name: /Empty the trash/ });
  await expect(empty).toBeVisible();

  // A tap and a short press do nothing.
  await empty.click();
  await press(page, '#empty-trash');
  await page.waitForTimeout(700);
  await release(page, '#empty-trash');
  await page.waitForTimeout(1200);
  expect(await trashedIds(page)).toEqual(['thrown']);

  // Held: it fills, then the trash is emptied for good.
  await press(page, '#empty-trash');
  await expect(empty).toHaveAttribute('data-holding', '');
  await expect(page.locator('#trash-summary')).toHaveText('The trash is empty.', {
    timeout: 4000,
  });
  await expect(empty).toBeHidden();
  expect(await trashedIds(page)).toEqual([]);
  expect(Object.keys(await savedStrokeCounts(page))).toEqual(['kept']);
});
