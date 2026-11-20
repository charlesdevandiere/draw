/**
 * The stored format of a drawing, shared by IndexedDB and the magic PNG. Every value read
 * back (database, imported file) goes through `parseDrawing`: nothing unchecked reaches
 * the engine. Older versions are migrated; unknown versions are refused.
 */
import { POINT_STRIDE, type Drawing, type Stroke } from '../engine/types';

export const SCHEMA_VERSION = 1;

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
} = {
  idLength: 64,
  strokes: 20_000,
  /** Numbers (x, y, t) across the whole drawing: ~3.3 million points. */
  numbers: 10_000_000,
  maxWidth: 500,
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
  // 1 → 2 goes here when the format changes, e.g.:
  // 1: (value) => ({ ...value, schema: 2, background: null }),
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
  };
}

/** A new, empty drawing. `id` comes from the caller (crypto.randomUUID in the app). */
export function newDrawing(id: string, now: number): Drawing {
  return { id, createdAt: now, updatedAt: now, strokes: [] };
}
