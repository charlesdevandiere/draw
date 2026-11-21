import { expect, test, type Page } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';

const INK = [0x21, 0x21, 0x21];

test.use({ locale: 'en-US' });

async function horizontal(page: Page, y: number) {
  return line(await pagePoint(page, 0.1, y), await pagePoint(page, 0.4, y));
}

async function inked(page: Page, y: number): Promise<boolean> {
  return isColor(
    await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.25, y)),
    INK,
  );
}

async function blank(page: Page, y: number): Promise<boolean> {
  return isBlank(await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.25, y)));
}

test.beforeEach(async ({ page }) => {
  await page.goto('en/');
});

test('finger mode is the default: one contact draws, a second one does not', async ({ page }) => {
  await expect(page.locator('#mode-button')).toHaveAttribute('data-mode', 'finger');
  await drawStrokes(page, [
    { points: await horizontal(page, 0.2), pointerType: 'touch', pointerId: 1 },
    { points: await horizontal(page, 0.6), pointerType: 'touch', pointerId: 2 },
  ]);
  expect(await inked(page, 0.2)).toBe(true);
  expect(await blank(page, 0.6)).toBe(true);
});

test('finger mode ignores a contact as wide as a palm', async ({ page }) => {
  await drawStrokes(page, [
    { points: await horizontal(page, 0.4), pointerType: 'touch', width: 200 },
  ]);
  expect(await blank(page, 0.4)).toBe(true);
});

test('the first pen switches to pen mode, then touches no longer draw', async ({ page }) => {
  await drawStrokes(page, [{ points: await horizontal(page, 0.2), pointerType: 'pen' }]);
  await expect(page.locator('#mode-button')).toHaveAttribute('data-mode', 'pen');
  await expect(page.locator('#mode-button')).toHaveAccessibleName(/pen only/);
  await drawStrokes(page, [{ points: await horizontal(page, 0.6), pointerType: 'touch' }]);
  expect(await inked(page, 0.2)).toBe(true);
  expect(await blank(page, 0.6)).toBe(true);
});

test('the mode button cycles finger → multi → pen, and multi lets two fingers draw', async ({
  page,
}) => {
  const button = page.locator('#mode-button');
  await button.click();
  await expect(button).toHaveAttribute('data-mode', 'multi');
  await drawStrokes(page, [
    { points: await horizontal(page, 0.2), pointerType: 'touch', pointerId: 1 },
    { points: await horizontal(page, 0.6), pointerType: 'touch', pointerId: 2 },
  ]);
  expect(await inked(page, 0.2)).toBe(true);
  expect(await inked(page, 0.6)).toBe(true);
  await button.click();
  await expect(button).toHaveAttribute('data-mode', 'pen');
  await button.click();
  await expect(button).toHaveAttribute('data-mode', 'finger');
});

test('after choosing finger by hand, a pen does not switch the mode', async ({ page }) => {
  const button = page.locator('#mode-button');
  for (let i = 0; i < 3; i += 1) await button.click(); // back to finger, chosen by hand
  await drawStrokes(page, [{ points: await horizontal(page, 0.2), pointerType: 'pen' }]);
  await expect(button).toHaveAttribute('data-mode', 'finger');
  await drawStrokes(page, [{ points: await horizontal(page, 0.6), pointerType: 'touch' }]);
  // Pens also draw in finger mode.
  expect(await inked(page, 0.2)).toBe(true);
  expect(await inked(page, 0.6)).toBe(true);
});

for (const [name, width] of [
  ['a palm', 150],
  ['a finger', 1],
] as const) {
  test(`${name} resting before the pen does not stop the pen`, async ({ page }) => {
    const rest = await pagePoint(page, 0.8, 0.8);
    const pen = await horizontal(page, 0.3);
    await drawStrokes(page, [
      { points: pen.map(() => rest), pointerType: 'touch', width, pointerId: 7 },
      { points: pen, pointerType: 'pen', pointerId: 9 },
    ]);
    expect(await inked(page, 0.3)).toBe(true);
    if (width > 1) expect(isBlank(await pixelAt(page.locator('#drawing-layer'), rest))).toBe(true);
  });
}
