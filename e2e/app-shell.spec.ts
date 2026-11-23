import { expect, test, type Page } from '@playwright/test';
import { isBlank, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes } from './helpers/pointer';

/** Distance kept free of controls near the top and bottom edges (spec A4). */
const EDGE_MARGIN = 32;
/** Tablets keep more room at the top: iPadOS 26 blurs a band under its status bar. */
const TABLET_TOP_MARGIN = 64;

test.use({ locale: 'en-US' });

async function expectDrawingLayout(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');
  const box = await page.locator('#page').boundingBox();
  if (!box) throw new Error('Page not visible');

  // Device class (margins only): both sides at least Bootstrap's sm breakpoint (576 px).
  const tablet = viewport.width >= 576 && viewport.height >= 576;
  const topMargin = tablet ? TABLET_TOP_MARGIN : EDGE_MARGIN;

  expect(Math.abs(box.width - box.height)).toBeLessThan(1);
  // The layout follows the window's shape: tools below the page in portrait, on both
  // sides in landscape, so the page takes the full width or the full height.
  const portrait = viewport.height > viewport.width;
  const tools = await page.locator('#tools-primary').boundingBox();
  if (!tools) throw new Error('Tools not visible');
  if (portrait) {
    // Phones: the full width. Tablets: the full box of colors above takes some height.
    expect(box.width).toBeGreaterThan(tablet ? viewport.width * 0.8 : viewport.width - 24);
    expect(tools.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
  } else {
    expect(box.height).toBeGreaterThan(viewport.height - topMargin - EDGE_MARGIN - 1);
    expect(tools.x + tools.width).toBeLessThanOrEqual(box.x + 1);
    const secondary = await page.locator('#tools-secondary').boundingBox();
    if (!secondary) throw new Error('Secondary tools not visible');
    expect(secondary.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
  }

  for (const button of await page.locator('#draw-screen button').all()) {
    const rect = await button.boundingBox();
    if (!rect) continue;
    // DF-02: docs/device-fixes.md (tablets, in either orientation)
    expect(rect.y).toBeGreaterThanOrEqual(topMargin);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - EDGE_MARGIN);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
    expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(48);
  }
}

test('the square page fills the drawing area and controls stay away from the edges', async ({
  page,
}) => {
  await page.goto('en/');
  await expectDrawingLayout(page);
  await page.screenshot({ path: test.info().outputPath('draw-screen.png') });
});

test('turned a quarter, the layout follows the window and keeps its drawing', async ({ page }) => {
  await page.goto('en/');
  await drawStrokes(page, [{ points: [await pagePoint(page, 0.3, 0.5)], pointerType: 'pen' }]);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expectDrawingLayout(page);
  // Same place on the page, at its new size.
  const layer = page.locator('#drawing-layer');
  // The repaint after a resize is asynchronous: poll until it lands.
  await expect
    .poll(async () => isBlank(await pixelAt(layer, await pagePoint(page, 0.3, 0.5))))
    .toBe(false);
  await page.screenshot({ path: test.info().outputPath('draw-screen-turned.png') });
});

// DF-01: docs/device-fixes.md
test('on a narrow phone (iPhone 8), the bar of 5 and the palette pebble share one row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('en/');
  const rows = new Set<number>();
  for (const cell of await page.locator('.color-bar label, .palette-button').all()) {
    const rect = await cell.boundingBox();
    if (rect) rows.add(Math.round(rect.y));
  }
  expect(rows.size).toBe(1);
});

test('the gallery button switches screens and back', async ({ page }) => {
  await page.goto('en/');
  await page.getByRole('button', { name: 'My drawings' }).click();
  await expect(page.locator('#gallery-screen')).toBeVisible();
  await expect(page.locator('#draw-screen')).toBeHidden();
  await page.getByRole('button', { name: 'Back to drawing' }).click();
  await expect(page.locator('#draw-screen')).toBeVisible();
});

test('the page cannot be zoomed and long-press menus are cancelled', async ({ page }) => {
  await page.goto('en/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /user-scalable=no/,
  );
  const prevented = await page.evaluate(() => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.getElementById('page')?.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
});
