import { describe, expect, it } from 'vitest';
import {
  BASE_COLORS,
  COOL_FAMILIES,
  DEFAULT_TOOLS,
  FAMILIES,
  PALETTE,
  SIZES,
  TONES,
  WARM_FAMILIES,
  colorValue,
  fromMvpColor,
  isColorId,
  isSizeStep,
  pickColor,
  resetBar,
  selectEraser,
  selectSize,
  styleFor,
  type ColorId,
} from './palette';

describe('palette', () => {
  it('has 14 families × 4 tones = 56 distinct colors, family by family', () => {
    expect(FAMILIES).toHaveLength(14);
    expect(TONES).toEqual(['light', 'bright', 'medium', 'dark']);
    expect(PALETTE).toHaveLength(56);
    expect(new Set(PALETTE.map((color) => color.value)).size).toBe(56);
    expect(PALETTE.slice(0, 4).map((color) => color.id)).toEqual([
      'pink-light',
      'pink-bright',
      'pink-medium',
      'pink-dark',
    ]);
    expect(PALETTE.at(-1)?.id).toBe('purple-dark');
  });

  it('splits warm and neutral families from cool ones, 7 and 7', () => {
    expect(WARM_FAMILIES).toEqual(['pink', 'red', 'orange', 'yellow', 'beige', 'brown', 'grey']);
    expect(COOL_FAMILIES).toEqual([
      'light-green',
      'green',
      'teal',
      'sky-blue',
      'blue',
      'indigo',
      'purple',
    ]);
  });

  it('uses the values of the foundations board', () => {
    expect(colorValue('grey-light')).toBe('#ffffff');
    expect(colorValue('grey-dark')).toBe('#212121');
    expect(colorValue('beige-medium')).toBe('#dfc08f');
    expect(colorValue('blue-dark')).toBe('#1565c0');
    expect(colorValue('teal-bright')).toBe('#26a69a');
  });

  it('keeps every MVP color at the same value', () => {
    const mvp: [string, string][] = [
      ['black', '#212121'],
      ['red', '#e53935'],
      ['orange', '#fb8c00'],
      ['yellow', '#fdd835'],
      ['green', '#43a047'],
      ['blue', '#1e88e5'],
      ['purple', '#8e24aa'],
      ['brown', '#6d4c41'],
    ];
    for (const [id, value] of mvp) {
      const color = fromMvpColor(id);
      expect(color).not.toBeNull();
      expect(colorValue(color as ColorId)).toBe(value);
    }
    expect(fromMvpColor('pink')).toBeNull();
  });

  it('has 6 sizes in page units', () => {
    expect(SIZES).toEqual([4, 8, 16, 24, 40, 64]);
    expect(isSizeStep(0)).toBe(true);
    expect(isSizeStep(5)).toBe(true);
    expect(isSizeStep(6)).toBe(false);
    expect(isSizeStep(1.5)).toBe(false);
  });

  it('recognizes color ids', () => {
    expect(isColorId('sky-blue-light')).toBe(true);
    expect(isColorId('red')).toBe(false);
    expect(isColorId(42)).toBe(false);
  });
});

describe('tool state', () => {
  it('starts with a black pen, size 8, the base colors in the bar', () => {
    expect(BASE_COLORS).toEqual([
      'grey-dark',
      'red-medium',
      'green-medium',
      'blue-medium',
      'yellow-medium',
    ]);
    expect(DEFAULT_TOOLS.recent).toEqual(BASE_COLORS);
    expect(styleFor(DEFAULT_TOOLS)).toEqual({ tool: 'pen', color: '#212121', width: 8 });
  });

  it('the size applies to the pen and to the eraser, and keeps the tool', () => {
    const big = selectSize(DEFAULT_TOOLS, 5);
    expect(styleFor(big)).toMatchObject({ tool: 'pen', width: 64 });
    const erasing = selectSize(selectEraser(DEFAULT_TOOLS), 0);
    expect(styleFor(erasing)).toMatchObject({ tool: 'eraser', width: 4 });
  });

  it('picking in the bar draws with that color and never reorders the bar', () => {
    const state = pickColor(selectEraser(DEFAULT_TOOLS), 'blue-medium');
    expect(state.tool).toBe('pen');
    expect(state.color).toBe('blue-medium');
    expect(state.recent).toEqual(BASE_COLORS);
  });

  it('a color picked in the box enters the bar first, the last one leaves', () => {
    const state = pickColor(DEFAULT_TOOLS, 'teal-light');
    expect(state.color).toBe('teal-light');
    expect(state.recent).toEqual([
      'teal-light',
      'grey-dark',
      'red-medium',
      'green-medium',
      'blue-medium',
    ]);
  });

  it('a color of the box already in the bar keeps the order', () => {
    const state = pickColor(selectEraser(DEFAULT_TOOLS), 'green-medium');
    expect(state.tool).toBe('pen');
    expect(state.recent).toEqual(BASE_COLORS);
  });

  it('a new drawing gets the base colors, the current color kept in the bar', () => {
    const teal = pickColor(DEFAULT_TOOLS, 'teal-light');
    const reset = resetBar(teal);
    expect(reset.color).toBe('teal-light');
    expect(reset.recent).toEqual([
      'teal-light',
      'grey-dark',
      'red-medium',
      'green-medium',
      'blue-medium',
    ]);
    const red = resetBar(pickColor(teal, 'red-medium'));
    expect(red.recent).toEqual(BASE_COLORS);
  });

  it('never mutates a state', () => {
    const state = structuredClone(DEFAULT_TOOLS);
    pickColor(state, 'pink-light');
    selectSize(state, 4);
    selectEraser(state);
    resetBar(state);
    expect(state).toEqual(DEFAULT_TOOLS);
  });
});
