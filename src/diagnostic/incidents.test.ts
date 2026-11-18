import { describe, expect, it } from 'vitest';
import { createIncidentCounter } from './incidents';

describe('createIncidentCounter', () => {
  it('starts with no incidents in either protection state', () => {
    const counter = createIncidentCounter();

    expect(counter.snapshot()).toEqual({ protectionsOn: {}, protectionsOff: {} });
  });

  it('counts incidents under the protection state active when they happened', () => {
    const counter = createIncidentCounter();
    counter.record('contextmenu', true);
    counter.record('contextmenu', true);
    counter.record('contextmenu', false);

    expect(counter.snapshot()).toEqual({
      protectionsOn: { contextmenu: 2 },
      protectionsOff: { contextmenu: 1 },
    });
  });

  it('keeps one counter per incident kind', () => {
    const counter = createIncidentCounter();
    counter.record('pointercancel:pen', true);
    counter.record('pointercancel:touch', true);
    counter.record('pointercancel:touch', true);

    expect(counter.snapshot().protectionsOn).toEqual({
      'pointercancel:pen': 1,
      'pointercancel:touch': 2,
    });
  });

  it('totals the incidents of one protection state', () => {
    const counter = createIncidentCounter();
    counter.record('touchcancel', false);
    counter.record('scroll', false);
    counter.record('scroll', true);

    expect(counter.total(false)).toBe(2);
    expect(counter.total(true)).toBe(1);
  });

  it('returns snapshots that later records do not mutate', () => {
    const counter = createIncidentCounter();
    counter.record('scroll', true);
    const snapshot = counter.snapshot();
    counter.record('scroll', true);

    expect(snapshot.protectionsOn).toEqual({ scroll: 1 });
  });

  it('can be reset', () => {
    const counter = createIncidentCounter();
    counter.record('scroll', true);
    counter.reset();

    expect(counter.snapshot()).toEqual({ protectionsOn: {}, protectionsOff: {} });
  });
});
