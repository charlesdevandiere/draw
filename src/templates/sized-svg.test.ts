import { describe, expect, it } from 'vitest';
import { sizedSvg } from './sized-svg';

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="M0 0"/></svg>';

describe('sizedSvg', () => {
  it('gives the root the size it is drawn at', () => {
    expect(sizedSvg(svg, { size: 612.4 })).toBe(
      '<svg width="612" height="612" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">' +
        '<path d="M0 0"/></svg>',
    );
  });

  it('replaces a size the SVG already had', () => {
    const sized = sizedSvg(svg.replace('<svg', '<svg width="10" height=\'20\''), { size: 300 });
    expect(sized.match(/width=/g)).toHaveLength(1);
    expect(sized.match(/height=/g)).toHaveLength(1);
    expect(sized).toContain('width="300" height="300"');
  });

  it('keeps an XML declaration in front', () => {
    expect(sizedSvg(`<?xml version="1.0"?>${svg}`, { size: 5 })).toMatch(
      /^<\?xml version="1.0"\?><svg width="5" height="5"/,
    );
  });

  it('adds a fixed outline width when asked', () => {
    const fixed = sizedSvg(svg, { size: 100, fixedStrokeWidth: 6 });
    expect(fixed).toContain('vector-effect:non-scaling-stroke');
    expect(fixed).toContain('stroke-width:6px');
    expect(fixed.indexOf('<style>')).toBeGreaterThan(fixed.indexOf('viewBox'));
  });

  it('leaves text without an svg root alone', () => {
    expect(sizedSvg('<g/>', { size: 5 })).toBe('<g/>');
  });
});
