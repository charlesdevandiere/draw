import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FINGER_SETTINGS,
  createInputFilter,
  isInputMode,
  type ContactInput,
  type InputMode,
} from './input-mode';

const FINGER_WIDTH = 50;
const PALM_WIDTH = 200;

function touch(
  pointerId: number,
  phase: ContactInput['phase'],
  timeStamp: number,
  width = FINGER_WIDTH,
): ContactInput {
  return { pointerId, pointerType: 'touch', phase, timeStamp, width };
}

function pen(pointerId: number, phase: ContactInput['phase'], timeStamp: number): ContactInput {
  return { pointerId, pointerType: 'pen', phase, timeStamp, width: 0.5 };
}

function filter(mode: InputMode, chosenByHand = true) {
  return createInputFilter({ mode, chosenByHand });
}

describe('pen mode', () => {
  it('draws with the pen and ignores every touch', () => {
    const f = filter('pen');
    expect(f.accepts(touch(1, 'down', 0, PALM_WIDTH))).toBe(false);
    expect(f.accepts(touch(1, 'move', 5, PALM_WIDTH))).toBe(false);
    expect(f.accepts(pen(2, 'down', 10))).toBe(true);
    expect(f.accepts(pen(2, 'move', 20))).toBe(true);
    expect(f.accepts(touch(3, 'down', 30))).toBe(false);
    expect(f.accepts(touch(1, 'up', 40))).toBe(false);
  });
});

describe('multi-finger mode', () => {
  it('lets every contact draw', () => {
    const f = filter('multi');
    expect(f.accepts(touch(1, 'down', 0))).toBe(true);
    expect(f.accepts(touch(2, 'down', 1, PALM_WIDTH))).toBe(true);
    expect(f.accepts(touch(1, 'move', 2))).toBe(true);
    expect(f.accepts(touch(2, 'move', 3))).toBe(true);
    expect(f.accepts(touch(1, 'up', 4))).toBe(false);
  });
});

describe('finger mode', () => {
  it('lets the first contact draw and refuses a second one', () => {
    const f = filter('finger');
    expect(f.accepts(touch(1, 'down', 0))).toBe(true);
    expect(f.accepts(touch(2, 'down', 10))).toBe(false);
    expect(f.accepts(touch(1, 'move', 20))).toBe(true);
    expect(f.accepts(touch(2, 'move', 30))).toBe(false);
  });

  it('keeps the slot locked while any contact remains after the finger lifts', () => {
    const f = filter('finger');
    f.accepts(touch(1, 'down', 0));
    f.accepts(touch(2, 'down', 10, PALM_WIDTH)); // palm lands during the stroke
    expect(f.accepts(touch(1, 'up', 100))).toBe(false);
    // The palm, still resting, touches a new spot: no stroke.
    expect(f.accepts(touch(3, 'down', 500))).toBe(false);
    expect(f.accepts(touch(2, 'move', 510))).toBe(false);
  });

  it('frees the slot only after the release delay once everything is lifted', () => {
    const f = filter('finger');
    f.accepts(touch(1, 'down', 0));
    f.accepts(touch(1, 'up', 100));
    expect(f.accepts(touch(2, 'down', 100 + DEFAULT_FINGER_SETTINGS.releaseDelayMs - 1))).toBe(
      false,
    );
    f.accepts(touch(2, 'up', 450));
    expect(f.accepts(touch(3, 'down', 450 + DEFAULT_FINGER_SETTINGS.releaseDelayMs))).toBe(true);
  });

  it('ignores a contact wider than the threshold, which still holds the slot', () => {
    const f = filter('finger');
    expect(f.accepts(touch(1, 'down', 0, PALM_WIDTH))).toBe(false);
    expect(f.accepts(touch(1, 'move', 5, PALM_WIDTH))).toBe(false);
    expect(f.accepts(touch(2, 'down', 10))).toBe(false);
  });

  it('stops a stroke whose contact grows past the threshold, which keeps the slot', () => {
    const f = filter('finger');
    expect(f.accepts(touch(1, 'down', 0))).toBe(true);
    expect(f.accepts(touch(1, 'move', 5, PALM_WIDTH))).toBe(false);
    expect(f.accepts(touch(2, 'down', 10))).toBe(false);
  });

  it('can turn the width filter off', () => {
    const f = createInputFilter(
      { mode: 'finger', chosenByHand: true },
      { widthThreshold: null, releaseDelayMs: 300 },
    );
    expect(f.accepts(touch(1, 'down', 0, PALM_WIDTH))).toBe(true);
  });

  it('applies new settings', () => {
    const f = filter('finger');
    f.setFingerSettings({ widthThreshold: 40, releaseDelayMs: 0 });
    expect(f.accepts(touch(1, 'down', 0))).toBe(false);
    f.accepts(touch(1, 'up', 10));
    expect(f.accepts(touch(2, 'down', 10, 30))).toBe(true);
  });

  it('lets a pen draw alongside the finger', () => {
    const f = filter('finger');
    expect(f.accepts(touch(1, 'down', 0))).toBe(true);
    expect(f.accepts(pen(9, 'down', 5))).toBe(true);
    expect(f.accepts(touch(1, 'move', 6))).toBe(true);
  });

  it('treats an up without a down as harmless', () => {
    const f = filter('finger');
    expect(f.accepts(touch(7, 'up', 0))).toBe(false);
    expect(f.accepts(touch(1, 'down', 1000))).toBe(true);
  });
});

describe('mice', () => {
  it.each(['pen', 'finger', 'multi'] as const)('always draw in %s mode', (mode) => {
    const f = filter(mode);
    expect(
      f.accepts({ pointerId: 1, pointerType: 'mouse', phase: 'down', timeStamp: 0, width: 1 }),
    ).toBe(true);
  });
});

describe('automatic switch to the pen mode', () => {
  it('switches on the first pen while no mode was chosen by hand', () => {
    const f = filter('finger', false);
    expect(f.accepts(pen(1, 'down', 0))).toBe(true);
    expect(f.state()).toEqual({ mode: 'pen', chosenByHand: false });
    expect(f.accepts(touch(2, 'down', 10))).toBe(false);
  });

  it('never switches after a manual choice', () => {
    const f = filter('finger', false);
    f.setMode('finger');
    f.accepts(pen(1, 'down', 0));
    expect(f.state()).toEqual({ mode: 'finger', chosenByHand: true });
    f.accepts(pen(1, 'up', 5));
    expect(f.accepts(touch(2, 'down', 1000))).toBe(true);
  });

  it('keeps the flag when a mode is restored without being chosen by hand', () => {
    const f = filter('finger', false);
    f.setMode('multi', false);
    expect(f.state()).toEqual({ mode: 'multi', chosenByHand: false });
  });
});

describe('switching modes', () => {
  it('drops the finger slot so the next contact can draw', () => {
    const f = filter('finger');
    f.accepts(touch(1, 'down', 0));
    f.setMode('multi');
    expect(f.accepts(touch(2, 'down', 10))).toBe(true);
    f.setMode('finger');
    expect(f.accepts(touch(1, 'move', 20))).toBe(false);
  });
});

describe('re-applying the current mode', () => {
  it('keeps the stroke in progress', () => {
    const f = filter('finger');
    f.accepts(touch(1, 'down', 0));
    f.setMode('finger', false);
    expect(f.accepts(touch(1, 'move', 10))).toBe(true);
  });
});

describe('isInputMode', () => {
  it('recognizes the three modes only', () => {
    expect(['pen', 'finger', 'multi', 'other', 3].map(isInputMode)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});
