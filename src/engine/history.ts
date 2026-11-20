import type { Stroke } from './types';

/**
 * Undo / redo over finished strokes. Immutable: every operation returns a new value.
 * Undo takes back the last stroke (eraser strokes included), redo puts it back; any new
 * stroke clears what could be redone.
 */
export interface History {
  readonly strokes: readonly Stroke[];
  /** Undone strokes, the next one to redo last. */
  readonly redo: readonly Stroke[];
}

export function createHistory(strokes: readonly Stroke[] = []): History {
  return { strokes: [...strokes], redo: [] };
}

export function commitStroke(history: History, stroke: Stroke): History {
  return { strokes: [...history.strokes, stroke], redo: [] };
}

export function undo(history: History): History {
  const last = history.strokes.at(-1);
  if (!last) return history;
  return { strokes: history.strokes.slice(0, -1), redo: [...history.redo, last] };
}

export function redo(history: History): History {
  const next = history.redo.at(-1);
  if (!next) return history;
  return { strokes: [...history.strokes, next], redo: history.redo.slice(0, -1) };
}

export function canUndo(history: History): boolean {
  return history.strokes.length > 0;
}

export function canRedo(history: History): boolean {
  return history.redo.length > 0;
}
