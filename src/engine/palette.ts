import type { StrokeStyle, Tool } from './types';

/** The 8 colors of the slate, in display order. */
export const PALETTE = [
  { id: 'black', value: '#212121' },
  { id: 'red', value: '#e53935' },
  { id: 'orange', value: '#fb8c00' },
  { id: 'yellow', value: '#fdd835' },
  { id: 'green', value: '#43a047' },
  { id: 'blue', value: '#1e88e5' },
  { id: 'purple', value: '#8e24aa' },
  { id: 'brown', value: '#6d4c41' },
] as const;

export type ColorId = (typeof PALETTE)[number]['id'];

/** Stroke diameters in page units (the page is 1000 units wide). */
export const WIDTHS = { thin: 8, thick: 24 } as const;
export type WidthId = keyof typeof WIDTHS;
export const ERASER_WIDTH = 48;

/** What the tool buttons currently select. */
export interface ToolState {
  tool: Tool;
  color: ColorId;
  width: WidthId;
}

export const DEFAULT_TOOLS: ToolState = { tool: 'pen', color: 'black', width: 'thin' };

const COLOR_VALUES = Object.fromEntries(PALETTE.map(({ id, value }) => [id, value])) as Record<
  ColorId,
  string
>;

export function colorValue(id: ColorId): string {
  return COLOR_VALUES[id];
}

/** Style of the next stroke. */
export function styleFor(state: ToolState): StrokeStyle {
  return state.tool === 'eraser'
    ? { tool: 'eraser', color: colorValue(state.color), width: ERASER_WIDTH }
    : { tool: 'pen', color: colorValue(state.color), width: WIDTHS[state.width] };
}

/** Picking a color or a width goes back to drawing; the eraser keeps both for later. */
export function selectColor(state: ToolState, color: ColorId): ToolState {
  return { ...state, tool: 'pen', color };
}

export function selectWidth(state: ToolState, width: WidthId): ToolState {
  return { ...state, tool: 'pen', width };
}

export function selectEraser(state: ToolState): ToolState {
  return { ...state, tool: 'eraser' };
}

export function isColorId(value: unknown): value is ColorId {
  return PALETTE.some((color) => color.id === value);
}

export function isWidthId(value: unknown): value is WidthId {
  return value === 'thin' || value === 'thick';
}
