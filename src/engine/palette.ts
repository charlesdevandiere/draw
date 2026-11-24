/**
 * Colors and sizes of the slate (spec/SPEC-draw-tools.md), pure. 14 families × 4 tones in
 * two groups (warm and neutral, then cool) and 6 stroke sizes. Strokes store `#rrggbb` and
 * a width in page units, never these ids.
 */
import type { StrokeStyle, Tool } from './types';

export const FAMILIES = [
  'pink',
  'red',
  'orange',
  'yellow',
  'beige',
  'brown',
  'grey',
  'light-green',
  'green',
  'teal',
  'sky-blue',
  'blue',
  'indigo',
  'purple',
] as const;
export type Family = (typeof FAMILIES)[number];

export const TONES = ['light', 'bright', 'medium', 'dark'] as const;
export type Tone = (typeof TONES)[number];

export type ColorId = `${Family}-${Tone}`;

/** The two blocks of the box: warm and neutral, then cool. */
export const WARM_FAMILIES = FAMILIES.slice(0, 7) as readonly Family[];
export const COOL_FAMILIES = FAMILIES.slice(7) as readonly Family[];

/**
 * The rows of the palette shown in full on tablets: by wavelength, from the hue of each
 * row's medium tone (red to purple; pink, out of the rainbow, after purple where the hue
 * circle puts it), black and white at the bottom. The dialog keeps the warm / cool blocks.
 */
export const BOX_FAMILIES: readonly Family[] = [
  'red',
  'brown',
  'orange',
  'beige',
  'yellow',
  'light-green',
  'green',
  'teal',
  'sky-blue',
  'blue',
  'indigo',
  'purple',
  'pink',
  'grey',
];

/** Values by family, light → dark (foundations board of the mockups). */
const VALUES: Record<Family, readonly [string, string, string, string]> = {
  pink: ['#f48fb1', '#ec407a', '#d81b60', '#ad1457'],
  red: ['#ef9a9a', '#ef5350', '#e53935', '#c62828'],
  orange: ['#ffcc80', '#ffa726', '#fb8c00', '#ef6c00'],
  yellow: ['#fff59d', '#ffee58', '#fdd835', '#f9a825'],
  beige: ['#f8eedc', '#efd9b4', '#dfc08f', '#c8a26b'],
  brown: ['#bcaaa4', '#8d6e63', '#6d4c41', '#4e342e'],
  grey: ['#ffffff', '#bdbdbd', '#757575', '#212121'],
  'light-green': ['#c5e1a5', '#9ccc65', '#7cb342', '#558b2f'],
  green: ['#a5d6a7', '#66bb6a', '#43a047', '#2e7d32'],
  teal: ['#80cbc4', '#26a69a', '#00897b', '#00695c'],
  'sky-blue': ['#81d4fa', '#29b6f6', '#039be5', '#0277bd'],
  blue: ['#90caf9', '#42a5f5', '#1e88e5', '#1565c0'],
  indigo: ['#9fa8da', '#5c6bc0', '#3949ab', '#283593'],
  purple: ['#ce93d8', '#ab47bc', '#8e24aa', '#6a1b9a'],
};

export interface PaletteColor {
  id: ColorId;
  family: Family;
  tone: Tone;
  value: string;
}

/** All 56 colors, family by family, light → dark. */
export const PALETTE: readonly PaletteColor[] = FAMILIES.flatMap((family) =>
  TONES.map((tone, index) => ({
    id: `${family}-${tone}` as ColorId,
    family,
    tone,
    value: VALUES[family][index] as string,
  })),
);

const BY_ID = new Map(PALETTE.map((color) => [color.id as string, color]));

export function isColorId(value: unknown): value is ColorId {
  return typeof value === 'string' && BY_ID.has(value);
}

export function colorValue(id: ColorId): string {
  return (BY_ID.get(id) as PaletteColor).value;
}

/** The 8 colors of the MVP (stored tool settings), all in the palette at the same value. */
const MVP_COLORS: Readonly<Record<string, ColorId>> = {
  black: 'grey-dark',
  red: 'red-medium',
  orange: 'orange-medium',
  yellow: 'yellow-medium',
  green: 'green-medium',
  blue: 'blue-medium',
  purple: 'purple-medium',
  brown: 'brown-medium',
};

export function fromMvpColor(id: unknown): ColorId | null {
  return typeof id === 'string' && Object.hasOwn(MVP_COLORS, id)
    ? (MVP_COLORS[id] as ColorId)
    : null;
}

/** Stroke diameters in page units (the page is 1000 units wide), one per slider step. */
export const SIZES = [4, 8, 16, 24, 40, 64] as const;
export type SizeStep = 0 | 1 | 2 | 3 | 4 | 5;

export function isSizeStep(value: unknown): value is SizeStep {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < SIZES.length;
}

/** What the tools currently select. */
export interface ToolState {
  tool: Tool;
  color: ColorId;
  size: SizeStep;
}

export const DEFAULT_TOOLS: ToolState = { tool: 'pen', color: 'grey-dark', size: 1 };

/** Style of the next stroke: the slider size for the pen and the eraser alike. */
export function styleFor(state: ToolState): StrokeStyle {
  return { tool: state.tool, color: colorValue(state.color), width: SIZES[state.size] };
}

/** A color picked in the box (tablets) or the "all colors" dialog (phones): back to the pen. */
export function pickColor(state: ToolState, color: ColorId): ToolState {
  return { ...state, tool: 'pen', color };
}

/** Moving the slider keeps the tool: the eraser takes the size too. */
export function selectSize(state: ToolState, size: SizeStep): ToolState {
  return { ...state, size };
}

/** The eraser keeps the color and size for later. */
export function selectEraser(state: ToolState): ToolState {
  return { ...state, tool: 'eraser' };
}
