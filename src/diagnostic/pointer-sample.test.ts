import { describe, expect, it } from 'vitest';
import { formatSample, toSample, type PointerEventLike } from './pointer-sample';

function penEvent(overrides: Partial<PointerEventLike> = {}): PointerEventLike {
  return {
    pointerId: 3,
    pointerType: 'pen',
    isPrimary: true,
    pressure: 0.42,
    tangentialPressure: 0,
    tiltX: 12,
    tiltY: -5,
    twist: 0,
    width: 1,
    height: 1,
    buttons: 1,
    clientX: 100.5,
    clientY: 200.25,
    timeStamp: 1234.5,
    ...overrides,
  };
}

describe('toSample', () => {
  it('copies the pointer properties into a plain serialisable object', () => {
    const sample = toSample(penEvent());

    expect(sample).toEqual({
      pointerId: 3,
      pointerType: 'pen',
      isPrimary: true,
      pressure: 0.42,
      tangentialPressure: 0,
      tiltX: 12,
      tiltY: -5,
      twist: 0,
      altitudeAngle: null,
      azimuthAngle: null,
      width: 1,
      height: 1,
      buttons: 1,
      x: 100.5,
      y: 200.25,
      timeStamp: 1234.5,
    });
  });

  it('keeps altitude and azimuth angles when the browser provides them', () => {
    const sample = toSample(penEvent({ altitudeAngle: 1.2, azimuthAngle: 0.3 }));

    expect(sample.altitudeAngle).toBe(1.2);
    expect(sample.azimuthAngle).toBe(0.3);
  });

  it('produces a JSON round-trippable value', () => {
    const sample = toSample(penEvent());

    expect(JSON.parse(JSON.stringify(sample))).toEqual(sample);
  });
});

describe('formatSample', () => {
  it('renders one labelled line per property with rounded numbers', () => {
    const text = formatSample(toSample(penEvent({ altitudeAngle: 1.23456 })));

    expect(text).toContain('pointerType: pen');
    expect(text).toContain('pressure: 0.420');
    expect(text).toContain('tiltX: 12');
    expect(text).toContain('altitudeAngle: 1.235');
  });

  it('shows « n/d » for properties the browser does not provide', () => {
    const text = formatSample(toSample(penEvent()));

    expect(text).toContain('azimuthAngle: n/d');
  });
});
