/**
 * DOM side of the PWA update: an installed app on iOS rarely navigates, so the browser
 * seldom checks for a new service worker on its own. These helpers let the page ask.
 * The reload itself happens on `controllerchange` (see main.ts): the generated service
 * worker skips waiting and claims the page as soon as it is installed (autoUpdate).
 */

export type UpdateCheck = 'updating' | 'up-to-date' | 'no-service-worker';

/** Asks the browser to fetch sw.js again and reports whether a new version is installing. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration) return 'no-service-worker';
  await registration.update();
  return registration.installing || registration.waiting ? 'updating' : 'up-to-date';
}

/**
 * Last resort when the app stays stuck on an old version: unregisters every service
 * worker, empties the caches, then loads the page from the network. The query string
 * skips the HTTP cache (GitHub Pages sends max-age=600).
 */
export async function resetAppCache(beforeReload: () => void): Promise<void> {
  const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  beforeReload();
  window.location.replace(`${window.location.pathname}?refresh=${Date.now()}`);
}
