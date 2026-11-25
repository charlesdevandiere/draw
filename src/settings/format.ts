/**
 * Settings page texts computed from the stored drawings (pure, spec/SPEC-settings.md).
 */
import type { Drawing } from '../engine/types';
import type { Translator } from '../i18n/i18n';

const MEGABYTE = 1_048_576;

/** Approximate stored size of a drawing: its vectors as JSON, plus its thumbnail. */
export function drawingBytes(drawing: Drawing, thumbnailBytes: number): number {
  return JSON.stringify(drawing).length + thumbnailBytes;
}

/** "12 drawings, 1.4 MB." (at least 0.1 MB as soon as there is a drawing). */
export function backupSummary(translator: Translator, count: number, bytes: number): string {
  if (count === 0) return translator.t('settings.backup.none');
  const size = new Intl.NumberFormat(translator.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.max(0.1, Math.round((bytes / MEGABYTE) * 10) / 10));
  return translator.t('settings.backup.summary', { count, size });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of the day of `time`. */
function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * "yesterday", "6 days ago": calendar days (local time) since the move to the trash, never
 * in the future. Thrown away last night, it says "yesterday" in the morning.
 */
export function trashedAgo(language: string, trashedAt: number, now: number): string {
  // Rounded: a day across a daylight saving change lasts 23 or 25 hours.
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(trashedAt)) / DAY_MS));
  return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-days, 'day');
}

/** "Deleted yesterday", "Deleted 6 days ago". */
export function trashedWhen(translator: Translator, trashedAt: number, now: number): string {
  return translator.t('settings.trash.when', {
    when: trashedAgo(translator.language, trashedAt, now),
  });
}

/** "3 drawings: they are deleted for good 30 days after being thrown away." */
export function trashSummary(translator: Translator, count: number): string {
  return translator.t('settings.trash.summary', { count });
}
