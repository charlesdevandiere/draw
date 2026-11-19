export type PalmRejectionStrategy = 'none' | 'during-stroke' | 'pen-session';

export interface PalmRejectionOptions {
  strategy: PalmRejectionStrategy;
  /** Grace after the pen's last activity (during-stroke strategy). */
  graceMs: number;
  /** Time without pen activity before touch draws again (pen-session strategy). */
  sessionMs: number;
  /**
   * Only one touch draws at a time: the first one keeps priority until it lifts,
   * and any other touch (a palm landing mid-stroke) is ignored.
   */
  singleTouch: boolean;
}

export interface PointerInput {
  pointerId: number;
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
  /** Whether another touch holds the single drawing slot (always false without singleTouch). */
  isSlotTaken(pointerId: number): boolean;
}

export function createPalmRejector(options: PalmRejectionOptions): PalmRejector {
  let pensDown = 0;
  let lastPenActivity = Number.NEGATIVE_INFINITY;
  /** pointerId of the touch currently drawing (singleTouch only). */
  let slotOwner: number | null = null;

  function isSlotTaken(pointerId: number): boolean {
    return options.singleTouch && slotOwner !== null && slotOwner !== pointerId;
  }

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
    if (input.phase === 'up') {
      if (slotOwner === input.pointerId) slotOwner = null;
      return true;
    }
    if (isTouchBlocked(input.timeStamp) || isSlotTaken(input.pointerId)) return false;
    if (input.phase === 'down' && options.singleTouch) slotOwner = input.pointerId;
    return true;
  }

  return { accepts, isTouchBlocked, isSlotTaken };
}
