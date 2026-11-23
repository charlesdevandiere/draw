import type { Locator, Page } from '@playwright/test';

/** A color cell (a `.btn-check` label around its radio), by the color's name. */
export function colorCell(scope: Page | Locator, name: string): Locator {
  const page = 'page' in scope && typeof scope.page === 'function' ? scope.page() : (scope as Page);
  // The inner locator is matched inside each label.
  return scope.locator('label.color-cell', {
    has: page.getByRole('radio', { name, exact: true }),
  });
}

/** The colors on screen: the bar of 5 on phones, the full box on tablets. */
export function visiblePalette(page: Page): Locator {
  return page.locator('.color-bar:visible, .color-box:visible').first();
}

/** Picks a color on screen (or in `scope`, the dialog). */
export async function pickColor(page: Page, name: string, scope?: Locator): Promise<void> {
  await colorCell(scope ?? visiblePalette(page), name).click();
}

/** The radio of a color on screen (bar or box), to check its state. */
export function barColor(page: Page, name: string): Locator {
  return visiblePalette(page).getByRole('radio', { name, exact: true });
}

/** Whether the window is a phone (no full box: the bar of 5). */
export function isPhone(page: Page): boolean {
  const viewport = page.viewportSize();
  return Math.min(viewport?.width ?? 0, viewport?.height ?? 0) < 576;
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
