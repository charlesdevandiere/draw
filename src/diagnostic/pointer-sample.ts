/** Subset of PointerEvent read by the diagnostic (lets tests use plain objects). */
export interface PointerEventLike {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  pressure: number;
  tangentialPressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  altitudeAngle?: number;
  azimuthAngle?: number;
  width: number;
  height: number;
  buttons: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

/** Serialisable snapshot of a pointer event. */
export interface PointerSample {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  pressure: number;
  tangentialPressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  altitudeAngle: number | null;
  azimuthAngle: number | null;
  width: number;
  height: number;
  buttons: number;
  x: number;
  y: number;
  timeStamp: number;
}

export function toSample(event: PointerEventLike): PointerSample {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    pressure: event.pressure,
    tangentialPressure: event.tangentialPressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    twist: event.twist,
    altitudeAngle: event.altitudeAngle ?? null,
    azimuthAngle: event.azimuthAngle ?? null,
    width: event.width,
    height: event.height,
    buttons: event.buttons,
    x: event.clientX,
    y: event.clientY,
    timeStamp: event.timeStamp,
  };
}

const DISPLAYED_KEYS = [
  'pointerType',
  'isPrimary',
  'pressure',
  'tangentialPressure',
  'tiltX',
  'tiltY',
  'twist',
  'altitudeAngle',
  'azimuthAngle',
  'width',
  'height',
  'buttons',
] as const satisfies readonly (keyof PointerSample)[];

function formatValue(value: PointerSample[keyof PointerSample], notAvailable: string): string {
  if (value === null) return notAvailable;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return String(value);
}

/** Human-readable multi-line description of a sample; `notAvailable` marks missing values. */
export function formatSample(sample: PointerSample, notAvailable = 'n/a'): string {
  return DISPLAYED_KEYS.map((key) => `${key}: ${formatValue(sample[key], notAvailable)}`).join(
    '\n',
  );
}
