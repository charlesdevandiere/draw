/**
 * Input modes of the drawing screen (spec A3, measurements in
 * docs/diagnostic/conclusions.md):
 *
 * - **pen**: only `pen` pointers draw; every touch (palm included) is ignored.
 * - **finger**: one contact draws at a time. The first contact keeps the slot until no
 *   contact at all touches the screen, then the slot stays locked a little longer, so a
 *   palm still resting (or lifted a moment later) cannot start a stroke. Contacts wider
 *   than a threshold (a palm) never draw but hold the slot like any other contact.
 * - **multi**: every contact draws, one stroke per pointer.
 *
 * Pens and mice always draw. The first pen seen switches to the pen mode, unless a mode
 * was chosen by hand. Pure logic: time stamps and widths are passed in.
 */

export type InputMode = 'pen' | 'finger' | 'multi';

export const INPUT_MODES: readonly InputMode[] = ['pen', 'finger', 'multi'];

export interface FingerSettings {
  /** Contacts wider than this (CSS px) are ignored; null turns the filter off. */
  widthThreshold: number | null;
  /** How long the slot stays locked once every contact is lifted (ms). */
  releaseDelayMs: number;
}

export const DEFAULT_FINGER_SETTINGS: FingerSettings = { widthThreshold: 80, releaseDelayMs: 300 };

export interface ContactInput {
  pointerId: number;
  pointerType: string;
  phase: 'down' | 'move' | 'up';
  timeStamp: number;
  /** Contact width in CSS px (`PointerEvent.width`). */
  width: number;
}

export interface InputModeState {
  mode: InputMode;
  /** Once a mode is chosen by hand, the pen no longer switches it automatically. */
  chosenByHand: boolean;
}

export interface InputFilter {
  /**
   * Feeds every down / move / up (`pointercancel` counts as up) of the drawing surface.
   * For down and move: true when the contact draws. For up: always false (bookkeeping).
   */
  accepts(input: ContactInput): boolean;
  state(): InputModeState;
  /** A mode chosen by the user (or restored from settings with its flag). */
  setMode(mode: InputMode, chosenByHand?: boolean): void;
  setFingerSettings(settings: FingerSettings): void;
}

export function isInputMode(value: unknown): value is InputMode {
  return typeof value === 'string' && (INPUT_MODES as readonly string[]).includes(value);
}

export function createInputFilter(
  initial: InputModeState,
  initialSettings: FingerSettings = DEFAULT_FINGER_SETTINGS,
): InputFilter {
  let { mode, chosenByHand } = initial;
  let settings = initialSettings;
  /** Touches currently on the screen, drawing or not. */
  const touchesDown = new Set<number>();
  /** The touch holding the finger-mode slot. */
  let owner: number | null = null;
  /** The finger slot cannot be taken before this time stamp. */
  let lockedUntil = Number.NEGATIVE_INFINITY;

  function tooWide(width: number): boolean {
    return settings.widthThreshold !== null && width > settings.widthThreshold;
  }

  /**
   * Down or move of a touch in finger mode: only the slot owner draws. A palm often lands
   * edge first and only then spreads: an owner growing past the threshold stops drawing
   * but keeps the slot.
   */
  function touchInFingerMode(input: ContactInput): boolean {
    if (input.phase === 'down') {
      const alone = touchesDown.size === 1;
      if (owner === null && alone && input.timeStamp >= lockedUntil && !tooWide(input.width)) {
        owner = input.pointerId;
      }
    }
    return owner === input.pointerId && !tooWide(input.width);
  }

  function accepts(input: ContactInput): boolean {
    if (input.pointerType === 'pen') {
      if (input.phase === 'down' && !chosenByHand) mode = 'pen';
      return true;
    }
    if (input.pointerType !== 'touch') return true;

    if (input.phase === 'down') touchesDown.add(input.pointerId);
    if (input.phase === 'up') {
      // Bookkeeping only: the caller ends the stroke (if any) whatever is returned.
      touchesDown.delete(input.pointerId);
      if (owner === input.pointerId) owner = null;
      if (touchesDown.size === 0) lockedUntil = input.timeStamp + settings.releaseDelayMs;
      return false;
    }
    if (mode === 'pen') return false;
    if (mode === 'multi') return true;
    return touchInFingerMode(input);
  }

  return {
    accepts,
    state: () => ({ mode, chosenByHand }),
    setMode(next, byHand = true) {
      // Re-applying the current mode (settings restored) must not cut the stroke in progress.
      if (next !== mode) owner = null;
      mode = next;
      chosenByHand = chosenByHand || byHand;
    },
    setFingerSettings(next) {
      settings = next;
    },
  };
}
