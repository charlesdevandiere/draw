import { describe, expect, it } from 'vitest';
import { createTranslator } from '../i18n/i18n';
import { PALETTE } from '../engine/palette';
import { CATALOG, COLORING_MAX_BYTES, layerFor } from './catalog';
import { checkTemplateSvg, utf8Bytes } from './svg-check';

const coloring = CATALOG.filter((entry) => entry.kind === 'coloring');
const paletteValues = new Set(PALETTE.map((color) => color.value.toLowerCase()));

/** The start tags of an SVG, with their attributes. */
function tags(svg: string): { name: string; attributes: Record<string, string> }[] {
  return [...svg.matchAll(/<([a-z]+)\b([^>]*)>/gi)].map((match) => ({
    name: match[1] ?? '',
    attributes: Object.fromEntries(
      [...(match[2] ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]),
    ),
  }));
}

describe('catalog', () => {
  it('has unique ids', () => {
    expect(new Set(CATALOG.map((entry) => entry.id)).size).toBe(CATALOG.length);
  });

  it.each(coloring.map((entry) => [entry.id, entry] as const))(
    '%s follows the authoring rules (docs/templates.md)',
    (_, entry) => {
      expect(entry.slot).toBe('overlay');
      expect(utf8Bytes(entry.svg)).toBeLessThanOrEqual(COLORING_MAX_BYTES);
      expect(checkTemplateSvg(entry.svg, COLORING_MAX_BYTES)).toBeNull();
      const elements = tags(entry.svg);
      // Shapes inherit the root's fill: without fill="none" there, every area is filled black.
      expect(elements[0]?.attributes['fill']).toBe('none');
      for (const { name, attributes } of elements) {
        const hint = attributes['class'] === 'hint';
        // Outlines are black; only color hints are filled, with a palette color.
        if ('stroke' in attributes) expect(['#000', 'none']).toContain(attributes['stroke']);
        if (hint) {
          expect(name).toBe('circle');
          expect(paletteValues).toContain(attributes['fill']?.toLowerCase());
        } else if ('fill' in attributes) {
          expect(attributes['fill']).toBe('none');
        }
      }
    },
  );

  it('names every template in each language', () => {
    for (const language of ['en', 'fr'] as const) {
      const { t } = createTranslator(language);
      for (const entry of CATALOG) expect(t(entry.nameKey)).not.toBe(entry.nameKey);
    }
  });

  it('makes a layer carrying the SVG itself', () => {
    const entry = CATALOG[0];
    if (!entry) throw new Error('empty catalog');
    expect(layerFor(entry)).toEqual({
      slot: 'overlay',
      template: entry.id,
      version: entry.version,
      params: {},
      svg: entry.svg,
    });
  });
});
