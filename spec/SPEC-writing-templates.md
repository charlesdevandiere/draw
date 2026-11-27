# Spec Delta: Writing templates — milestone 2, module 2 of 3

Status: implemented (2026-11-27, folded into `spec/SPEC-mvp.md` C2; device check with the final test campaign)

Module `writing-templates` of milestone 2 (`spec/capability-map-milestone-2.md`). Inherits `spec/SPEC-mvp.md` and builds on `template-layers` (layer model, steps, panel, rendering, storage).

## Objective

A child can write on **ruled paper** and **trace letters and digits**: templates placed **under** the strokes (background slot), at the **same physical size on every screen**, frozen when added.

Users: children aged 5+ learning to write (French school conventions first).

## Current Behavior

After `template-layers`: an overlay slot with static coloring pages; the background slot exists in the model but has no template. The drawing canvas is transparent: a white stroke paints white over what is under it, the eraser gives back transparency (so it reveals the background again).

## New Behavior

### Templates (background slot)

- **Lines**:
  - `lines/small-squares`: a 5 mm square grid, light blue (French "petits carreaux").
  - `lines/seyes`: French ruled paper ("grands carreaux", Seyès): 8 mm squares, three thin lines every 2 mm between the thick horizontal lines; violet / light blue as French exercise books. No margin line.
- **Letters**, one character chosen, repeated along a row and on the next rows until the page is full:
  - `letters/capitals`: A–Z, light grey filled glyphs between two guide lines (baseline and cap line), cap height 2 cm;
  - `letters/cursive`: a–z, French school cursive, light grey filled glyphs on Seyès ruling enlarged for young children (interval 4 mm, x-height one interval), letters not joined; the ruling is shifted so the first baseline (on a thick line) leaves the ascenders a margin from the top edge, the same rows for every letter;
  - `letters/digits`: 0–9, as the capitals.
  - Spacing: advance width plus 0.5 cm; at least 0.5 cm from the page edges; rows centered; a row only if a whole letter fits (no cut letter).
- One background at a time: picking a template replaces the current one (one history step), the blank tile removes it.

### Constant physical size

- Generated **when added**, from the page's current CSS size: `unitsPerCm = 1000 × NOMINAL_PX_PER_CM / pageCssWidth`, with `NOMINAL_PX_PER_CM = 55` (the CSS pixel is about 52–63 per real cm on the reference devices, ±10 %: `spec/SPEC-mvp.md`, Milestone 2). Fewer squares and letters on a phone, the same size in cm everywhere.
- The generated SVG is stored (layer `params`: `unitsPerCm`, `char`, `set`; `version`): the size is **frozen** at creation. Turning the device, resizing the window, reopening the drawing or importing it on another device **scales** it with the page; it is never regenerated.

### Generation (pure)

- `src/templates/writing.ts`: `linesSvg(kind, unitsPerCm)` and `lettersSvg(set, char, unitsPerCm)` return the SVG text, deterministic (same input, same text), compact (a glyph defined once in `<defs>`, then `<use>`), within the template limits.
- Glyph outlines come from `src/templates/glyphs/{capitals,cursive,digits}.json` (path data in font units, advance width, metrics), extracted once by a dev script (`scripts/glyphs.mjs`, `opentype.js` as a dev dependency) from the SIL OFL font **Marelle**, the cursive taught in French schools (Ministère de l'Éducation nationale, `marelle.forge.apps.education.fr`): **Marelle** for the cursive letters, its variant **Marelle Bâton** for the capitals and digits (changed 2026-11-27 from Andika and Playwrite FR Moderne at the user's request). Marelle is drawn on the Seyès ruling: x-height one interval, ascenders three, descenders two, capitals two. The font files are not shipped; their license goes into `public/THIRD-PARTY-NOTICES.txt`.

### Panel

- Two sections added before coloring pages: **lines** (blank tile, small squares, Seyès) and **letters** (three set tabs shown as "A", "a" in cursive, "1"; then a grid of the characters of the set). Accessible names from the catalogs ("Letter J to trace", "Small squares").

## Success Criteria

1. Unit: grid spacing in page units from `unitsPerCm`; Seyès thin and thick lines at the right positions; letters: count per row and number of rows for a phone and a tablet `unitsPerCm`, none crossing the margins, every row whole; deterministic output; size within the limits; every character of each set has a glyph.
2. e2e: on a phone viewport and a tablet viewport, the small-squares spacing in CSS pixels is the same (±1 px); after resizing the window, the spacing scales with the page (not regenerated).
3. e2e: the letter "J" repeated: several copies on the page, both viewports; a drawing with a letter template reopened after reload keeps the same template.
4. e2e: a white stroke over the lines hides them; the eraser over that stroke shows them again; a colored stroke on the lines is above them.
5. e2e: replacing lines with letters is one undo step; panel tiles reachable in every window shape.
6. What must NOT change: coloring pages and drawings without templates.

## Boundaries (deltas)

- Always: generated in page units and stored; glyph data derived only from OFL fonts, with their notice.
- Ask first: any other font; a "letter size" setting (only if a device strays too far from the nominal size).
- Never: regenerating a stored template; loading a font at run time.

## Out of Scope (Deferred)

- Joined cursive (words), lowercase print letters, start dots and stroke-order arrows, a red margin line.
- The alphabet in sequence across pages, words to copy.
- A letter size setting (see Boundaries).

## Open Questions

Answered 2026-11-26 (approved as proposed):

1. **Fonts**: Andika (capitals, digits) and Playwrite FR Moderne (cursive), through `opentype.js` as a dev dependency. Replaced on 2026-11-27 by Marelle (cursive) and Marelle Bâton (capitals, digits), the fonts of the French national education.
2. **Sizes**: capitals and digits 2 cm; cursive on Seyès with a 4 mm interval; small squares 5 mm; Seyès 8 mm; tuned on the devices if needed.
3. **Look of letters**: light grey filled, all the same.
