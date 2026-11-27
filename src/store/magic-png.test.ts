import { describe, expect, it } from 'vitest';
import type { Drawing } from '../engine/types';
import { MAGIC_LIMITS, MagicPngError, decodeMagicPng, embedDrawing } from './magic-png';
import { MAGIC_KEYWORD, crc32, writeItxt } from './png-chunk';

const encoder = new TextEncoder();

function chunk(type: string, data: Uint8Array = new Uint8Array()): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(encoder.encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const PNG = Uint8Array.from([
  ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  ...chunk('IHDR', new Uint8Array(13)),
  ...chunk('IDAT', Uint8Array.of(1, 2, 3)),
  ...chunk('IEND'),
]);

const drawing: Drawing = {
  id: 'drawing-1',
  createdAt: 1,
  updatedAt: 2,
  templates: [],
  strokes: [
    { tool: 'pen', color: '#e53935', width: 8, points: [1, 2, 0, 3, 4, 16] },
    { tool: 'eraser', color: '#212121', width: 48, points: [5, 5, 40] },
  ],
};

async function problem(file: Blob, limits = MAGIC_LIMITS): Promise<string> {
  try {
    await decodeMagicPng(file, limits);
    return 'none';
  } catch (error) {
    return error instanceof MagicPngError ? error.problem : 'other';
  }
}

describe('magic PNG', () => {
  it('round-trips a drawing through the PNG bytes (compressed)', async () => {
    const bytes = await embedDrawing(PNG, drawing);
    expect(await decodeMagicPng(new Blob([new Uint8Array(bytes)]))).toEqual(drawing);
  });

  it('round-trips template layers', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="M0 0L9 9"/></svg>';
    const layered: Drawing = {
      ...drawing,
      templates: [
        {
          slot: 'overlay',
          at: 1,
          t: 20,
          layer: { slot: 'overlay', template: 'coloring/fish', version: 1, params: {}, svg },
        },
      ],
    };
    const bytes = await embedDrawing(PNG, layered);
    expect(await decodeMagicPng(new Blob([new Uint8Array(bytes)]))).toEqual(layered);
  });

  it('round-trips the start zone of a stroke', async () => {
    const [first, second] = drawing.strokes;
    if (!first || !second) throw new Error('strokes missing');
    const zoned: Drawing = { ...drawing, strokes: [{ ...first, zone: [12.5, 40] }, second] };
    const bytes = await embedDrawing(PNG, zoned);
    expect(await decodeMagicPng(new Blob([new Uint8Array(bytes)]))).toEqual(zoned);
  });

  it('reads a schema 1 picture (made before template layers)', async () => {
    const old: Partial<Drawing> = { ...drawing };
    delete old.templates;
    const json = encoder.encode(JSON.stringify({ schema: 1, ...old }));
    const bytes = writeItxt(PNG, MAGIC_KEYWORD, json, false);
    expect(await decodeMagicPng(new Blob([new Uint8Array(bytes)]))).toEqual(drawing);
  });

  it('reads an uncompressed chunk too', async () => {
    const json = encoder.encode(JSON.stringify({ schema: 1, ...drawing }));
    const bytes = writeItxt(PNG, MAGIC_KEYWORD, json, false);
    expect(await decodeMagicPng(new Blob([new Uint8Array(bytes)]))).toEqual(drawing);
  });

  it('refuses a file that is not a PNG', async () => {
    expect(await problem(new Blob(['GIF89a']))).toBe('not-png');
  });

  it('refuses a plain PNG (a photo)', async () => {
    expect(await problem(new Blob([new Uint8Array(PNG)]))).toBe('not-magic');
  });

  it('refuses a chunk that is not a valid drawing', async () => {
    const bad = writeItxt(PNG, MAGIC_KEYWORD, encoder.encode('{"schema":1}'), false);
    expect(await problem(new Blob([new Uint8Array(bad)]))).toBe('invalid');
    const garbage = writeItxt(PNG, MAGIC_KEYWORD, Uint8Array.of(1, 2, 3), true);
    expect(await problem(new Blob([new Uint8Array(garbage)]))).toBe('invalid');
  });

  it('refuses files, chunks and inflated texts over the limits', async () => {
    const bytes = new Blob([new Uint8Array(await embedDrawing(PNG, drawing))]);
    expect(await problem(bytes, { ...MAGIC_LIMITS, fileBytes: 10 })).toBe('too-large');
    expect(await problem(bytes, { ...MAGIC_LIMITS, chunkBytes: 10 })).toBe('too-large');
    // A decompression bomb is stopped as soon as it passes the limit.
    expect(await problem(bytes, { ...MAGIC_LIMITS, jsonBytes: 20 })).toBe('too-large');
  });
});
