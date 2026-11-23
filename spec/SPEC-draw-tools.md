# Spec Delta: Drawing tools — redesign module 3 of 5

Status: approved (2026-11-23)

Module `draw-tools` of the UI redesign (`spec/capability-map.md`). Inherits everything from `spec/SPEC-mvp.md` (stack, commands, structure, code style, testing strategy, boundaries) and builds on module `ui-foundation` (pebbles, action colors, haptic tick).

## Objective

More colors and more sizes, without losing the simplicity of the slate:

1. a palette of **56 colors** (14 families × 4 tones), shown in full on tablets, through a bar of 5 colors and a "all colors" dialog on phones;
2. a **size slider in 6 steps** with a preview at real size (1:1 with the page);
3. the new drawing screen layout of the mockups (boards 1 and 2: "Dessin — iPhone SE" and "Dessin — tablette paysage").

Users: children aged 5+ (choose a color and a size quickly, without reading).

## Current Behavior

- `src/engine/palette.ts`: 8 colors (`black`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `brown`), 2 widths (`thin` 8, `thick` 24 page units), eraser 48 units. `ToolState` = `{ tool, color: ColorId, width: WidthId }`, stored in the `tools` setting (`parseToolState`, `src/store/settings.ts`). Picking a color or a width goes back to the pen; the eraser keeps both ("kept" ring).
- Drawing screen (`src/app/app.html`, `src/app/tools.ts`): `#tools-primary` = 8 round swatches + 2 round width buttons + the eraser pebble; `#tools-secondary` = undo, redo, mode, new page, gallery. Portrait: page on top, two rows of tools below; landscape: the two groups on both sides.
- A stroke stores its color as `#rrggbb` and its width in page units: the stroke format does not depend on the palette.

## New Behavior

### Palette

- **14 families × 4 tones** (light, bright, medium, dark), from the foundations board:

  | Family      | Light     | Bright    | Medium    | Dark      |
  | ----------- | --------- | --------- | --------- | --------- |
  | pink        | `#f48fb1` | `#ec407a` | `#d81b60` | `#ad1457` |
  | red         | `#ef9a9a` | `#ef5350` | `#e53935` | `#c62828` |
  | orange      | `#ffcc80` | `#ffa726` | `#fb8c00` | `#ef6c00` |
  | yellow      | `#fff59d` | `#ffee58` | `#fdd835` | `#f9a825` |
  | beige       | `#f8eedc` | `#efd9b4` | `#dfc08f` | `#c8a26b` |
  | brown       | `#bcaaa4` | `#8d6e63` | `#6d4c41` | `#4e342e` |
  | grey        | `#ffffff` | `#bdbdbd` | `#757575` | `#212121` |
  | light green | `#c5e1a5` | `#9ccc65` | `#7cb342` | `#558b2f` |
  | green       | `#a5d6a7` | `#66bb6a` | `#43a047` | `#2e7d32` |
  | teal        | `#80cbc4` | `#26a69a` | `#00897b` | `#00695c` |
  | sky blue    | `#81d4fa` | `#29b6f6` | `#039be5` | `#0277bd` |
  | blue        | `#90caf9` | `#42a5f5` | `#1e88e5` | `#1565c0` |
  | indigo      | `#9fa8da` | `#5c6bc0` | `#3949ab` | `#283593` |
  | purple      | `#ce93d8` | `#ab47bc` | `#8e24aa` | `#6a1b9a` |

- Two blocks of 7 families: **warm and neutral** (pink to grey), then **cool** (light green to purple). Inside a block, a "paint box": square cells without gaps, rounded outer corners only.
- Color ids: `<family>-<tone>` (e.g. `blue-medium`). Labels translated from the family and the tone ("Blue, medium" / "Bleu moyen").
- The 8 MVP colors are all in it (medium tone, black = grey dark): a stored MVP color maps to its new id (`black` → `grey-dark`, `purple` → `purple-medium`, others → `<id>-medium`). White (grey light) draws over other strokes.
- **Selection** of a cell: Bootstrap's focus ring (`--focus-ring-width`, `--focus-ring-offset`) outside the cell, in a subtle (light) tint of the selected color, over the neighbouring cells (changed 2026-11-23 at the user's request: the black and white inset ring looked heavy). With the eraser on, the color kept for later shows a fainter ring.
- Built on Bootstrap: one radio group (`.btn-check` inputs, one color chosen), laid out with CSS grid.

### Phones: a bar of 5 colors and an "all colors" dialog

- Above the page: a **bar of 5 square cells** (paint-box style) and next to it a **palette pebble** (multicolor, `bi-palette-fill`) that opens a **dialog with all 56 colors** (two blocks of 7 families × 4 tones, 48 px cells, close button, centered; Bootstrap dialog).
- At the start of a drawing (new page, a drawing reopened from the gallery, first launch), the bar holds the **base colors**: black, red, green, blue, yellow (`grey-dark`, `red-medium`, `green-medium`, `blue-medium`, `yellow-medium`).
- Picking a color in the dialog closes it and selects that color; if it is not in the bar, it **enters first** and the last one leaves. Picking in the bar never reorders it.
- The bar is remembered with the drawing on the slate (a reload keeps it), and reset to the base colors when the slate changes drawing. The current color is kept: if it is not a base color, it enters the reset bar first (the bar always shows the current color).

### Tablets: the full box

- The whole palette always visible: two blocks of 4 tones × 7 families (48 px cells), warm on top, cool below, left of the page in landscape.

### Size slider

- **6 steps**: 4, 8, 16, 24, 40, 64 page units (default: 8, the MVP's thin; the MVP's thick, 24, is step 4).
- A Bootstrap **`.form-range`** with steps (min 0, max 5, step 1), on a white rounded track, with a **preview dot at real size** next to it: the stroke diameter at the current page scale, in the current color (white with a grey outline for the eraser). A light **haptic tick** at each step.
- Phones: horizontal, below the page, next to the eraser. Tablets: vertical, in the right column (the range turned by CSS).
- The **eraser uses the slider size** too (the preview shows it). Moving the slider keeps the current tool (pen or eraser); picking a color goes back to the pen.

### Drawing screen layout

The layout still follows the window's shape (`ui-foundation`); the device class (both sides ≥ 576 px) picks the palette form.

- **Portrait, phone** (board 1): from top to bottom: bar of 5 + palette pebble; the page; slider + eraser; actions (undo, redo, mode | new page, gallery, the two groups separated by a thin line). Free space goes to the top.
- **Landscape, tablet** (board 2): the box on the left; the page in the middle; the right column: new page + gallery on top (separated by a line), then the eraser, the vertical slider, and undo, redo, mode in a 2-column grid.
- **Landscape, phone** (no board): the bar of 5 (vertical) + palette pebble on the left, the page, and on the right the eraser, the vertical slider and the actions.
- **Portrait, tablet** (no board): the box above the page (the two blocks side by side, 14 columns × 4 tones), the slider, eraser and actions below.
- Nothing in the system edge margins (DF-02), touch targets ≥ 48 px, DF-01 / DF-03 kept for the pebbles.

### Stored state

- The `tools` setting becomes `{ tool, color: <color id>, size: <step 0–5>, recent: [5 color ids] }`. An MVP value (`color: 'red'`, `width: 'thin' | 'thick'`) is read as its new id and step (thin → 1, thick → 3); anything invalid falls back to the defaults (black, step 1, base colors). Strokes are unchanged (`#rrggbb` color, width in page units).

## Success Criteria

1. Unit tests (`src/engine/palette.test.ts`): 56 distinct colors in 14 × 4 order with the table's values; every MVP color id maps to the same `#rrggbb` as before; `styleFor` gives the step's width for the pen and the eraser; the bar rule (a new color enters first, a known one keeps the order, always 5, base colors on reset).
2. Unit tests (`src/store/settings.test.ts`): an MVP `tools` value is migrated; an invalid one falls back to the defaults.
3. e2e, phone: pick a color in the dialog → it is first in the bar and the next stroke uses it; the dialog closes; picking in the bar does not reorder; new page → base colors.
4. e2e, tablet: the 56 cells are visible next to the page, picking one selects it, the next stroke uses it.
5. e2e: each slider step changes the stroke width (pixel measure) and the preview dot's size (1:1 with the page); the eraser takes the slider size; a haptic tick per step (stubbed `navigator.vibrate`).
6. e2e: the four layouts (phone and tablet, portrait and landscape) keep every control on screen and out of the edge margins; screenshots compared with boards 1 and 2 by eye.
7. What must NOT change: strokes already stored and the magic PNG format, input handling (modes, palm, DF-01 to DF-12), undo / redo, autosave, replay, gallery.

## Boundaries (deltas)

- Always: palette values and ids in one pure module (`src/engine/palette.ts`); controls on Bootstrap (`.btn-check`, `.form-range`, dialog, pebbles).
- Ask first: changing a color value, a size step, or the base colors.
- Never: store palette ids in strokes (they keep `#rrggbb`).

## Out of Scope (Deferred)

- A free color picker, an eyedropper, opacity.
- The gallery and viewer redesign: module `gallery-viewer`. Settings: module `settings`.

## Open Questions

None. Answered 2026-11-23: the eraser uses the slider size; the bar of 5 is reset when the slate changes drawing and kept across a reload; the two layouts with no board (phone landscape, tablet portrait) are built as described, without a mockup first.
