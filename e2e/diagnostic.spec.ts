import { expect, test } from '@playwright/test';
import { canvasPixel, drawStrokes, line } from './helpers/pointer';

const PEN_BLUE = [0x1f, 0x5f, 0xd6];

function isColor(pixel: number[], rgb: number[]): boolean {
  const [alpha = 0] = pixel.slice(3);
  return alpha > 200 && rgb.every((value, i) => Math.abs((pixel[i] ?? 0) - value) < 40);
}

test.describe('diagnostic page in French', () => {
  test.use({ locale: 'fr-FR' });

  test('is translated', async ({ page }) => {
    await page.goto('fr/diagnostic.html');
    await expect(page.locator('#clear')).toHaveText('Effacer');
    await expect(page.locator('#check-update')).toHaveText('Rechercher une mise à jour');
    await expect(page.locator('#touch-state')).toContainText('Doigt : actif');
  });
});

test.describe('diagnostic page in English', () => {
  test.use({ locale: 'en-US' });

  test('is translated', async ({ page }) => {
    await page.goto('en/diagnostic.html');
    await expect(page.locator('#clear')).toHaveText('Clear');
    await expect(page.locator('#strategy option[value="pen-session"]')).toHaveText('Pen session');
    await expect(page.locator('#touch-state')).toContainText('Finger: active');
  });

  test('the panel header shows the contact size and the widest one', async ({ page }) => {
    await page.goto('en/diagnostic.html');
    await page.locator('#toggle-panel').click();
    const contact = page.locator('#contact-size');
    await expect(contact).toHaveText('Touch to measure the contact');
    await drawStrokes(page, [
      { points: line([40, 120], [120, 120]), pointerType: 'touch', width: 90 },
    ]);
    await drawStrokes(page, [
      { points: line([40, 200], [120, 200]), pointerType: 'touch', width: 20 },
    ]);
    await expect(contact).toContainText('Contact: 20 ×');
    await expect(contact).toContainText('(widest 90 px)');
    await page.locator('#clear').click();
    await expect(contact).toHaveText('Touch to measure the contact');
  });

  test('a pen stroke and a pen tap paint the canvas', async ({ page }) => {
    await page.goto('en/diagnostic.html');
    // Collapse the panel so it does not cover the canvas.
    await page.locator('#toggle-panel').click();
    const canvas = page.locator('#surface');

    await drawStrokes(page, [{ points: line([40, 120], [200, 120]), pointerType: 'pen' }]);
    expect(isColor(await canvasPixel(canvas, [120, 120]), PEN_BLUE)).toBe(true);

    await drawStrokes(page, [{ points: [[60, 220]], pointerType: 'pen' }]);
    expect(isColor(await canvasPixel(canvas, [60, 220]), PEN_BLUE)).toBe(true);
  });
});
