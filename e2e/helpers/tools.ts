import type { Locator, Page } from '@playwright/test';

/** A color cell (a `.btn-check` label around its radio), by the color's name. */
export function colorCell(scope: Page | Locator, name: string): Locator {
  const page = 'page' in scope && typeof scope.page === 'function' ? scope.page() : (scope as Page);
  // The inner locator is matched inside each label.
  return scope.locator('label.color-cell', {
    has: page.getByRole('radio', { name, exact: true }),
  });
}

/** Picks a color in the bar of 5 (or in `scope`, a dialog or the box). */
export async function pickColor(page: Page, name: string, scope?: Locator): Promise<void> {
  await colorCell(scope ?? page.locator('.color-bar'), name).click();
}

/** The radio of a color in the bar, to check its state. */
export function barColor(page: Page, name: string): Locator {
  return page.locator('.color-bar').getByRole('radio', { name, exact: true });
}

/** Names of the colors in the bar, in order. */
export async function barColors(page: Page): Promise<string[]> {
  return page
    .locator('.color-bar input')
    .evaluateAll((inputs) => inputs.map((input) => input.getAttribute('aria-label') ?? ''));
}

/** Moves the size slider to a step (0–5). */
export async function setSize(page: Page, step: number): Promise<void> {
  await page.getByRole('slider', { name: 'Stroke size' }).fill(String(step));
}
