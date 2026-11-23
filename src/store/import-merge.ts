/**
 * Import of magic PNGs (pure part): which decoded drawings to add. Merge by id: a drawing
 * already in the gallery, or twice in the same import, is not duplicated. A drawing in the
 * trash is restored to the gallery (spec/SPEC-trash.md), with its stored strokes.
 */
import type { Drawing } from '../engine/types';

export interface ImportOutcome {
  /** Drawings to save. */
  added: Drawing[];
  /** Drawings in the trash to bring back (counted in `alreadyThere`); saved if purged meanwhile. */
  restored: Drawing[];
  /** Files whose drawing is already in the gallery (or earlier in this import). */
  alreadyThere: number;
  /** Files that are not valid magic PNGs. */
  refused: number;
}

export type Decoded = { ok: true; drawing: Drawing } | { ok: false };

export function mergeImport(
  existingIds: ReadonlySet<string>,
  decoded: readonly Decoded[],
  trashedIds: ReadonlySet<string> = new Set(),
): ImportOutcome {
  const seen = new Set([...existingIds, ...trashedIds]);
  const outcome: ImportOutcome = { added: [], restored: [], alreadyThere: 0, refused: 0 };
  for (const entry of decoded) {
    if (!entry.ok) outcome.refused += 1;
    else if (seen.has(entry.drawing.id)) {
      outcome.alreadyThere += 1;
      const { id } = entry.drawing;
      if (trashedIds.has(id) && !outcome.restored.some((drawing) => drawing.id === id))
        outcome.restored.push(entry.drawing);
    } else {
      seen.add(entry.drawing.id);
      outcome.added.push(entry.drawing);
    }
  }
  return outcome;
}
