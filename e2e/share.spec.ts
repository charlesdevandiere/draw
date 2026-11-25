import { expect, test } from '@playwright/test';
import { MAGIC_KEYWORD, readItxt } from '../src/store/png-chunk';
import { parseDrawing } from '../src/store/schema';
import { pagePoint } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';

test.use({ locale: 'fr-FR' });

test('sharing a drawing gives a PNG that carries the vector drawing', async ({ page }) => {
  await page.addInitScript(() => {
    // No native share sheet in the test browsers: force the download fallback, and keep
    // the downloaded file so the test can read it.
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob) (window as unknown as { lastBlob: Blob }).lastBlob = object;
      return create(object);
    };
  });
  await page.goto('fr/');
  for (const y of [0.3, 0.6]) {
    await drawStrokes(page, [
      {
        points: line(await pagePoint(page, 0.1, y), await pagePoint(page, 0.9, y)),
        pointerType: 'pen',
      },
    ]);
  }
  await page.getByRole('button', { name: 'Mes dessins' }).click();
  await page.getByRole('button', { name: /Ouvrir le dessin/ }).click();

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Partager ce dessin' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^carnet-magique-\d{4}-\d{2}-\d{2}-\d{6}\.png$/);

  const bytes = await page.evaluate(async () => {
    const blob = (window as unknown as { lastBlob: Blob }).lastBlob;
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  const chunk = readItxt(Uint8Array.from(bytes), MAGIC_KEYWORD, 20 * 1024 * 1024);
  if (!chunk) throw new Error('No magic chunk');
  const json = await page.evaluate(
    async ({ payload, compressed }) => {
      const data = new Blob([Uint8Array.from(payload)]).stream();
      const stream = compressed ? data.pipeThrough(new DecompressionStream('deflate')) : data;
      return new Response(stream).text();
    },
    { payload: [...chunk.payload], compressed: chunk.compressed },
  );
  const drawing = parseDrawing(JSON.parse(json));
  expect(drawing.strokes).toHaveLength(2);
  expect(drawing.strokes[0]?.tool).toBe('pen');
});
