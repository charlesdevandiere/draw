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
  /** Drawings waiting to be written, one per id: a failed save of a drawing left behind
   * (new page, reopened drawing) must not be dropped by changes to the next one. */
  const queue = new Map<string, Drawing>();
  /** Latest version of each drawing not yet written: an older version that fails while a
   * newer one is already on its way must not be queued again (it would overwrite it). */
  const latest = new Map<string, Drawing>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  function write(): Promise<void> {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const drawings = [...queue.values()];
    queue.clear();
    for (const drawing of drawings) {
      chain = chain
        .then(() => (drawing.strokes.length > 0 ? target.save(drawing) : target.remove(drawing.id)))
        .then(
          () => {
            if (latest.get(drawing.id) === drawing) latest.delete(drawing.id);
          },
          (error: unknown) => {
            // Keep the drawing pending (unless newer) so the next flush or change retries it.
            if (latest.get(drawing.id) === drawing && !queue.has(drawing.id)) {
              queue.set(drawing.id, drawing);
            }
            onError(error);
          },
        );
    }
    return chain;
  }

  return {
    changed(drawing) {
      // Re-inserted last: drawings are written in the order they last changed.
      queue.delete(drawing.id);
      queue.set(drawing.id, drawing);
      latest.set(drawing.id, drawing);
      timer ??= setTimeout(() => void write(), delayMs);
    },
    flush: write,
    pending: () => queue.size > 0,
  };
}
