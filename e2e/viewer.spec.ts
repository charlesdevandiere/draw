import { expect, test, type Page } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { seedDatabase } from './helpers/storage';

/** The viewer (spec/SPEC-gallery-viewer.md): replay with play / pause / restart. */
const INK = [0x21, 0x21, 0x21];

test.use({ locale: 'en-US' });

const layer = (page: Page) => page.locator('#viewer-layer');
const inkAt = async (page: Page, x: number, y = 0.5) =>
  !isBlank(await pixelAt(layer(page), await pagePoint(page, x, y, '#viewer-layer')));
const progressOf = async (page: Page) =>
  Number(await page.locator('#viewer-progress').getAttribute('aria-valuenow'));

async function openSlowDrawing(page: Page): Promise<void> {
  // One line drawn left to right over 8 s: the replay takes 8 s too.
  await seedDatabase(page, [{ id: 'slow', updatedAt: Date.now(), lineAt: 500, durationMs: 8000 }]);
  await page.goto('en/');
  await page.getByRole('button', { name: 'My drawings' }).click();
  await page.getByRole('button', { name: /Open the drawing/ }).click();
  await expect(page.locator('#viewer-screen')).toBeVisible();
}

test('a drawing replays stroke by stroke, eraser included', async ({ page }) => {
  await page.goto('en/');
  for (const y of [0.3, 0.6]) {
    await drawStrokes(page, [
      {
        points: line(await pagePoint(page, 0.1, y), await pagePoint(page, 0.9, y)),
        pointerType: 'pen',
      },
    ]);
  }
  await page.getByRole('button', { name: 'Eraser' }).click();
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.5, 0.5), await pagePoint(page, 0.5, 0.7)),
      pointerType: 'pen',
    },
  ]);

  await page.getByRole('button', { name: 'My drawings' }).click();
  await expect(page.locator('.gallery-card').getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: /Open the drawing/ }).click();
  await expect(page.locator('#viewer-screen')).toBeVisible();

  // At the end, the play / pause pebble offers to play again and the bar is full.
  await expect(page.locator('#viewer-play')).toHaveAttribute('aria-label', 'Play', {
    timeout: 20_000,
  });
  expect(await progressOf(page)).toBe(100);
  const canvas = layer(page);
  expect(
    isColor(await pixelAt(canvas, await pagePoint(page, 0.3, 0.3, '#viewer-layer')), INK),
  ).toBe(true);
  expect(
    isColor(await pixelAt(canvas, await pagePoint(page, 0.3, 0.6, '#viewer-layer')), INK),
  ).toBe(true);
  // The eraser stroke was replayed too.
  expect(await inkAt(page, 0.5, 0.6)).toBe(false);
  await page.screenshot({ path: test.info().outputPath('viewer.png') });

  // Escape goes back to the gallery (the play pebble has the focus).
  await expect(page.locator('#viewer-play')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery-screen')).toBeVisible();
});

test('pause, resume, restart, and play again at the end', async ({ page }) => {
  await openSlowDrawing(page);
  const play = page.locator('#viewer-play');
  await expect(play).toHaveAttribute('aria-label', 'Pause');
  await expect.poll(() => progressOf(page)).toBeGreaterThan(5);

  // A touch on the page pauses: the bar and the drawing stop.
  await layer(page).click();
  await expect(play).toHaveAttribute('aria-label', 'Play');
  const paused = await progressOf(page);
  expect(paused).toBeLessThan(100);
  await page.waitForTimeout(600);
  expect(await progressOf(page)).toBe(paused);
  expect(await inkAt(page, 0.88)).toBe(false);

  // Turned a quarter while paused: repainted at the same point, nothing more.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expect.poll(() => inkAt(page, 0.12)).toBe(true);
  expect(await inkAt(page, 0.88)).toBe(false);
  expect(await progressOf(page)).toBe(paused);
  await page.setViewportSize(viewport);

  // Play resumes from there.
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Pause');
  await expect.poll(() => progressOf(page)).toBeGreaterThan(paused);
  await expect.poll(() => inkAt(page, 0.5)).toBe(true);

  // Restart: back to an empty page, playing.
  await page.locator('#viewer-restart').click();
  await layer(page).click();
  await expect(play).toHaveAttribute('aria-label', 'Play');
  expect(await progressOf(page)).toBeLessThan(paused);
  expect(await inkAt(page, 0.5)).toBe(false);

  // To the end, then play again from the start.
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Play', { timeout: 15_000 });
  expect(await progressOf(page)).toBe(100);
  expect(await inkAt(page, 0.88)).toBe(true);
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Pause');
  expect(await progressOf(page)).toBeLessThan(50);
});

test('back returns to the gallery; continue puts the drawing on the slate', async ({ page }) => {
  await openSlowDrawing(page);
  await page.getByRole('button', { name: 'Back to my drawings' }).click();
  await expect(page.locator('#gallery-screen')).toBeVisible();

  await page.getByRole('button', { name: /Open the drawing/ }).click();
  await page.getByRole('button', { name: 'Continue this drawing' }).click();
  await expect(page.locator('#draw-screen')).toBeVisible();
  await expect
    .poll(async () =>
      isBlank(await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5))),
    )
    .toBe(false);
  // Its history is there: one undo empties the page.
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(
    isBlank(await pixelAt(page.locator('#drawing-layer'), await pagePoint(page, 0.5, 0.5))),
  ).toBe(true);
});
