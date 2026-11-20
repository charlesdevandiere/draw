import { describe, expect, it } from 'vitest';
import type { Drawing } from '../engine/types';
import {
  DrawingFormatError,
  LIMITS,
  SCHEMA_VERSION,
  newDrawing,
  parseDrawing,
  toStored,
} from './schema';

const drawing: Drawing = {
  id: 'abc',
  createdAt: 1000,
  updatedAt: 2000,
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
    expect(newDrawing('x', 5)).toEqual({ id: 'x', createdAt: 5, updatedAt: 5, strokes: [] });
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
