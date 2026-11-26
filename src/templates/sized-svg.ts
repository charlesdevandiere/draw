/**
 * Prepares a template SVG for rendering as an image (pure). The stored SVG has only a
 * viewBox; engines differ on the size of such an image (Firefox refuses to draw it on a
 * canvas), so the root gets an explicit size, the pixels it is drawn at. The stored SVG is
 * never changed.
 */

export interface SizedSvgOptions {
  /** Width and height of the rendered image, in pixels. */
  size: number;
  /**
   * Outline width that stays the same whatever the size (pixels of this image), instead of
   * scaling with it.
   */
  fixedStrokeWidth?: number;
}

const ROOT = /<svg\b[^>]*>/;

/** The SVG text with an explicit size (and a fixed outline width when asked). */
export function sizedSvg(svg: string, options: SizedSvgOptions): string {
  const root = ROOT.exec(svg);
  if (!root) return svg;
  const size = String(Math.round(options.size));
  const attributes = root[0]
    .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/g, '')
    .replace(/^<svg\b/, `<svg width="${size}" height="${size}"`);
  const fixed = options.fixedStrokeWidth;
  const style =
    fixed === undefined
      ? ''
      : `<style>*{vector-effect:non-scaling-stroke;stroke-width:${fixed}px}</style>`;
  const end = root.index + root[0].length;
  return `${svg.slice(0, root.index)}${attributes}${style}${svg.slice(end)}`;
}
