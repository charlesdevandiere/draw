import { describe, expect, it } from 'vitest';
import type { Drawing } from '../engine/types';
import {
  DrawingFormatError,
  LIMITS,
  MIGRATIONS,
  SCHEMA_VERSION,
  newDrawing,
  parseDrawing,
  toStored,
} from './schema';

const drawing: Drawing = {
  id: 'abc',
  createdAt: 1000,
  updatedAt: 2000,
  templates: [],
  strokes: [
    { tool: 'pen', color: '#e53935', width: 8, points: [1, 2, 0, 3, 4, 16] },
    { tool: 'eraser', color: '#212121', width: 48, points: [5, 5, 40] },
  ],
};

function stored(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...toStored(drawing), ...overrides };
}

function strokeWith(overrides: Record<string, unknown>) {
  return stored({ strokes: [{ ...drawing.strokes[0], ...overrides }] });
}

describe('round trip', () => {
  it('stores the current schema version and reads the same drawing back', () => {
    const value = toStored(drawing);
    expect(value.schema).toBe(SCHEMA_VERSION);
    expect(parseDrawing(JSON.parse(JSON.stringify(value)))).toEqual(drawing);
  });

  it('copies the points instead of sharing them', () => {
    const value = toStored(drawing);
    expect(value.strokes[0]?.points).not.toBe(drawing.strokes[0]?.points);
  });

  it('creates an empty drawing', () => {
    expect(newDrawing('x', 5)).toEqual({
      id: 'x',
      createdAt: 5,
      updatedAt: 5,
      strokes: [],
      templates: [],
    });
  });
});

describe('validation', () => {
  it.each([
    ['not an object', 'nope'],
    ['an array', []],
    ['no schema', stored({ schema: undefined })],
    ['a fractional schema', stored({ schema: 1.5 })],
    ['an unknown schema', stored({ schema: 99 })],
    ['an empty id', stored({ id: '' })],
    ['a too long id', stored({ id: 'x'.repeat(LIMITS.idLength + 1) })],
    ['bad dates', stored({ createdAt: 'yesterday' })],
    ['no strokes', stored({ strokes: undefined })],
    ['a stroke that is not an object', stored({ strokes: [42] })],
    ['an unknown tool', strokeWith({ tool: 'brush' })],
    ['a bad color', strokeWith({ color: 'red' })],
    ['a script as color', strokeWith({ color: '#fff;background:url(x)' })],
    ['a zero width', strokeWith({ width: 0 })],
    ['a huge width', strokeWith({ width: LIMITS.maxWidth + 1 })],
    ['empty points', strokeWith({ points: [] })],
    ['points not in triplets', strokeWith({ points: [1, 2] })],
    ['a non-numeric point', strokeWith({ points: [1, 'x', 0] })],
    ['an infinite point', strokeWith({ points: [1, Infinity, 0] })],
  ])('refuses %s', (_label, value) => {
    expect(() => parseDrawing(value)).toThrow(DrawingFormatError);
  });

  it('refuses too many strokes or points', () => {
    const limits = { ...LIMITS, strokes: 1, numbers: 6 };
    expect(() => parseDrawing(toStored(drawing), { limits })).toThrow(/too many strokes/);
    expect(() =>
      parseDrawing(stored({ strokes: [drawing.strokes[0], drawing.strokes[0]] }), {
        limits: { ...LIMITS, numbers: 6 },
      }),
    ).toThrow(/too many points/);
  });

  it('drops unknown fields', () => {
    const parsed = parseDrawing(
      stored({ extra: true, strokes: [{ ...drawing.strokes[0], x: 1 }] }),
    );
    expect(parsed).toEqual({ ...drawing, strokes: [drawing.strokes[0]] });
  });
});

describe('migrations', () => {
  it('upgrades older versions step by step', () => {
    const migrations = {
      ...MIGRATIONS,
      0: (value: Record<string, unknown>) => ({ ...value, schema: 1, strokes: value['lines'] }),
    };
    const old = { ...stored(), schema: 0, strokes: undefined, lines: drawing.strokes };
    expect(parseDrawing(old, { migrations })).toEqual(drawing);
  });

  it('refuses a migration that does not move forward', () => {
    const old = { ...stored(), schema: 0 };
    const stuck = { 0: (value: Record<string, unknown>) => ({ ...value, schema: 0 }) };
    expect(() => parseDrawing(old, { migrations: stuck })).toThrow(DrawingFormatError);
    const broken = { 0: () => null as unknown as Record<string, unknown> };
    expect(() => parseDrawing(old, { migrations: broken })).toThrow(DrawingFormatError);
  });
});

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="M0 0L9 9"/></svg>';
const layer = (overrides: Record<string, unknown> = {}) => ({
  slot: 'overlay',
  template: 'coloring/fish',
  version: 1,
  params: {},
  svg: SVG,
  ...overrides,
});
const step = (overrides: Record<string, unknown> = {}) => ({
  slot: 'overlay',
  layer: layer(),
  at: 1,
  t: 40,
  ...overrides,
});
const withSteps = (...steps: unknown[]) => stored({ templates: steps });

describe('template steps (schema 2)', () => {
  it('migrates a schema 1 drawing to no templates', () => {
    const rest = stored();
    delete rest['templates'];
    expect(parseDrawing({ ...rest, schema: 1 })).toEqual(drawing);
  });

  it('reads steps back: add, then remove', () => {
    const value = withSteps(step(), step({ layer: null, at: 2, t: 90 }));
    const parsed = parseDrawing(JSON.parse(JSON.stringify(value)));
    expect(parsed.templates).toEqual([
      { slot: 'overlay', layer: layer(), at: 1, t: 40 },
      { slot: 'overlay', layer: null, at: 2, t: 90 },
    ]);
    const round = parseDrawing(toStored(parsed));
    expect(round).toEqual(parsed);
  });

  it('keeps generation parameters of strings and numbers', () => {
    const params = { set: 'capitals', char: 'J', unitsPerCm: 81.5 };
    const parsed = parseDrawing(withSteps(step({ layer: layer({ params }) })));
    expect(parsed.templates[0]?.layer?.params).toEqual(params);
  });

  it('drops a step for a slot this version does not know', () => {
    const parsed = parseDrawing(withSteps({ ...step(), slot: 'sticker' }, step()));
    expect(parsed.templates).toHaveLength(1);
  });

  it.each([
    ['templates not a list', stored({ templates: {} })],
    ['templates missing', stored({ templates: undefined })],
    ['a step not an object', withSteps(3)],
    ['at beyond the strokes', withSteps(step({ at: 3 }))],
    ['at going back', withSteps(step({ at: 2 }), step({ at: 1 }))],
    ['at not whole', withSteps(step({ at: 0.5 }))],
    ['negative time', withSteps(step({ t: -1 }))],
    ['layer of another slot', withSteps(step({ layer: layer({ slot: 'background' }) }))],
    ['layer not an object', withSteps(step({ layer: 'x' }))],
    ['empty template id', withSteps(step({ layer: layer({ template: '' }) }))],
    ['long template id', withSteps(step({ layer: layer({ template: 'x'.repeat(65) }) }))],
    ['bad version', withSteps(step({ layer: layer({ version: 1.5 }) }))],
    ['svg not text', withSteps(step({ layer: layer({ svg: 5 }) }))],
    ['active svg', withSteps(step({ layer: layer({ svg: SVG.replace('<path', '<script') }) }))],
    ['params not an object', withSteps(step({ layer: layer({ params: [] }) }))],
    ['param of another type', withSteps(step({ layer: layer({ params: { a: true } }) }))],
    ['long param', withSteps(step({ layer: layer({ params: { a: 'x'.repeat(65) } }) }))],
  ])('refuses %s', (_, value) => {
    expect(() => parseDrawing(value)).toThrow(DrawingFormatError);
  });

  it('enforces the template limits', () => {
    const limits = { ...LIMITS, templateSteps: 1, params: 1, drawingSvgBytes: SVG.length * 2 };
    expect(() => parseDrawing(withSteps(step(), step()), { limits })).toThrow(/too many/);
    const params = { a: 1, b: 2 };
    expect(() => parseDrawing(withSteps(step({ layer: layer({ params }) })), { limits })).toThrow(
      /too many params/,
    );
    const three = { ...limits, templateSteps: 3 };
    expect(() => parseDrawing(withSteps(step(), step(), step()), { limits: three })).toThrow(
      /too much template data/,
    );
    const small = { ...LIMITS, svgBytes: 20 };
    expect(() => parseDrawing(withSteps(step()), { limits: small })).toThrow(/too-large/);
  });
});
