/**
 * Writing templates (spec/SPEC-writing-templates.md), generated when added (pure): ruled
 * paper and letters to trace, at a constant physical size. `unitsPerCm` is the number of
 * page units in one centimeter on the device that adds the template; the SVG is stored and
 * only scaled afterwards, never generated again.
 */
import { PAGE_SIZE, type TemplateLayer } from '../engine/types';
import capitals from './glyphs/capitals.json';
import cursive from './glyphs/cursive.json';
import digits from './glyphs/digits.json';

/**
 * CSS pixels in a real centimeter, nearly the same on handheld devices (52–63 on the
 * reference devices, spec/SPEC-mvp.md, Milestone 2).
 */
export const NOMINAL_PX_PER_CM = 55;

/** Page units per centimeter for a page this wide on screen (CSS pixels). */
export function unitsPerCmFor(pageCssWidth: number): number {
  return round((PAGE_SIZE * NOMINAL_PX_PER_CM) / pageCssWidth);
}

export type LinesKind = 'small-squares' | 'seyes';

/** Light blue of squared paper. */
const GRID_COLOR = '#90b8e0';
/** French ruled paper: violet thick lines, light blue thin ones. */
const SEYES_THICK = '#8f7fd6';
const SEYES_THIN = '#a8c8ec';

/** Coordinates rounded to 0.1 unit: short, deterministic SVG text. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

const SVG_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_SIZE} ${PAGE_SIZE}">`;

/** Positions from `step` on, every `step`, inside the page. */
function every(step: number, from = step): number[] {
  const positions: number[] = [];
  // A zero, negative or non-finite step would never reach the page edge.
  if (!(step > 0) || !Number.isFinite(step)) return positions;
  for (let position = from; position < PAGE_SIZE - 0.05; position += step) {
    positions.push(round(position));
  }
  return positions;
}

function horizontal(ys: readonly number[]): string {
  return ys.map((y) => `M0 ${y}H${PAGE_SIZE}`).join('');
}

function vertical(xs: readonly number[]): string {
  return xs.map((x) => `M${x} 0V${PAGE_SIZE}`).join('');
}

function strokePath(d: string, color: string, width: number): string {
  return d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="${round(width)}"/>` : '';
}

/** Seyès ruling with `interval` between lines (thick every 4), vertical lines every 4. */
export function seyesPaths(interval: number): string {
  const lines = every(interval);
  const thick = lines.filter((_, index) => (index + 1) % 4 === 0);
  const thin = lines.filter((_, index) => (index + 1) % 4 !== 0);
  const width = interval / 12;
  return (
    strokePath(horizontal(thin), SEYES_THIN, width) +
    strokePath(horizontal(thick) + vertical(every(4 * interval)), SEYES_THICK, width * 1.5)
  );
}

/** Ruled paper over the whole page: 5 mm squares, or Seyès (8 mm, thin lines every 2 mm). */
export function linesSvg(kind: LinesKind, unitsPerCm: number): string {
  if (kind === 'small-squares') {
    const step = 0.5 * unitsPerCm;
    const grid = horizontal(every(step)) + vertical(every(step));
    return `${SVG_OPEN}${strokePath(grid, GRID_COLOR, step / 25)}</svg>`;
  }
  return `${SVG_OPEN}${seyesPaths(0.2 * unitsPerCm)}</svg>`;
}

export type LetterSet = 'capitals' | 'cursive' | 'digits';

interface GlyphData {
  unitsPerEm: number;
  capHeight: number;
  xHeight: number;
  glyphs: Readonly<Record<string, { d: string; advance: number } | undefined>>;
}

const GLYPHS: Readonly<Record<LetterSet, GlyphData>> = { capitals, cursive, digits };

/** The characters of each set, in the order of the panel. */
export const LETTER_SETS: Readonly<Record<LetterSet, readonly string[]>> = {
  capitals: Object.keys(capitals.glyphs),
  cursive: Object.keys(cursive.glyphs),
  digits: Object.keys(digits.glyphs),
};

/** Light grey of the letters to trace. */
const LETTER_COLOR = '#c4c4c4';
/** Height of capitals and digits (cm). */
const CAP_HEIGHT_CM = 2;
/** Interval of the enlarged Seyès ruling of cursive (cm): the x-height. */
const CURSIVE_INTERVAL_CM = 0.4;
/** Space between two letters, and kept free along the page edges (cm). */
const SPACE_CM = 0.5;
/** Space between two rows of capitals or digits (cm). */
const ROW_GAP_CM = 1;

/** Where the copies of one character go on the page (page units). */
export interface LetterLayout {
  /** Page units per font unit. */
  scale: number;
  /** Width of one copy (its advance). */
  width: number;
  /** Baseline of each row. */
  baselines: number[];
  /** Left edge of each copy in a row. */
  xs: number[];
  /** Height of the letters above the baseline (capitals and digits: the cap line). */
  height: number;
}

/** Ink box of a glyph outline (font units, y down). */
interface InkBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Bounds of the points of an outline. The path data holds only absolute M, L, Q and Z
 * commands (scripts/glyphs.mjs): its numbers are x y pairs, and the control points of a
 * quadratic curve enclose it, so this box contains all the ink.
 */
function inkBox(d: string): InkBox {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = numbers.filter((_, index) => index % 2 === 0);
  const ys = numbers.filter((_, index) => index % 2 === 1);
  return {
    minX: Math.min(0, ...xs),
    maxX: Math.max(0, ...xs),
    minY: Math.min(0, ...ys),
    maxY: Math.max(0, ...ys),
  };
}

/**
 * `count` items of `size` with `gap` between them, centered on the page: their starts.
 * `before` and `after` are how far the ink of the first and last items overhangs them: the
 * ink, not the boxes, is centered.
 */
function centered(count: number, size: number, gap: number, before = 0, after = 0): number[] {
  const total = count * size + Math.max(0, count - 1) * gap;
  const start = (PAGE_SIZE - total + before - after) / 2;
  return Array.from({ length: count }, (_, i) => round(start + i * (size + gap)));
}

/** How many items of `size` with `gap` between them fit in `room`. */
function fitting(room: number, size: number, gap: number): number {
  return Math.max(0, Math.floor((room + gap) / (size + gap)));
}

/** Half the width of the outline thickening cursive letters (font units). */
const CURSIVE_HALF_STROKE = 0.04 * cursive.xHeight;

/**
 * Lays out one character repeated along rows, as many whole copies as fit: capitals and
 * digits 2 cm high, rows 1 cm apart; cursive with a 4 mm x-height, its baselines on every
 * other thick line of the Seyès ruling. Null for a character outside the set.
 */
export function letterGrid(set: LetterSet, char: string, unitsPerCm: number): LetterLayout | null {
  const data = GLYPHS[set];
  const glyph = Object.hasOwn(data.glyphs, char) ? data.glyphs[char] : undefined;
  if (!glyph || !(unitsPerCm > 0) || !Number.isFinite(unitsPerCm)) return null;
  const space = SPACE_CM * unitsPerCm;
  const room = PAGE_SIZE - 2 * space;
  // The ink may overhang the advance box (cursive f, j; a capital Q's tail; the thickening
  // outline of cursive): margins are kept from the ink.
  const pad = set === 'cursive' ? CURSIVE_HALF_STROKE : 0;
  const ink = inkBox(glyph.d);
  let scale: number;
  let height: number;
  let baselines: number[];
  if (set === 'cursive') {
    const interval = CURSIVE_INTERVAL_CM * unitsPerCm;
    scale = interval / data.xHeight;
    height = interval;
    // Thick lines every 4 intervals; a row needs 3 intervals above (ascenders) and 2 below,
    // its descender kept a margin away from the bottom edge.
    const below = Math.max(2 * interval, (ink.maxY + pad) * scale + space);
    baselines = [];
    for (let y = 4 * interval; y + below <= PAGE_SIZE; y += 8 * interval) {
      baselines.push(round(y));
    }
  } else {
    height = CAP_HEIGHT_CM * unitsPerCm;
    scale = height / data.capHeight;
    const gap = ROW_GAP_CM * unitsPerCm;
    const above = Math.max(0, -ink.minY - data.capHeight) * scale;
    const below = Math.max(0, ink.maxY) * scale;
    baselines = centered(fitting(room - above - below, height, gap), height, gap, above, below).map(
      (top) => round(top + height),
    );
  }
  const width = glyph.advance * scale;
  const left = Math.max(0, pad - ink.minX) * scale;
  const right = Math.max(0, ink.maxX + pad - glyph.advance) * scale;
  return {
    scale,
    width: round(width),
    baselines,
    xs: centered(fitting(room - left - right, width, space), width, space, left, right),
    height: round(height),
  };
}

/** One character repeated to fill the page, light grey, on its guide lines. */
export function lettersSvg(set: LetterSet, char: string, unitsPerCm: number): string {
  const layout = letterGrid(set, char, unitsPerCm);
  const glyph = GLYPHS[set].glyphs[char];
  if (!layout || !glyph) return `${SVG_OPEN}</svg>`;
  const guides =
    set === 'cursive'
      ? seyesPaths(CURSIVE_INTERVAL_CM * unitsPerCm)
      : strokePath(
          horizontal(layout.baselines.flatMap((y) => [round(y - layout.height), y])),
          GRID_COLOR,
          unitsPerCm / 25,
        );
  const scale = Math.round(layout.scale * 1e5) / 1e5;
  // The cursive font is drawn with a fine pen: an outline of the same grey makes it a line
  // a child can follow (in font units: it is scaled with the glyph).
  const thicken =
    set === 'cursive'
      ? ` stroke="${LETTER_COLOR}" stroke-width="${round(2 * CURSIVE_HALF_STROKE)}" stroke-linejoin="round"`
      : '';
  const copies = layout.baselines
    .flatMap((y) => layout.xs.map((x) => `<use href="#g" x="${x}" y="${y}"/>`))
    .join('');
  return (
    `${SVG_OPEN}${guides}<defs><path id="g" d="${glyph.d}" transform="scale(${scale})"/></defs>` +
    `<g fill="${LETTER_COLOR}"${thicken}>${copies}</g></svg>`
  );
}

/** Version of the writing templates; bumped when their look changes. */
export const WRITING_VERSION = 1;

/** The background layer of ruled paper, generated for this device. */
export function linesLayer(kind: LinesKind, unitsPerCm: number): TemplateLayer {
  return {
    slot: 'background',
    template: `lines/${kind}`,
    version: WRITING_VERSION,
    params: { unitsPerCm },
    svg: linesSvg(kind, unitsPerCm),
  };
}

/** The background layer of one character to trace, generated for this device. */
export function lettersLayer(set: LetterSet, char: string, unitsPerCm: number): TemplateLayer {
  return {
    slot: 'background',
    template: `letters/${set}`,
    version: WRITING_VERSION,
    params: { char, unitsPerCm },
    svg: lettersSvg(set, char, unitsPerCm),
  };
}

/** What a layer shows, to compare with a tile of the panel: the template, and its letter. */
export function templateKey(layer: Pick<TemplateLayer, 'template' | 'params'>): string {
  const { char } = layer.params;
  return typeof char === 'string' ? `${layer.template}:${char}` : layer.template;
}

const setInks = new Map<LetterSet, { top: number; bottom: number }>();

/**
 * Vertical extent of the ink of a whole set (font units): its characters share one frame.
 * Computed once per set (every tile of the panel asks for it).
 */
function setInk(set: LetterSet): { top: number; bottom: number } {
  let ink = setInks.get(set);
  if (!ink) {
    const boxes = LETTER_SETS[set].map((char) => inkBox(GLYPHS[set].glyphs[char]?.d ?? ''));
    ink = {
      top: Math.min(...boxes.map((box) => box.minY)),
      bottom: Math.max(...boxes.map((box) => box.maxY)),
    };
    setInks.set(set, ink);
  }
  return ink;
}

/**
 * One character alone, dark: the tile of the panel. Every character of a set is drawn at
 * the same scale, on the same baseline, centered across.
 */
export function glyphPreviewSvg(set: LetterSet, char: string): string {
  const glyph = Object.hasOwn(GLYPHS[set].glyphs, char) ? GLYPHS[set].glyphs[char] : undefined;
  if (!glyph) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';
  const box = inkBox(glyph.d);
  const { top, bottom } = setInk(set);
  const size = (bottom - top) * 1.15;
  const x = round((box.minX + box.maxX - size) / 2);
  const y = round((top + bottom - size) / 2);
  const thicken =
    set === 'cursive' ? ` stroke="#2b2b2b" stroke-width="${round(2 * CURSIVE_HALF_STROKE)}"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${round(size)} ${round(size)}">` +
    `<path d="${glyph.d}" fill="#2b2b2b"${thicken} stroke-linejoin="round"/></svg>`
  );
}
