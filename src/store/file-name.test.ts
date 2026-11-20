import { describe, expect, it } from 'vitest';
import { drawingFileName } from './file-name';

describe('drawingFileName', () => {
  it('stamps the local date and time', () => {
    expect(drawingFileName('carnet-magique', new Date(2026, 10, 20, 9, 5, 7))).toBe(
      'carnet-magique-2026-11-20-090507.png',
    );
  });
});
