import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOLS } from '../engine/palette';
import {
  DEFAULT_INPUT_MODE,
  parseDrawingId,
  parseInputModeState,
  parseToolState,
} from './settings';

describe('parseInputModeState', () => {
  it('reads a stored mode', () => {
    expect(parseInputModeState({ mode: 'pen', chosenByHand: true })).toEqual({
      mode: 'pen',
      chosenByHand: true,
    });
    expect(parseInputModeState({ mode: 'multi' })).toEqual({ mode: 'multi', chosenByHand: false });
  });

  it.each([undefined, null, 'pen', { mode: 'palm' }])(
    'falls back to the default for %j',
    (value) => {
      expect(parseInputModeState(value)).toEqual(DEFAULT_INPUT_MODE);
    },
  );
});

describe('parseToolState', () => {
  it('reads stored tools', () => {
    const state = { tool: 'eraser', color: 'red', width: 'thick' };
    expect(parseToolState(state)).toEqual(state);
  });

  it.each([
    undefined,
    { tool: 'brush', color: 'red', width: 'thin' },
    { tool: 'pen', color: 'pink', width: 'thin' },
    { tool: 'pen', color: 'red', width: 'huge' },
  ])('falls back to the default for %j', (value) => {
    expect(parseToolState(value)).toEqual(DEFAULT_TOOLS);
  });
});

describe('parseDrawingId', () => {
  it('accepts a short string only', () => {
    expect(parseDrawingId('abc')).toBe('abc');
    expect(parseDrawingId('')).toBeNull();
    expect(parseDrawingId('x'.repeat(65))).toBeNull();
    expect(parseDrawingId(42)).toBeNull();
  });
});
