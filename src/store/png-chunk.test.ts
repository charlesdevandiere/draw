import { describe, expect, it } from 'vitest';
import { MAGIC_KEYWORD, PngFormatError, crc32, readChunks, readItxt, writeItxt } from './png-chunk';

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

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
/** A structurally valid PNG (the pixel data is not decoded here). */
const PNG = concat(
  SIGNATURE,
  chunk('IHDR', new Uint8Array(13)),
  chunk('IDAT', Uint8Array.of(1, 2, 3)),
  chunk('IEND'),
);

describe('crc32', () => {
  it('matches the reference values', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(encoder.encode('IEND'))).toBe(0xae426082);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('readChunks', () => {
  it('lists the chunks of a PNG', () => {
    expect(readChunks(PNG).map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it.each([
    ['not a PNG', encoder.encode('GIF89a......')],
    ['an empty file', new Uint8Array()],
    ['a truncated chunk', PNG.subarray(0, PNG.length - 6)],
    ['a missing IEND', concat(SIGNATURE, chunk('IHDR', new Uint8Array(13)))],
    ['a chunk header cut short', concat(SIGNATURE, Uint8Array.of(0, 0, 0))],
  ])('refuses %s', (_label, bytes) => {
    expect(() => readChunks(bytes)).toThrow(PngFormatError);
  });

  it('refuses a corrupted chunk (bad CRC)', () => {
    const corrupt = PNG.slice();
    corrupt[8 + 8] = 0xff; // first byte of IHDR data
    expect(() => readChunks(corrupt)).toThrow(/bad CRC/);
  });
});

describe('iTXt', () => {
  const payload = encoder.encode('{"schema":1,"note":"élan"}');

  it('writes a chunk before IEND and reads it back', () => {
    const png = writeItxt(PNG, MAGIC_KEYWORD, payload, false);
    expect(readChunks(png).map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'iTXt', 'IEND']);
    expect(readItxt(png, MAGIC_KEYWORD, 1000)).toEqual({ payload, compressed: false });
  });

  it('keeps the compression flag', () => {
    const png = writeItxt(PNG, MAGIC_KEYWORD, Uint8Array.of(9, 8, 7), true);
    expect(readItxt(png, MAGIC_KEYWORD, 1000)?.compressed).toBe(true);
  });

  it('replaces an existing chunk with the same keyword, keeps others', () => {
    const other = writeItxt(PNG, 'Comment', encoder.encode('hi'), false);
    const once = writeItxt(other, MAGIC_KEYWORD, encoder.encode('one'), false);
    const twice = writeItxt(once, MAGIC_KEYWORD, encoder.encode('two'), false);
    expect(readChunks(twice).filter((c) => c.type === 'iTXt')).toHaveLength(2);
    expect(readItxt(twice, MAGIC_KEYWORD, 100)?.payload).toEqual(encoder.encode('two'));
    expect(readItxt(twice, 'Comment', 100)?.payload).toEqual(encoder.encode('hi'));
  });

  it('returns null when there is no such chunk', () => {
    expect(readItxt(PNG, MAGIC_KEYWORD, 100)).toBeNull();
    expect(readItxt(writeItxt(PNG, 'Other', payload, false), MAGIC_KEYWORD, 100)).toBeNull();
  });

  it('refuses a chunk larger than allowed', () => {
    const png = writeItxt(PNG, MAGIC_KEYWORD, payload, false);
    expect(() => readItxt(png, MAGIC_KEYWORD, payload.length - 1)).toThrow(/too large/);
  });

  it('refuses a bad keyword', () => {
    expect(() => writeItxt(PNG, '', payload, false)).toThrow(PngFormatError);
    expect(() => writeItxt(PNG, 'x'.repeat(80), payload, false)).toThrow(PngFormatError);
    for (const keyword of [' lead', 'trail ', 'double  space']) {
      expect(() => writeItxt(PNG, keyword, payload, false)).toThrow(PngFormatError);
    }
    expect(readItxt(writeItxt(PNG, 'Two words', payload, false), 'Two words', 100)).not.toBeNull();
  });

  it('ignores malformed iTXt chunks', () => {
    const malformed = [
      Uint8Array.of(), // no keyword
      concat(encoder.encode(MAGIC_KEYWORD), Uint8Array.of(0, 2, 0, 0, 0)), // bad flag
      concat(encoder.encode(MAGIC_KEYWORD), Uint8Array.of(0, 0, 1, 0, 0)), // bad method
      concat(encoder.encode(MAGIC_KEYWORD), Uint8Array.of(0, 0, 0, 65)), // no language end
      concat(encoder.encode(MAGIC_KEYWORD), Uint8Array.of(0, 0, 0, 0, 65)), // no translated end
      concat(new Uint8Array(200_000).fill(65), Uint8Array.of(0, 0, 0, 0, 0)), // keyword too long
    ];
    for (const data of malformed) {
      const png = concat(
        SIGNATURE,
        chunk('IHDR', new Uint8Array(13)),
        chunk('iTXt', data),
        chunk('IEND'),
      );
      expect(readItxt(png, MAGIC_KEYWORD, 100)).toBeNull();
    }
  });

  it('does not modify its input', () => {
    const copy = PNG.slice();
    writeItxt(PNG, MAGIC_KEYWORD, payload, false);
    expect(PNG).toEqual(copy);
  });
});
