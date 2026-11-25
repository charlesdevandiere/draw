/**
 * Replay clock (pure, spec/SPEC-gallery-viewer.md): the position in a replay of `duration`
 * ms that can be paused, resumed and restarted. Time is passed in. Playing once the end is
 * reached starts again from the beginning.
 */

export interface ReplayClock {
  /** Stays true once the end is reached while playing: check `ended(now)` for the end. */
  readonly playing: boolean;
  play(now: number): void;
  pause(now: number): void;
  restart(now: number): void;
  /** Replay time reached, from 0 to the duration. */
  elapsed(now: number): number;
  /** Share of the replay played, from 0 to 1. */
  progress(now: number): number;
  ended(now: number): boolean;
}

export function createReplayClock(duration: number): ReplayClock {
  let playing = false;
  /** Replay time reached when the clock last started or paused. */
  let offset = 0;
  let startedAt = 0;

  const elapsed = (now: number): number =>
    Math.min(duration, Math.max(0, offset + (playing ? Math.max(0, now - startedAt) : 0)));
  const ended = (now: number): boolean => elapsed(now) >= duration;

  function restart(now: number): void {
    offset = 0;
    startedAt = now;
    playing = true;
  }

  return {
    get playing() {
      return playing;
    },
    play(now) {
      if (ended(now)) restart(now);
      else if (!playing) {
        startedAt = now;
        playing = true;
      }
    },
    pause(now) {
      if (!playing) return;
      offset = elapsed(now);
      playing = false;
    },
    restart,
    elapsed,
    progress: (now) => (duration <= 0 ? 1 : elapsed(now) / duration),
    ended,
  };
}
