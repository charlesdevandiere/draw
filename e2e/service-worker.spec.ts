import { expect, test } from '@playwright/test';

/**
 * Chrome Android never closes an installed app's page, so a new service worker left
 * "waiting" never activates: it must skip waiting and claim the pages by itself (the
 * pages reload on `controllerchange`). vite-plugin-pwa 2 otherwise waits for a
 * SKIP_WAITING message that nothing sends.
 */
test('the service worker activates a new version without waiting', async ({ request }) => {
  const response = await request.get('sw.js');
  expect(response.ok()).toBe(true);
  const source = await response.text();
  expect(source).toContain('skipWaiting()');
  expect(source).toContain('clientsClaim()');
  expect(source).not.toContain('SKIP_WAITING');
});
