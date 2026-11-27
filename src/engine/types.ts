/** Size of the square page, in page units. Every stored coordinate is in page units. */
export const PAGE_SIZE = 1000;

/** Values per point in `Stroke.points`: x, y, t. */
export const POINT_STRIDE = 3;

export type Tool = 'pen' | 'eraser';

/** What a new stroke looks like: chosen with the tools before the stroke starts. */
export interface StrokeStyle {
  tool: Tool;
  /** CSS color; ignored by the eraser. */
  color: string;
  /** Diameter in page units. */
  width: number;
}

export interface Stroke extends StrokeStyle {
  /**
   * Flat list of x, y, t triplets: page units rounded to 0.1, t in whole milliseconds
   * since the drawing started. A stroke with a single point is a dot.
   */
  points: number[];
  /**
   * Overflow protection (spec/SPEC-overflow-protection.md): a page point inside the zone of
   * the coloring page this stroke started in; the stroke is clipped to that zone. Absent:
   * not clipped.
   */
  zone?: [number, number];
}

/** Where a template layer sits: under the strokes or above them. */
export type LayerSlot = 'background' | 'overlay';

export const LAYER_SLOTS: readonly LayerSlot[] = ['background', 'overlay'];

/** A template as placed on a drawing: everything needed to show it without the catalog. */
export interface TemplateLayer {
  slot: LayerSlot;
  /** Catalog id, e.g. 'coloring/fish'; informative: rendering uses `svg`. */
  template: string;
  /** Version of that template in the catalog. */
  version: number;
  /** Generation parameters ({} for a static template). */
  params: Record<string, string | number>;
  /** The SVG, viewBox 0 0 1000 1000 (page units). */
  svg: string;
}

/** Adding, replacing or removing (layer null) the template of one slot. */
export interface TemplateStep {
  slot: LayerSlot;
  layer: TemplateLayer | null;
  /** Number of strokes drawn before this step: orders steps and strokes. */
  at: number;
  /** Drawing time of the step (ms, the clock of the stroke points). */
  t: number;
}

export interface Drawing {
  id: string;
  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
  strokes: Stroke[];
  /** Template steps, in the order they were made. */
  templates: TemplateStep[];
}

/** Number of points in a stroke. */
export function pointCount(stroke: Pick<Stroke, 'points'>): number {
  return Math.floor(stroke.points.length / POINT_STRIDE);
}

/** End time of a drawing (t of its last point), 0 when empty. */
export function drawingDuration(strokes: readonly Stroke[]): number {
  let end = 0;
  for (const stroke of strokes) {
    // t of the last whole triplet: a truncated trailing triplet (corrupt import) is ignored.
    const last = stroke.points[pointCount(stroke) * POINT_STRIDE - 1];
    if (last !== undefined && last > end) end = last;
  }
  return end;
}
