import type { Locator, Page } from '@playwright/test';

/** A color cell (a `.btn-check` label around its radio), by the color's name. */
export function colorCell(scope: Page | Locator, name: string): Locator {
  // By attribute, not by role: the cells of the closed dialog are hidden from roles.
  return scope.locator(`label.color-cell:has(input[aria-label="${name}"])`);
}

/** Whether the window is a phone (no palette on screen: a pebble and its dialog). */
export function isPhone(page: Page): boolean {
  const viewport = page.viewportSize();
  return Math.min(viewport?.width ?? 0, viewport?.height ?? 0) < 576;
}

/** The palette on screen (tablets). */
export function visiblePalette(page: Page): Locator {
  return page.locator('.color-box:visible').first();
}

/** Picks a color: in the palette on tablets, through the "all colors" dialog on phones. */
export async function pickColor(page: Page, name: string, scope?: Locator): Promise<void> {
  if (scope) {
    await colorCell(scope, name).click();
    return;
  }
  if (isPhone(page)) {
    await page.getByRole('button', { name: 'All colors' }).click();
    const dialog = page.getByRole('dialog', { name: 'All colors' });
    await colorCell(dialog, name).click();
    // The dialog fades out; its backdrop covers the page until then.
    await dialog.waitFor({ state: 'hidden' });
    return;
  }
  await colorCell(visiblePalette(page), name).click();
}

/** The radio of a color (in the dialog on phones, even closed), to check its state. */
export function colorRadio(page: Page, name: string): Locator {
  const group = isPhone(page) ? page.locator('dialog.palette-dialog') : visiblePalette(page);
  return group.locator(`input[aria-label="${name}"]`);
}

/** Moves the size slider to a step (0–5). */
export async function setSize(page: Page, step: number): Promise<void> {
  await page.getByRole('slider', { name: 'Stroke size' }).fill(String(step));
}
