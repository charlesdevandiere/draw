/**
 * Press-and-hold gesture (pure): a long-press action runs only after a continuous press of
 * `durationMs`. Releasing earlier cancels. Time is passed in.
 */

/** One duration for every long press (spec/SPEC-ui-foundation.md). */
export const LONG_PRESS_MS = 1500;

export interface Hold {
  press(now: number): void;
  release(): void;
  /** 0 when not pressed, up to 1 when the hold is complete. */
  progress(now: number): number;
  complete(now: number): boolean;
}

export function createHold(durationMs: number = LONG_PRESS_MS): Hold {
  let pressedAt: number | null = null;

  const progress = (now: number): number =>
    pressedAt === null ? 0 : Math.min(1, Math.max(0, (now - pressedAt) / durationMs));

  return {
    press(now) {
      pressedAt = now;
    },
    release() {
      pressedAt = null;
    },
    progress,
    complete: (now) => progress(now) >= 1,
  };
}
