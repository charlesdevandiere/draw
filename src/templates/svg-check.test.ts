import { describe, expect, it } from 'vitest';
import { checkTemplateSvg } from './svg-check';

const svg = (body: string, attributes = 'viewBox="0 0 1000 1000"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`;

describe('checkTemplateSvg', () => {
  it('accepts shapes, groups and internal references', () => {
    const ok = svg(
      '<defs><path id="a" d="M0 0L10 10"/></defs><g stroke="#000"><use href="#a"/>' +
        '<circle class="hint" cx="5" cy="5" r="3" fill="url(#g)"/></g>',
    );
    expect(checkTemplateSvg(ok, 10_000)).toBeNull();
    expect(checkTemplateSvg(`<?xml version="1.0"?>\n${ok}`, 10_000)).toBeNull();
  });

  it('refuses what is too large or not an SVG', () => {
    expect(checkTemplateSvg(svg('<path d="M0 0"/>'), 20)).toBe('too-large');
    expect(checkTemplateSvg('<html></html>', 1000)).toBe('not-svg');
    expect(checkTemplateSvg(svg('', 'viewBox="0 0 500 500"'), 1000)).toBe('view-box');
    expect(checkTemplateSvg(svg(''), 1000)).toBeNull();
    const nested = svg('<g data-v=\'viewBox="0 0 1000 1000"\'/>', 'viewBox="0 0 500 500"');
    expect(checkTemplateSvg(nested, 1000)).toBe('view-box');
  });

  it('refuses anything active or external', () => {
    expect(checkTemplateSvg(svg('<script>alert(1)</script>'), 1000)).toBe('element');
    expect(checkTemplateSvg(svg('<foreignObject/>'), 1000)).toBe('element');
    expect(checkTemplateSvg(svg('<image href="#a"/>'), 1000)).toBe('element');
    expect(checkTemplateSvg(svg('<style>@import "x.css";</style>'), 1000)).toBe('element');
    expect(checkTemplateSvg(svg('<path onclick="x()" d=""/>'), 1000)).toBe('event');
    expect(checkTemplateSvg(svg('<use href="https://x.test/a.svg#a"/>'), 1000)).toBe('reference');
    expect(checkTemplateSvg(svg('<use xlink:href="a.svg#a"/>'), 1000)).toBe('reference');
    expect(checkTemplateSvg(svg('<path fill="url(https://x.test/p)" d=""/>'), 1000)).toBe(
      'reference',
    );
    const doctype = `<!DOCTYPE svg [<!ENTITY x "y">]>${svg('')}`;
    expect(checkTemplateSvg(doctype, 1000)).toBe('not-svg');
    expect(checkTemplateSvg(svg('<!ENTITY x "y">'), 1000)).toBe('declaration');
  });
});
