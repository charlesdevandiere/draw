import { expect, test } from '@playwright/test';
import { isBlank, pagePoint, pixelAt } from './helpers/canvas';
import { savedStrokeCounts, seedDatabase } from './helpers/storage';

/**
 * Trash (spec/SPEC-trash.md): trashed drawings stay 30 days, out of the gallery, then are
 * purged at startup. No button yet (modules gallery-viewer and settings): the database
 * is seeded directly.
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

test('the parent page lists only drawings outside the trash, and purges too', async ({ page }) => {
  const now = Date.now();
  await seedDatabase(page, [
    { id: 'kept', updatedAt: now - 3 * DAY, lineAt: 200 },
    { id: 'recent', updatedAt: now - 2 * DAY, lineAt: 500, trashedAt: now - DAY },
    { id: 'old', updatedAt: now - 40 * DAY, lineAt: 800, trashedAt: now - 31 * DAY },
  ]);
  await page.goto('en/parent.html');
  await expect(page.locator('#drawings-list li')).toHaveCount(1);
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
  await expect(page.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
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
