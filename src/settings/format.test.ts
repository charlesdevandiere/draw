import { describe, expect, it } from 'vitest';
import { createTranslator } from '../i18n/i18n';
import type { Drawing } from '../engine/types';
import { backupSummary, drawingBytes, trashedWhen, trashSummary } from './format';

const drawing = (points: number): Drawing => ({
  id: 'a',
  createdAt: 0,
  updatedAt: 0,
  strokes: [
    {
      tool: 'pen',
      color: '#212121',
      width: 8,
      points: Array.from({ length: points * 3 }, (_, i) => i),
    },
  ],
});

describe('drawingBytes', () => {
  it('counts the stored drawing and its thumbnail', () => {
    const small = drawingBytes(drawing(1), 0);
    expect(small).toBeGreaterThan(0);
    expect(drawingBytes(drawing(1), 2000)).toBe(small + 2000);
    expect(drawingBytes(drawing(100), 0)).toBeGreaterThan(small);
  });
});

describe('backupSummary', () => {
  const en = createTranslator('en');
  const fr = createTranslator('fr');

  it('says how many drawings and their size, in MB with one decimal', () => {
    expect(backupSummary(en, 12, 1.4 * 1_048_576)).toBe('12 drawings, 1.4 MB.');
    expect(backupSummary(fr, 12, 1.4 * 1_048_576)).toBe('12 dessins, 1,4 Mo.');
  });

  it('uses the singular and never says 0.0 for a small drawing', () => {
    expect(backupSummary(en, 1, 2000)).toBe('1 drawing, 0.1 MB.');
    expect(backupSummary(fr, 1, 2000)).toBe('1 dessin, 0,1 Mo.');
  });

  it('says when there is nothing to back up', () => {
    expect(backupSummary(en, 0, 0)).toBe('No drawings yet.');
    expect(backupSummary(fr, 0, 0)).toBe("Aucun dessin pour l'instant.");
  });
});

describe('trashedWhen', () => {
  const en = createTranslator('en');
  const fr = createTranslator('fr');
  const DAY = 24 * 60 * 60 * 1000;
  // Local noon: the days are calendar days in local time.
  const now = new Date(2026, 10, 25, 12).getTime();

  it('says how long ago a drawing went to the trash, in whole days', () => {
    expect(trashedWhen(en, now - 1000, now)).toBe('Deleted today');
    expect(trashedWhen(en, now - DAY - 1000, now)).toBe('Deleted yesterday');
    expect(trashedWhen(en, now - 6 * DAY - 1000, now)).toBe('Deleted 6 days ago');
    expect(trashedWhen(fr, now - 1000, now)).toBe('Supprimé aujourd’hui');
    expect(trashedWhen(fr, now - DAY, now)).toBe('Supprimé hier');
    expect(trashedWhen(fr, now - 24 * DAY, now)).toBe('Supprimé il y a 24 jours');
  });

  it('counts calendar days: last night is yesterday in the morning', () => {
    const lastNight = new Date(2026, 10, 24, 23).getTime();
    const morning = new Date(2026, 10, 25, 9).getTime();
    expect(trashedWhen(en, lastNight, morning)).toBe('Deleted yesterday');
    expect(trashedWhen(en, new Date(2026, 10, 25, 1).getTime(), morning)).toBe('Deleted today');
  });

  it('a date in the future (clock moved back) counts as today', () => {
    expect(trashedWhen(en, now + 5 * DAY, now)).toBe('Deleted today');
  });
});

describe('trashSummary', () => {
  it('counts the drawings in the trash', () => {
    expect(trashSummary(createTranslator('en'), 0)).toBe('The trash is empty.');
    expect(trashSummary(createTranslator('en'), 1)).toBe(
      '1 drawing: it is deleted for good 30 days after being thrown away.',
    );
    expect(trashSummary(createTranslator('fr'), 3)).toBe(
      '3 dessins : ils sont effacés pour de bon 30 jours après leur suppression.',
    );
  });
});
