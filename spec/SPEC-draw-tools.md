# Spec Delta: Drawing tools — redesign module 3 of 5

Status: implemented (2026-11-25)

Module `draw-tools` of the UI redesign (`spec/capability-map.md`). Inherits everything from `spec/SPEC-mvp.md` (stack, commands, structure, code style, testing strategy, boundaries) and builds on module `ui-foundation` (pebbles, action colors, haptic tick).

## Objective

More colors and more sizes, without losing the simplicity of the slate:

1. a palette of **56 colors** (14 families × 4 tones), shown in full on tablets, behind a palette pebble ("all colors" dialog) on phones;
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

- Order: in the phone dialog, **warm and neutral** families (pink to grey), then **cool** ones (light green to purple); on tablets, one grid by wavelength (`BOX_FAMILIES`: red, orange, yellow, light green, green, teal, sky blue, blue, indigo, purple, then pink, out of the rainbow, after purple, then the earth tones beige and brown next to grey, black and white, at the bottom; changed 2026-11-24: brown and beige among the rainbow surprised). A paint box: square cells without gaps, rounded outer corners only.
- Color ids: `<family>-<tone>` (e.g. `blue-medium`). Labels translated from the family and the tone ("Blue, medium" / "Bleu moyen").
- The 8 MVP colors are all in it (medium tone, black = grey dark): a stored MVP color maps to its new id (`black` → `grey-dark`, `purple` → `purple-medium`, others → `<id>-medium`). White (grey light) draws over other strokes.
- **Selection** of a cell: the selected cell is drawn **larger** than the others (about 1.3×), with **rounded corners** and a light shadow, over its neighbours: the grid does not move. With the eraser on, the color kept for later stays a little larger, without the shadow. (Changed 2026-11-24 at the user's request; before: a black and white inset ring, then Bootstrap's focus ring in a subtle tint.)
- Built on Bootstrap: one radio group (`.btn-check` inputs, one color chosen), laid out with CSS grid.

### Phones: a palette pebble and an "all colors" dialog

- No colors on the screen itself: a **palette pebble** (multicolor, `bi-palette-fill`) next to the slider opens a **dialog with all 56 colors** (two blocks of 7 families × 4 tones, 48 px cells, close button, centered; Bootstrap dialog). Picking a color closes it and selects the color; the close button and the backdrop close it without a change. The current color shows in the slider's preview dot.
- (Changed 2026-11-24 at the user's request: a bar of the 5 last colors above the page was not intuitive and is removed.)

### Tablets: the full palette

- The whole palette always visible as **one grid**: **4 tones across × 14 families down**, left of the page in landscape; turned to **14 families across × 4 tones down** above the page in portrait, as the side grid rotated by −90°: the families left to right, the dark tones on top, the light ones at the bottom. The cells are 48 px, smaller when the window lacks room (each cell = the space / 14), never hiding a color. Color cells may go under the 48 px touch target there (the user's choice, 2026-11-24: one palette rather than a fallback); the buttons keep 48 px.

### Selection and motion

- The eraser selected: the pebble drawn larger (1.15×) with the same light shadow as the selected color (changed 2026-11-24; before: an ink ring).
- Short animations (0.15 s) when a pebble or a color cell is selected; the "all colors" dialog fades in and out (Bootstrap dialog, 0.2 s). A pick, a backdrop tap or Escape during the fade-in closes it once open; nothing can be picked during the fade-out. No motion with `prefers-reduced-motion`.

### Size slider

- **6 steps**: 4, 8, 16, 24, 40, 64 page units (default: 8, the MVP's thin; the MVP's thick, 24, is step 4).
- A Bootstrap **`.form-range`** with steps (min 0, max 5, step 1), on a white rounded track, with a **preview dot at real size** next to it: the stroke diameter at the current page scale, in the current color (white with a grey outline for the eraser; the white color gets the same outline). A light **haptic tick** at each step.
- Portrait: horizontal, below the page, between the palette pebble (phones) and the eraser. Landscape: vertical, in the right column (the range turned by CSS).
- The **eraser uses the slider size** too (the preview shows it). Moving the slider keeps the current tool (pen or eraser); picking a color goes back to the pen.

### Drawing screen layout

The layout still follows the window's shape (`ui-foundation`); the device class (both sides ≥ 576 px) picks the palette form.

- **Portrait, phone** (board 1, without the bar): the page; palette pebble + slider + eraser; actions (undo, redo, mode | new page, gallery, the two groups separated by a thin line). The whole group is **centered vertically** (changed 2026-11-24: aligned to the bottom, it left an empty band at the top).
- **Landscape, tablet** (board 2): palette | page | tools spread across the screen (`justify-content: space-between`): the palette (4 × 14) at the left edge, the tools column at the right edge, the page centered between them; the column: new page + gallery on top (separated by a line), then the eraser over the vertical slider, then undo, redo, mode in a 2-column grid.
- **Landscape, phone** (no board): the page, then on the right the palette pebble, the eraser and the vertical slider, then the actions over the pages.
- **Portrait, tablet** (no board): the palette (14 × 4) above the page, the slider and eraser, the actions below; centered vertically.
- Nothing in the system edge margins (DF-02), touch targets ≥ 48 px, DF-01 / DF-03 kept for the pebbles.

### Stored state

- The `tools` setting becomes `{ tool, color: <color id>, size: <step 0–5> }`. An MVP value (`color: 'red'`, `width: 'thin' | 'thick'`) is read as its new id and step (thin → 1, thick → 3); anything invalid falls back to the defaults (black, step 1); a `recent` field written by an earlier build is ignored. Strokes are unchanged (`#rrggbb` color, width in page units).

## Success Criteria

1. Unit tests (`src/engine/palette.test.ts`): 56 distinct colors in 14 × 4 order with the table's values; every MVP color id maps to the same `#rrggbb` as before; `styleFor` gives the step's width for the pen and the eraser.
2. Unit tests (`src/store/settings.test.ts`): an MVP `tools` value is migrated; an invalid one falls back to the defaults.
3. e2e, phone: no colors on the screen; pick a color in the dialog → the dialog closes and the next stroke uses it.
4. e2e, tablet: the 56 cells are visible as one grid (4 × 14 left of the page in landscape, 14 × 4 above it in portrait), picking one selects it (drawn larger, grid unchanged), the next stroke uses it.
5. e2e: each slider step changes the stroke width (pixel measure) and the preview dot's size (1:1 with the page); the eraser takes the slider size; a haptic tick per step (stubbed `navigator.vibrate`).
6. e2e: the four layouts (phone and tablet, portrait and landscape) keep every control on screen and out of the edge margins; portrait layouts are centered vertically; screenshots compared with boards 1 and 2 by eye.
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
