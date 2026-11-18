import type { PointerSample } from './pointer-sample';

export interface Range {
  min: number;
  max: number;
}

export interface TypeStats {
  events: number;
  pressure: Range & { distinctCount: number; distinctValues: number[] };
  tiltX: Range;
  tiltY: Range;
  /** null when the browser never reported the angle. */
  altitudeAngle: Range | null;
  azimuthAngle: Range | null;
  twistSeen: boolean;
  width: Range;
  height: Range;
}

const LISTED_DISTINCT_VALUES = 10;
const PRESSURE_PRECISION = 1000;

interface Accumulator {
  events: number;
  pressures: Set<number>;
  pressure: Range;
  tiltX: Range;
  tiltY: Range;
  altitudeAngle: Range | null;
  azimuthAngle: Range | null;
  twistSeen: boolean;
  width: Range;
  height: Range;
}

/** Widens the range in place (hot path: one call per sample, no allocation). */
function widen(range: Range, value: number): Range {
  if (value < range.min) range.min = value;
  if (value > range.max) range.max = value;
  return range;
}

/** Like widen, for properties the browser may not report at all. */
function extend(range: Range | null, value: number | null): Range | null {
  if (value === null) return range;
  return range ? widen(range, value) : { min: value, max: value };
}

function point(value: number): Range {
  return { min: value, max: value };
}

/** Aggregates pointer samples per pointerType (what each input really reports). */
export function createPointerStats() {
  let byType = new Map<string, Accumulator>();

  return {
    record(sample: PointerSample): void {
      const acc = byType.get(sample.pointerType);
      const pressure = Math.round(sample.pressure * PRESSURE_PRECISION) / PRESSURE_PRECISION;
      if (!acc) {
        byType.set(sample.pointerType, {
          events: 1,
          pressures: new Set([pressure]),
          pressure: point(sample.pressure),
          tiltX: point(sample.tiltX),
          tiltY: point(sample.tiltY),
          altitudeAngle: extend(null, sample.altitudeAngle),
          azimuthAngle: extend(null, sample.azimuthAngle),
          twistSeen: sample.twist !== 0,
          width: point(sample.width),
          height: point(sample.height),
        });
        return;
      }
      acc.events += 1;
      acc.pressures.add(pressure);
      widen(acc.pressure, sample.pressure);
      widen(acc.tiltX, sample.tiltX);
      widen(acc.tiltY, sample.tiltY);
      acc.altitudeAngle = extend(acc.altitudeAngle, sample.altitudeAngle);
      acc.azimuthAngle = extend(acc.azimuthAngle, sample.azimuthAngle);
      acc.twistSeen ||= sample.twist !== 0;
      widen(acc.width, sample.width);
      widen(acc.height, sample.height);
    },

    snapshot(): Record<string, TypeStats> {
      const result: Record<string, TypeStats> = {};
      for (const [type, acc] of byType) {
        const distinct = [...acc.pressures].sort((a, b) => a - b);
        result[type] = {
          events: acc.events,
          pressure: {
            ...acc.pressure,
            distinctCount: distinct.length,
            distinctValues: distinct.slice(0, LISTED_DISTINCT_VALUES),
          },
          tiltX: { ...acc.tiltX },
          tiltY: { ...acc.tiltY },
          altitudeAngle: acc.altitudeAngle && { ...acc.altitudeAngle },
          azimuthAngle: acc.azimuthAngle && { ...acc.azimuthAngle },
          twistSeen: acc.twistSeen,
          width: { ...acc.width },
          height: { ...acc.height },
        };
      }
      return result;
    },

    reset(): void {
      byType = new Map();
    },
  };
}

export type PointerStats = ReturnType<typeof createPointerStats>;
