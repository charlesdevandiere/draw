/**
 * Reads and writes an `iTXt` chunk in PNG bytes (pure). The magic PNG keeps the vector
 * drawing in such a chunk (keyword `carnet-magique`): any viewer shows the image, the app
 * reads the drawing back. Compression of the text is the caller's job (CompressionStream),
 * this module only lays out bytes.
 *
 * PNG layout: an 8-byte signature, then chunks of [length u32 BE][type 4][data][CRC-32 of
 * type + data]. iTXt data: keyword, 0, compression flag, compression method (0 = zlib),
 * language tag, 0, translated keyword, 0, text.
 */

export const MAGIC_KEYWORD = 'carnet-magique';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ITXT = 'iTXt';
const MAX_KEYWORD = 79;
const IEND = 'IEND';

export class PngFormatError extends Error {
  constructor(reason: string) {
    super(`Invalid PNG: ${reason}`);
    this.name = 'PngFormatError';
  }
}

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

/** CRC-32 (ISO 3309, as used by PNG). */
export function crc32(bytes: Uint8Array): number {
  const t = table();
  let c = 0xffffffff;
  for (const byte of bytes) c = (t[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Chunk {
  type: string;
  /** Offset of the chunk's length field. */
  start: number;
  /** Offset just after its CRC. */
  end: number;
  data: Uint8Array;
}

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function asciiBytes(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

/** Splits PNG bytes into chunks, checking the signature, bounds and every CRC. */
export function readChunks(png: Uint8Array): Chunk[] {
  if (png.length < SIGNATURE.length || SIGNATURE.some((byte, i) => png[i] !== byte)) {
    throw new PngFormatError('bad signature');
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Chunk[] = [];
  let offset = SIGNATURE.length;
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new PngFormatError('truncated chunk');
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > png.length) throw new PngFormatError('truncated chunk');
    const typeAndData = png.subarray(offset + 4, offset + 8 + length);
    if (crc32(typeAndData) !== view.getUint32(offset + 8 + length)) {
      throw new PngFormatError('bad CRC');
    }
    const type = ascii(typeAndData.subarray(0, 4));
    chunks.push({ type, start: offset, end, data: typeAndData.subarray(4) });
    offset = end;
    if (type === IEND) break;
  }
  if (chunks.at(-1)?.type !== IEND) throw new PngFormatError('missing IEND');
  return chunks;
}

function chunkBytes(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(asciiBytes(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function itxtData(keyword: string, payload: Uint8Array, compressed: boolean): Uint8Array {
  const key = asciiBytes(keyword);
  // keyword \0 flag method language(empty) \0 translated(empty) \0 text
  const out = new Uint8Array(key.length + 5 + payload.length);
  out.set(key, 0);
  let i = key.length;
  out[i++] = 0;
  out[i++] = compressed ? 1 : 0;
  out[i++] = 0;
  out[i++] = 0;
  out[i++] = 0;
  out.set(payload, i);
  return out;
}

interface ItxtContent {
  keyword: string;
  compressed: boolean;
  payload: Uint8Array;
}

function parseItxt(data: Uint8Array): ItxtContent | null {
  // A keyword is 1-79 bytes: a longer one is malformed (and would overflow `ascii`).
  const keywordEnd = data.subarray(0, MAX_KEYWORD + 1).indexOf(0);
  if (keywordEnd <= 0 || keywordEnd + 3 > data.length) return null;
  const flag = data[keywordEnd + 1];
  const method = data[keywordEnd + 2];
  if ((flag !== 0 && flag !== 1) || method !== 0) return null;
  const languageEnd = data.indexOf(0, keywordEnd + 3);
  if (languageEnd < 0) return null;
  const translatedEnd = data.indexOf(0, languageEnd + 1);
  if (translatedEnd < 0) return null;
  return {
    keyword: ascii(data.subarray(0, keywordEnd)),
    compressed: flag === 1,
    payload: data.slice(translatedEnd + 1),
  };
}

/** PNG keyword rules: 1-79 printable characters, no leading, trailing or double space. */
function validKeyword(keyword: string): boolean {
  return (
    /^[\x21-\x7e](?:[\x21-\x7e]| (?! ))*$/.test(keyword) &&
    keyword.length <= MAX_KEYWORD &&
    !keyword.endsWith(' ')
  );
}

/**
 * Returns a copy of `png` with an iTXt chunk for `keyword` just before IEND. An existing
 * chunk with the same keyword is replaced.
 */
export function writeItxt(
  png: Uint8Array,
  keyword: string,
  payload: Uint8Array,
  compressed: boolean,
): Uint8Array {
  if (!validKeyword(keyword)) throw new PngFormatError('bad keyword');
  const chunks = readChunks(png);
  const parts: Uint8Array[] = [png.subarray(0, SIGNATURE.length)];
  for (const chunk of chunks) {
    if (chunk.type === ITXT && parseItxt(chunk.data)?.keyword === keyword) continue;
    if (chunk.type === IEND) parts.push(chunkBytes(ITXT, itxtData(keyword, payload, compressed)));
    parts.push(png.subarray(chunk.start, chunk.end));
  }
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Finds the iTXt chunk for `keyword`. Null when the PNG has none; throws PngFormatError
 * when the bytes are not a valid PNG or the chunk is larger than `maxBytes`.
 */
export function readItxt(
  png: Uint8Array,
  keyword: string,
  maxBytes: number,
): { payload: Uint8Array; compressed: boolean } | null {
  for (const chunk of readChunks(png)) {
    if (chunk.type !== ITXT) continue;
    const content = parseItxt(chunk.data);
    if (content?.keyword !== keyword) continue;
    if (content.payload.length > maxBytes) throw new PngFormatError('chunk too large');
    return { payload: content.payload, compressed: content.compressed };
  }
  return null;
}
