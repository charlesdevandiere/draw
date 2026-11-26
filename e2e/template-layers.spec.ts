import { expect, test, type Page } from '@playwright/test';
import { isBlank, isColor, pagePixel, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { seedDatabase } from './helpers/storage';
import { pickColor, setSize } from './helpers/tools';

/** Template layers on the slate (spec/SPEC-template-layers.md). */
const BLACK = [0, 0, 0];
const RED = [0xe5, 0x39, 0x35];
// A stand-in for the house page: its ground line across the page at 80 % of the height.
const HOUSE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none" stroke="#000" ' +
  'stroke-width="6"><path d="M0 800 L1000 800"/><rect x="250" y="450" width="400" height="350"/>' +
  '</svg>';
const houseStep = {
  slot: 'overlay',
  at: 1,
  t: 200,
  layer: { slot: 'overlay', template: 'coloring/house', version: 1, params: {}, svg: HOUSE },
};

test.use({ locale: 'en-US' });

const overlay = (page: Page) => page.locator('#overlay-layer');

/** Opens a drawing (a line at the top, then the house coloring page) on the slate. */
async function openHouse(page: Page): Promise<void> {
  await seedDatabase(
    page,
    [{ id: 'house', updatedAt: Date.now(), lineAt: 150, templates: [houseStep] }],
    { lastDrawingId: 'house' },
  );
  await page.goto('en/');
  await expect(overlay(page)).toHaveAttribute('data-template', 'coloring/house');
}

const GROUND = { x: 0.1, y: 0.8 };

test('a coloring page stays above the strokes; the eraser never removes it', async ({ page }) => {
  await openHouse(page);
  const ground = await pagePoint(page, GROUND.x, GROUND.y);
  expect(isColor(await pixelAt(overlay(page), ground), BLACK)).toBe(true);

  // A thick red stroke across the ground line: red around it, the line still black on top.
  await pickColor(page, 'Red');
  await setSize(page, 5);
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, 0.7), await pagePoint(page, 0.1, 0.9)),
      pointerType: 'pen',
    },
  ]);
  expect(isColor(await pagePixel(page, await pagePoint(page, 0.1, 0.75)), RED)).toBe(true);
  expect(isColor(await pagePixel(page, ground), BLACK)).toBe(true);
  expect(isColor(await pixelAt(page.locator('#drawing-layer'), ground), RED)).toBe(true);

  // A white stroke across it does not hide the outline either.
  await pickColor(page, 'White');
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.2, 0.7), await pagePoint(page, 0.2, 0.9)),
      pointerType: 'pen',
    },
  ]);
  expect(isColor(await pagePixel(page, await pagePoint(page, 0.2, 0.8)), BLACK)).toBe(true);

  // The eraser takes the red away, never the outline.
  await page.getByRole('button', { name: 'Eraser' }).click();
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, 0.7), await pagePoint(page, 0.1, 0.9)),
      pointerType: 'pen',
    },
  ]);
  expect(isBlank(await pixelAt(page.locator('#drawing-layer'), ground))).toBe(true);
  expect(isColor(await pagePixel(page, ground), BLACK)).toBe(true);
});

test('undo and redo take the coloring page away and back; it stays after a reload', async ({
  page,
}) => {
  await openHouse(page);
  const ground = await pagePoint(page, GROUND.x, GROUND.y);
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.3, 0.9), await pagePoint(page, 0.6, 0.9)),
      pointerType: 'pen',
    },
  ]);
  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });

  // First undo: the stroke drawn on the coloring page; second: the coloring page itself.
  await undo.click();
  await expect(overlay(page)).toHaveAttribute('data-template', 'coloring/house');
  await undo.click();
  await expect(overlay(page)).toHaveAttribute('data-template', '');
  expect(isColor(await pagePixel(page, ground), [255, 255, 255])).toBe(true);
  // The line drawn before it is still there; one more undo empties the page.
  await expect(undo).toBeEnabled();

  await redo.click();
  await expect(overlay(page)).toHaveAttribute('data-template', 'coloring/house');
  expect(isColor(await pagePixel(page, ground), BLACK)).toBe(true);

  // Saved with the drawing: a reload shows it again.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(overlay(page)).toHaveAttribute('data-template', 'coloring/house');
  expect(isColor(await pagePixel(page, ground), BLACK)).toBe(true);
});

test('the templates panel places, replaces and removes a coloring page', async ({ page }) => {
  await page.goto('en/');
  const open = page.getByRole('button', { name: 'Templates' });
  const dialog = page.getByRole('dialog', { name: 'Templates' });
  await open.click();
  await expect(dialog).toBeVisible();
  // Nothing to remove yet.
  await expect(dialog.getByRole('button', { name: 'No coloring page' })).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath('templates-panel.png') });
  await dialog.getByRole('button', { name: 'Coloring page: fish' }).click();
  await expect(dialog).toBeHidden();
  await expect(overlay(page)).toHaveAttribute('data-template', 'coloring/fish');

  // A stroke on it, then the house replaces the fish: undo goes back step by step.
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.3, 0.5), await pagePoint(page, 0.6, 0.5)),
      pointerType: 'pen',
    },
  ]);
  await open.click();
  await expect(dialog.getByRole('button', { name: 'Coloring page: fish' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Coloring page: house' }).click();
  await expect(overlay(page)).toHaveAttribute('data-template', 'coloring/house');
  const undo = page.getByRole('button', { name: 'Undo' });
  await undo.click();
  await expect(overlay(page)).toHaveAttribute('data-template', 'coloring/fish');
  await undo.click();
  await undo.click();
  await expect(overlay(page)).toHaveAttribute('data-template', '');
  await expect(undo).toBeDisabled();
  await page.getByRole('button', { name: 'Redo' }).click();

  // The blank tile removes it; Escape closes the panel without a change.
  await open.click();
  await dialog.getByRole('button', { name: 'No coloring page' }).click();
  await expect(overlay(page)).toHaveAttribute('data-template', '');
  await open.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(overlay(page)).toHaveAttribute('data-template', '');
});

test('the panel speaks French in the French app', async ({ page }) => {
  await page.goto('fr/');
  await page.getByRole('button', { name: 'Modèles' }).click();
  await expect(page.getByRole('button', { name: 'Coloriage : poisson' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Coloriages' })).toBeVisible();
});
