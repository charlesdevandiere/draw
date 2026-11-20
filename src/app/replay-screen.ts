/**
 * DOM side of the replay: a full-screen page where the drawing redraws itself stroke by
 * stroke (eraser included), following the schedule of engine/replay.ts. Touching the page
 * stops it; a button plays it again at the end.
 */
import { backingSize, pageToBacking } from '../engine/page-transform';
import { renderDrawing, renderStroke, setPageScale } from '../engine/render';
import { planReplay, visiblePoints, type ReplayPlan } from '../engine/replay';
import { PAGE_SIZE, POINT_STRIDE, type Drawing } from '../engine/types';

export interface ReplayScreenOptions {
  canvas: HTMLCanvasElement;
  playAgain: HTMLButtonElement;
  /** Called when the child stops the replay by touching the page. */
  onStop: () => void;
}

export interface ReplayScreen {
  /** Starts the replay; the replay screen must be visible (it sizes its canvas). */
  play(drawing: Drawing): void;
  stop(): void;
}

export function initReplayScreen(options: ReplayScreenOptions): ReplayScreen {
  const { canvas, playAgain } = options;
  const contextOrNull = canvas.getContext('2d');
  if (!contextOrNull) throw new Error('Canvas 2D is not available');
  const context = contextOrNull;

  let plan: ReplayPlan | null = null;
  let drawing: Drawing | null = null;
  let frame = 0;
  let startedAt = 0;
  /** Points already painted, per planned stroke. */
  let painted: number[] = [];

  function prepareCanvas(): void {
    const size = canvas.getBoundingClientRect().width;
    const backing = backingSize(size, window.devicePixelRatio);
    canvas.width = backing;
    canvas.height = backing;
    renderDrawing(context, [], pageToBacking(backing), PAGE_SIZE);
    // A cleared canvas: every visible point must be painted again.
    painted = plan ? plan.strokes.map(() => 0) : [];
  }

  function tick(now: number): void {
    if (!plan) return;
    const elapsed = now - startedAt;
    setPageScale(context, pageToBacking(canvas.width));
    plan.strokes.forEach(({ stroke, times }, index) => {
      const visible = visiblePoints(times, elapsed);
      const done = painted[index] ?? 0;
      if (visible <= done) return;
      // Paint the newly visible part, joined to what is already there.
      renderStroke(
        context,
        { ...stroke, points: stroke.points.slice(0, visible * POINT_STRIDE) },
        done,
      );
      painted[index] = visible;
    });
    if (elapsed >= plan.duration) {
      frame = 0;
      const hadFocus = document.activeElement === canvas;
      playAgain.hidden = false;
      if (hadFocus) playAgain.focus();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function stop(): void {
    cancelAnimationFrame(frame);
    frame = 0;
    plan = null;
  }

  function play(next: Drawing): void {
    stop();
    drawing = next;
    plan = planReplay(next.strokes);
    playAgain.hidden = true;
    prepareCanvas();
    // The button pressed (gallery card, "play again") is hidden: keep the focus on the page.
    canvas.focus();
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function stopAndLeave(): void {
    stop();
    options.onStop();
  }

  canvas.addEventListener('pointerdown', stopAndLeave);
  // Keyboard users stop it too (the canvas is labelled "touch to stop").
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      event.preventDefault();
      stopAndLeave();
    }
  });
  // Rotation or resize while it plays (or once it ended): resize the canvas, repaint.
  window.addEventListener('resize', () => {
    if (!plan || canvas.getBoundingClientRect().width === 0) return;
    prepareCanvas();
    if (frame === 0) tick(performance.now());
  });
  playAgain.addEventListener('click', () => {
    if (drawing) play(drawing);
  });

  return { play, stop };
}
