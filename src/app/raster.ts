/**
 * Renders a drawing to an image (DOM): gallery thumbnails and shared PNGs. Strokes are
 * painted on a transparent layer first (the eraser clears that layer), then laid over the
 * white page.
 */
import { renderDrawing } from '../engine/render';
import { PAGE_SIZE, type Stroke } from '../engine/types';

const PAGE_COLOR = '#ffffff';

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  return context;
}

/** A square canvas of `size` pixels showing the drawing on its white page. */
export function rasterize(strokes: readonly Stroke[], size: number): HTMLCanvasElement {
  const layer = document.createElement('canvas');
  layer.width = size;
  layer.height = size;
  renderDrawing(context2d(layer), strokes, size / PAGE_SIZE, PAGE_SIZE);

  const page = document.createElement('canvas');
  page.width = size;
  page.height = size;
  const context = context2d(page);
  context.fillStyle = PAGE_COLOR;
  context.fillRect(0, 0, size, size);
  context.drawImage(layer, 0, 0);
  return page;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
      'image/png',
    );
  });
}

/** Gallery thumbnail: small, 2x for sharp display. */
export const THUMBNAIL_SIZE = 320;

export function renderThumbnail(strokes: readonly Stroke[]): Promise<Blob> {
  return canvasToPng(rasterize(strokes, THUMBNAIL_SIZE));
}
