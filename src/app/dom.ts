/** Looks up an element of the app markup by id, checking its type. */
export function requireElement<T extends Element>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Element not found: #${id}`);
  return element;
}

/**
 * Links marked `data-replace` replace the current history entry instead of adding one.
 * The app, the settings page and the diagnostic page never stack up in the history, so the
 * edge swipe "back" (iOS, Android) never leads from the sketchbook to the settings page.
 *
 * DF-05: docs/device-fixes.md
 */
export function replaceHistoryOnLinks(root: ParentNode): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-replace]')) {
    link.addEventListener('click', (event) => {
      // Modified clicks (new tab, new window) keep their default behavior.
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      window.location.replace(link.href);
    });
  }
}
