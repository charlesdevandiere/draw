/**
 * Renders a drawing to an image (DOM): gallery thumbnails and shared PNGs. Strokes are
 * painted on a transparent layer first (the eraser clears that layer), then laid over the
 * white page and its background template; the overlay template goes on top.
 */
import { currentLayers } from '../engine/layers';
import { renderDrawing } from '../engine/render';
import { PAGE_SIZE, type Drawing, type TemplateLayer } from '../engine/types';
import { templateImage } from './template-image';

/** What an image of a drawing shows. */
export type DrawingPicture = Pick<Drawing, 'strokes' | 'templates'>;

const PAGE_COLOR = '#ffffff';

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  return context;
}

/** A template decoded at `size` pixels, or null (none, or an SVG this engine refuses). */
async function templateAt(layer: TemplateLayer | null, size: number) {
  if (!layer) return null;
  return templateImage(layer.svg, { size }).catch(() => null);
}

/** A square canvas of `size` pixels showing the drawing on its white page. */
export async function rasterize(drawing: DrawingPicture, size: number): Promise<HTMLCanvasElement> {
  const layers = currentLayers(drawing.templates);
  const [background, overlay] = await Promise.all([
    templateAt(layers.background, size),
    templateAt(layers.overlay, size),
  ]);
  const layer = document.createElement('canvas');
  layer.width = size;
  layer.height = size;
  renderDrawing(context2d(layer), drawing.strokes, size / PAGE_SIZE, PAGE_SIZE);

  const page = document.createElement('canvas');
  page.width = size;
  page.height = size;
  const context = context2d(page);
  context.fillStyle = PAGE_COLOR;
  context.fillRect(0, 0, size, size);
  if (background) context.drawImage(background, 0, 0, size, size);
  context.drawImage(layer, 0, 0);
  if (overlay) context.drawImage(overlay, 0, 0, size, size);
  release(layer);
  return page;
}

/**
 * Frees a canvas' pixels now: iOS Safari caps the total canvas memory and collects
 * detached canvases late, so repeated exports would otherwise make getContext fail.
 */
function release(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/** Encodes the canvas as PNG, then releases its pixels: the canvas is not usable after. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      release(canvas);
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

/** Gallery thumbnail: small, 2x for sharp display. */
export const THUMBNAIL_SIZE = 320;

export async function renderThumbnail(drawing: DrawingPicture): Promise<Blob> {
  return canvasToPng(await rasterize(drawing, THUMBNAIL_SIZE));
}
