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

test('undo and redo 10 times in a row', async ({ page }) => {
  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  const rows = Array.from({ length: 10 }, (_, i) => 0.05 + i * 0.09);
  for (const y of rows) await strokeAt(page, y);
  for (const y of rows) expect(await blankAt(page, y)).toBe(false);

  for (let i = 0; i < 10; i += 1) await undo.click();
  await expect(undo).toBeDisabled();
  for (const y of rows) expect(await blankAt(page, y)).toBe(true);

  for (let i = 0; i < 10; i += 1) await redo.click();
  await expect(redo).toBeDisabled();
  for (const y of rows) expect(await blankAt(page, y)).toBe(false);
});

test('undo takes back an eraser stroke too', async ({ page }) => {
  await strokeAt(page, 0.5);
  await page.getByRole('button', { name: 'Eraser' }).click();
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.5, 0.3), await pagePoint(page, 0.5, 0.7)),
      pointerType: 'pen',
    },
  ]);
  expect(await blankAt(page, 0.5)).toBe(true);
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await blankAt(page, 0.5)).toBe(false);
});

test('a new stroke clears redo', async ({ page }) => {
  await strokeAt(page, 0.3);
  await page.getByRole('button', { name: 'Undo' }).click();
  await strokeAt(page, 0.6);
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('new page starts a blank page', async ({ page }) => {
  const newPage = page.getByRole('button', { name: 'New page' });
  await expect(newPage).toBeDisabled();
  await strokeAt(page, 0.5);
  await newPage.click();
  expect(await blankAt(page, 0.5)).toBe(true);
  await expect(newPage).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});
