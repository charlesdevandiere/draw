import { expect, test, type Page } from '@playwright/test';
import { isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { barColor, barColors, pickColor } from './helpers/tools';

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
  test.skip((page.viewportSize()?.width ?? 0) >= 576, 'phones only');
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
  test.skip((page.viewportSize()?.width ?? 0) >= 576, 'phones only');
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
  test.skip((page.viewportSize()?.width ?? 0) >= 576, 'phones only');
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
