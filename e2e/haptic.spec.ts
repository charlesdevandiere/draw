import { expect, test, type Page } from '@playwright/test';

/**
 * Haptic tick (spec/SPEC-ui-foundation.md, "Haptic feedback"): `navigator.vibrate(8)`
 * where it exists, nothing elsewhere. The calls are recorded in sessionStorage,
 * which survives the move to the parent page.
 */
test.use({ locale: 'en-US' });

async function holdPadlock(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'My drawings' }).click();
  await page.locator('#parent-lock').dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    buttons: 1,
  });
  await page.waitForURL(/\/en\/parent\.html$/, { timeout: 6000 });
}

const recorded = (page: Page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('haptics') ?? '[]') as unknown[]);

test('opening the parent page ticks once through the vibration API', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: number) => {
        const calls = JSON.parse(sessionStorage.getItem('haptics') ?? '[]') as unknown[];
        sessionStorage.setItem('haptics', JSON.stringify([...calls, pattern]));
        return true;
      },
    });
  });
  await page.goto('en/');
  await holdPadlock(page);
  expect(await recorded(page)).toEqual([8]);
});

test('without the vibration API (Safari), nothing happens and the page opens', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
  });
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('en/');
  await holdPadlock(page);
  expect(await recorded(page)).toEqual([]);
  expect(errors).toEqual([]);
});
