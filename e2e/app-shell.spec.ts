import { expect, test } from '@playwright/test';

/** Distance kept free of controls near the top and bottom edges (spec A4). */
const EDGE_MARGIN = 32;

test.use({ locale: 'en-US' });

test('the square page fills the drawing area and controls stay away from the edges', async ({
  page,
}) => {
  await page.goto('en/');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');
  const box = await page.locator('#page').boundingBox();
  if (!box) throw new Error('Page not visible');

  expect(Math.abs(box.width - box.height)).toBeLessThan(1);
  // The page takes the full width in portrait, the full height (minus margins) in landscape.
  const portrait = viewport.height > viewport.width;
  if (portrait) expect(box.width).toBeGreaterThan(viewport.width - 24);
  else expect(box.height).toBeGreaterThan(viewport.height - 2 * EDGE_MARGIN - 1);

  for (const button of await page.locator('#draw-screen button').all()) {
    const rect = await button.boundingBox();
    if (!rect) continue;
    expect(rect.y).toBeGreaterThanOrEqual(EDGE_MARGIN);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - EDGE_MARGIN);
    expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(48);
  }
  await page.screenshot({ path: test.info().outputPath('draw-screen.png') });
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
