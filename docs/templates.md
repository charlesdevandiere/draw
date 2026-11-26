# Coloring pages: authoring rules

A coloring page is an SVG drawn **above** the child's strokes (an "overlay" template layer, `spec/SPEC-template-layers.md`). The child colors under the black outlines; the overflow protection (`spec/SPEC-overflow-protection.md`) keeps each stroke inside the area it started in, found by filling between the outlines. These rules make a picture work for both. Give this file, as is, to whoever (or whatever tool) draws new pages.

## The brief

Draw a coloring page for children aged 5 and up, as a single SVG file:

1. **Square**: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">`. No `width` / `height` needed. Keep everything inside the square, with a margin of about 30 units from the edges for the main subject.
2. **Transparent background**: no background rectangle, no fill on the areas to color. Use `fill="none"` on the root.
3. **Black outlines only**: `stroke="#000"`, `stroke-width` between **4 and 8** (6 recommended), `stroke-linejoin="round"`, `stroke-linecap="round"`. No grey, no shading, no hatching, no gradients.
4. **Closed areas**: every area meant to be colored must be completely closed by outlines. Lines meant to close an area must touch or cross each other (overlap by a few units rather than stop short): a gap of even 1–2 units lets the color leak into the next area. Open decorative lines (a smile, a gill) are fine inside an area.
5. **Big areas**: no area smaller than about 40 × 40 units (a child's finger is about 60 units wide on a phone). Few details: 5 to 20 areas per page.
6. **Color hints** (optional, the classic "magic coloring" dot): a small filled circle inside an area showing which color goes there: `<circle class="hint" cx="…" cy="…" r="12…16" fill="#…" stroke="none"/>`, where the fill is one of the app's palette colors (`src/engine/palette.ts`, e.g. `#e53935` red, `#fb8c00` orange, `#fdd835` yellow, `#43a047` green, `#1e88e5` blue, `#8e24aa` purple, `#6d4c41` brown). Hints never act as outlines.
7. **Allowed elements only**: `svg`, `g`, `defs`, `use` (with `href="#id"`), `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`, `title`, `desc`. **Not allowed**: text, images, `style` elements, filters, masks, clip paths, gradients, patterns, scripts, event attributes (`onclick` …), links or references to anything outside the file, `<!DOCTYPE>` or entities.
8. **Size**: at most 64 KB. Round coordinates to whole units or one decimal.
9. A `<title>` in English naming the picture.

## Minimal example

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none" stroke="#000"
     stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
  <title>Sun</title>
  <circle cx="500" cy="500" r="200"/>
  <path d="M500 60 L500 240 M500 760 L500 940 M60 500 L240 500 M760 500 L940 500"/>
  <circle class="hint" cx="500" cy="500" r="16" fill="#fdd835" stroke="none"/>
</svg>
```

## Adding a page to the app

1. Put the file in `src/templates/coloring/<name>.svg`.
2. Add an entry to `CATALOG` in `src/templates/catalog.ts` (new id `coloring/<name>`, version 1) and its accessible name to every catalog in `src/i18n/messages/` (`templates.coloring.<name>`).
3. `npm test`: `src/templates/catalog.test.ts` checks these rules (elements, colors, size).
4. Look at it in the app, and color it with a thick marker: no leak from one area to the next.

Changing a published picture: bump its `version`. Drawings already made keep their own copy of the old picture.
