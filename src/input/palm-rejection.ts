export type PalmRejectionStrategy = 'none' | 'during-stroke' | 'pen-session';

export interface PalmRejectionOptions {
  strategy: PalmRejectionStrategy;
  /** Grace after the pen's last activity (during-stroke strategy). */
  graceMs: number;
  /** Time without pen activity before touch draws again (pen-session strategy). */
  sessionMs: number;
}

export interface PointerInput {
  pointerType: string;
  /** `up` also covers `pointercancel`. */
  phase: 'down' | 'move' | 'up';
  timeStamp: number;
}

export interface PalmRejector {
  /** Records the event and tells whether it should draw. */
  accepts(input: PointerInput): boolean;
  /** Whether a touch arriving at `timeStamp` would be ignored. */
  isTouchBlocked(timeStamp: number): boolean;
}

export function createPalmRejector(options: PalmRejectionOptions): PalmRejector {
  let pensDown = 0;
  let lastPenActivity = Number.NEGATIVE_INFINITY;

  function isTouchBlocked(timeStamp: number): boolean {
    switch (options.strategy) {
      case 'none':
        return false;
      case 'during-stroke':
        return pensDown > 0 || timeStamp - lastPenActivity < options.graceMs;
      case 'pen-session':
        return pensDown > 0 || timeStamp - lastPenActivity < options.sessionMs;
    }
  }

  function accepts(input: PointerInput): boolean {
    if (input.pointerType === 'pen') {
      if (input.phase === 'down') pensDown += 1;
      if (input.phase === 'up') pensDown = Math.max(0, pensDown - 1);
      lastPenActivity = input.timeStamp;
      return true;
    }
    if (input.pointerType !== 'touch') return true;
    return !isTouchBlocked(input.timeStamp);
  }

  return { accepts, isTouchBlocked };
}
