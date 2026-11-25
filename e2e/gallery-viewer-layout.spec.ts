import { expect, test, type Page } from '@playwright/test';
import { seedDatabase } from './helpers/storage';

/**
 * Gallery and viewer layouts in the four window shapes (spec/SPEC-gallery-viewer.md,
 * boards "Galerie" and "Visionneuse"): every control on screen, out of the edge margins,
 * at least 48 px, and the viewer's page as large as the controls leave.
 */
const EDGE_MARGIN = 32;
const TABLET_TOP_MARGIN = 64;
const SIZES = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-se-landscape', width: 667, height: 375 },
  { name: 'pixel', width: 412, height: 915 },
  { name: 'pixel-landscape', width: 915, height: 412 },
  { name: 'ipad', width: 1180, height: 820 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
];

test.use({ locale: 'en-US' });

type Box = { x: number; y: number; width: number; height: number };

async function rect(page: Page, selector: string): Promise<Box> {
  const found = await page.locator(selector).boundingBox();
  if (!found) throw new Error(`${selector} not visible`);
  return found;
}

function expectInside(control: Box, size: { width: number; height: number }, top: number) {
  expect(control.width).toBeGreaterThanOrEqual(48);
  expect(control.height).toBeGreaterThanOrEqual(48);
  expect(control.y).toBeGreaterThanOrEqual(top - 1);
  expect(control.y + control.height).toBeLessThanOrEqual(size.height - EDGE_MARGIN + 1);
  expect(control.x).toBeGreaterThanOrEqual(0);
  expect(control.x + control.width).toBeLessThanOrEqual(size.width);
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('the viewer keeps every control on screen and the page as large as it can', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await seedDatabase(page, [{ id: 'one', updatedAt: Date.now(), lineAt: 500 }]);
  await page.goto('en/');
  await page.getByRole('button', { name: 'My drawings' }).click();
  await page.getByRole('button', { name: /Open the drawing/ }).click();
  await expect(page.locator('#viewer-screen')).toBeVisible();

  for (const size of SIZES) {
    await page.setViewportSize(size);
    const tablet = size.width >= 576 && size.height >= 576;
    const top = tablet ? TABLET_TOP_MARGIN : EDGE_MARGIN;
    const portrait = size.height > size.width;
    // Let the resize settle (layout and repaint).
    await expect
      .poll(async () => {
        const box = await rect(page, '#viewer-page');
        return Math.abs(box.width - box.height) < 1 && box.y >= top - 1;
      })
      .toBe(true);

    const pageBox = await rect(page, '#viewer-page');
    const bar = await rect(page, '#viewer-progress');
    const ids = ['back', 'share', 'trash', 'restart', 'play', 'continue'];
    const controls = Object.fromEntries(
      await Promise.all(ids.map(async (id) => [id, await rect(page, `#viewer-${id}`)] as const)),
    ) as Record<string, Box>;
    for (const control of Object.values(controls)) {
      expectInside(control, size, top);
      expect(overlaps(control, pageBox)).toBe(false);
      expect(overlaps(control, bar)).toBe(false);
    }
    // The bar right under the page, as wide.
    expect(bar.y).toBeGreaterThanOrEqual(pageBox.y + pageBox.height - 1);
    expect(Math.abs(bar.width - pageBox.width)).toBeLessThan(1);
    const play = controls['play'] as Box;
    expect(play.width).toBe(tablet ? 88 : 72);

    if (portrait) {
      // Back | share, trash above; restart, play, continue below; centered vertically.
      const back = controls['back'] as Box;
      const restart = controls['restart'] as Box;
      expect(back.y + back.height).toBeLessThanOrEqual(pageBox.y + 1);
      expect(restart.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
      const above = back.y - top;
      const below = size.height - EDGE_MARGIN - (play.y + play.height);
      expect(Math.abs(above - below)).toBeLessThan(4);
      // Largest: limited by the width, or the column fills the height.
      const fillsWidth = pageBox.width >= size.width - 16 - 1;
      const fillsHeight = above < 2 && below < 2;
      expect(fillsWidth || fillsHeight).toBe(true);
    } else {
      // Left column: back on top, share and trash at the bottom; right column: play first.
      for (const id of ['back', 'share', 'trash']) {
        const control = controls[id] as Box;
        expect(control.x + control.width).toBeLessThanOrEqual(pageBox.x + 1);
      }
      for (const id of ['restart', 'play', 'continue']) {
        expect((controls[id] as Box).x).toBeGreaterThanOrEqual(pageBox.x + pageBox.width - 1);
      }
      expect(play.y).toBeLessThan((controls['restart'] as Box).y);
      expect((controls['back'] as Box).y).toBeLessThan((controls['share'] as Box).y);
      // Largest: the page and its bar fill the height between the margins.
      expect(bar.y + bar.height - pageBox.y).toBeGreaterThan(size.height - top - EDGE_MARGIN - 2);
    }
    await page.screenshot({ path: test.info().outputPath(`viewer-${size.name}.png`) });
  }
});

test('the gallery keeps its header and first tiles on screen in every shape', async ({ page }) => {
  const now = Date.now();
  await seedDatabase(
    page,
    Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, updatedAt: now - i, lineAt: 500 })),
  );
  await page.goto('en/');
  await page.getByRole('button', { name: 'My drawings' }).click();
  // Seeded drawings have no thumbnail: the gallery renders them one by one first.
  await expect(page.locator('.gallery-card')).toHaveCount(8, { timeout: 20_000 });

  for (const size of SIZES) {
    await page.setViewportSize(size);
    const tablet = size.width >= 576 && size.height >= 576;
    const top = tablet ? TABLET_TOP_MARGIN : EDGE_MARGIN;
    for (const selector of ['#back-to-drawing', '#parent-lock']) {
      expectInside(await rect(page, selector), size, top);
    }
    const tiles = page.locator('.gallery-list > li');
    const first = await rect(page, '.gallery-list > li:first-child');
    expect(first.y).toBeGreaterThanOrEqual(top);
    // At least two tiles across, none cut by the sides.
    const second = await tiles.nth(1).boundingBox();
    if (!second) throw new Error('No second tile');
    expect(Math.abs(second.y - first.y)).toBeLessThan(12);
    for (const tile of [first, second]) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(size.width);
      expect(tile.width).toBeGreaterThanOrEqual(tablet ? 180 : 150);
    }
    await page.screenshot({ path: test.info().outputPath(`gallery-${size.name}.png`) });
  }
});
