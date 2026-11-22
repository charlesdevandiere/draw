import { expect, test, type Locator } from '@playwright/test';

/**
 * Paper theme and pebble buttons (spec/SPEC-ui-foundation.md, "Theme and buttons"): action
 * buttons are Bootstrap `.btn` with a `theme-<role>` color and the `.btn-pebble` shape.
 */
test.use({ locale: 'en-US' });

const INK_RING = 'rgb(255, 244, 214) 0px 0px 0px 3px, rgb(43, 43, 43) 0px 0px 0px 6px';
const DISABLED_BG = 'rgb(235, 224, 196)';
const DISABLED_ICON = 'rgb(163, 152, 130)';
const ORANGE = 'rgb(224, 105, 42)';

async function styleOf(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('en/');
});

test('the drawing screen actions are pebbles in their role colors', async ({ page }) => {
  const roles: [string, string][] = [
    ['#mode-button', 'rgb(206, 147, 216)'],
    ['#open-gallery', 'rgb(129, 212, 250)'],
    ['[aria-label="Eraser"]', 'rgb(244, 143, 177)'],
  ];
  for (const [selector, color] of roles) {
    const button = page.locator(selector);
    await expect(button).toHaveClass(/\bbtn\b/);
    await expect(button).toHaveClass(/\bbtn-pebble\b/);
    await expect.poll(() => styleOf(button, 'background-color')).toBe(color);
    // Dark icon on the light pebble.
    await expect
      .poll(() => styleOf(button.locator('.icon'), 'background-color'))
      .toBe('rgb(26, 26, 26)');
    // Square with rounded corners (≈ 29 % of the size), not a circle.
    const size = (await button.boundingBox())?.width ?? 0;
    const radius = await styleOf(button, 'border-top-left-radius');
    const share = radius.endsWith('%')
      ? Number.parseFloat(radius) / 100
      : Number.parseFloat(radius) / size;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.33);
  }
});

test('undo, redo and new page use the disabled colors until there is something to do', async ({
  page,
}) => {
  for (const selector of ['#undo', '#redo', '#new-page']) {
    const button = page.locator(selector);
    await expect(button).toBeDisabled();
    await expect.poll(() => styleOf(button, 'background-color')).toBe(DISABLED_BG);
    await expect.poll(() => styleOf(button, 'opacity')).toBe('1');
    await expect
      .poll(() => styleOf(button.locator('.icon'), 'background-color'))
      .toBe(DISABLED_ICON);
  }
});

test('undo, redo enabled take the yellow, new page the green', async ({ page }) => {
  const box = await page.locator('#page').boundingBox();
  if (!box) throw new Error('Page not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#undo')).toBeEnabled();
  await expect
    .poll(() => styleOf(page.locator('#undo'), 'background-color'))
    .toBe('rgb(255, 213, 79)');
  await expect
    .poll(() => styleOf(page.locator('#new-page'), 'background-color'))
    .toBe('rgb(165, 214, 167)');
  await page.locator('#undo').click();
  await expect
    .poll(() => styleOf(page.locator('#redo'), 'background-color'))
    .toBe('rgb(255, 213, 79)');
});

test('the selection is an ink ring, never the old orange border', async ({ page }) => {
  const eraser = page.locator('[aria-label="Eraser"]');
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => styleOf(eraser, 'box-shadow')).toBe(INK_RING);

  const red = page.locator('[aria-label="Red"]');
  await red.click();
  await expect(red).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => styleOf(red, 'box-shadow')).toBe(INK_RING);

  for (const button of await page.locator('#draw-screen button').all()) {
    await expect.poll(() => styleOf(button, 'border-top-color')).not.toBe(ORANGE);
    await expect.poll(() => styleOf(button, 'box-shadow')).not.toContain(ORANGE);
  }
});

test('the page has square corners', async ({ page }) => {
  await expect.poll(() => styleOf(page.locator('#page'), 'border-top-left-radius')).toBe('0px');
});
