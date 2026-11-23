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

/** A setting stored in IndexedDB (undefined when absent). */
export async function storedSetting(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (key) =>
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
          const get = db.transaction('settings').objectStore('settings').get(key);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
        };
      }),
    key,
  );
}

/** The `lastDrawingId` setting: the drawing the app reopens at launch. */
export async function lastDrawingId(page: Page): Promise<unknown> {
  return storedSetting(page, 'lastDrawingId');
}

/** A drawing record as the app stores it, for seeding (thumbnail left to the gallery). */
export interface SeededDrawing {
  id: string;
  updatedAt: number;
  /** One horizontal line at this height of the page (0–1000). */
  lineAt: number;
  /** Epoch ms, or absent: outside the trash. */
  trashedAt?: number;
}

/**
 * Writes drawings and settings straight into IndexedDB before the app opens. Call it on a
 * page of the app's origin that does not run the app (the manifest), then load the app.
 */
export async function seedDatabase(
  page: Page,
  drawings: readonly SeededDrawing[],
  settings: Record<string, unknown> = {},
): Promise<void> {
  await page.goto('en/manifest.webmanifest');
  await page.evaluate(
    ({ drawings, settings }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('draw', 1);
        open.onupgradeneeded = () => {
          open.result.createObjectStore('drawings', { keyPath: 'id' });
          open.result.createObjectStore('settings');
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction(['drawings', 'settings'], 'readwrite');
          for (const drawing of drawings) {
            transaction.objectStore('drawings').put({
              schema: 1,
              id: drawing.id,
              createdAt: drawing.updatedAt,
              updatedAt: drawing.updatedAt,
              strokes: [
                {
                  tool: 'pen',
                  color: '#202020',
                  width: 8,
                  points: [100, drawing.lineAt, 0, 900, drawing.lineAt, 100],
                },
              ],
              thumbnail: null,
              ...(drawing.trashedAt === undefined ? {} : { trashedAt: drawing.trashedAt }),
            });
          }
          for (const [key, value] of Object.entries(settings)) {
            transaction.objectStore('settings').put(value, key);
          }
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    { drawings, settings },
  );
}
