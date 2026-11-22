import { expect, test, type Page } from '@playwright/test';
import { drawStrokes } from './helpers/pointer';

/**
 * Layout fixed to the device (spec/SPEC-ui-foundation.md): a phone held in landscape or a
 * tablet held in portrait turns its screens back by a quarter turn. Playwright reports a
 * screen angle of 0 whatever the viewport, so the turn is the portrait-natural fallback.
 */
test.use({ locale: 'en-US' });

async function holdTheOtherWay(page: Page): Promise<number> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  const attribute = page.locator('#screens');
  await expect(attribute).toHaveAttribute('data-rotation', /^(90|270)$/);
  return Number(await attribute.getAttribute('data-rotation'));
}

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).boundingBox();
  if (!rect) throw new Error(`${selector} not visible`);
  return rect;
}

test('in the design orientation, nothing is turned', async ({ page }) => {
  await page.goto('en/');
  await expect(page.locator('#screens')).toHaveAttribute('data-rotation', '0');
});

test('held the other way, the controls keep their place on the device', async ({ page }) => {
  await page.goto('en/');
  const tablet = (page.viewportSize()?.width ?? 0) > (page.viewportSize()?.height ?? 0);
  const rotation = await holdTheOtherWay(page);
  const sheet = await box(page, '#page');
  const tools = await box(page, tablet ? '#tools-primary' : '#tools-secondary');
  // Clockwise turn: the layout's bottom goes to the left, its left side to the top.
  // Counter-clockwise: bottom to the right, left side to the bottom.
  if (tablet && rotation === 90) expect(tools.y + tools.height).toBeLessThanOrEqual(sheet.y + 1);
  if (tablet && rotation === 270)
    expect(tools.y).toBeGreaterThanOrEqual(sheet.y + sheet.height - 1);
  if (!tablet && rotation === 90) expect(tools.x + tools.width).toBeLessThanOrEqual(sheet.x + 1);
  if (!tablet && rotation === 270)
    expect(tools.x).toBeGreaterThanOrEqual(sheet.x + sheet.width - 1);
  // Still a square page, nothing off screen.
  expect(Math.abs(sheet.width - sheet.height)).toBeLessThan(1);
  const viewport = page.viewportSize();
  for (const button of await page.locator('#draw-screen button').all()) {
    const rect = await button.boundingBox();
    if (!rect || !viewport) continue;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
    // DF-02: the layout's sides now run along the top and bottom of the screen, where the
    // iPadOS status bar blur (tablets) and the system swipes are: margins kept there.
    const margin = tablet ? 64 : 16;
    expect(rect.y).toBeGreaterThanOrEqual(margin);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - margin);
  }
  await page.screenshot({ path: test.info().outputPath('rotated.png') });
});

test('held the other way, icons stay upright', async ({ page }) => {
  await page.goto('en/');
  const rotation = await holdTheOtherWay(page);
  const iconTurn = await page
    .locator('#undo .icon')
    .evaluate((icon) => Number.parseFloat(getComputedStyle(icon).rotate));
  expect((((rotation + iconTurn) % 360) + 360) % 360).toBe(0);
});

test('held the other way, a stroke lands under the finger', async ({ page }) => {
  await page.goto('en/');
  await holdTheOtherWay(page);
  const sheet = await box(page, '#page');
  // A dot a quarter of the way in from the top-left of the page as seen on screen.
  const finger: [number, number] = [sheet.x + sheet.width * 0.25, sheet.y + sheet.height * 0.3];
  await drawStrokes(page, [{ points: [finger], pointerType: 'pen' }]);

  // Where the browser really shows the drawn dot: find it in the canvas, put a probe at
  // that spot inside the (turned) page and read the probe's position on screen.
  const shown = await page.locator('#drawing-layer').evaluate(async (element) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D context');
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if ((data[(y * width + x) * 4 + 3] ?? 0) > 128) {
          sumX += x;
          sumY += y;
          count += 1;
        }
      }
    }
    if (count === 0) return null;
    const cssPerBacking = canvas.offsetWidth / canvas.width;
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;width:0;height:0;left:${(sumX / count) * cssPerBacking}px;top:${(sumY / count) * cssPerBacking}px`;
    canvas.parentElement?.append(probe);
    const rect = probe.getBoundingClientRect();
    probe.remove();
    return [rect.x, rect.y];
  });
  expect(shown).not.toBeNull();
  expect(Math.abs((shown?.[0] ?? 0) - finger[0])).toBeLessThan(3);
  expect(Math.abs((shown?.[1] ?? 0) - finger[1])).toBeLessThan(3);
});
