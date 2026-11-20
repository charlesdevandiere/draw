import type { Page } from '@playwright/test';

/** Stroke counts of the drawings saved in IndexedDB (database `draw`), by id. */
export async function savedStrokeCounts(page: Page): Promise<Record<string, number>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, number>>((resolve, reject) => {
        const open = indexedDB.open('draw');
        // No database yet: do not create an empty one, the app would then never get its stores.
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => resolve({});
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('drawings')) {
            db.close();
            resolve({});
            return;
          }
          const all = db.transaction('drawings').objectStore('drawings').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            db.close();
            const counts: Record<string, number> = {};
            for (const record of all.result as { id: string; strokes: unknown[] }[]) {
              counts[record.id] = record.strokes.length;
            }
            resolve(counts);
          };
        };
      }),
  );
}

/** Total strokes saved, across all drawings. */
export async function savedStrokes(page: Page): Promise<number> {
  return Object.values(await savedStrokeCounts(page)).reduce((sum, count) => sum + count, 0);
}

/** The `lastDrawingId` setting: the drawing the app reopens at launch. */
export async function lastDrawingId(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('draw');
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => resolve(undefined);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('settings')) {
            db.close();
            resolve(undefined);
            return;
          }
          const get = db.transaction('settings').objectStore('settings').get('lastDrawingId');
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
        };
      }),
  );
}
