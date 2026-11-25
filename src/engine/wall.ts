/**
 * The gallery wall (pure, spec/SPEC-gallery-viewer.md): each drawing is pinned slightly
 * tilted under a strip of tape. Both come from the drawing id, so a tile keeps its look
 * across reloads and new drawings, and nothing is stored.
 */

export const MAX_TILT_DEG = 2.5;
/** Tape colors: the six action colors, in the order of `$action-colors` (src/styles/_tokens.scss). */
export const TAPE_COUNT = 6;

/** Tilts from -2.5° to 2.5° by 0.5°, never flat. */
const TILTS = [-2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5] as const;

export interface TileLook {
  /** Degrees, clockwise. */
  tilt: number;
  /** Index of the tape color. */
  tape: number;
}

/** FNV-1a, 32 bits: a small, well-spread string hash. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

export function tileLook(id: string): TileLook {
  const value = hash(id);
  return {
    tilt: TILTS[value % TILTS.length] as number,
    tape: Math.floor(value / TILTS.length) % TAPE_COUNT,
  };
}
