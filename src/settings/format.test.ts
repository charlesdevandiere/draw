import { describe, expect, it } from 'vitest';
import { createTranslator } from '../i18n/i18n';
import type { Drawing } from '../engine/types';
import { backupSummary, drawingBytes } from './format';

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
