import type { PalmRejectionStrategy } from '../input/palm-rejection';
import type { EnvironmentInfo } from './environment';
import type { IncidentSnapshot } from './incidents';
import type { TypeStats } from './pointer-stats';
import type { Summary } from './timing-stats';

/** Bump when the report's shape changes, so collected reports stay interpretable. */
export const REPORT_VERSION = 1;

export interface ReportInput {
  generatedAt: string;
  appVersion: string;
  environment: EnvironmentInfo | null;
  support: { coalescedEvents: boolean; predictedEvents: boolean };
  /** Drawing options active when the report was taken (they change what timing measures). */
  drawingOptions: { coalescedDrawing: boolean; rawPoints: boolean };
  pointers: Record<string, TypeStats>;
  timing: {
    byType: Record<
      string,
      { eventsHz: number | null; samplesHz: number | null; coalescedPerMove: Summary }
    >;
    frameIntervalMs: Summary;
    eventToRenderMs: Summary;
  };
  incidents: IncidentSnapshot & { protectionsEnabled: boolean };
  palmRejection: {
    strategy: PalmRejectionStrategy;
    graceMs: number;
    sessionMs: number;
    ignoredByStrategy: Record<PalmRejectionStrategy, number>;
  };
}

export type DiagnosticReport = { reportVersion: number } & ReportInput;

const DECIMALS = 1000;

/** Deep copy with every non-integer number rounded to 3 decimals (compact, readable JSON). */
export function roundNumbers<T>(value: T): T {
  if (typeof value === 'number') {
    return (Number.isInteger(value) ? value : Math.round(value * DECIMALS) / DECIMALS) as T;
  }
  if (Array.isArray(value)) return value.map((item: unknown) => roundNumbers(item)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, roundNumbers(item)]),
    ) as T;
  }
  return value;
}

export function buildReport(input: ReportInput): DiagnosticReport {
  return roundNumbers({ reportVersion: REPORT_VERSION, ...input });
}
