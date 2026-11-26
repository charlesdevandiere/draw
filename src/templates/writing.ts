/**
 * Writing templates (spec/SPEC-writing-templates.md), generated when added (pure): ruled
 * paper and letters to trace, at a constant physical size. `unitsPerCm` is the number of
 * page units in one centimeter on the device that adds the template; the SVG is stored and
 * only scaled afterwards, never generated again.
 */
import { PAGE_SIZE } from '../engine/types';

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
