/**
 * Trash rules (spec/SPEC-trash.md), pure. A trashed drawing keeps its record, with a
 * `trashedAt` date (epoch ms) next to the drawing, like its thumbnail: the drawing format
 * and the magic PNG never carry it. It stays 30 days, restorable, then is purged.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a drawing stays in the trash. */
export const TRASH_RETENTION_MS = 30 * DAY_MS;

/** The trash date of a stored record: a finite number, else outside the trash. */
export function readTrashedAt(record: unknown): number | null {
  if (typeof record !== 'object' || record === null) return null;
  const value = (record as { trashedAt?: unknown }).trashedAt;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Milliseconds spent in the trash; a date in the future (clock moved back) counts as now. */
function elapsed(trashedAt: number, now: number): number {
  return Math.max(0, now - trashedAt);
}

/** Whether a drawing trashed at `trashedAt` is due for final deletion. */
export function isExpired(trashedAt: number | null, now: number): boolean {
  if (trashedAt === null || !Number.isFinite(trashedAt)) return false;
  return elapsed(trashedAt, now) >= TRASH_RETENTION_MS;
}

/**
 * Whole days left before final deletion, rounded up (30 on the first day, 0 once expired).
 * A non-finite date is never expired (`isExpired`), so it shows the full stay.
 */
export function daysLeft(trashedAt: number, now: number): number {
  if (!Number.isFinite(trashedAt)) return TRASH_RETENTION_MS / DAY_MS;
  const left = TRASH_RETENTION_MS - elapsed(trashedAt, now);
  return Math.max(0, Math.ceil(left / DAY_MS));
}

/** The trash, most recently trashed first (a new array). */
export function sortTrash<T extends { trashedAt: number }>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => b.trashedAt - a.trashedAt);
}

/**
 * The record a save writes: `next` with the trash date already stored. A save never moves
 * a drawing into or out of the trash (an autosave landing after a move to the trash).
 */
export function keepTrashState<T extends object>(
  stored: unknown,
  next: T,
): T & { trashedAt: number | null } {
  return { ...next, trashedAt: readTrashedAt(stored) };
}
