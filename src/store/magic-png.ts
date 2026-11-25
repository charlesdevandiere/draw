/**
 * The magic PNG: a normal PNG of the drawing on its white page, carrying the vector
 * drawing in an iTXt chunk (keyword `carnet-magique`, zlib-compressed JSON of the stored
 * schema). Shared from the gallery; exported and imported back by the settings page.
 *
 * No DOM here (Blob and compression streams exist in Node too): the image itself is
 * rendered by app/magic-image.ts.
 */
import type { Drawing } from '../engine/types';
import { MAGIC_KEYWORD, PngFormatError, readItxt, writeItxt } from './png-chunk';
import { parseDrawing, toStored } from './schema';

/** Side of the exported image, in pixels. */
export const EXPORT_SIZE = 2048;

/** Refuse bigger files and payloads: protects memory against hostile files. */
export interface MagicLimits {
  fileBytes: number;
  chunkBytes: number;
  jsonBytes: number;
}

export const MAGIC_LIMITS: MagicLimits = {
  fileBytes: 40 * 1024 * 1024,
  chunkBytes: 20 * 1024 * 1024,
  jsonBytes: 80 * 1024 * 1024,
};

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

/**
 * Adds the drawing to the bytes of its rendered PNG. Compressed when the platform has
 * CompressionStream ('deflate' is the zlib format the iTXt chunk expects).
 */
export async function embedDrawing(png: Uint8Array, drawing: Drawing): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(toStored(drawing)));
  const compress = typeof CompressionStream === 'function';
  const payload = compress
    ? await pipe(json, new CompressionStream('deflate'), Number.POSITIVE_INFINITY)
    : json;
  return writeItxt(png, MAGIC_KEYWORD, payload, compress);
}

/** Reads the drawing back from a magic PNG; throws MagicPngError for anything else. */
export async function decodeMagicPng(
  file: Blob,
  limits: MagicLimits = MAGIC_LIMITS,
): Promise<Drawing> {
  if (file.size > limits.fileBytes) throw new MagicPngError('too-large');
  const png = new Uint8Array(await file.arrayBuffer());
  let chunk: ReturnType<typeof readItxt>;
  try {
    chunk = readItxt(png, MAGIC_KEYWORD, limits.chunkBytes);
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
          limits.jsonBytes,
        )
      : chunk.payload;
    return parseDrawing(JSON.parse(new TextDecoder().decode(json)));
  } catch (error) {
    if (error instanceof MagicPngError) throw error;
    throw new MagicPngError('invalid', error);
  }
}
