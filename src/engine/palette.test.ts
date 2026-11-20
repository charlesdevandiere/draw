import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOOLS,
  ERASER_WIDTH,
  PALETTE,
  WIDTHS,
  colorValue,
  isColorId,
  isWidthId,
  selectColor,
  selectEraser,
  selectWidth,
  styleFor,
} from './palette';

describe('palette', () => {
  it('has 8 distinct colors', () => {
    expect(PALETTE).toHaveLength(8);
    expect(new Set(PALETTE.map((color) => color.value)).size).toBe(8);
  });

  it('starts with a thin black pen', () => {
    expect(styleFor(DEFAULT_TOOLS)).toEqual({ tool: 'pen', color: '#212121', width: WIDTHS.thin });
  });

  it('gives the color value of an id', () => {
    expect(colorValue('blue')).toBe('#1e88e5');
  });
});

describe('selection', () => {
  it('picking a color draws with it', () => {
    const state = selectColor(selectEraser(DEFAULT_TOOLS), 'red');
    expect(styleFor(state)).toEqual({ tool: 'pen', color: '#e53935', width: WIDTHS.thin });
  });

  it('picking a width draws with it, keeping the color', () => {
    const state = selectWidth(selectColor(DEFAULT_TOOLS, 'green'), 'thick');
    expect(styleFor(state)).toEqual({ tool: 'pen', color: '#43a047', width: WIDTHS.thick });
  });

  it('the eraser has its own width and remembers the pen settings', () => {
    const pen = selectWidth(selectColor(DEFAULT_TOOLS, 'blue'), 'thick');
    const eraser = selectEraser(pen);
    expect(styleFor(eraser)).toMatchObject({ tool: 'eraser', width: ERASER_WIDTH });
    expect(styleFor(selectColor(eraser, 'blue'))).toEqual(styleFor(pen));
  });

  it('does not mutate the state', () => {
    const state = { ...DEFAULT_TOOLS };
    selectEraser(state);
    expect(state).toEqual(DEFAULT_TOOLS);
  });
});

describe('guards', () => {
  it('recognize color and width ids', () => {
    expect(isColorId('purple')).toBe(true);
    expect(isColorId('pink')).toBe(false);
    expect(isWidthId('thick')).toBe(true);
    expect(isWidthId('huge')).toBe(false);
  });
});
