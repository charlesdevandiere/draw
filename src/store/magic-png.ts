/**
 * The magic PNG (DOM): a normal PNG of the drawing on its white page, carrying the vector
 * drawing in an iTXt chunk (keyword `carnet-magique`, zlib-compressed JSON of the stored
 * schema). Shared from the gallery; imported back by the parent page.
 */
import { canvasToPng, rasterize } from '../app/raster';
import type { Drawing } from '../engine/types';
import { MAGIC_KEYWORD, PngFormatError, readItxt, writeItxt } from './png-chunk';
import { parseDrawing, toStored } from './schema';

/** Side of the exported image, in pixels. */
export const EXPORT_SIZE = 2048;
/** Refuse bigger files and payloads: protects memory against hostile files. */
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
export const MAX_CHUNK_BYTES = 20 * 1024 * 1024;
export const MAX_JSON_BYTES = 80 * 1024 * 1024;

export type MagicPngProblem = 'not-png' | 'not-magic' | 'invalid' | 'too-large';

export class MagicPngError extends Error {
  constructor(
    readonly problem: MagicPngProblem,
    cause?: unknown,
  ) {
    super(`Not a valid magic PNG: ${problem}`, { cause });
    this.name = 'MagicPngError';
  }
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  limit: number,
): Promise<Uint8Array> {
  const reader = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(stream).getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    // Stop a decompression bomb early.
    if (total > limit) {
      await reader.cancel();
      throw new MagicPngError('too-large');
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const canCompress = typeof CompressionStream === 'function';

export async function encodeMagicPng(drawing: Drawing): Promise<Blob> {
  const image = await canvasToPng(rasterize(drawing.strokes, EXPORT_SIZE));
  const png = new Uint8Array(await image.arrayBuffer());
  const json = new TextEncoder().encode(JSON.stringify(toStored(drawing)));
  // 'deflate' is the zlib format the iTXt chunk expects.
  const payload = canCompress
    ? await pipe(json, new CompressionStream('deflate'), Number.POSITIVE_INFINITY)
    : json;
  const bytes = writeItxt(png, MAGIC_KEYWORD, payload, canCompress);
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
}

/** Reads the drawing back from a magic PNG; throws MagicPngError for anything else. */
export async function decodeMagicPng(file: Blob): Promise<Drawing> {
  if (file.size > MAX_FILE_BYTES) throw new MagicPngError('too-large');
  const png = new Uint8Array(await file.arrayBuffer());
  let chunk: ReturnType<typeof readItxt>;
  try {
    chunk = readItxt(png, MAGIC_KEYWORD, MAX_CHUNK_BYTES);
  } catch (error) {
    if (error instanceof PngFormatError && error.message.includes('too large')) {
      throw new MagicPngError('too-large', error);
    }
    throw new MagicPngError('not-png', error);
  }
  if (!chunk) throw new MagicPngError('not-magic');
  try {
    const json = chunk.compressed
      ? await pipe(
          new Uint8Array(chunk.payload),
          new DecompressionStream('deflate'),
          MAX_JSON_BYTES,
        )
      : chunk.payload;
    return parseDrawing(JSON.parse(new TextDecoder().decode(json)));
  } catch (error) {
    if (error instanceof MagicPngError) throw error;
    throw new MagicPngError('invalid', error);
  }
}
