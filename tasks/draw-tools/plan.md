# Implementation Plan: Drawing tools (redesign module 3 of 5)

Source spec: `spec/SPEC-draw-tools.md` (module `draw-tools` of `spec/capability-map.md`). Tasks: `tasks/draw-tools/todo.md`.

## Overview

56 colors (a bar of 5 plus an "all colors" dialog on phones, the full box on tablets), a 6-step size slider with a 1:1 preview and a haptic tick, and the drawing screen layout of the mockups in the four window shapes. Strokes keep their format (`#rrggbb`, width in page units).

## Architecture Decisions

- **One pure palette module** (`src/engine/palette.ts`, rewritten): families, tones, ids, values, the 6 sizes, `ToolState` v2 (`tool`, `color`, `size`, `recent`), `styleFor`, the bar rule (`pickFromBox`, `pickFromBar`, `resetBar`), the MVP id mapping. Tested at 90 %+.
- **Settings migration in `parseToolState`**: MVP values (`color: 'red'`, `width: 'thin'`) map to the new shape; invalid values fall back to defaults. The setting key stays `tools`.
- **Vertical slices**: task 1 switches the whole app to the new state with the bar and the slider in today's layout (every device), so the app is never half-migrated; the dialog, the box and the new layout come on top.
- **Bootstrap controls**: color cells are `.btn-check` radios (one group per visible palette), the slider a `.form-range`, the dialog Bootstrap's `dialog` module (already used by the parent page). Their look is overridden in `app.scss` (paint-box cells, white track).
- **Device class in CSS** picks bar + pebble (phone) or box (tablet): both are in the markup, one hidden by the `$tablet` media query; the window shape picks the placement (`min-aspect-ratio`), as today.
- **The preview dot** is sized from the page's on-screen size (CSS `--page-size` set by the drawing screen) × the step's units / 1000.

## Task List

### Phase 1: New tool state

- [x] Task 1: 56-color palette, 6 sizes and the bar of 5 in the current layout (engine, settings, tools UI)

### Checkpoint: State

- [ ] `npm run check` and `npm run e2e` pass; an MVP `tools` setting is migrated

### Phase 2: Choosing among 56 colors

- [ ] Task 2: "All colors" dialog behind the palette pebble (phones)
- [ ] Task 3: The full box on tablets

### Phase 3: Layout

- [ ] Task 4: Drawing screen layout in the four window shapes (boards 1 and 2), vertical slider in landscape

### Checkpoint: Module complete

- [ ] Spec success criteria 1–7 met
- [ ] Device check on the iPad 11 (pen and finger) and the Pixel 9a, both orientations (plus the `trash` quick check)
- [ ] Fold into `spec/SPEC-mvp.md`, set `spec/SPEC-draw-tools.md` to `Status: implemented`

## Risks and Mitigations

| Risk                                                                      | Impact | Mitigation                                                                          |
| ------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| The phone landscape layout lacks height (412 px minus margins)            | High   | Bar of 5 at 48 px cells (5 × 48 + pebble = 296 px); checked by e2e on 375 × 667 too |
| `.form-range` turned vertical: hit area and direction differ by browser   | Medium | Rotate with CSS (as the mockup), e2e drags in both engines; device check            |
| Range input steals touches meant to draw / browser gestures on the slider | Medium | `touch-action` on the slider row only; tool bar guard of DF-06 already covers it    |
| 56 radio inputs slow the first render on old phones                       | Low    | Plain markup, no images; measured by the e2e timings                                |
| Existing e2e rely on 8 swatches and width buttons                         | Medium | Updated in task 1 with the behavior they check                                      |

## Open Questions

- None.
