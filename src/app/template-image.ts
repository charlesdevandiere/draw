/**
 * Template SVGs as decoded images, the only way they are ever rendered: an SVG image runs
 * no script and loads nothing, so an SVG from an imported picture is harmless. Never put a
 * template's SVG into the document.
 */
import { sizedSvg, type SizedSvgOptions } from '../templates/sized-svg';

/** Recently used images (layer canvases, thumbnails): enough for a slate and an export. */
const CACHE_SIZE = 8;
const cache = new Map<string, Promise<HTMLImageElement>>();

async function load(text: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The template drawn at `options.size` pixels, decoded and ready for `drawImage`. */
export function templateImage(svg: string, options: SizedSvgOptions): Promise<HTMLImageElement> {
  const key = `${options.size}|${options.fixedStrokeWidth ?? ''}|${svg}`;
  const cached = cache.get(key);
  if (cached) {
    // Most recently used last.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const image = load(sizedSvg(svg, options));
  cache.set(key, image);
  // A failed decode is not kept: the next paint tries again.
  image.catch(() => {
    if (cache.get(key) === image) cache.delete(key);
  });
  while (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return image;
}
