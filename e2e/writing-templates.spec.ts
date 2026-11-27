import { expect, test, type Page } from '@playwright/test';
import { isColor, pagePixel, pagePoint } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';
import { pickColor, setSize } from './helpers/tools';

/** Writing templates (spec/SPEC-writing-templates.md): ruled paper and letters to trace. */
test.use({ locale: 'en-US' });
// Headless WebKit paints the large layers (1901 px at 3×) in software: near the default
// timeout alone, past it under load.
test.slow(({ browserName }) => browserName === 'webkit', 'Large layers painted in software');

const background = (page: Page) => page.locator('#background-layer');
const PHONE = { width: 375, height: 667 };
const TABLET = { width: 1180, height: 820 };

async function pick(page: Page, name: string | RegExp, tab?: string): Promise<void> {
  await page.getByRole('button', { name: 'Templates' }).click();
  const dialog = page.getByRole('dialog', { name: 'Templates' });
  if (tab) await dialog.getByRole('button', { name: tab, exact: true }).click();
  await dialog.getByRole('button', { name, exact: typeof name === 'string' }).click();
  await expect(dialog).toBeHidden();
}

/**
 * Spacing (CSS px) of the horizontal lines of the background, measured down a few columns
 * of the page (the one crossing the most lines: it misses the vertical ones).
 */
async function lineSpacing(page: Page): Promise<number> {
  return background(page).evaluate(async (element) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D context');
    let best: number[] = [];
    for (const fraction of [0.31, 0.37, 0.43, 0.53, 0.61]) {
      const x = Math.floor(canvas.width * fraction);
      const column = context.getImageData(x, 0, 1, canvas.height).data;
      const centers: number[] = [];
      let start = -1;
      for (let y = 0; y <= canvas.height; y += 1) {
        const ink = y < canvas.height && (column[y * 4 + 3] ?? 0) > 20;
        if (ink && start < 0) start = y;
        if (!ink && start >= 0) {
          centers.push((start + y - 1) / 2);
          start = -1;
        }
      }
      if (centers.length > best.length) best = centers;
    }
    const gaps = best.slice(1).map((y, i) => y - (best[i] ?? 0));
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)] ?? 0;
    return median / (canvas.width / canvas.getBoundingClientRect().width);
  });
}

/** A viewport point on a horizontal line of the background, just below (fx, fy) of the page. */
async function pointOnLine(page: Page, fx: number, fy: number): Promise<[number, number]> {
  const found = await background(page).evaluate(
    async (element, [fx, fy]) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No 2D context');
      const x = Math.floor(canvas.width * fx);
      const column = context.getImageData(x, 0, 1, canvas.height).data;
      let best = -1;
      for (let y = Math.floor(canvas.height * fy); y < canvas.height; y += 1) {
        const alpha = column[y * 4 + 3] ?? 0;
        if (alpha > 200) {
          best = y;
          break;
        }
      }
      const box = canvas.getBoundingClientRect();
      const scale = box.width / canvas.width;
      return [box.left + (x + 0.5) * scale, box.top + (best + 0.5) * scale];
    },
    [fx, fy] as const,
  );
  return found as [number, number];
}

/** The template layers saved with the drawing on the slate. */
async function savedBackground(page: Page): Promise<{ template: string; svg: string }> {
  return page.evaluate(
    () =>
      new Promise<{ template: string; svg: string }>((resolve, reject) => {
        const open = indexedDB.open('draw');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('drawings').objectStore('drawings').getAll();
          all.onsuccess = () => {
            open.result.close();
            const records = all.result as {
              updatedAt: number;
              templates: { layer: { template: string; svg: string } | null }[];
            }[];
            records.sort((a, b) => b.updatedAt - a.updatedAt);
            const layer = records[0]?.templates.at(-1)?.layer;
            resolve({ template: layer?.template ?? '', svg: layer?.svg ?? '' });
          };
        };
      }),
  );
}

test('small squares keep the same size in CSS pixels on a phone and a tablet', async ({ page }) => {
  for (const size of [PHONE, TABLET]) {
    await page.setViewportSize(size);
    await page.goto('en/');
    await pick(page, 'Small squares');
    await expect(background(page)).toHaveAttribute('data-template', 'lines/small-squares');
    // 5 mm at 55 CSS px per cm (polled: the layer paints after its image decodes).
    await expect
      .poll(async () => Math.abs((await lineSpacing(page)) - 27.5))
      .toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Undo' }).click();
    // Saved empty (so removed) before the next load, or it would reopen with its squares.
    await expect.poll(async () => (await savedBackground(page)).template).toBe('');
  }

  // Made on the tablet, then the window shrinks: the squares follow the page (frozen).
  await page.setViewportSize(TABLET);
  await page.goto('en/');
  await pick(page, 'Small squares');
  await expect.poll(() => lineSpacing(page)).toBeGreaterThan(0);
  const before = await lineSpacing(page);
  const pageBefore = (await page.locator('#page').boundingBox())?.width ?? 0;
  await page.setViewportSize(PHONE);
  await expect
    .poll(async () => (await page.locator('#page').boundingBox())?.width)
    .toBeLessThan(pageBefore);
  const pageAfter = (await page.locator('#page').boundingBox())?.width ?? 0;
  await expect.poll(() => lineSpacing(page)).toBeCloseTo((before * pageAfter) / pageBefore, 0);
});

test('a letter repeats along the rows; replacing lines by letters is one step', async ({
  page,
}) => {
  await page.goto('en/');
  await pick(page, 'French ruled paper');
  await expect(background(page)).toHaveAttribute('data-template', 'lines/seyes');
  await pick(page, 'Letter J to trace');
  await expect(background(page)).toHaveAttribute('data-template', 'letters/capitals');
  await expect
    .poll(async () => (await savedBackground(page)).svg.match(/<use /g)?.length ?? 0)
    .toBeGreaterThanOrEqual(4);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(background(page)).toHaveAttribute('data-template', 'lines/seyes');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(background(page)).toHaveAttribute('data-template', 'letters/capitals');

  // The panel opens on the set of the letter shown; a cursive letter and a digit.
  await pick(page, 'Letter f to trace', 'Cursive letters');
  await expect(background(page)).toHaveAttribute('data-template', 'letters/cursive');
  await pick(page, 'Digit 8 to trace', 'Digits');
  await expect(background(page)).toHaveAttribute('data-template', 'letters/digits');

  // Kept after a reload, generated once: the same SVG.
  await expect.poll(async () => (await savedBackground(page)).template).toBe('letters/digits');
  const { svg } = await savedBackground(page);
  await page.reload();
  await expect(background(page)).toHaveAttribute('data-template', 'letters/digits');
  expect((await savedBackground(page)).svg).toBe(svg);
});

test('white covers the lines, the eraser shows them again', async ({ page }) => {
  await page.goto('en/');
  await pick(page, 'Small squares');
  await expect(background(page)).toHaveAttribute('data-template', 'lines/small-squares');
  // A point on a grid line near the middle; thick strokes along that line.
  const onLine = await pointOnLine(page, 0.47, 0.5);
  const along = async () =>
    line(await pagePoint(page, 0.05, 0), await pagePoint(page, 0.95, 0)).map(
      ([x]) => [x, onLine[1]] as const,
    );
  const white = [255, 255, 255];
  expect(isColor(await pagePixel(page, onLine), white)).toBe(false);

  await pickColor(page, 'White');
  await setSize(page, 5);
  await drawStrokes(page, [{ points: await along(), pointerType: 'pen' }]);
  expect(isColor(await pagePixel(page, onLine), white)).toBe(true);

  await page.getByRole('button', { name: 'Eraser' }).click();
  await drawStrokes(page, [{ points: await along(), pointerType: 'pen' }]);
  expect(isColor(await pagePixel(page, onLine), white)).toBe(false);

  // A colored stroke lies above the lines.
  await pickColor(page, 'Red');
  await drawStrokes(page, [{ points: await along(), pointerType: 'pen' }]);
  expect(isColor(await pagePixel(page, onLine), [0xe5, 0x39, 0x35])).toBe(true);
});

test('the French panel names the writing templates', async ({ page }) => {
  await page.goto('fr/');
  await page.getByRole('button', { name: 'Modèles' }).click();
  await expect(page.getByRole('button', { name: 'Petits carreaux' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lettre A à tracer' })).toBeVisible();
  await page.getByRole('button', { name: 'Chiffres', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Chiffre 7 à tracer' })).toBeVisible();
});
