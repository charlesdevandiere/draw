import { expect, test, type Page } from '@playwright/test';
import { pagePoint } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { clearDrawings, savedStrokeCounts, seedDatabase } from './helpers/storage';

test.use({ locale: 'en-US' });

/** Files produced by downloads in the page, as bytes. */
async function capturedFiles(page: Page): Promise<{ name: string; bytes: number[] }[]> {
  return page.evaluate(async () => {
    const files = (window as unknown as { captured: File[] }).captured;
    return Promise.all(
      files.map(async (file) => ({
        name: file.name,
        bytes: [...new Uint8Array(await file.arrayBuffer())],
      })),
    );
  });
}

/** Picks files in the import input (built in the page: no Node Buffer needed). */
async function importFiles(page: Page, files: { name: string; bytes: number[] }[]) {
  await page.evaluate((list) => {
    const input = document.getElementById('import-files') as HTMLInputElement;
    const transfer = new DataTransfer();
    for (const { name, bytes } of list) {
      transfer.items.add(new File([Uint8Array.from(bytes)], name, { type: 'image/png' }));
    }
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  }, files);
}

test('export the gallery, delete everything, import it back; a photo is refused', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const captured: File[] = [];
    (window as unknown as { captured: File[] }).captured = captured;
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof File) captured.push(object);
      return create(object);
    };
  });

  await page.goto('en/');
  for (const y of [0.3, 0.6]) {
    await drawStrokes(page, [
      {
        points: line(await pagePoint(page, 0.1, y), await pagePoint(page, 0.9, y)),
        pointerType: 'pen',
      },
    ]);
    await page.getByRole('button', { name: 'New page' }).click();
  }
  await expect.poll(async () => Object.keys(await savedStrokeCounts(page)).length).toBe(2);
  const before = await savedStrokeCounts(page);

  await page.goto('en/settings.html');
  await page.getByRole('button', { name: 'Export the drawings' }).click();
  await expect(page.locator('#transfer-status')).toHaveText('2 pictures ready.');
  await page.getByRole('button', { name: 'Share 2 pictures' }).click();
  await expect(page.locator('#transfer-status')).toHaveText('2 drawings exported.');
  const exported = await capturedFiles(page);
  expect(exported).toHaveLength(2);

  await expect(page.locator('#backup-summary')).toHaveText(/^2 drawings, 0\.1 MB\.$/);

  // Delete everything (straight in the database: no final delete in the settings).
  await clearDrawings(page);
  await page.reload();
  await expect(page.locator('#backup-summary')).toHaveText('No drawings yet.');

  // A plain picture made in the browser: not a sketchbook drawing.
  const photo = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return [...new Uint8Array(await (blob as Blob).arrayBuffer())];
  });

  await importFiles(page, [...exported, { name: 'photo.png', bytes: photo }]);
  await expect(page.locator('#transfer-status')).toHaveText(
    '2 drawings imported, 1 file refused (not a sketchbook drawing).',
  );
  expect(await savedStrokeCounts(page)).toEqual(before);

  // Importing again does not duplicate.
  await importFiles(page, exported);
  await expect(page.locator('#transfer-status')).toHaveText(
    'No drawing imported, 2 already there.',
  );

  // Back in the app, the drawings are in the gallery, with thumbnails.
  await page.getByRole('link', { name: 'Back to my drawings' }).click();
  // Back leads straight to the gallery.
  await expect(page.locator('#gallery-screen')).toBeVisible();
  await expect(page.locator('.gallery-card img')).toHaveCount(2);
});

test('export leaves the trash out; importing a trashed drawing restores it', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const captured: File[] = [];
    (window as unknown as { captured: File[] }).captured = captured;
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof File) captured.push(object);
      return create(object);
    };
  });
  const now = Date.now();
  await seedDatabase(page, [
    { id: 'kept', updatedAt: now - 2000, lineAt: 300 },
    { id: 'thrown', updatedAt: now - 1000, lineAt: 600 },
  ]);

  // Export both while they are in the gallery, to have the PNG of 'thrown'.
  await page.goto('en/settings.html');
  await page.getByRole('button', { name: 'Export the drawings' }).click();
  await page.getByRole('button', { name: 'Share 2 pictures' }).click();
  await expect(page.locator('#transfer-status')).toHaveText('2 drawings exported.');
  const both = await capturedFiles(page);

  // 'thrown' goes to the trash (no button yet: straight into the database).
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('draw');
        open.onsuccess = () => {
          const transaction = open.result.transaction('drawings', 'readwrite');
          const store = transaction.objectStore('drawings');
          const get = store.get('thrown');
          get.onsuccess = () => store.put({ ...get.result, trashedAt: Date.now() });
          transaction.oncomplete = () => {
            open.result.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );

  // Export now leaves it out.
  await page.reload();
  await page.getByRole('button', { name: 'Export the drawings' }).click();
  await expect(page.locator('#transfer-status')).toHaveText('1 picture ready.');

  // Importing its PNG brings it back, counted as already there.
  await importFiles(page, both);
  await expect(page.locator('#transfer-status')).toHaveText(
    'No drawing imported, 2 already there.',
  );
  await expect(page.locator('#backup-summary')).toHaveText(/^2 drawings, /);
  await page.getByRole('link', { name: 'Back to my drawings' }).click();
  // Back leads straight to the gallery.
  await expect(page.locator('#gallery-screen')).toBeVisible();
  await expect(page.locator('.gallery-card')).toHaveCount(2);
});
