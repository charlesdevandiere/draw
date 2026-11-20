/** DOM side of the magic PNG: renders the drawing, then embeds its vectors. */
import type { Drawing } from '../engine/types';
import { EXPORT_SIZE, embedDrawing } from '../store/magic-png';
import { canvasToPng, rasterize } from './raster';

export async function encodeMagicPng(drawing: Drawing): Promise<Blob> {
  const image = await canvasToPng(rasterize(drawing.strokes, EXPORT_SIZE));
  const bytes = await embedDrawing(new Uint8Array(await image.arrayBuffer()), drawing);
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
}
