import { expect, test } from '@playwright/test';
import { pagePoint } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';

test.use({ locale: 'fr-FR' });

test('the app and the diagnostic page open offline once cached', async ({ page, context }) => {
  await page.goto('fr/');
  const controlled = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    // `ready` never settles when registration fails: fail clearly rather than time out.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('The service worker never became ready')), 10_000),
    );
    await Promise.race([navigator.serviceWorker.ready, timeout]);
    return true;
  });
  test.skip(!controlled, 'No service worker support in this browser build');

  // The first visit installs the service worker; the reload is controlled by it.
  await page.reload();
  await context.setOffline(true);

  await page.reload();
  await expect(page.locator('h1')).toHaveText('Carnet magique');

  // Drawing and the gallery work without network.
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, 0.5), await pagePoint(page, 0.9, 0.5)),
      pointerType: 'pen',
    },
  ]);
  await page.getByRole('button', { name: 'Mes dessins' }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(1);

  await page.goto('fr/diagnostic.html');
  await expect(page.locator('#clear')).toHaveText('Effacer');
  // The other language folder is cached too.
  await page.goto('en/');
  await expect(page.locator('h1')).toHaveText('Magic Sketchbook');
});
