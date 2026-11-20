import { expect, test } from '@playwright/test';
import { isBlank, isColor, pagePoint, pixelAt } from './helpers/canvas';
import { drawStrokes, line } from './helpers/pointer';

const INK = [0x21, 0x21, 0x21];

test.use({ locale: 'en-US' });

test('a drawing replays stroke by stroke, eraser included, and can be stopped', async ({
  page,
}) => {
  await page.goto('en/');
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, 0.3), await pagePoint(page, 0.9, 0.3)),
      pointerType: 'pen',
    },
  ]);
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.1, 0.6), await pagePoint(page, 0.9, 0.6)),
      pointerType: 'pen',
    },
  ]);
  await page.getByRole('button', { name: 'Eraser' }).click();
  await drawStrokes(page, [
    {
      points: line(await pagePoint(page, 0.5, 0.5), await pagePoint(page, 0.5, 0.7)),
      pointerType: 'pen',
    },
  ]);

  await page.getByRole('button', { name: 'My drawings' }).click();
  await page.getByRole('button', { name: 'Watch this drawing again' }).click();
  await expect(page.locator('#replay-screen')).toBeVisible();

  const canvas = page.locator('#replay-layer');
  const again = page.getByRole('button', { name: 'Play again' });
  await expect(again).toBeVisible();
  expect(
    isColor(await pixelAt(canvas, await pagePoint(page, 0.3, 0.3, '#replay-layer')), INK),
  ).toBe(true);
  expect(
    isColor(await pixelAt(canvas, await pagePoint(page, 0.3, 0.6, '#replay-layer')), INK),
  ).toBe(true);
  // The eraser stroke was replayed too.
  expect(isBlank(await pixelAt(canvas, await pagePoint(page, 0.5, 0.6, '#replay-layer')))).toBe(
    true,
  );

  await again.click();
  await expect(again).toBeVisible();

  await page.locator('#replay-layer').click();
  await expect(page.locator('#gallery-screen')).toBeVisible();
});
