import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commitStep, commitStroke, createHistory, redo, undo } from './history';
import type { Stroke, TemplateLayer } from './types';

const stroke = (id: number): Stroke => ({
  tool: 'pen',
  color: '#000',
  width: 8,
  points: [id, id, id],
});
const eraser: Stroke = { tool: 'eraser', color: '#000', width: 48, points: [0, 0, 9] };

describe('history', () => {
  it('starts empty, or from the strokes of a reopened drawing', () => {
    expect(createHistory()).toEqual({ strokes: [], templates: [], redo: [] });
    const strokes = [stroke(1)];
    const history = createHistory(strokes);
    expect(history.strokes).toEqual(strokes);
    expect(history.strokes).not.toBe(strokes);
    expect(canUndo(history)).toBe(true);
  });

  it('undo removes the last stroke, eraser strokes included', () => {
    let history = commitStroke(commitStroke(createHistory(), stroke(1)), eraser);
    history = undo(history);
    expect(history.strokes).toEqual([stroke(1)]);
    expect(history.redo).toEqual([{ kind: 'stroke', stroke: eraser }]);
  });

  it('redo puts back the undone strokes in order', () => {
    let history = createHistory();
    for (const id of [1, 2, 3]) history = commitStroke(history, stroke(id));
    history = undo(undo(history));
    expect(history.strokes).toEqual([stroke(1)]);
    history = redo(history);
    expect(history.strokes).toEqual([stroke(1), stroke(2)]);
    history = redo(history);
    expect(history.strokes).toEqual([stroke(1), stroke(2), stroke(3)]);
    expect(canRedo(history)).toBe(false);
  });

  it('a new stroke clears what could be redone', () => {
    const history = commitStroke(undo(commitStroke(createHistory(), stroke(1))), stroke(2));
    expect(history).toEqual({ strokes: [stroke(2)], templates: [], redo: [] });
  });

  it('undo and redo on nothing change nothing', () => {
    const empty = createHistory();
    expect(undo(empty)).toBe(empty);
    expect(redo(empty)).toBe(empty);
    expect(canUndo(empty)).toBe(false);
  });

  it('10 undos then 10 redos give back the same drawing', () => {
    let history = createHistory();
    for (let id = 0; id < 10; id += 1) history = commitStroke(history, stroke(id));
    const full = history.strokes;
    for (let i = 0; i < 10; i += 1) history = undo(history);
    expect(history.strokes).toEqual([]);
    for (let i = 0; i < 10; i += 1) history = redo(history);
    expect(history.strokes).toEqual(full);
  });
});

const fish: TemplateLayer = {
  slot: 'overlay',
  template: 'coloring/fish',
  version: 1,
  params: {},
  svg: '<svg/>',
};
const addFish = { slot: 'overlay' as const, layer: fish, t: 10 };

describe('template steps', () => {
  it('places a step after the strokes drawn so far', () => {
    const history = commitStep(commitStroke(createHistory(), stroke(1)), addFish);
    expect(history.templates).toEqual([{ ...addFish, at: 1 }]);
    expect(canUndo(commitStep(createHistory(), addFish))).toBe(true);
  });

  it('undo takes back the later entry: the step after a stroke', () => {
    let history = commitStep(commitStroke(createHistory(), stroke(1)), addFish);
    history = undo(history);
    expect(history.templates).toEqual([]);
    expect(history.strokes).toHaveLength(1);
    history = undo(history);
    expect(history.strokes).toHaveLength(0);
  });

  it('undo takes back the stroke drawn after a step first', () => {
    let history = commitStroke(commitStep(createHistory(), addFish), stroke(1));
    history = undo(history);
    expect(history.strokes).toEqual([]);
    expect(history.templates).toHaveLength(1);
    history = undo(history);
    expect(history.templates).toEqual([]);
    expect(canUndo(history)).toBe(false);
  });

  it('redo puts strokes and steps back in order', () => {
    const full = commitStroke(
      commitStep(commitStroke(createHistory(), stroke(1)), addFish),
      stroke(2),
    );
    let history = undo(undo(undo(full)));
    expect(canUndo(history)).toBe(false);
    history = redo(redo(redo(history)));
    expect(history.strokes).toEqual(full.strokes);
    expect(history.templates).toEqual(full.templates);
    expect(canRedo(history)).toBe(false);
  });

  it('a new step clears what could be redone', () => {
    const history = commitStep(undo(commitStroke(createHistory(), stroke(1))), addFish);
    expect(canRedo(history)).toBe(false);
  });

  it('keeps steps loaded with a drawing', () => {
    const history = createHistory([stroke(1)], [{ ...addFish, at: 0 }]);
    expect(undo(history).strokes).toEqual([]);
    expect(undo(undo(history)).templates).toEqual([]);
  });
});
