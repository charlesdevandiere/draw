/**
 * IndexedDB access (DOM). Database `draw`: the origin charlesdevandiere.github.io is shared
 * with the account's other GitHub Pages projects, so the name says whose data it is.
 * Stores: `drawings` (key `id`) and `settings` (free keys). Everything read back from
 * `drawings` is validated by `parseDrawing`. A drawing record also holds its gallery
 * thumbnail and, in the trash, its `trashedAt` date (spec/SPEC-trash.md, src/store/trash.ts):
 * both sit next to the drawing, never inside its format.
 */
import type { Drawing } from '../engine/types';
import { parseDrawing, toStored } from './schema';
import { isExpired, keepTrashState, readTrashedAt, sortTrash } from './trash';

const DB_NAME = 'draw';
const DB_VERSION = 1;
const DRAWINGS = 'drawings';
const SETTINGS = 'settings';

/** A stored drawing with its gallery thumbnail (absent until the first save with one). */
export interface DrawingRecord {
  drawing: Drawing;
  thumbnail: Blob | null;
  /** When it was moved to the trash (epoch ms), or null outside the trash. */
  trashedAt: number | null;
}

/** A drawing in the trash. */
export type TrashedRecord = DrawingRecord & { trashedAt: number };

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB aborted'));
  });
}

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRAWINGS))
        db.createObjectStore(DRAWINGS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
    };
    req.onsuccess = () => {
      const db = req.result;
      // A connection closed by the browser (iOS drops it in the background) or by a newer
      // version opened elsewhere must not stay cached: the next call reopens.
      db.onclose = () => {
        if (opening === pending) opening = null;
      };
      db.onversionchange = () => {
        db.close();
        if (opening === pending) opening = null;
      };
      resolve(db);
    };
    // Another connection holds an older version open: fail rather than wait forever.
    req.onblocked = () => {
      if (opening === pending) opening = null;
      reject(new Error('IndexedDB upgrade blocked by another tab'));
    };
    req.onerror = () => {
      if (opening === pending) opening = null;
      reject(req.error ?? new Error('Cannot open IndexedDB'));
    };
  });
  opening = pending;
  return pending;
}

/**
 * Runs `work` on the database, reopening it once if the cached connection turned out to be
 * closed without notice (InvalidStateError; some iOS versions never fire `close`).
 */
async function withDb<T>(work: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await open();
  try {
    return await work(db);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'InvalidStateError')) throw error;
    opening = null;
    return work(await open());
  }
}

/**
 * Thumbnails are stored as raw PNG bytes, not as Blob: Blobs in IndexedDB fail in some
 * WebKit builds and have a troubled history on iOS.
 */
function toRecord(value: unknown): DrawingRecord | null {
  try {
    const bytes =
      typeof value === 'object' && value !== null && 'thumbnail' in value
        ? (value as { thumbnail: unknown }).thumbnail
        : null;
    return {
      drawing: parseDrawing(value),
      thumbnail: bytes instanceof ArrayBuffer ? new Blob([bytes], { type: 'image/png' }) : null,
      trashedAt: readTrashedAt(value),
    };
  } catch {
    // A corrupt record is skipped rather than breaking the whole gallery.
    return null;
  }
}

export async function saveDrawing(drawing: Drawing, thumbnail: Blob | null): Promise<void> {
  // Read the bytes before opening the transaction: it must not wait on other promises.
  const bytes = thumbnail ? await thumbnail.arrayBuffer() : null;
  return withDb((db) => {
    const transaction = db.transaction(DRAWINGS, 'readwrite');
    const store = transaction.objectStore(DRAWINGS);
    // Read and write in one transaction: a save never takes a drawing out of the trash
    // (an autosave of the drawing being left lands after its move to the trash).
    const existing = store.get(drawing.id);
    existing.onsuccess = () => {
      store.put(keepTrashState(existing.result, { ...toStored(drawing), thumbnail: bytes }));
    };
    return done(transaction);
  });
}

/** Sets or clears the trash date of a stored drawing, leaving the rest of its record as is. */
function setTrashedAt(id: string, trashedAt: number | null): Promise<void> {
  return withDb((db) => {
    const transaction = db.transaction(DRAWINGS, 'readwrite');
    const store = transaction.objectStore(DRAWINGS);
    const existing = store.get(id);
    existing.onsuccess = () => {
      const value: unknown = existing.result;
      if (typeof value === 'object' && value !== null) store.put({ ...value, trashedAt });
    };
    return done(transaction);
  });
}

/** Moves a drawing to the trash: it leaves the gallery, restorable for 30 days. */
export function moveToTrash(id: string, now: number): Promise<void> {
  return setTrashedAt(id, now);
}

/** Brings a drawing back from the trash to the gallery. */
export function restoreFromTrash(id: string): Promise<void> {
  return setTrashedAt(id, null);
}

/** Deletes for good every stored drawing whose raw record matches. */
function deleteWhere(matches: (value: unknown) => boolean): Promise<void> {
  return withDb((db) => {
    const transaction = db.transaction(DRAWINGS, 'readwrite');
    const cursor = transaction.objectStore(DRAWINGS).openCursor();
    cursor.onsuccess = () => {
      const position = cursor.result;
      if (!position) return;
      if (matches(position.value)) position.delete();
      position.continue();
    };
    return done(transaction);
  });
}

/** Deletes for good every drawing in the trash. */
export function emptyTrash(): Promise<void> {
  return deleteWhere((value) => readTrashedAt(value) !== null);
}

/** Deletes for good the drawings trashed 30 days ago or more (run at each start). */
export function purgeTrash(now: number): Promise<void> {
  return deleteWhere((value) => isExpired(readTrashedAt(value), now));
}

export async function loadDrawing(id: string): Promise<DrawingRecord | null> {
  const value: unknown = await withDb((db) =>
    request(db.transaction(DRAWINGS).objectStore(DRAWINGS).get(id)),
  );
  return value === undefined ? null : toRecord(value);
}

async function listRecords(): Promise<DrawingRecord[]> {
  const values: unknown[] = await withDb((db) =>
    request(db.transaction(DRAWINGS).objectStore(DRAWINGS).getAll()),
  );
  return values.map(toRecord).filter((record): record is DrawingRecord => record !== null);
}

/** Every valid drawing outside the trash, most recently modified first. */
export async function listDrawings(): Promise<DrawingRecord[]> {
  return (await listRecords())
    .filter((record) => record.trashedAt === null)
    .sort((a, b) => b.drawing.updatedAt - a.drawing.updatedAt);
}

/** Every valid drawing in the trash, most recently trashed first. */
export async function listTrash(): Promise<TrashedRecord[]> {
  return sortTrash(
    (await listRecords()).filter((record): record is TrashedRecord => record.trashedAt !== null),
  );
}

export function deleteDrawing(id: string): Promise<void> {
  return withDb((db) => {
    const transaction = db.transaction(DRAWINGS, 'readwrite');
    transaction.objectStore(DRAWINGS).delete(id);
    return done(transaction);
  });
}

export function readSetting(key: string): Promise<unknown> {
  return withDb((db) => request(db.transaction(SETTINGS).objectStore(SETTINGS).get(key)));
}

export function writeSetting(key: string, value: unknown): Promise<void> {
  return withDb((db) => {
    const transaction = db.transaction(SETTINGS, 'readwrite');
    transaction.objectStore(SETTINGS).put(value, key);
    return done(transaction);
  });
}
