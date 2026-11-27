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
  // The layout follows the window's shape (spec/SPEC-draw-tools.md, boards 1 and 2).
  const portrait = viewport.height > viewport.width;
  const rect = async (selector: string) => {
    const found = await page.locator(selector).boundingBox();
    if (!found) throw new Error(`${selector} not visible`);
    return found;
  };
  // The palette is on the screen on tablets only (phones: a pebble and its dialog).
  const colors = tablet ? await rect('#color-box') : null;
  const size = await rect('#tools-primary');
  const actions = await rect('#tools-secondary');
  const pages = await rect('#tools-pages');
  if (portrait) {
    // Phones: the full width. Tablets: the full box of colors above takes some height.
    expect(box.width).toBeGreaterThan(tablet ? viewport.width * 0.8 : viewport.width - 24);
    // (Palette right above the page,) then the slider, then actions | pages on one row.
    if (colors) {
      expect(colors.y + colors.height).toBeLessThanOrEqual(box.y + 1);
      expect(box.y - (colors.y + colors.height)).toBeLessThan(24);
    }
    // The whole group is centered: as much free space above as below.
    const top = (colors ?? box).y - topMargin;
    const bottom = viewport.height - EDGE_MARGIN - (actions.y + actions.height);
    expect(Math.abs(top - bottom)).toBeLessThan(4);
    expect(size.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
    expect(actions.y).toBeGreaterThanOrEqual(size.y + size.height - 1);
    expect(Math.abs(actions.y - pages.y)).toBeLessThan(2);
    expect(actions.x + actions.width).toBeLessThanOrEqual(pages.x + 1);
  } else {
    expect(box.height).toBeGreaterThan(viewport.height - topMargin - EDGE_MARGIN - 1);
    // (Palette left of the page,) every tool right of it.
    if (colors) expect(colors.x + colors.width).toBeLessThanOrEqual(box.x + 1);
    for (const tools of [size, actions, pages]) {
      expect(tools.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
    }
    if (tablet) {
      // One column (board 2): pages, then the eraser and slider, then the actions.
      expect(pages.y + pages.height).toBeLessThanOrEqual(size.y + 1);
      expect(size.y + size.height).toBeLessThanOrEqual(actions.y + 1);
    } else {
      // Phones: the slider column, then actions over pages.
      expect(size.x + size.width).toBeLessThanOrEqual(actions.x + 1);
      expect(actions.y + actions.height).toBeLessThanOrEqual(pages.y + 1);
    }
  }
  // Every color cell and the slider on screen too.
  for (const control of await page
    .locator('#draw-screen label.color-cell:visible, #draw-screen input[type="range"]')
    .all()) {
    const cell = await control.boundingBox();
    if (!cell) continue;
    expect(cell.y).toBeGreaterThanOrEqual(topMargin - 1);
    expect(cell.y + cell.height).toBeLessThanOrEqual(viewport.height - EDGE_MARGIN + 1);
    expect(cell.x).toBeGreaterThanOrEqual(0);
    expect(cell.x + cell.width).toBeLessThanOrEqual(viewport.width);
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

test('on the iPhone SE, in portrait and in landscape, every control fits', async ({ page }) => {
  for (const size of [
    { width: 375, height: 667 },
    { width: 667, height: 375 },
    // The narrowest common Android phones.
    { width: 360, height: 740 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('en/');
    await expectDrawingLayout(page);
    await page.screenshot({ path: test.info().outputPath(`iphone-se-${size.width}.png`) });
  }
});

test('with a coloring page, the protection pebble fits beside the eraser everywhere', async ({
  page,
}) => {
  // Five window sizes, each with the full layout check: longer than the default on WebKit.
  test.setTimeout(60_000);
  await page.goto('en/');
  await page.getByRole('button', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Coloring page: house' }).click();
  const protection = page.getByRole('button', { name: 'Stay inside the lines' });
  await expect(protection).toBeVisible();
  for (const size of [
    { width: 375, height: 667 },
    { width: 667, height: 375 },
    { width: 360, height: 740 },
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
  ]) {
    await page.setViewportSize(size);
    await expect(protection).toBeVisible();
    await expectDrawingLayout(page);
    // Portrait: the pebble stays on the row of the eraser and the slider.
    if (size.height > size.width) {
      const tops = new Set<number>();
      for (const button of await page.locator('#tools-primary button:visible').all()) {
        const rect = await button.boundingBox();
        if (rect) tops.add(Math.round(rect.y + rect.height / 2));
      }
      expect(tops.size).toBe(1);
    }
    await page.screenshot({ path: test.info().outputPath(`protection-${size.width}.png`) });
  }
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
test('on a narrow phone (iPhone 8), the tools keep to their two rows', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('en/');
  for (const row of ['#tools-primary button', '#tools-secondary button, #tools-pages button']) {
    const tops = new Set<number>();
    for (const button of await page.locator(row).all()) {
      const rect = await button.boundingBox();
      if (rect) tops.add(Math.round(rect.y));
    }
    expect(tops.size).toBe(1);
  }
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
