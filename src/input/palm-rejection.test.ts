import { describe, expect, it } from 'vitest';
import { createPalmRejector, type PalmRejectionOptions } from './palm-rejection';

const DURING_STROKE: PalmRejectionOptions = {
  strategy: 'during-stroke',
  graceMs: 500,
  sessionMs: 10_000,
};
const PEN_SESSION: PalmRejectionOptions = { ...DURING_STROKE, strategy: 'pen-session' };
const NONE: PalmRejectionOptions = { ...DURING_STROKE, strategy: 'none' };

describe('strategy none', () => {
  it('accepts a touch while a pen is in contact', () => {
    const rejector = createPalmRejector(NONE);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 10 })).toBe(true);
  });

  it('never reports the finger as blocked', () => {
    const rejector = createPalmRejector(NONE);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });

    expect(rejector.isTouchBlocked(10)).toBe(false);
  });
});

describe('strategy during-stroke', () => {
  it('accepts a touch before any pen was seen', () => {
    const rejector = createPalmRejector(DURING_STROKE);

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 0 })).toBe(true);
  });

  it('ignores a touch while the pen is in contact', () => {
    const rejector = createPalmRejector(DURING_STROKE);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'move', timeStamp: 5_000 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'move', timeStamp: 5_001 })).toBe(false);
  });

  it('ignores a touch during the grace period after the pen lifts', () => {
    const rejector = createPalmRejector(DURING_STROKE);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 1_000 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 1_499 })).toBe(false);
  });

  it('accepts the touch again once the grace period is over', () => {
    const rejector = createPalmRejector(DURING_STROKE);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 1_000 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 1_500 })).toBe(true);
  });

  it('keeps ignoring touches while a second pen is still down', () => {
    const rejector = createPalmRejector(DURING_STROKE);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 10 });
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 20 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 5_000 })).toBe(false);
  });

  it('does not let an unmatched pen up make the contact count negative', () => {
    const rejector = createPalmRejector(DURING_STROKE);
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 1_000 });
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 1_100 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 2_000 })).toBe(true);
  });

  it('reports the finger as blocked only while touches are being ignored', () => {
    const rejector = createPalmRejector(DURING_STROKE);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 1_000 });

    expect(rejector.isTouchBlocked(1_200)).toBe(true);
    expect(rejector.isTouchBlocked(1_600)).toBe(false);
  });
});

describe('strategy pen-session', () => {
  it('accepts a touch before any pen was seen', () => {
    const rejector = createPalmRejector(PEN_SESSION);

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 0 })).toBe(true);
  });

  it('ignores a touch long after the grace period while the session is alive', () => {
    const rejector = createPalmRejector(PEN_SESSION);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 1_000 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 10_999 })).toBe(
      false,
    );
  });

  it('accepts the touch again after sessionMs without pen activity', () => {
    const rejector = createPalmRejector(PEN_SESSION);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 1_000 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 11_000 })).toBe(true);
  });

  it('extends the session with each pen move', () => {
    const rejector = createPalmRejector(PEN_SESSION);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });
    rejector.accepts({ pointerType: 'pen', phase: 'move', timeStamp: 8_000 });
    rejector.accepts({ pointerType: 'pen', phase: 'up', timeStamp: 9_000 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 18_000 })).toBe(
      false,
    );
  });

  it('ignores touches while a pen stays down longer than sessionMs', () => {
    const rejector = createPalmRejector(PEN_SESSION);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });

    expect(rejector.accepts({ pointerType: 'touch', phase: 'down', timeStamp: 60_000 })).toBe(
      false,
    );
  });
});

describe('non-touch pointers', () => {
  it('always accepts the mouse, even during a pen stroke', () => {
    const rejector = createPalmRejector(PEN_SESSION);
    rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 });

    expect(rejector.accepts({ pointerType: 'mouse', phase: 'down', timeStamp: 10 })).toBe(true);
  });

  it('always accepts the pen itself', () => {
    const rejector = createPalmRejector(PEN_SESSION);

    expect(rejector.accepts({ pointerType: 'pen', phase: 'down', timeStamp: 0 })).toBe(true);
  });
});
