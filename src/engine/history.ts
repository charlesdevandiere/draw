import type { Stroke, TemplateStep } from './types';

/** One undoable entry: a finished stroke or a template step. */
export type HistoryEntry =
  | { readonly kind: 'stroke'; readonly stroke: Stroke }
  | { readonly kind: 'step'; readonly step: TemplateStep };

/**
 * Undo / redo over finished strokes and template steps. Immutable: every operation returns a
 * new value. Undo takes back the last entry, a stroke (eraser strokes included) or a template
 * step; redo puts it back; any new stroke or step clears what could be redone.
 */
export interface History {
  readonly strokes: readonly Stroke[];
  readonly templates: readonly TemplateStep[];
  /** Undone entries, the next one to redo last. */
  readonly redo: readonly HistoryEntry[];
}

export function createHistory(
  strokes: readonly Stroke[] = [],
  templates: readonly TemplateStep[] = [],
): History {
  return { strokes: [...strokes], templates: [...templates], redo: [] };
}

export function commitStroke(history: History, stroke: Stroke): History {
  return { ...history, strokes: [...history.strokes, stroke], redo: [] };
}

/** Adds a template step after the strokes drawn so far (its `at` is set here). */
export function commitStep(history: History, step: Omit<TemplateStep, 'at'>): History {
  const placed: TemplateStep = { ...step, at: history.strokes.length };
  return { ...history, templates: [...history.templates, placed], redo: [] };
}

/** The last step is the later entry when no stroke was drawn after it. */
function lastIsStep(history: History): boolean {
  const step = history.templates.at(-1);
  return step !== undefined && step.at >= history.strokes.length;
}

export function undo(history: History): History {
  if (lastIsStep(history)) {
    const step = history.templates.at(-1) as TemplateStep;
    return {
      ...history,
      templates: history.templates.slice(0, -1),
      redo: [...history.redo, { kind: 'step', step }],
    };
  }
  const stroke = history.strokes.at(-1);
  if (!stroke) return history;
  return {
    ...history,
    strokes: history.strokes.slice(0, -1),
    redo: [...history.redo, { kind: 'stroke', stroke }],
  };
}

export function redo(history: History): History {
  const next = history.redo.at(-1);
  if (!next) return history;
  const rest = history.redo.slice(0, -1);
  if (next.kind === 'stroke') {
    return { ...history, strokes: [...history.strokes, next.stroke], redo: rest };
  }
  const step: TemplateStep = { ...next.step, at: history.strokes.length };
  return { ...history, templates: [...history.templates, step], redo: rest };
}

export function canUndo(history: History): boolean {
  return history.strokes.length > 0 || history.templates.length > 0;
}

export function canRedo(history: History): boolean {
  return history.redo.length > 0;
}
