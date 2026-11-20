/**
 * Silent autosave: changes are batched (one save per `delayMs` at most), saves never
 * overlap, and `flush` writes what is pending right away (app going to the background,
 * new page). A drawing left without strokes is removed instead of saved: empty drawings
 * never reach the gallery.
 */
import type { Drawing } from '../engine/types';

export interface AutosaveTarget {
  save(drawing: Drawing): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface Autosave {
  /** The drawing changed: save it soon. */
  changed(drawing: Drawing): void;
  /** Saves what is pending now; resolves once everything is written. */
  flush(): Promise<void>;
  /** Something is waiting to be written. */
  pending(): boolean;
}

export function createAutosave(
  target: AutosaveTarget,
  delayMs = 1000,
  onError: (error: unknown) => void = () => undefined,
): Autosave {
  let next: Drawing | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  function write(): Promise<void> {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const drawing = next;
    next = null;
    if (drawing) {
      chain = chain
        .then(() => (drawing.strokes.length > 0 ? target.save(drawing) : target.remove(drawing.id)))
        .catch((error: unknown) => {
          // Keep the drawing pending (unless newer) so the next flush or change retries it.
          next ??= drawing;
          onError(error);
        });
    }
    return chain;
  }

  return {
    changed(drawing) {
      next = drawing;
      timer ??= setTimeout(() => void write(), delayMs);
    },
    flush: write,
    pending: () => next !== null,
  };
}
