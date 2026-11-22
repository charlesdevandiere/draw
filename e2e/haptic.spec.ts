import { expect, test, type Page } from '@playwright/test';

/**
 * Haptic tick (spec/SPEC-ui-foundation.md, "Haptic feedback"): `navigator.vibrate(8)`
 * where it exists, else the hidden iOS switch. The calls are recorded in sessionStorage,
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

test('the iOS switch is out of sight, out of reach and out of the accessibility tree', async ({
  page,
}) => {
  await page.goto('en/');
  const label = page.locator('.haptic-switch');
  await expect(label).toHaveCount(1);
  await expect(label).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const box = await label.boundingBox();
  expect((box?.width ?? 0) * (box?.height ?? 0)).toBeLessThanOrEqual(1);
  expect(await label.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');
  await expect(label.locator('input')).toHaveAttribute('tabindex', '-1');
});

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

test('without the vibration API, the tick toggles the switch', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
    document.addEventListener('change', (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      const calls = JSON.parse(sessionStorage.getItem('haptics') ?? '[]') as unknown[];
      sessionStorage.setItem('haptics', JSON.stringify([...calls, 'switch']));
    });
  });
  await page.goto('en/');
  await holdPadlock(page);
  expect(await recorded(page)).toEqual(['switch']);
});
