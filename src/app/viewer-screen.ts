/**
 * DOM side of the viewer (spec/SPEC-gallery-viewer.md): one drawing on its page, redrawing
 * itself stroke by stroke (eraser included) on the schedule of engine/replay.ts, with a
 * progress bar and play / pause / restart driven by engine/replay-clock.ts. Touching the
 * page toggles pause. The other actions (back, continue, share, trash) are wired by main.
 */
import { backingSize, pageToBacking } from '../engine/page-transform';
import { renderDrawing, renderStroke, setPageScale } from '../engine/render';
import { layersAtReplayTime, planReplay, visiblePoints, type ReplayPlan } from '../engine/replay';
import { createReplayClock, type ReplayClock } from '../engine/replay-clock';
import { PAGE_SIZE, POINT_STRIDE, type Drawing } from '../engine/types';
import type { Translator } from '../i18n/i18n';
import { createLayerCanvas } from './layer-canvas';

export interface ViewerOptions {
  canvas: HTMLCanvasElement;
  /** Canvases of the template layers, under and above the drawing canvas. */
  background: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  /** Overlay outline width kept constant (CSS pixels), or null to scale it. */
  fixedOutline?: () => number | null;
  progress: HTMLElement;
  playButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
  t: Translator['t'];
  /** Escape on the page: back to the gallery. */
  onBack: () => void;
}

export interface Viewer {
  /** Shows a drawing and plays it; the viewer screen must be visible (it sizes its canvas). */
  open(drawing: Drawing): void;
  /** Stops painting (the viewer is left); the replay stays where it was. */
  close(): void;
  /** The drawing last opened. */
  drawing(): Drawing | null;
  /** Repaints the template layers (a setting changed). */
  refreshLayers(): void;
}

export function initViewer(options: ViewerOptions): Viewer {
  const { canvas, progress, playButton, restartButton, t } = options;
  const contextOrNull = canvas.getContext('2d');
  if (!contextOrNull) throw new Error('Canvas 2D is not available');
  const context = contextOrNull;
  const bar = progress.firstElementChild instanceof HTMLElement ? progress.firstElementChild : null;
  const playIcon = playButton.querySelector('.icon');
  const background = createLayerCanvas(options.background);
  const overlay = createLayerCanvas(options.overlay, { fixedOutline: options.fixedOutline });

  let drawing: Drawing | null = null;
  let plan: ReplayPlan | null = null;
  let clock: ReplayClock | null = null;
  let frame = 0;
  /** Points already painted, per planned stroke. */
  let painted: number[] = [];
  /** Replay time last painted: going back (restart) clears the page first. */
  let paintedUntil = 0;
  let shownPercent = -1;
  /** Play state last shown on the button: it changes rarely, frames come 60 times a second. */
  let shownPlaying: boolean | null = null;

  function clearCanvas(): void {
    const size = canvas.getBoundingClientRect().width;
    const backing = backingSize(size, window.devicePixelRatio);
    if (canvas.width !== backing) {
      canvas.width = backing;
      canvas.height = backing;
    }
    background.resize(backing);
    overlay.resize(backing);
    renderDrawing(context, [], pageToBacking(backing), PAGE_SIZE);
    painted = plan ? plan.strokes.map(() => 0) : [];
    paintedUntil = 0;
  }

  /** The template layers placed by replay time `elapsed`. */
  function showLayers(elapsed: number): void {
    if (!plan) return;
    const layers = layersAtReplayTime(plan, elapsed);
    background.set(layers.background);
    overlay.set(layers.overlay);
  }

  function paintTo(elapsed: number): void {
    if (!plan || !drawing) return;
    showLayers(elapsed);
    if (elapsed < paintedUntil) clearCanvas();
    if (elapsed >= plan.duration) {
      // Simultaneous strokes were painted interleaved, frame by frame (as when drawn): end
      // on the drawing exactly as stored, so an eraser among them leaves the same result.
      renderDrawing(context, drawing.strokes, pageToBacking(canvas.width), PAGE_SIZE);
      painted = plan.strokes.map(({ times }) => times.length);
      paintedUntil = elapsed;
      return;
    }
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
    paintedUntil = elapsed;
  }

  function showState(now: number): void {
    if (!clock) return;
    const percent = Math.round(clock.progress(now) * 100);
    if (percent !== shownPercent) {
      shownPercent = percent;
      if (bar) bar.style.width = `${percent}%`;
      progress.setAttribute('aria-valuenow', String(percent));
    }
    const playing = clock.playing && !clock.ended(now);
    if (playing === shownPlaying) return;
    shownPlaying = playing;
    playButton.setAttribute('aria-label', t(playing ? 'viewer.pause' : 'viewer.play'));
    playIcon?.classList.toggle('icon-pause', playing);
    playIcon?.classList.toggle('icon-play', !playing);
  }

  function tick(now: number): void {
    // Called directly (toggle, restart, resize) while a frame may be pending: one loop only.
    cancelAnimationFrame(frame);
    frame = 0;
    if (!clock) return;
    paintTo(clock.elapsed(now));
    showState(now);
    if (clock.playing && !clock.ended(now)) frame = requestAnimationFrame(tick);
  }

  function schedule(): void {
    if (frame === 0) frame = requestAnimationFrame(tick);
  }

  function stopFrames(): void {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function toggle(): void {
    if (!clock) return;
    const now = performance.now();
    if (clock.playing && !clock.ended(now)) clock.pause(now);
    else clock.play(now);
    tick(now);
  }

  function open(next: Drawing): void {
    stopFrames();
    drawing = next;
    plan = planReplay(next.strokes, {}, next.templates);
    clock = createReplayClock(plan.duration);
    shownPercent = -1;
    shownPlaying = null;
    // The layers of this drawing at the start, never the last drawing's.
    showLayers(0);
    clearCanvas();
    const now = performance.now();
    clock.play(now);
    showState(now);
    schedule();
  }

  function close(): void {
    stopFrames();
    if (clock) clock.pause(performance.now());
  }

  // One toggle per touch: a second finger (or a resting palm) must not undo the first.
  canvas.addEventListener('pointerdown', (event) => {
    if (event.isPrimary) toggle();
  });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  });
  // Escape anywhere on the viewer (the play button has the focus when it opens).
  (canvas.closest('.screen') ?? canvas).addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent) || event.key !== 'Escape') return;
    event.preventDefault();
    options.onBack();
  });
  playButton.addEventListener('click', toggle);
  restartButton.addEventListener('click', () => {
    if (!clock) return;
    const now = performance.now();
    clock.restart(now);
    tick(now);
  });
  // Rotation or resize: resize the canvas and repaint up to the same point.
  window.addEventListener('resize', () => {
    if (!clock || canvas.getBoundingClientRect().width === 0) return;
    clearCanvas();
    tick(performance.now());
  });
  // Going to the background pauses: the child finds the replay where it was.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && clock && frame !== 0) {
      stopFrames();
      clock.pause(performance.now());
      showState(performance.now());
    }
  });

  return {
    open,
    close,
    drawing: () => drawing,
    refreshLayers() {
      if (canvas.width === 0) return;
      background.resize(canvas.width);
      overlay.resize(canvas.width);
    },
  };
}
