import { describe, expect, it } from 'vitest';
import { TABLET_MIN_SIDE, TABLET_QUERY, deviceClass, layoutRotation } from './screen-layout';

describe('deviceClass', () => {
  it('is a phone when a side is under the Bootstrap sm breakpoint, in both orientations', () => {
    expect(deviceClass(375, 667)).toBe('phone'); // iPhone SE
    expect(deviceClass(667, 375)).toBe('phone');
    expect(deviceClass(412, 892)).toBe('phone'); // Pixel 9a
  });

  it('is a tablet when both sides reach the breakpoint, in both orientations', () => {
    expect(deviceClass(1180, 820)).toBe('tablet'); // iPad 11
    expect(deviceClass(820, 1180)).toBe('tablet');
    expect(deviceClass(744, 1133)).toBe('tablet'); // iPad mini
    expect(deviceClass(576, 576)).toBe('tablet');
    expect(deviceClass(575, 900)).toBe('phone');
  });

  it('shares its breakpoint with the CSS media query', () => {
    expect(TABLET_MIN_SIDE).toBe(576);
    expect(TABLET_QUERY).toBe('(min-width: 576px) and (min-height: 576px)');
  });
});

describe('layoutRotation', () => {
  it('leaves a phone in portrait and a tablet in landscape unrotated', () => {
    expect(layoutRotation(375, 667, 0)).toBe(0);
    expect(layoutRotation(375, 667, 180)).toBe(0); // upside down: still portrait
    expect(layoutRotation(1180, 820, 90)).toBe(0);
    expect(layoutRotation(1180, 820, 270)).toBe(0);
  });

  it('turns a phone held in landscape back by a quarter turn, against the screen angle', () => {
    expect(layoutRotation(667, 375, 90)).toBe(270);
    expect(layoutRotation(667, 375, 270)).toBe(90);
  });

  it('turns a tablet held in portrait back by a quarter turn, against the screen angle', () => {
    expect(layoutRotation(820, 1180, 0)).toBe(90);
    expect(layoutRotation(820, 1180, 180)).toBe(270);
  });

  it('normalizes odd angles from the browser', () => {
    expect(layoutRotation(667, 375, -90)).toBe(90);
    expect(layoutRotation(667, 375, 450)).toBe(270);
  });

  it('always turns by a quarter when the angle does not match the viewport', () => {
    // Landscape-natural device, or a missing angle: never 0° or 180°.
    expect(layoutRotation(667, 375, 0)).toBe(270);
    expect(layoutRotation(667, 375, 180)).toBe(270);
    expect(layoutRotation(820, 1180, 90)).toBe(90);
    expect(layoutRotation(820, 1180, 270)).toBe(90);
    expect(layoutRotation(667, 375, Number.NaN)).toBe(270);
    expect(layoutRotation(820, 1180, Number.NaN)).toBe(90);
  });

  it('never rotates a square or empty viewport', () => {
    expect(layoutRotation(600, 600, 90)).toBe(0);
    expect(layoutRotation(0, 0, 90)).toBe(0);
  });
});
