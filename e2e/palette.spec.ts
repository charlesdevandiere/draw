import { expect, test, type Page } from '@playwright/test';
import { isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { barColor, barColors, isPhone, pickColor } from './helpers/tools';

/** The 56 colors (spec/SPEC-draw-tools.md): a dialog behind the palette pebble on phones. */
test.use({ locale: 'en-US' });

const TEAL_LIGHT = [0x80, 0xcb, 0xc4];

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

test('phone: a color picked in the dialog enters the bar first and draws', async ({ page }) => {
  test.skip(!isPhone(page), 'phones only');
  await page.getByRole('button', { name: 'All colors' }).click();
  const dialog = page.getByRole('dialog', { name: 'All colors' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio')).toHaveCount(56);
  await expect(dialog.getByRole('radio', { name: 'Black', exact: true })).toBeChecked();
  await page.screenshot({ path: test.info().outputPath('palette-dialog.png') });

  await pickColor(page, 'Teal, light', dialog);
  await expect(dialog).toBeHidden();
  expect(await barColors(page)).toEqual(['Teal, light', 'Black', 'Red', 'Green', 'Blue']);
  await expect(barColor(page, 'Teal, light')).toBeChecked();
  await stroke(page, 0.5);
  const pixel = await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5));
  expect(isColor(pixel, TEAL_LIGHT)).toBe(true);

  // A color of the bar keeps its order.
  await pickColor(page, 'Green');
  expect(await barColors(page)).toEqual(['Teal, light', 'Black', 'Red', 'Green', 'Blue']);
});

test('phone: the close button and the backdrop close the dialog without a change', async ({
  page,
}) => {
  test.skip(!isPhone(page), 'phones only');
  const dialog = page.getByRole('dialog', { name: 'All colors' });
  await page.getByRole('button', { name: 'All colors' }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'All colors' }).click();
  await expect(dialog).toBeVisible();
  // A tap on the backdrop, outside the dialog box.
  await page.mouse.click(4, 4);
  await expect(dialog).toBeHidden();
  expect(await barColors(page)).toEqual(['Black', 'Red', 'Green', 'Blue', 'Yellow']);
  await expect(barColor(page, 'Black')).toBeChecked();
});

test('phone: with the eraser on, the dialog shows the kept color and picking leaves the eraser', async ({
  page,
}) => {
  test.skip(!isPhone(page), 'phones only');
  await page.getByRole('button', { name: 'Eraser' }).click();
  await page.getByRole('button', { name: 'All colors' }).click();
  const dialog = page.getByRole('dialog', { name: 'All colors' });
  await expect(dialog.getByRole('radio', { name: 'Black', exact: true })).toBeChecked();
  await pickColor(page, 'Purple, dark', dialog);
  await expect(page.getByRole('button', { name: 'Eraser' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('tablet: the 56 colors are always shown beside the page, no bar or pebble', async ({
  page,
}) => {
  test.skip(isPhone(page), 'tablets only');
  const box = page.locator('.color-box:visible');
  await expect(box).toHaveCount(1);
  await expect(box.getByRole('radio')).toHaveCount(56);
  await expect(page.locator('.color-bar')).toBeHidden();
  await expect(page.getByRole('button', { name: 'All colors' })).toBeHidden();
  // Left of the page in landscape.
  const sheet = await page.locator('#page').boundingBox();
  const boxRect = await box.boundingBox();
  expect((boxRect?.x ?? 0) + (boxRect?.width ?? 0)).toBeLessThanOrEqual(sheet?.x ?? 0);

  await pickColor(page, 'Teal, light', box);
  await expect(box.getByRole('radio', { name: 'Teal, light', exact: true })).toBeChecked();
  await stroke(page, 0.5);
  const pixel = await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5));
  expect(isColor(pixel, TEAL_LIGHT)).toBe(true);
});

test('tablet in portrait: the box sits above the page, its two blocks side by side', async ({
  page,
}) => {
  test.skip(isPhone(page), 'tablets only');
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport?.height ?? 0, height: viewport?.width ?? 0 });
  const box = page.locator('.color-box:visible');
  await expect(box.getByRole('radio')).toHaveCount(56);
  const sheet = await page.locator('#page').boundingBox();
  const boxRect = await box.boundingBox();
  expect((boxRect?.y ?? 0) + (boxRect?.height ?? 0)).toBeLessThanOrEqual(sheet?.y ?? 0);
  // 14 columns of 48 px: wider than tall.
  expect(boxRect?.width ?? 0).toBeGreaterThan((boxRect?.height ?? 0) * 2);
});

test('phone: no box, the bar and the pebble instead', async ({ page }) => {
  test.skip(!isPhone(page), 'phones only');
  await expect(page.locator('.color-box:visible')).toHaveCount(0);
  await expect(page.locator('.color-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'All colors' })).toBeVisible();
});

// DF-06: docs/device-fixes.md (the colors are a tool bar: a tap there never draws)
test('a contact on a color next to the page never draws', async ({ page }) => {
  const palette = page.locator('#color-box:visible, #tools-colors:visible').first();
  const cells = palette.locator('label.color-cell:visible');
  // The cell closest to the page edge.
  const sheet = await page.locator('#page').boundingBox();
  let closest = cells.first();
  let best = Number.POSITIVE_INFINITY;
  for (const cell of await cells.all()) {
    const box = await cell.boundingBox();
    if (!box || !sheet) continue;
    const distance = Math.min(
      Math.abs(sheet.x - (box.x + box.width)),
      Math.abs(sheet.y - (box.y + box.height)),
    );
    if (distance < best) {
      best = distance;
      closest = cell;
    }
  }
  const box = await closest.boundingBox();
  if (!box) throw new Error('No cell');
  await drawStrokes(page, [
    { points: [[box.x + box.width / 2, box.y + box.height / 2]], pointerType: 'touch' },
  ]);
  await expect(page.locator('#undo')).toBeDisabled();
});
