import { describe, expect, it } from 'vitest';
import type { Drawing } from '../engine/types';
import { mergeImport } from './import-merge';

const drawing = (id: string): Drawing => ({ id, createdAt: 0, updatedAt: 0, strokes: [] });

describe('mergeImport', () => {
  it('adds new drawings, skips those already there, counts refused files', () => {
    const outcome = mergeImport(new Set(['a']), [
      { ok: true, drawing: drawing('a') },
      { ok: true, drawing: drawing('b') },
      { ok: false },
      { ok: true, drawing: drawing('c') },
    ]);
    expect(outcome.added.map((d) => d.id)).toEqual(['b', 'c']);
    expect(outcome.alreadyThere).toBe(1);
    expect(outcome.refused).toBe(1);
  });

  it('does not add the same drawing twice from one import', () => {
    const outcome = mergeImport(new Set(), [
      { ok: true, drawing: drawing('x') },
      { ok: true, drawing: drawing('x') },
    ]);
    expect(outcome.added).toHaveLength(1);
    expect(outcome.alreadyThere).toBe(1);
  });

  it('handles an empty import', () => {
    expect(mergeImport(new Set(['a']), [])).toEqual({
      added: [],
      restored: [],
      alreadyThere: 0,
      refused: 0,
    });
  });

  it('restores a drawing found in the trash instead of adding it (spec/SPEC-trash.md)', () => {
    const outcome = mergeImport(
      new Set(['a']),
      [
        { ok: true, drawing: drawing('t') },
        { ok: true, drawing: drawing('t') },
        { ok: true, drawing: drawing('n') },
      ],
      new Set(['t']),
    );
    expect(outcome.restored.map((d) => d.id)).toEqual(['t']);
    expect(outcome.added.map((d) => d.id)).toEqual(['n']);
    // The trashed one counts as already there, once per file.
    expect(outcome.alreadyThere).toBe(2);
  });
});
