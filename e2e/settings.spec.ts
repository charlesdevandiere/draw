import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'en-US' });

async function press(page: Page, selector: string) {
  await page.locator(selector).dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    buttons: 1,
  });
}

async function release(page: Page, selector: string) {
  await page.locator(selector).dispatchEvent('pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    buttons: 0,
  });
}

async function openGallery(page: Page) {
  await page.goto('en/');
  await page.getByRole('button', { name: 'My drawings' }).click();
}

test('a tap or a short press on the settings pebble does not open the settings page', async ({
  page,
}) => {
  await openGallery(page);
  await page.locator('#open-settings').click();
  await press(page, '#open-settings');
  await page.waitForTimeout(700);
  await release(page, '#open-settings');
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/en\/$/);
});

test('while held, the settings pebble grows and fills from the bottom, without a ring', async ({
  page,
}) => {
  await openGallery(page);
  const settingsPebble = page.locator('#open-settings');
  await expect(settingsPebble).toHaveClass(/\blong-press\b/);
  await expect(settingsPebble.locator('svg')).toHaveCount(0);
  await press(page, '#open-settings');
  await expect(settingsPebble).toHaveAttribute('data-holding', '');
  await expect
    .poll(() => settingsPebble.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain('linear-gradient');
  // Grows over 0.2 s.
  await expect
    .poll(() => settingsPebble.evaluate((element) => getComputedStyle(element).scale))
    .toBe('1.12');
  // Released well before 1.5 s: a wait or a screenshot here could let the hold complete
  // and leave the page.
  await release(page, '#open-settings');
  await expect(settingsPebble).not.toHaveAttribute('data-holding', '');
});

test('a 1.5-second press opens the settings page, which leads back', async ({ page }) => {
  await openGallery(page);
  const pressed = Date.now();
  await press(page, '#open-settings');
  await page.waitForURL(/\/en\/settings\.html$/, { timeout: 4000 });
  expect(Date.now() - pressed).toBeGreaterThanOrEqual(1400);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('#app-version')).toHaveText(/^Version /);
  await expect(page.locator('#storage-persisted')).toContainText('Drawings protected');
  await page.screenshot({ path: test.info().outputPath('settings.png'), fullPage: true });
  // Back leads to the gallery, and the hash goes: a reload lands on the slate.
  await page.getByRole('link', { name: 'Back to my drawings' }).click();
  await expect(page.locator('#gallery-screen')).toBeVisible();
  await expect(page).toHaveURL(/\/en\/$/);
  await page.reload();
  await expect(page.locator('#draw-screen')).toBeVisible();
});

test('the old parent page address lands on the settings page', async ({ page }) => {
  await page.goto('en/parent.html');
  await page.waitForURL(/\/en\/settings\.html$/);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('the settings and diagnostic pages never stack up in the history', async ({ page }) => {
  // An edge swipe "back" from the sketchbook must not reach the settings page.
  await openGallery(page);
  const length = await page.evaluate(() => history.length);
  await press(page, '#open-settings');
  await page.waitForURL(/\/en\/settings\.html$/, { timeout: 4000 });
  await page.getByRole('link', { name: 'Diagnostic page' }).click();
  await page.waitForURL(/\/en\/diagnostic\.html$/);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForURL(/\/en\/settings\.html$/);
  await page.getByRole('link', { name: 'Back to my drawings' }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  expect(await page.evaluate(() => history.length)).toBe(length);
});

test('the language chosen in the settings page applies to the app', async ({ page }) => {
  await page.goto('en/settings.html');
  await page.locator('#language-select').selectOption('fr');
  await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible();
  await page.goto('en/');
  await expect(page.getByRole('button', { name: 'Mes dessins' })).toBeVisible();
  await page.goto('en/settings.html');
  await page.locator('#language-select').selectOption('');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});
