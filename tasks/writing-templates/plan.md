# Implementation Plan: Writing templates (milestone 2, module 2 of 3)

Source spec: `spec/SPEC-writing-templates.md` (module `writing-templates` of `spec/capability-map-milestone-2.md`). Tasks: `tasks/writing-templates/todo.md`. Requires `template-layers` done.

## Overview

Background templates generated when added, at a constant physical size: small squares, Seyès, and one letter or digit repeated to fill the page (capitals, cursive, digits). The SVG is generated in page units from the page's CSS size, stored, and only scaled afterwards.

## Architecture Decisions

- **Pure generators** in `src/templates/writing.ts`: `linesSvg(kind, unitsPerCm)`, `lettersSvg(set, char, unitsPerCm)`; numbers rounded to 0.1 unit so the text is short and deterministic. Layout math separate (`letterGrid(...)` returning positions) to test it without parsing SVG.
- **Glyphs as data**: a dev script (`scripts/glyphs.mjs`, `opentype.js` dev dependency) reads the two OFL fonts given as paths and writes `src/templates/glyphs/*.json` (path data in font units, advance, units per em, cap height / x-height). The fonts are downloaded by hand (Google Fonts repository) into an ignored folder; only the JSON is committed. Their OFL license text goes into the notices generator as extra entries.
- **`unitsPerCm`** from the page element's CSS width at the moment of adding (`NOMINAL_PX_PER_CM = 55`), passed by the panel; stored in `params`.
- **Panel**: two catalog sections (lines; letters with three set tabs) added to the panel of `template-layers`; their tiles generate a layer instead of reading a static SVG (catalog entries get an optional `generate(params)`).

## Task List

### Phase 1: Generators (pure)

- [x] Task 1: Glyph extraction script, glyph data, notices
- [ ] Task 2: Lines: small squares and Seyès
- [ ] Task 3: Letters: layout and SVG for capitals, cursive, digits

### Checkpoint: Generators

- [ ] `npm run check` passes; generated SVGs pass the template checker; sample SVGs looked at by eye (written to `test-results/`)

### Phase 2: In the app

- [ ] Task 4: Lines and letters sections in the panel, generated at the device's physical size

### Checkpoint: Module complete

- [ ] Spec success criteria 1–6 met
- [ ] Device check (sizes in cm on the iPad 11 and the Pixel 9a): deferred to the final test campaign
- [ ] Fold into `spec/SPEC-mvp.md`; spec status implemented; capability map progress

## Risks and Mitigations

| Risk                                                     | Impact | Mitigation                                                                      |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Glyph JSON too big (cursive outlines are detailed)       | Low    | Only the needed characters; coordinates rounded; size checked in a unit test    |
| Playwrite metrics don't sit well on the enlarged Seyès   | Medium | Scale from the font's x-height; sample SVG checked by eye in task 3             |
| OFL notice missed (build check only covers npm packages) | Medium | Extra notice entries in `scripts/third-party-notices.mjs`, checked by `--check` |
| Physical size off on a device                            | Low    | ±10 % accepted by the spec; a letter size setting is the deferred fallback      |

## Open Questions

- None (answered with the spec, 2026-11-26).
