import { describe, expect, it } from 'vitest';
import {
  createInputFilter,
  isInputMode,
  nextInputMode,
  type ContactInput,
  type InputMode,
} from './input-mode';

const FINGER_WIDTH = 50;
const PALM_WIDTH = 200;

function touch(
  pointerId: number,
  phase: ContactInput['phase'],
  width = FINGER_WIDTH,
): ContactInput {
  return { pointerId, pointerType: 'touch', phase, width };
}

function pen(pointerId: number, phase: ContactInput['phase']): ContactInput {
  return { pointerId, pointerType: 'pen', phase, width: 0.5 };
}

function filter(mode: InputMode, chosenByHand = true) {
  return createInputFilter({ mode, chosenByHand });
}

describe('pen mode', () => {
  it('draws with the pen and ignores every touch', () => {
    const f = filter('pen');
    expect(f.accepts(touch(1, 'down', PALM_WIDTH))).toBe(false);
    expect(f.accepts(touch(1, 'move', PALM_WIDTH))).toBe(false);
    expect(f.accepts(pen(2, 'down'))).toBe(true);
    expect(f.accepts(pen(2, 'move'))).toBe(true);
    expect(f.accepts(touch(3, 'down'))).toBe(false);
    expect(f.accepts(touch(1, 'up'))).toBe(false);
  });
});

describe('multi-finger mode', () => {
  it('lets every contact draw', () => {
    const f = filter('multi');
    expect(f.accepts(touch(1, 'down'))).toBe(true);
    expect(f.accepts(touch(2, 'down', PALM_WIDTH))).toBe(true);
    expect(f.accepts(touch(1, 'move'))).toBe(true);
    expect(f.accepts(touch(2, 'move'))).toBe(true);
    expect(f.accepts(touch(1, 'up'))).toBe(false);
  });
});

describe('finger mode', () => {
  it('lets the first contact draw and refuses a second one', () => {
    const f = filter('finger');
    expect(f.accepts(touch(1, 'down'))).toBe(true);
    expect(f.accepts(touch(2, 'down'))).toBe(false);
    expect(f.accepts(touch(1, 'move'))).toBe(true);
    expect(f.accepts(touch(2, 'move'))).toBe(false);
  });

  it('keeps the slot locked while any contact remains after the finger lifts', () => {
    const f = filter('finger');
    f.accepts(touch(1, 'down'));
    f.accepts(touch(2, 'down', PALM_WIDTH)); // palm lands during the stroke
    expect(f.accepts(touch(1, 'up'))).toBe(false);
    // The palm, still resting, touches a new spot: no stroke.
    expect(f.accepts(touch(3, 'down'))).toBe(false);
    expect(f.accepts(touch(2, 'move'))).toBe(false);
  });

  it('frees the slot as soon as everything is lifted (fast handwriting, DF-10)', () => {
    const f = filter('finger');
    f.accepts(touch(1, 'down'));
    f.accepts(touch(1, 'up'));
    expect(f.accepts(touch(2, 'down'))).toBe(true);
    f.accepts(touch(2, 'up'));
    // A palm lifted last frees the slot too: whatever it leaves is handled by DF-09.
    f.accepts(touch(3, 'down', PALM_WIDTH));
    f.accepts(touch(3, 'up'));
    expect(f.accepts(touch(4, 'down'))).toBe(true);
  });

  it('ignores a contact wider than the threshold, which still holds the slot', () => {
    const f = filter('finger');
    expect(f.accepts(touch(1, 'down', PALM_WIDTH))).toBe(false);
    expect(f.accepts(touch(1, 'move', PALM_WIDTH))).toBe(false);
    expect(f.accepts(touch(2, 'down'))).toBe(false);
  });

  it('stops a stroke whose contact grows past the threshold, which keeps the slot', () => {
    const f = filter('finger');
    expect(f.accepts(touch(1, 'down'))).toBe(true);
    expect(f.accepts(touch(1, 'move', PALM_WIDTH))).toBe(false);
    expect(f.accepts(touch(2, 'down'))).toBe(false);
  });

  it('can turn the width filter off', () => {
    const f = createInputFilter({ mode: 'finger', chosenByHand: true }, { widthThreshold: null });
    expect(f.accepts(touch(1, 'down', PALM_WIDTH))).toBe(true);
  });

  it('applies new settings', () => {
    const f = filter('finger');
    f.setFingerSettings({ widthThreshold: 40 });
    expect(f.accepts(touch(1, 'down'))).toBe(false);
    f.accepts(touch(1, 'up'));
    expect(f.accepts(touch(2, 'down', 30))).toBe(true);
  });

  it('lets a pen draw alongside the finger', () => {
    const f = filter('finger');
    expect(f.accepts(touch(1, 'down'))).toBe(true);
    expect(f.accepts(pen(9, 'down'))).toBe(true);
    expect(f.accepts(touch(1, 'move'))).toBe(true);
  });

  it('treats an up without a down as harmless', () => {
    const f = filter('finger');
    expect(f.accepts(touch(7, 'up'))).toBe(false);
    expect(f.accepts(touch(1, 'down'))).toBe(true);
  });
});

describe('mice', () => {
  it.each(['pen', 'finger', 'multi'] as const)('always draw in %s mode', (mode) => {
    const f = filter(mode);
    expect(f.accepts({ pointerId: 1, pointerType: 'mouse', phase: 'down', width: 1 })).toBe(true);
  });
});

describe('automatic switch to the pen mode', () => {
  it('switches on the first pen while no mode was chosen by hand', () => {
    const f = filter('finger', false);
    expect(f.accepts(pen(1, 'down'))).toBe(true);
    expect(f.state()).toEqual({ mode: 'pen', chosenByHand: false });
    expect(f.accepts(touch(2, 'down'))).toBe(false);
  });

  it('never switches after a manual choice', () => {
    const f = filter('finger', false);
    f.setMode('finger');
    f.accepts(pen(1, 'down'));
    expect(f.state()).toEqual({ mode: 'finger', chosenByHand: true });
    f.accepts(pen(1, 'up'));
    expect(f.accepts(touch(2, 'down'))).toBe(true);
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
    f.accepts(touch(1, 'down'));
    f.setMode('multi');
    expect(f.accepts(touch(2, 'down'))).toBe(true);
    f.setMode('finger');
    expect(f.accepts(touch(1, 'move'))).toBe(false);
  });
});

describe('re-applying the current mode', () => {
  it('keeps the stroke in progress', () => {
    const f = filter('finger');
    f.accepts(touch(1, 'down'));
    f.setMode('finger', false);
    expect(f.accepts(touch(1, 'move'))).toBe(true);
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

describe('nextInputMode', () => {
  it('cycles finger → multi → pen → finger', () => {
    expect(nextInputMode('finger')).toBe('multi');
    expect(nextInputMode('multi')).toBe('pen');
    expect(nextInputMode('pen')).toBe('finger');
  });
});
