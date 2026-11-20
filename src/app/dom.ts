/** Looks up an element of the app markup by id, checking its type. */
export function requireElement<T extends Element>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Element not found: #${id}`);
  return element;
}
