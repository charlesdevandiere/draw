/**
 * Zone maps of coloring pages and clipped painting (spec/SPEC-overflow-protection.md), DOM
 * side. A coloring page's outlines (color hints left out) are rendered at one pixel per
 * page unit and labeled into zones (engine/zones.ts); a stroke with a start zone is painted
 * on a scratch canvas, kept only inside its zone's mask, then laid on the drawing.
 */
import { layerBeforeStroke } from '../engine/layers';
import { renderStroke, setPageScale } from '../engine/render';
import { POINT_STRIDE, pointCount, type Stroke, type TemplateStep } from '../engine/types';
import { ZONE_RESOLUTION, labelZones, zoneAt } from '../engine/zones';
import { templateImage } from './template-image';

/** The mask of one zone: a canvas as large as the zone's bounding box (mask pixels). */
export interface ZoneMask {
  canvas: HTMLCanvasElement;
  left: number;
  top: number;
}

interface ZoneMap {
  labels: Int32Array;
  /** Bounding box of each zone, by label: left, top, right, bottom (inclusive). */
  boxes: Int32Array;
  /** Masks by zone label, made on demand. */
  masks: Map<number, ZoneMask>;
}

/** Zone maps by overlay SVG: a drawing reopened, replayed or exported reuses them. */
const CACHE_SIZE = 4;
/**
 * Pixels of the masks kept per zone map (least recently used dropped first): iOS Safari
 * caps the total canvas memory. Masks are as large as their zone, so most are small.
 */
const MASK_PIXEL_BUDGET = 4_000_000;
const maps = new Map<string, ZoneMap>();
const pending = new Map<string, Promise<ZoneMap | null>>();

/** Bounding box of every zone, in one pass over the labels. */
function zoneBoxes(labels: Int32Array): Int32Array {
  let count = 0;
  for (const label of labels) if (label > count) count = label;
  const boxes = new Int32Array((count + 1) * 4);
  for (let label = 1; label <= count; label += 1) {
    boxes[label * 4] = ZONE_RESOLUTION;
    boxes[label * 4 + 1] = ZONE_RESOLUTION;
    boxes[label * 4 + 2] = -1;
    boxes[label * 4 + 3] = -1;
  }
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i] ?? 0;
    if (label === 0) continue;
    const x = i % ZONE_RESOLUTION;
    const y = (i - x) / ZONE_RESOLUTION;
    const at = label * 4;
    if (x < (boxes[at] ?? 0)) boxes[at] = x;
    if (y < (boxes[at + 1] ?? 0)) boxes[at + 1] = y;
    if (x > (boxes[at + 2] ?? 0)) boxes[at + 2] = x;
    if (y > (boxes[at + 3] ?? 0)) boxes[at + 3] = y;
  }
  return boxes;
}

/** The outlines alone: color hints never stop a stroke. Parsed, never put in the document. */
function withoutHints(svg: string): string {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) return svg;
  for (const hint of parsed.querySelectorAll('.hint')) hint.remove();
  return new XMLSerializer().serializeToString(parsed);
}

/** Frees a canvas' pixels now (iOS Safari collects detached canvases late). */
function release(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

async function build(svg: string): Promise<ZoneMap | null> {
  const image = await templateImage(withoutHints(svg), { size: ZONE_RESOLUTION }).catch(() => null);
  if (!image) return null;
  const canvas = document.createElement('canvas');
  canvas.width = ZONE_RESOLUTION;
  canvas.height = ZONE_RESOLUTION;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, ZONE_RESOLUTION, ZONE_RESOLUTION);
  const pixels = context.getImageData(0, 0, ZONE_RESOLUTION, ZONE_RESOLUTION).data;
  canvas.width = 0;
  const barrier = new Uint8Array(ZONE_RESOLUTION * ZONE_RESOLUTION);
  for (let i = 0; i < barrier.length; i += 1) barrier[i] = (pixels[i * 4 + 3] ?? 0) >= 128 ? 1 : 0;
  const labels = labelZones(barrier, ZONE_RESOLUTION);
  return { labels, boxes: zoneBoxes(labels), masks: new Map() };
}

/** Builds (once) the zone map of an overlay; resolves when it can be used. */
export function loadZoneMap(svg: string): Promise<void> {
  const ready = maps.get(svg);
  if (ready) {
    // Most recently used last.
    maps.delete(svg);
    maps.set(svg, ready);
    return Promise.resolve();
  }
  let loading = pending.get(svg);
  if (!loading) {
    // A map that cannot be built only leaves its strokes unclipped: never a rejection.
    loading = build(svg)
      .catch(() => null)
      .then((map) => {
        pending.delete(svg);
        if (!map) return null;
        maps.set(svg, map);
        while (maps.size > CACHE_SIZE) {
          const oldest = maps.keys().next().value;
          if (oldest === undefined) break;
          for (const mask of maps.get(oldest)?.masks.values() ?? []) release(mask.canvas);
          maps.delete(oldest);
        }
        return map;
      });
    pending.set(svg, loading);
  }
  return loading.then(() => undefined);
}

/** Loads the zone maps of every overlay a drawing ever had. */
export function loadZoneMaps(templates: readonly TemplateStep[]): Promise<void> {
  const svgs = new Set<string>();
  for (const step of templates) if (step.slot === 'overlay' && step.layer) svgs.add(step.layer.svg);
  return Promise.all([...svgs].map(loadZoneMap)).then(() => undefined);
}

/** True when the zone map of an overlay is ready. */
export function zoneMapReady(svg: string): boolean {
  return maps.has(svg);
}

/** True when every zone map a drawing needs is ready. */
export function zoneMapsReady(templates: readonly TemplateStep[]): boolean {
  return templates.every(
    (step) => step.slot !== 'overlay' || !step.layer || maps.has(step.layer.svg),
  );
}

function maskPixels(mask: ZoneMask): number {
  return mask.canvas.width * mask.canvas.height;
}

function maskOf(map: ZoneMap, label: number): ZoneMask {
  const cached = map.masks.get(label);
  if (cached) {
    // Most recently used last.
    map.masks.delete(label);
    map.masks.set(label, cached);
    return cached;
  }
  const left = map.boxes[label * 4] ?? 0;
  const top = map.boxes[label * 4 + 1] ?? 0;
  const width = Math.max(1, (map.boxes[label * 4 + 2] ?? 0) - left + 1);
  const height = Math.max(1, (map.boxes[label * 4 + 3] ?? 0) - top + 1);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) {
    const image = context.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      const row = (top + y) * ZONE_RESOLUTION + left;
      for (let x = 0; x < width; x += 1) {
        if (map.labels[row + x] === label) image.data[(y * width + x) * 4 + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }
  const mask = { canvas, left, top };
  map.masks.set(label, mask);
  let total = 0;
  for (const kept of map.masks.values()) total += maskPixels(kept);
  // Drop the least recently used masks over the budget (never the one just made).
  for (const [oldLabel, old] of map.masks) {
    if (total <= MASK_PIXEL_BUDGET || old === mask) break;
    total -= maskPixels(old);
    release(old.canvas);
    map.masks.delete(oldLabel);
  }
  return mask;
}

/**
 * The mask a stroke is clipped to: the zone of its `zone` point in the coloring page that
 * was on the drawing when stroke number `index` started. Null: not clipped (no zone, no
 * coloring page then, or its map is not loaded yet).
 */
export function zoneMaskFor(
  stroke: Stroke,
  index: number,
  templates: readonly TemplateStep[],
  svg?: string,
): ZoneMask | null {
  if (!stroke.zone) return null;
  const overlay = svg ?? layerBeforeStroke(templates, 'overlay', index)?.svg;
  const map = overlay === undefined ? undefined : maps.get(overlay);
  if (!map) return null;
  const hit = zoneAt(map.labels, ZONE_RESOLUTION, stroke.zone[0], stroke.zone[1]);
  return hit ? maskOf(map, hit.label) : null;
}

/** The zone a stroke starting at a page point would get on this overlay (live drawing). */
export function startZone(svg: string, x: number, y: number): [number, number] | null {
  const map = maps.get(svg);
  if (!map) return null;
  return zoneAt(map.labels, ZONE_RESOLUTION, x, y)?.point ?? null;
}

let scratch: HTMLCanvasElement | null = null;

/** Pixel box (backing pixels) of the part of a stroke from point `from` on, with its width. */
function boxOf(stroke: Stroke, from: number, pixelsPerUnit: number, size: number) {
  const count = pointCount(stroke);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = Math.max(0, from - 1); i < count; i += 1) {
    const x = stroke.points[i * POINT_STRIDE] ?? 0;
    const y = stroke.points[i * POINT_STRIDE + 1] ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const pad = stroke.width / 2 + 2;
  const left = Math.max(0, Math.floor((minX - pad) * pixelsPerUnit));
  const top = Math.max(0, Math.floor((minY - pad) * pixelsPerUnit));
  const right = Math.min(size, Math.ceil((maxX + pad) * pixelsPerUnit));
  const bottom = Math.min(size, Math.ceil((maxY + pad) * pixelsPerUnit));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Paints a stroke from point `from` on (as renderStroke), clipped to `mask` when given: on a
 * scratch canvas, only around the new part, kept inside the mask, then laid on the drawing
 * (an eraser takes away what is under its clipped shape). Returns the points now drawn.
 */
export function paintStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  from: number,
  pixelsPerUnit: number,
  mask: ZoneMask | null,
): number {
  if (!mask) {
    setPageScale(context, pixelsPerUnit);
    return renderStroke(context, stroke, from);
  }
  const count = pointCount(stroke);
  if (count === 0 || from >= count) return count;
  const size = context.canvas.width;
  const box = boxOf(stroke, from, pixelsPerUnit, size);
  if (box.width <= 0 || box.height <= 0) return count;
  scratch ??= document.createElement('canvas');
  if (scratch.width !== size || scratch.height !== size) {
    scratch.width = size;
    scratch.height = size;
  }
  const paper = scratch.getContext('2d');
  if (!paper) {
    setPageScale(context, pixelsPerUnit);
    return renderStroke(context, stroke, from);
  }
  paper.setTransform(1, 0, 0, 1, 0, 0);
  paper.globalCompositeOperation = 'source-over';
  paper.clearRect(box.left, box.top, box.width, box.height);
  setPageScale(paper, pixelsPerUnit);
  // On the scratch canvas the eraser's shape is painted, then taken away from the drawing.
  const shape: Stroke =
    stroke.tool === 'eraser' ? { ...stroke, tool: 'pen', color: '#000000' } : stroke;
  renderStroke(paper, shape, from);
  paper.setTransform(1, 0, 0, 1, 0, 0);
  // Keep only what lies inside the zone: its box first, then its exact shape.
  const scale = ZONE_RESOLUTION / size;
  const zoneLeft = Math.max(box.left, Math.floor(mask.left / scale));
  const zoneTop = Math.max(box.top, Math.floor(mask.top / scale));
  const zoneRight = Math.min(
    box.left + box.width,
    Math.ceil((mask.left + mask.canvas.width) / scale),
  );
  const zoneBottom = Math.min(
    box.top + box.height,
    Math.ceil((mask.top + mask.canvas.height) / scale),
  );
  if (zoneRight <= zoneLeft || zoneBottom <= zoneTop) return count;
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  paper.clearRect(box.left, box.top, box.width, zoneTop - box.top);
  paper.clearRect(box.left, zoneBottom, box.width, bottom - zoneBottom);
  paper.clearRect(box.left, zoneTop, zoneLeft - box.left, zoneBottom - zoneTop);
  paper.clearRect(zoneRight, zoneTop, right - zoneRight, zoneBottom - zoneTop);
  const width = zoneRight - zoneLeft;
  const height = zoneBottom - zoneTop;
  paper.globalCompositeOperation = 'destination-in';
  paper.drawImage(
    mask.canvas,
    zoneLeft * scale - mask.left,
    zoneTop * scale - mask.top,
    width * scale,
    height * scale,
    zoneLeft,
    zoneTop,
    width,
    height,
  );
  paper.globalCompositeOperation = 'source-over';
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.drawImage(scratch, zoneLeft, zoneTop, width, height, zoneLeft, zoneTop, width, height);
  context.globalCompositeOperation = 'source-over';
  setPageScale(context, pixelsPerUnit);
  return count;
}

/** Frees the scratch canvas (after an export: it took the export's size). */
export function releaseScratch(): void {
  if (scratch) release(scratch);
  scratch = null;
}

/** Clears the canvas and paints every stroke of a drawing, clipped strokes included. */
export function paintDrawing(
  context: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  templates: readonly TemplateStep[],
  pixelsPerUnit: number,
): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  strokes.forEach((stroke, index) => {
    paintStroke(context, stroke, 0, pixelsPerUnit, zoneMaskFor(stroke, index, templates));
  });
}
