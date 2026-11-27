import { expect, test, type Page } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { seedDatabase } from './helpers/storage';

/** Overflow protection (spec/SPEC-overflow-protection.md): strokes clipped to their zone. */
test.use({ locale: 'en-US' });

// A house: walls from x 250 to 650, y 450 to 800, on a ground line; a red hint dot inside.
const HOUSE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none" stroke="#000" ' +
  'stroke-width="6"><path d="M0 800 L1000 800"/><rect x="250" y="450" width="400" height="350"/>' +
  '<circle class="hint" cx="300" cy="600" r="14" fill="#e53935" stroke="none"/></svg>';
const houseStep = {
  slot: 'overlay',
  at: 0,
  t: 0,
  layer: { slot: 'overlay', template: 'coloring/house', version: 1, params: {}, svg: HOUSE },
};
const RED = [0xe5, 0x39, 0x35];

/** A thick horizontal stroke across the house at y = 600, from x 100 to 900. */
function across(tool: 'pen' | 'eraser', zone?: [number, number]) {
  const points: number[] = [];
  for (let i = 0; i <= 40; i += 1) points.push(100 + i * 20, 600, i * 10);
  return { tool, color: '#e53935', width: 60, points, ...(zone ? { zone } : {}) };
}

const layer = (page: Page) => page.locator('#drawing-layer');
const inkAt = async (page: Page, x: number, selector = '#page', canvas = layer(page)) =>
  pixelAt(canvas, await pagePoint(page, x, 0.6, selector));

async function open(page: Page, strokes: unknown[]): Promise<void> {
  await seedDatabase(
    page,
    [{ id: 'house', updatedAt: Date.now(), lineAt: 0, templates: [houseStep], strokes }],
    { lastDrawingId: 'house' },
  );
  await page.goto('en/');
  await expect(page.locator('#overlay-layer')).toHaveAttribute('data-template', 'coloring/house');
}

test('a stroke with a zone stays inside it; one without crosses', async ({ page }) => {
  await open(page, [across('pen', [400, 600])]);
  // Inside the walls (and under the hint dot: hints are not outlines), nothing outside.
  await expect.poll(async () => isColor(await inkAt(page, 0.45), RED)).toBe(true);
  expect(isColor(await inkAt(page, 0.3), RED)).toBe(true);
  expect(isBlank(await inkAt(page, 0.15))).toBe(true);
  expect(isBlank(await inkAt(page, 0.8))).toBe(true);
});

test('without a zone, the same stroke goes across the outlines', async ({ page }) => {
  await open(page, [across('pen')]);
  await expect.poll(async () => isColor(await inkAt(page, 0.15), RED)).toBe(true);
  expect(isColor(await inkAt(page, 0.8), RED)).toBe(true);
});

test('an eraser with a zone erases only inside it', async ({ page }) => {
  await open(page, [across('pen'), across('eraser', [400, 600])]);
  await expect.poll(async () => isBlank(await inkAt(page, 0.45))).toBe(true);
  expect(isColor(await inkAt(page, 0.15), RED)).toBe(true);
  expect(isColor(await inkAt(page, 0.8), RED)).toBe(true);
});

test('the viewer and the exported picture clip the same way', async ({ page }) => {
  await open(page, [across('pen', [400, 600])]);
  await page.getByRole('button', { name: 'My drawings' }).click();
  // The gallery thumbnail: red inside, nothing outside.
  const thumbnail = page.locator('.gallery-card img');
  await expect(thumbnail).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  const pixel = async (fx: number) =>
    page.evaluate(
      async ({ src, fx }) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2D context');
        context.drawImage(image, 0, 0);
        const x = Math.floor(fx * canvas.width);
        return [...context.getImageData(x, Math.floor(0.6 * canvas.height), 1, 1).data];
      },
      { src: (await thumbnail.getAttribute('src')) ?? '', fx },
    );
  expect(isColor(await pixel(0.45), RED)).toBe(true);
  expect(isColor(await pixel(0.15), [255, 255, 255])).toBe(true);

  await page.getByRole('button', { name: /Open the drawing/ }).click();
  await expect(page.locator('#viewer-play')).toHaveAttribute('aria-label', 'Play', {
    timeout: 15_000,
  });
  const viewer = page.locator('#viewer-layer');
  await expect
    .poll(async () => isColor(await inkAt(page, 0.45, '#viewer-page', viewer), RED))
    .toBe(true);
  expect(isBlank(await inkAt(page, 0.15, '#viewer-page', viewer))).toBe(true);
});
