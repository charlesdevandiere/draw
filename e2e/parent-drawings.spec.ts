import { expect, test, type Page } from '@playwright/test';
import { pagePoint } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { savedStrokeCounts } from './helpers/storage';

test.use({ locale: 'en-US' });

async function makeDrawings(page: Page, count: number) {
  await page.goto('en/');
  for (let i = 0; i < count; i += 1) {
    const y = 0.2 + i * 0.2;
    await drawStrokes(page, [
      {
        points: line(await pagePoint(page, 0.1, y), await pagePoint(page, 0.9, y)),
        pointerType: 'pen',
      },
    ]);
    await page.getByRole('button', { name: 'New page' }).click();
  }
  // Saves include a thumbnail: allow time when the machine is busy (parallel tests).
  await expect
    .poll(async () => Object.keys(await savedStrokeCounts(page)).length, { timeout: 15_000 })
    .toBe(count);
}

test('the parent page lists the drawings and deletes the selected ones after confirmation', async ({
  page,
}) => {
  await makeDrawings(page, 3);
  await page.goto('en/parent.html');
  const items = page.locator('#drawings-list li');
  await expect(items).toHaveCount(3);
  await expect(page.locator('#drawings-count')).toHaveText('No drawing selected');
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();

  await items.nth(0).locator('input').check();
  await items.nth(1).locator('input').check();
  await expect(page.locator('#drawings-count')).toHaveText('2 drawings selected');

  // Cancel keeps everything.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('#delete-dialog')).toBeVisible();
  await expect(page.locator('#delete-dialog-text')).toHaveText(
    'These 2 drawings will be deleted for good.',
  );
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#delete-dialog')).toBeHidden();
  await expect(items).toHaveCount(3);

  // Confirm deletes them.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.locator('#delete-confirm').click();
  await expect(items).toHaveCount(1);
  await expect.poll(async () => Object.keys(await savedStrokeCounts(page)).length).toBe(1);

  await page.getByRole('link', { name: 'Back to the sketchbook' }).click();
  await page.getByRole('button', { name: 'My drawings' }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(1);
});

test('select all, then none', async ({ page }) => {
  await makeDrawings(page, 2);
  await page.goto('en/parent.html');
  await page.getByRole('button', { name: 'Select all' }).click();
  await expect(page.locator('#drawings-count')).toHaveText('2 drawings selected');
  await page.getByRole('button', { name: 'Select none' }).click();
  await expect(page.locator('#drawings-count')).toHaveText('No drawing selected');
});
