import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOLS } from '../engine/palette';
import { DEFAULT_FINGER_SETTINGS } from '../input/input-mode';
import {
  DEFAULT_INPUT_MODE,
  clampFingerSettings,
  parseFingerSettings,
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
    const state = { tool: 'eraser', color: 'teal-light', size: 4 };
    expect(parseToolState(state)).toEqual(state);
  });

  it('ignores the bar of 5 an earlier build stored', () => {
    expect(
      parseToolState({ tool: 'pen', color: 'pink-dark', size: 2, recent: ['pink-dark'] }),
    ).toEqual({ tool: 'pen', color: 'pink-dark', size: 2 });
  });

  it('migrates the MVP tools: same color, thin → 8 units, thick → 24', () => {
    expect(parseToolState({ tool: 'pen', color: 'blue', width: 'thin' })).toEqual({
      tool: 'pen',
      color: 'blue-medium',
      size: 1,
    });
    expect(parseToolState({ tool: 'eraser', color: 'purple', width: 'thick' })).toEqual({
      tool: 'eraser',
      color: 'purple-medium',
      size: 3,
    });
  });

  it.each([
    undefined,
    { tool: 'brush', color: 'red-medium', size: 1 },
    { tool: 'pen', color: 'pink', size: 1 },
    { tool: 'pen', color: 'red-medium', size: 9 },
    { tool: 'pen', color: 'red', width: 'huge' },
    { tool: 'pen', color: 'red', width: 'toString' },
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

describe('finger settings', () => {
  it('reads stored settings, the filter off included', () => {
    expect(parseFingerSettings({ widthThreshold: 120 })).toEqual({ widthThreshold: 120 });
    expect(parseFingerSettings({ widthThreshold: null })).toEqual({ widthThreshold: null });
    // Saved by an earlier version, with the release delay since removed.
    expect(parseFingerSettings({ widthThreshold: 90, releaseDelayMs: 300 })).toEqual({
      widthThreshold: 90,
    });
  });

  it.each([undefined, 'x', { widthThreshold: 'big' }, {}])(
    'falls back to the defaults for %j',
    (value) => {
      expect(parseFingerSettings(value)).toEqual(DEFAULT_FINGER_SETTINGS);
    },
  );

  it('keeps values within bounds', () => {
    expect(clampFingerSettings({ widthThreshold: 5 })).toEqual({ widthThreshold: 20 });
    expect(clampFingerSettings({ widthThreshold: 9999 })).toEqual({ widthThreshold: 400 });
    expect(clampFingerSettings({ widthThreshold: Number.NaN })).toEqual(DEFAULT_FINGER_SETTINGS);
    expect(clampFingerSettings({ widthThreshold: 80.6 }).widthThreshold).toBe(81);
  });
});
