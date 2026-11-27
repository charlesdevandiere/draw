/**
 * Zones of a coloring page (spec/SPEC-overflow-protection.md), pure. The outlines are
 * rendered into a square mask (1 = barrier); the zones are the connected regions of the
 * other pixels (4-connected), found by filling. Any picture works, whatever its paths.
 */
import { roundCoordinate } from './stroke-builder';
import { PAGE_SIZE } from './types';

/** Side of the zone mask in pixels: one pixel per page unit. */
export const ZONE_RESOLUTION = PAGE_SIZE;

/** A start point on a barrier finds the nearest zone within this distance (page units). */
export const ZONE_SEARCH_UNITS = 12;

/**
 * Labels each pixel with its zone: 0 for a barrier, 1, 2 … for the zones, in the order
 * their first pixel is met (row by row). Scanline fill with an explicit stack: no
 * recursion, linear time.
 */
export function labelZones(mask: Uint8Array, size: number): Int32Array {
  const labels = new Int32Array(size * size);
  let next = 0;
  const stack: number[] = [];
  for (let start = 0; start < labels.length; start += 1) {
    if (mask[start] || labels[start]) continue;
    next += 1;
    stack.push(start);
    while (stack.length > 0) {
      const seed = stack.pop() ?? 0;
      if (labels[seed]) continue;
      const row = Math.floor(seed / size) * size;
      // Spread left and right along the row, then queue the rows above and below.
      let left = seed;
      while (left > row && !mask[left - 1] && !labels[left - 1]) left -= 1;
      let right = seed;
      while (right < row + size - 1 && !mask[right + 1] && !labels[right + 1]) right += 1;
      for (let index = left; index <= right; index += 1) {
        labels[index] = next;
        const above = index - size;
        if (above >= 0 && !mask[above] && !labels[above]) stack.push(above);
        const below = index + size;
        if (below < labels.length && !mask[below] && !labels[below]) stack.push(below);
      }
    }
  }
  return labels;
}

/** The zone a stroke starting at a page point belongs to, and a point inside it. */
export interface ZoneHit {
  label: number;
  /** A page point inside the zone (the start point, or the nearest zone pixel). */
  point: [number, number];
}

/**
 * The zone of a page point. On a barrier (an outline), the nearest zone within
 * ZONE_SEARCH_UNITS; null when there is none. Points off the page are pulled onto it.
 */
export function zoneAt(labels: Int32Array, size: number, x: number, y: number): ZoneHit | null {
  const scale = size / PAGE_SIZE;
  const clamp = (value: number) => Math.min(size - 1, Math.max(0, Math.floor(value * scale)));
  const px = clamp(x);
  const py = clamp(y);
  // The point is stored rounded (0.1): it must stay on the page and on the same pixel once
  // rounded, or the stored zone would be refused or resolve to another zone when reopened.
  const center = (pixel: number) => roundCoordinate((pixel + 0.5) / scale);
  const kept = (value: number, pixel: number) => {
    const rounded = roundCoordinate(value);
    return rounded >= 0 && rounded < PAGE_SIZE && clamp(rounded) === pixel
      ? rounded
      : center(pixel);
  };
  const at = labels[py * size + px] ?? 0;
  if (at > 0) return { label: at, point: [kept(x, px), kept(y, py)] };
  const radius = Math.ceil(ZONE_SEARCH_UNITS * scale);
  let best: { label: number; distance: number; x: number; y: number } | null = null;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const distance = dx * dx + dy * dy;
      if (distance > radius * radius || (best && distance >= best.distance)) continue;
      const cx = px + dx;
      const cy = py + dy;
      if (cx < 0 || cy < 0 || cx >= size || cy >= size) continue;
      const label = labels[cy * size + cx] ?? 0;
      if (label > 0) best = { label, distance, x: cx, y: cy };
    }
  }
  if (!best) return null;
  return { label: best.label, point: [center(best.x), center(best.y)] };
}
