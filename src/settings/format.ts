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
