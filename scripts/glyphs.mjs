/**
 * Extracts the glyph outlines of the letters to trace (spec/SPEC-writing-templates.md) from
 * the SIL OFL font Marelle into src/templates/glyphs/*.json. Run it by hand when a font or a
 * set changes; the JSON is committed, the fonts are not.
 *
 *   node scripts/glyphs.mjs fonts/Marelle-Regular.ttf fonts/MarelleBaton-Regular.ttf
 *
 * Fonts: Marelle, the cursive taught in French schools (Ministère de l'Éducation nationale,
 * marelle.forge.apps.education.fr, package marelle-ttf.zip, v1.005), drawn on the Seyès
 * ruling (x-height one interval, capitals two):
 * - Marelle-Regular.ttf: cursive lowercase letters;
 * - MarelleBaton-Regular.ttf ("Marelle Bâton"): block capitals, and the digits.
 * Outlines are in font units, y down, baseline at 0, rounded to whole units, every contour
 * closed (opentype.js 2 emits TrueType contours without a close command).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const [cursivePath, batonPath] = process.argv.slice(2);
if (!cursivePath || !batonPath) {
  console.error('Usage: node scripts/glyphs.mjs <Marelle-Regular.ttf> <MarelleBaton-Regular.ttf>');
  process.exit(1);
}

const range = (from, to) =>
  Array.from({ length: to.charCodeAt(0) - from.charCodeAt(0) + 1 }, (_, i) =>
    String.fromCharCode(from.charCodeAt(0) + i),
  );

const SETS = [
  { name: 'capitals', family: 'Marelle Bâton', font: batonPath, chars: range('A', 'Z') },
  { name: 'digits', family: 'Marelle Bâton', font: batonPath, chars: range('0', '9') },
  { name: 'cursive', family: 'Marelle', font: cursivePath, chars: range('a', 'z') },
];

/** Parses a font file; the Buffer may sit at an offset in a larger shared ArrayBuffer. */
function parseFont(path) {
  const bytes = readFileSync(path);
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
}

/** Path data with every contour closed by a Z (so it strokes as well as it fills). */
function closedPathData(path) {
  const commands = [];
  for (const command of path.commands) {
    const last = commands.at(-1);
    if (command.type === 'M' && last && last.type !== 'Z') commands.push({ type: 'Z' });
    commands.push(command);
  }
  if (commands.length > 0 && commands.at(-1).type !== 'Z') commands.push({ type: 'Z' });
  path.commands = commands;
  return path.toPathData(0);
}

const fonts = new Map();
for (const set of SETS) {
  if (!fonts.has(set.font)) fonts.set(set.font, parseFont(set.font));
  const font = fonts.get(set.font);
  const em = font.unitsPerEm;
  const glyphs = {};
  for (const char of set.chars) {
    const glyph = font.charToGlyph(char);
    if (!glyph || glyph.index === 0) throw new Error(`${set.name}: no glyph for ${char}`);
    const path = glyph.getPath(0, 0, em);
    glyphs[char] = { d: closedPathData(path), advance: Math.round(glyph.advanceWidth ?? 0) };
  }
  const os2 = font.tables.os2;
  const data = {
    font: set.family,
    license: 'SIL Open Font License 1.1',
    unitsPerEm: em,
    capHeight: os2.sCapHeight,
    xHeight: os2.sxHeight,
    ascender: font.ascender,
    descender: font.descender,
    glyphs,
  };
  const out = `src/templates/glyphs/${set.name}.json`;
  writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`${out}: ${set.chars.length} glyphs`);
}
