import { describe, expect, it } from 'vitest';
import { REPORT_VERSION, buildReport, roundNumbers, type ReportInput } from './report';

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    generatedAt: '2026-11-18T20:00:00.000Z',
    appVersion: 'abc1234',
    environment: null,
    support: { coalescedEvents: true, predictedEvents: false },
    drawingOptions: { coalescedDrawing: true, rawPoints: false },
    pointers: {},
    timing: {
      byType: {},
      frameIntervalMs: { count: 0, mean: null, p95: null },
      eventToRenderMs: { count: 0, mean: null, p95: null },
    },
    incidents: { protectionsEnabled: true, protectionsOn: {}, protectionsOff: {} },
    palmRejection: {
      strategy: 'during-stroke',
      graceMs: 500,
      sessionMs: 10_000,
      ignoredByStrategy: { none: 0, 'during-stroke': 0, 'pen-session': 0 },
    },
    ...overrides,
  };
}

describe('roundNumbers', () => {
  it('rounds every non-integer number to 3 decimals, deeply', () => {
    expect(roundNumbers({ a: 1.23456, b: [0.33333, { c: 2 }], d: 'x', e: null })).toEqual({
      a: 1.235,
      b: [0.333, { c: 2 }],
      d: 'x',
      e: null,
    });
  });
});

describe('buildReport', () => {
  it('stamps the report with its format version', () => {
    expect(buildReport(input()).reportVersion).toBe(REPORT_VERSION);
  });

  it('keeps every section of the input', () => {
    const report = buildReport(input());

    expect(Object.keys(report)).toEqual([
      'reportVersion',
      'generatedAt',
      'appVersion',
      'environment',
      'support',
      'drawingOptions',
      'pointers',
      'timing',
      'incidents',
      'palmRejection',
    ]);
  });

  it('rounds measured values', () => {
    const report = buildReport(
      input({
        timing: {
          byType: {},
          frameIntervalMs: { count: 3, mean: 16.66666, p95: 17.12345 },
          eventToRenderMs: { count: 0, mean: null, p95: null },
        },
      }),
    );

    expect(report.timing.frameIntervalMs).toEqual({ count: 3, mean: 16.667, p95: 17.123 });
  });

  it('serialises to valid JSON that round-trips', () => {
    const report = buildReport(input());

    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
