/**
 * Checks the SVG text of a template layer (pure, no DOM). Templates are only ever rendered
 * as images, which run no script and load nothing: this check keeps junk and anything
 * active out of storage anyway, as a second line of defense.
 */

/** Side of the template viewBox, in page units (the page is 1000 × 1000). */
const VIEW_BOX = /\bviewBox\s*=\s*["']\s*0[\s,]+0[\s,]+1000[\s,]+1000\s*["']/;

/** Elements a template may use: shapes, groups, reuse. Everything else is refused. */
const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'use',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'title',
  'desc',
]);

const ELEMENT = /<\s*([A-Za-z][\w:.-]*)/g;
const EVENT_ATTRIBUTE = /\son[a-z]+\s*=/i;
const HREF = /\b(?:xlink:)?href\s*=\s*["']\s*([^"']*)["']/gi;
const URL_REFERENCE = /url\(\s*["']?\s*([^)"'\s]*)/gi;

export type SvgProblem =
  'too-large' | 'not-svg' | 'view-box' | 'declaration' | 'element' | 'event' | 'reference';

/** Size of a text in UTF-8 bytes. */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Returns what is wrong with a template SVG, or null when it can be stored. */
export function checkTemplateSvg(svg: string, maxBytes: number): SvgProblem | null {
  if (svg.length > maxBytes || utf8Bytes(svg) > maxBytes) return 'too-large';
  const start = svg.replace(/^\uFEFF?\s*(<\?xml[^>]*\?>\s*)?/, '');
  const root = /^<svg[\s>][^>]*>?/.exec(start)?.[0];
  if (root === undefined) return 'not-svg';
  // The viewBox must be on the root element, not anywhere in the text.
  if (!VIEW_BOX.test(root)) return 'view-box';
  // DOCTYPE and entities could expand or reference outside content.
  if (/<!(DOCTYPE|ENTITY)/i.test(svg)) return 'declaration';
  for (const match of svg.matchAll(ELEMENT)) {
    if (!ALLOWED_ELEMENTS.has(match[1] ?? '')) return 'element';
  }
  if (EVENT_ATTRIBUTE.test(svg)) return 'event';
  for (const match of [...svg.matchAll(HREF), ...svg.matchAll(URL_REFERENCE)]) {
    if (!(match[1] ?? '').startsWith('#')) return 'reference';
  }
  return null;
}
