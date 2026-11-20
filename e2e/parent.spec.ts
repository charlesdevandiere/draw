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

test('a tap or a short press on the padlock does not open the parent page', async ({ page }) => {
  await openGallery(page);
  await page.locator('#parent-lock').click();
  await press(page, '#parent-lock');
  await page.waitForTimeout(1500);
  await release(page, '#parent-lock');
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/\/en\/$/);
});

test('a 3-second press opens the parent page, which leads back', async ({ page }) => {
  await openGallery(page);
  await press(page, '#parent-lock');
  await page.waitForURL(/\/en\/parent\.html$/, { timeout: 6000 });
  await expect(page.getByRole('heading', { name: 'Parent space' })).toBeVisible();
  await expect(page.locator('#app-version')).toHaveText(/^Version /);
  await expect(page.locator('#storage-persisted')).toContainText('Drawings protected');
  await page.screenshot({ path: test.info().outputPath('parent.png'), fullPage: true });
  await page.getByRole('link', { name: 'Back to the sketchbook' }).click();
  await expect(page).toHaveURL(/\/en\/$/);
});

test('the language chosen in the parent page applies to the app', async ({ page }) => {
  await page.goto('en/parent.html');
  await page.locator('#language-select').selectOption('fr');
  await expect(page.getByRole('heading', { name: 'Espace parent' })).toBeVisible();
  await page.goto('en/');
  await expect(page.getByRole('button', { name: 'Mes dessins' })).toBeVisible();
  await page.goto('en/parent.html');
  await page.locator('#language-select').selectOption('');
  await expect(page.getByRole('heading', { name: 'Parent space' })).toBeVisible();
});
