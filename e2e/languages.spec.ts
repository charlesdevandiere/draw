import { expect, test } from '@playwright/test';

for (const [locale, folder, name] of [
  ['fr-FR', 'fr', 'Carnet magique'],
  ['en-US', 'en', 'Magic Sketchbook'],
  ['de-DE', 'en', 'Magic Sketchbook'],
] as const) {
  test.describe(`browser in ${locale}`, () => {
    test.use({ locale });

    test(`the root redirects to /${folder}/`, async ({ page }) => {
      await page.goto('./?from=test#here');
      await expect(page).toHaveURL(new RegExp(`/draw/${folder}/\\?from=test#here$`));
      await expect(page.locator('h1')).toHaveText(name);
      await expect(page).toHaveTitle(name);
    });

    test(`the old diagnostic URL redirects to /${folder}/diagnostic.html`, async ({ page }) => {
      await page.goto('diagnostic.html');
      await expect(page).toHaveURL(new RegExp(`/draw/${folder}/diagnostic\\.html$`));
    });
  });
}

for (const [folder, name, shortName] of [
  ['en', 'Magic Sketchbook', 'Sketchbook'],
  ['fr', 'Carnet magique', 'Carnet'],
] as const) {
  test(`/${folder}/ links its own manifest`, async ({ page, request }) => {
    await page.goto(`${folder}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', folder);
    const href = `/draw/${folder}/manifest.webmanifest`;
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', href);

    const manifest = await (await request.get(href)).json();
    expect(manifest).toMatchObject({
      name,
      short_name: shortName,
      lang: folder,
      start_url: `/draw/${folder}/`,
      scope: `/draw/${folder}/`,
      display: 'standalone',
    });
    for (const icon of manifest.icons as { src: string }[]) {
      const url = new URL(icon.src, new URL(href, page.url()));
      expect((await request.get(url.href)).ok(), url.href).toBe(true);
    }
  });
}
