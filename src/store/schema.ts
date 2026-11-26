/**
 * The stored format of a drawing, shared by IndexedDB and the magic PNG. Every value read
 * back (database, imported file) goes through `parseDrawing`: nothing unchecked reaches
 * the engine. Older versions are migrated; unknown versions are refused.
 */
import {
  LAYER_SLOTS,
  POINT_STRIDE,
  type Drawing,
  type LayerSlot,
  type Stroke,
  type TemplateLayer,
  type TemplateStep,
} from '../engine/types';
import { checkTemplateSvg, utf8Bytes } from '../templates/svg-check';

export const SCHEMA_VERSION = 2;

/** A drawing as stored: the engine's Drawing plus its schema version. */
export interface StoredDrawing extends Drawing {
  schema: number;
}

/** Limits that keep a corrupt or hostile file from exhausting memory. */
export const LIMITS: {
  idLength: number;
  strokes: number;
  numbers: number;
  maxWidth: number;
  templateSteps: number;
  svgBytes: number;
  drawingSvgBytes: number;
  textLength: number;
  params: number;
} = {
  idLength: 64,
  strokes: 20_000,
  /** Numbers (x, y, t) across the whole drawing: ~3.3 million points. */
  numbers: 10_000_000,
  maxWidth: 500,
  templateSteps: 200,
  /** One template SVG. */
  svgBytes: 256 * 1024,
  /** Every template SVG of a drawing together. */
  drawingSvgBytes: 2 * 1024 * 1024,
  /** Template ids, parameter names and string values. */
  textLength: 64,
  /** Parameters per template. */
  params: 16,
};

export class DrawingFormatError extends Error {
  constructor(reason: string) {
    super(`Invalid drawing: ${reason}`);
    this.name = 'DrawingFormatError';
  }
}

export type Migration = (value: Record<string, unknown>) => Record<string, unknown>;

/** Upgrades a stored value to the current schema, one version at a time (key = from). */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // 1 → 2: template layers (milestone 2); schema 1 drawings have none.
  1: (value) => ({ ...value, schema: 2, templates: [] }),
};

const COLOR = /^#[0-9a-f]{6}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseStroke(
  value: unknown,
  index: number,
  budget: { numbers: number },
  limits: typeof LIMITS,
): Stroke {
  const fail = (reason: string): never => {
    throw new DrawingFormatError(`stroke ${index}: ${reason}`);
  };
  if (!isRecord(value)) return fail('not an object');
  const { tool, color, width, points } = value;
  if (tool !== 'pen' && tool !== 'eraser') return fail('unknown tool');
  if (typeof color !== 'string' || !COLOR.test(color)) return fail('bad color');
  if (!finite(width) || width <= 0 || width > limits.maxWidth) return fail('bad width');
  if (!Array.isArray(points) || points.length === 0 || points.length % POINT_STRIDE !== 0) {
    return fail('bad points');
  }
  budget.numbers -= points.length;
  if (budget.numbers < 0) throw new DrawingFormatError('too many points');
  if (!points.every(finite)) return fail('non-numeric point');
  return { tool, color, width, points: [...points] };
}

function parseParams(value: unknown, limits: typeof LIMITS): Record<string, string | number> {
  if (!isRecord(value)) throw new DrawingFormatError('bad params');
  const entries = Object.entries(value);
  if (entries.length > limits.params) throw new DrawingFormatError('too many params');
  const params: Record<string, string | number> = {};
  for (const [key, param] of entries) {
    const text = typeof param === 'string' && param.length <= limits.textLength;
    if (key.length > limits.textLength || !(text || finite(param))) {
      throw new DrawingFormatError('bad params');
    }
    params[key] = param;
  }
  return params;
}

function parseLayer(
  value: unknown,
  slot: LayerSlot,
  budget: { svgBytes: number },
  limits: typeof LIMITS,
): TemplateLayer {
  const fail = (reason: string): never => {
    throw new DrawingFormatError(`template: ${reason}`);
  };
  if (!isRecord(value)) return fail('not an object');
  const { template, version, params, svg } = value;
  if (value['slot'] !== slot) return fail('slot mismatch');
  if (typeof template !== 'string' || template.length === 0) return fail('bad id');
  if (template.length > limits.textLength) return fail('bad id');
  if (!finite(version) || !Number.isInteger(version) || version < 0) return fail('bad version');
  if (typeof svg !== 'string') return fail('bad svg');
  budget.svgBytes -= utf8Bytes(svg);
  if (budget.svgBytes < 0) throw new DrawingFormatError('too much template data');
  const problem = checkTemplateSvg(svg, limits.svgBytes);
  if (problem) return fail(`svg ${problem}`);
  return { slot, template, version, params: parseParams(params, limits), svg };
}

/**
 * Template steps, in order. A step for a slot this version does not know is dropped (a later
 * version may add kinds of layers); `at` must not go back and stays within the strokes.
 */
function parseTemplates(value: unknown, strokes: number, limits: typeof LIMITS): TemplateStep[] {
  if (!Array.isArray(value)) throw new DrawingFormatError('templates missing');
  if (value.length > limits.templateSteps) throw new DrawingFormatError('too many templates');
  const budget = { svgBytes: limits.drawingSvgBytes };
  const steps: TemplateStep[] = [];
  let previous = 0;
  for (const step of value) {
    if (!isRecord(step)) throw new DrawingFormatError('template step: not an object');
    const slot = LAYER_SLOTS.find((known) => known === step['slot']);
    if (!slot) continue;
    const { at, t, layer } = step;
    if (!finite(at) || !Number.isInteger(at) || at < previous || at > strokes) {
      throw new DrawingFormatError('template step: bad position');
    }
    if (!finite(t) || t < 0) throw new DrawingFormatError('template step: bad time');
    previous = at;
    steps.push({
      slot,
      at,
      t,
      layer: layer === null ? null : parseLayer(layer, slot, budget, limits),
    });
  }
  return steps;
}

/** Validates (and migrates) a value read from storage or a file. */
export interface ParseOptions {
  migrations?: Readonly<Record<number, Migration>>;
  limits?: typeof LIMITS;
}

export function parseDrawing(value: unknown, options: ParseOptions = {}): Drawing {
  const migrations = options.migrations ?? MIGRATIONS;
  const limits = options.limits ?? LIMITS;
  if (!isRecord(value)) throw new DrawingFormatError('not an object');
  let current = value;
  for (;;) {
    const { schema } = current;
    if (!finite(schema) || !Number.isInteger(schema)) {
      throw new DrawingFormatError('missing schema version');
    }
    if (schema === SCHEMA_VERSION) break;
    const migrate = migrations[schema];
    if (!migrate) throw new DrawingFormatError(`unknown schema version ${schema}`);
    const migrated: unknown = migrate(current);
    // Each step must move forward, or a faulty migration would loop forever.
    if (!isRecord(migrated) || !finite(migrated['schema']) || migrated['schema'] <= schema) {
      throw new DrawingFormatError(`migration from schema ${schema} failed`);
    }
    current = migrated;
  }

  const { id, createdAt, updatedAt, strokes } = current;
  if (typeof id !== 'string' || id.length === 0 || id.length > limits.idLength) {
    throw new DrawingFormatError('bad id');
  }
  if (!finite(createdAt) || !finite(updatedAt)) throw new DrawingFormatError('bad dates');
  if (!Array.isArray(strokes)) throw new DrawingFormatError('strokes missing');
  if (strokes.length > limits.strokes) throw new DrawingFormatError('too many strokes');
  const budget = { numbers: limits.numbers };
  return {
    id,
    createdAt,
    updatedAt,
    strokes: strokes.map((stroke, index) => parseStroke(stroke, index, budget, limits)),
    templates: parseTemplates(current['templates'], strokes.length, limits),
  };
}

/** The value to store for a drawing (current schema). */
export function toStored(drawing: Drawing): StoredDrawing {
  return {
    schema: SCHEMA_VERSION,
    id: drawing.id,
    createdAt: drawing.createdAt,
    updatedAt: drawing.updatedAt,
    strokes: drawing.strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] })),
    templates: drawing.templates.map((step) => ({
      ...step,
      layer: step.layer && { ...step.layer, params: { ...step.layer.params } },
    })),
  };
}

/** A new, empty drawing. `id` comes from the caller (newId in the app). */
export function newDrawing(id: string, now: number): Drawing {
  return { id, createdAt: now, updatedAt: now, strokes: [], templates: [] };
}
