/**
 * A canvas showing one template layer (background or overlay) over the whole page, at the
 * same backing size as the drawing canvas. Images decode asynchronously: a newer paint
 * wins over an older one still decoding.
 */
import type { TemplateLayer } from '../engine/types';
import { templateImage } from './template-image';

export interface LayerCanvas {
  /** Shows a layer, or nothing. */
  set(layer: TemplateLayer | null): void;
  /** The backing size changed (resize): repaint at the new size. */
  resize(backing: number): void;
  /** Resolves once the last requested paint is on the canvas (tests, export). */
  ready(): Promise<void>;
}

export interface LayerCanvasOptions {
  /** Outline width kept constant (CSS pixels), or null to scale it with the page. */
  fixedOutline?: () => number | null;
}

export function createLayerCanvas(
  canvas: HTMLCanvasElement,
  options: LayerCanvasOptions = {},
): LayerCanvas {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  let layer: TemplateLayer | null = null;
  let generation = 0;
  let painted: Promise<void> = Promise.resolve();

  function clear(): void {
    context?.setTransform(1, 0, 0, 1, 0, 0);
    context?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function paint(): void {
    generation += 1;
    const mine = generation;
    const shown = layer;
    if (!shown || canvas.width === 0) {
      clear();
      canvas.dataset['template'] = '';
      painted = Promise.resolve();
      return;
    }
    const css = canvas.getBoundingClientRect().width;
    const outline = options.fixedOutline?.() ?? null;
    const fixedStrokeWidth =
      outline === null || css <= 0 ? undefined : (outline * canvas.width) / css;
    painted = templateImage(shown.svg, { size: canvas.width, fixedStrokeWidth }).then(
      (image) => {
        if (mine !== generation) return;
        clear();
        context?.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.dataset['template'] = shown.template;
      },
      () => {
        // An SVG this engine cannot decode shows nothing; the drawing still works.
        if (mine !== generation) return;
        clear();
        canvas.dataset['template'] = '';
      },
    );
  }

  return {
    set(next) {
      if (next === layer) return;
      layer = next;
      // Another layer: the previous one never shows over it while it decodes.
      clear();
      canvas.dataset['template'] = '';
      paint();
    },
    resize(backing) {
      if (canvas.width !== backing || canvas.height !== backing) {
        canvas.width = backing;
        canvas.height = backing;
      }
      paint();
    },
    ready: () => painted,
  };
}
