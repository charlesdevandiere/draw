import { expect, test, type Page } from '@playwright/test';
import { isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { colorCell, colorRadio, isPhone, pickColor } from './helpers/tools';

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

test('phone: a color picked in the dialog draws', async ({ page }) => {
  test.skip(!isPhone(page), 'phones only');
  await page.getByRole('button', { name: 'All colors' }).click();
  const dialog = page.getByRole('dialog', { name: 'All colors' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio')).toHaveCount(56);
  await expect(dialog.getByRole('radio', { name: 'Black', exact: true })).toBeChecked();
  await page.screenshot({ path: test.info().outputPath('palette-dialog.png') });

  await pickColor(page, 'Teal, light', dialog);
  await expect(dialog).toBeHidden();
  await expect(colorRadio(page, 'Teal, light')).toBeChecked();
  await stroke(page, 0.5);
  const pixel = await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5));
  expect(isColor(pixel, TEAL_LIGHT)).toBe(true);
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
  // Fully open (it fades in), then a tap on the backdrop, outside the dialog box.
  await expect
    .poll(() => dialog.evaluate((element) => getComputedStyle(element).opacity))
    .toBe('1');
  await page.mouse.click(4, 4);
  await expect(dialog).toBeHidden();
  await expect(colorRadio(page, 'Black')).toBeChecked();
});

test('phone: a color picked while the dialog still fades in closes it anyway', async ({ page }) => {
  test.skip(!isPhone(page), 'phones only');
  const dialog = page.getByRole('dialog', { name: 'All colors' });
  await page.getByRole('button', { name: 'All colors' }).click();
  // At once, without waiting for the end of the opening animation.
  await colorCell(page.locator('dialog.palette-dialog'), 'Red').click({ force: true });
  await expect(dialog).toBeHidden();
  await expect(colorRadio(page, 'Red')).toBeChecked();
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

test('tablet: the 56 colors are one grid of 4 × 14 left of the page, no pebble', async ({
  page,
}) => {
  test.skip(isPhone(page), 'tablets only');
  const box = page.locator('.color-box:visible');
  await expect(box).toHaveCount(1);
  await expect(box.getByRole('radio')).toHaveCount(56);
  await expect(page.getByRole('button', { name: 'All colors' })).toBeHidden();
  // One grid, 4 tones across, 14 families down, left of the page in landscape.
  const sheet = await page.locator('#page').boundingBox();
  const boxRect = await box.boundingBox();
  expect((boxRect?.x ?? 0) + (boxRect?.width ?? 0)).toBeLessThanOrEqual(sheet?.x ?? 0);
  const first = await box.locator('label').first().boundingBox();
  expect((boxRect?.width ?? 0) / (first?.width ?? 1)).toBeCloseTo(4, 0);
  expect((boxRect?.height ?? 0) / (first?.height ?? 1)).toBeCloseTo(14, 0);
  // Rows by wavelength: red at the top, black and white at the bottom.
  const labels = await box
    .locator('input')
    .evaluateAll((inputs) => inputs.map((input) => input.getAttribute('aria-label')));
  expect(labels.slice(0, 4)).toEqual(['Red, light', 'Red, bright', 'Red', 'Red, dark']);
  expect(labels.slice(-4)).toEqual(['White', 'Light grey', 'Grey', 'Black']);
  // Palette at the left edge, tools at the right edge, the page centered between them.
  const tools = await page.locator('#tools-primary').boundingBox();
  expect(boxRect?.x ?? 0).toBeLessThan(16);
  const left = (sheet?.x ?? 0) - ((boxRect?.x ?? 0) + (boxRect?.width ?? 0));
  const right = (tools?.x ?? 0) - ((sheet?.x ?? 0) + (sheet?.width ?? 0));
  expect(Math.abs(left - right)).toBeLessThan(40);
  await page.screenshot({ path: test.info().outputPath('palette-tablet.png') });

  await pickColor(page, 'Teal, light', box);
  await expect(box.getByRole('radio', { name: 'Teal, light', exact: true })).toBeChecked();
  // The selected cell is drawn larger and rounded, its neighbours do not move.
  const neighbour = colorCell(box, 'Teal, bright');
  const before = await neighbour.boundingBox();
  const teal = colorCell(box, 'Teal, light');
  await expect.poll(() => teal.evaluate((cell) => getComputedStyle(cell).scale)).toBe('1.3');
  expect(await teal.evaluate((cell) => getComputedStyle(cell).borderTopRightRadius)).toBe('8px');
  expect(await neighbour.boundingBox()).toEqual(before);
  await stroke(page, 0.5);
  const pixel = await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5));
  expect(isColor(pixel, TEAL_LIGHT)).toBe(true);
});

test('tablet in portrait: the palette is turned (14 × 4) above the page', async ({ page }) => {
  test.skip(isPhone(page), 'tablets only');
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport?.height ?? 0, height: viewport?.width ?? 0 });
  const box = page.locator('.color-box:visible');
  await expect(box.getByRole('radio')).toHaveCount(56);
  const sheet = await page.locator('#page').boundingBox();
  const boxRect = await box.boundingBox();
  expect((boxRect?.y ?? 0) + (boxRect?.height ?? 0)).toBeLessThanOrEqual(sheet?.y ?? 0);
  // One grid, 14 families across, 4 tones down.
  const first = await box.locator('label').first().boundingBox();
  expect((boxRect?.width ?? 0) / (first?.width ?? 1)).toBeCloseTo(14, 0);
  expect((boxRect?.height ?? 0) / (first?.height ?? 1)).toBeCloseTo(4, 0);
  // The side grid turned by -90°: families left to right, the dark tones on top.
  const labels = await box
    .locator('input')
    .evaluateAll((inputs) => inputs.map((input) => input.getAttribute('aria-label')));
  expect(labels[0]).toBe('Red, dark');
  expect(labels[13]).toBe('Black');
  expect(labels.at(-1)).toBe('White');
});

test('phone: no colors on the screen, only the palette pebble', async ({ page }) => {
  test.skip(!isPhone(page), 'phones only');
  await expect(page.locator('#draw-screen label.color-cell:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All colors' })).toBeVisible();
});

// DF-06: docs/device-fixes.md (the colors are a tool bar: a tap there never draws)
test('a contact on a color next to the page never draws', async ({ page }) => {
  test.skip(isPhone(page), 'phones have no colors next to the page');
  const palette = page.locator('#color-box:visible').first();
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

test('white selected: the size preview gets an outline, like the eraser', async ({ page }) => {
  const preview = page.locator('.size-preview');
  const outline = () =>
    preview.evaluate((element) => getComputedStyle(element, '::before').boxShadow);
  expect(await outline()).toBe('none');
  await pickColor(page, 'White');
  await expect.poll(outline).toContain('1px');
});
