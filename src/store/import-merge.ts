/**
 * Import of magic PNGs (pure part): which decoded drawings to add. Merge by id: a drawing
 * already in the gallery, or twice in the same import, is not duplicated.
 */
import type { Drawing } from '../engine/types';

export interface ImportOutcome {
  /** Drawings to save. */
  added: Drawing[];
  /** Files whose drawing is already in the gallery (or earlier in this import). */
  alreadyThere: number;
  /** Files that are not valid magic PNGs. */
  refused: number;
}

export type Decoded = { ok: true; drawing: Drawing } | { ok: false };

export function mergeImport(
  existingIds: ReadonlySet<string>,
  decoded: readonly Decoded[],
): ImportOutcome {
  const seen = new Set(existingIds);
  const outcome: ImportOutcome = { added: [], alreadyThere: 0, refused: 0 };
  for (const entry of decoded) {
    if (!entry.ok) outcome.refused += 1;
    else if (seen.has(entry.drawing.id)) outcome.alreadyThere += 1;
    else {
      seen.add(entry.drawing.id);
      outcome.added.push(entry.drawing);
    }
  }
  return outcome;
}
