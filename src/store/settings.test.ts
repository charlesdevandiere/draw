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

describe('finger settings', () => {
  it('reads stored settings, the filter off included', () => {
    expect(parseFingerSettings({ widthThreshold: 120, releaseDelayMs: 500 })).toEqual({
      widthThreshold: 120,
      releaseDelayMs: 500,
    });
    expect(parseFingerSettings({ widthThreshold: null, releaseDelayMs: 0 })).toEqual({
      widthThreshold: null,
      releaseDelayMs: 0,
    });
  });

  it.each([undefined, { widthThreshold: 'big', releaseDelayMs: 1 }, { widthThreshold: 50 }])(
    'falls back to the defaults for %j',
    (value) => {
      expect(parseFingerSettings(value)).toEqual(DEFAULT_FINGER_SETTINGS);
    },
  );

  it('keeps values within bounds', () => {
    expect(clampFingerSettings({ widthThreshold: 5, releaseDelayMs: 99_999 })).toEqual({
      widthThreshold: 20,
      releaseDelayMs: 3000,
    });
    expect(clampFingerSettings({ widthThreshold: Number.NaN, releaseDelayMs: Number.NaN })).toEqual(
      DEFAULT_FINGER_SETTINGS,
    );
    expect(clampFingerSettings({ widthThreshold: 80.6, releaseDelayMs: 300 }).widthThreshold).toBe(
      81,
    );
  });
});
