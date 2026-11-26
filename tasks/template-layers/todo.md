# Tasks: Template layers (milestone 2, module 1 of 3)

Plan: `tasks/template-layers/plan.md`. Spec: `spec/SPEC-template-layers.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Task 1: Types, schema 2, SVG checker, magic PNG

**Description:** Add `LayerSlot`, `TemplateLayer`, `TemplateStep` and `Drawing.templates` (`src/engine/types.ts`). Schema 2 with migration 1 → 2 (`templates: []`), step parsing (slot, `at` within the strokes, `t` ≥ 0, params of strings and numbers), limits (200 steps, 256 KB per SVG, 2 MB per drawing), unknown slot ignored. Pure SVG checker `src/templates/svg-check.ts`, used by the parser. `newDrawing` and `toStored` carry `templates`.

**Acceptance criteria:**

- [x] Unit: migration 1 → 2; valid steps parse; each invalid field, each limit and a forbidden SVG (`script`, `foreignObject`, `image`, outside `href`, `on*`, wrong viewBox) refused; unknown slot ignored.
- [x] Unit: magic PNG round trip keeps the steps; a schema 1 PNG still decodes.
- [x] Every existing test passes (fixtures gain `templates: []` where typed).

**Verification:** `npx vitest run src/store src/templates`; `npm run check`, `npm run e2e`

**Dependencies:** None

**Files likely touched:** `src/engine/types.ts`, `src/store/schema.ts`, `src/store/schema.test.ts`, `src/store/magic-png.test.ts`, `src/templates/svg-check.ts` (+ test)

**Estimated scope:** Medium

## Task 2: History over steps; layer at a moment

**Description:** `History` gains `templates` and a tagged redo list; `commitStep(history, step)`; undo / redo pick the later entry. Pure `src/engine/layers.ts`: `layerAt(templates, slot, strokeCount)` (slate and history) and `layersAtTime(templates, t)` (replay). The slate keeps working on strokes only for now.

**Acceptance criteria:**

- [x] Unit: undo after "stroke, step" takes the step; after "step, stroke" the stroke; redo restores in order; a new stroke or step clears redo; `canUndo` counts both.
- [x] Unit: `layerAt` / `layersAtTime` with add, replace, remove, on both slots.
- [x] Existing history tests unchanged and passing.

**Verification:** `npx vitest run src/engine`; `npm run check`, `npm run e2e`

**Dependencies:** Task 1

**Files likely touched:** `src/engine/history.ts` (+ test), `src/engine/layers.ts` (+ test), `src/app/main.ts` (types only)

**Estimated scope:** Small

## Checkpoint: Data

- [x] `npm run check` passes; schema 1 drawings still parse; nothing visible changes

## Task 3: Catalog, test coloring pages, authoring rules

**Description:** `src/templates/catalog.ts` (id, version, slot, name key, SVG via `?raw`), two test pages in `src/templates/coloring/` (a fish with color hints, a house), drawn by hand to the rules. `docs/templates.md`: the authoring rules of the spec, written as a brief another tool can follow (with one minimal example).

**Acceptance criteria:**

- [x] Unit: every catalog SVG passes the checker, is ≤ 64 KB, has black outlines only, hints only as `class="hint"` circles in palette colors; ids unique.
- [x] Catalog names in en and fr.

**Verification:** `npx vitest run src/templates`; `npm run check`

**Dependencies:** Task 1

**Files likely touched:** `src/templates/catalog.ts` (+ test), `src/templates/coloring/*.svg`, `docs/templates.md`, `src/i18n/messages/*.json`

**Estimated scope:** Small

## Task 4: Layers on the slate

**Description:** `src/app/template-image.ts` (SVG → decoded image, cached). Background and overlay canvases around `#drawing-layer`, sized and repainted with it. `main.ts` keeps the merged history: steps change the layers, undo / redo / new page follow it; autosave stores `templates`; opening a drawing shows its layers. `e2e/helpers/storage.ts`: `seedDatabase` accepts templates.

**Acceptance criteria:**

- [x] e2e (seeded drawing with a coloring page): outlines show; a thick black stroke across an outline leaves it black; a white stroke does not hide it; the eraser never removes it.
- [x] e2e: undo / redo through a seeded step after strokes; reload keeps the layer.
- [x] Drawings without templates unchanged (existing e2e pass).

**Verification:** `npx playwright test e2e/template-layers.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Tasks 2, 3

**Files likely touched:** `src/app/template-image.ts`, `src/app/draw-screen.ts`, `src/app/main.ts`, `src/app/app.html`, `src/styles/app.scss`, `e2e/helpers/storage.ts`, `e2e/template-layers.spec.ts`

**Estimated scope:** Medium

## Task 5: Templates pebble and panel

**Description:** A pebble (icon `layers`) with the actions (no room by the eraser on phones) opens a `<dialog>`: the coloring pages section (pictogram heading, blank tile, thumbnails from the catalog, selected ring). Picking adds / replaces / removes through a history step and closes the dialog; the current one does nothing; haptic tick. Icon added to `_icons.scss`.

**Acceptance criteria:**

- [x] e2e: pick a coloring page, draw, undo (stroke), undo (page), redo; the blank tile removes it (disabled when none); accessible names in en and fr; Escape closes.
- [x] e2e: the pebble in every window shape (layout test of `e2e/app-shell.spec.ts` extended), ≥ 48 px, out of the edge margins.

**Verification:** `npx playwright test e2e/template-layers.spec.ts e2e/app-shell.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 4

**Files likely touched:** `src/app/templates-panel.ts`, `src/app/app.html`, `src/app/main.ts`, `src/styles/app.scss`, `src/styles/_icons.scss`, i18n catalogs, e2e specs

**Estimated scope:** Medium

## Checkpoint: Slate

- [x] `npm run check` and `npm run e2e` pass; a coloring page can be added, colored, undone

## Task 6: Viewer, thumbnails, export

**Description:** The viewer stacks the layer canvases; each layer shows from its step's `t` (pure `layersAtTime`), restart hides the later ones. `rasterize` draws page, background, strokes, overlay (async); thumbnails and the magic PNG image include the layers.

**Acceptance criteria:**

- [x] e2e: the viewer shows strokes drawn before the coloring page without it, then with it; at the end everything.
- [x] e2e: the gallery thumbnail shows the outlines; export / import round trip keeps the layer (Chromium and WebKit).

**Verification:** `npx playwright test e2e/viewer.spec.ts e2e/transfer.spec.ts e2e/template-layers.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 4

**Files likely touched:** `src/app/viewer-screen.ts`, `src/app/raster.ts`, `src/app/main.ts`, `src/app/app.html`, e2e specs

**Estimated scope:** Medium

## Task 7: Outline width modes

**Description:** `outlineWidth` setting (`'scaled'` default, `'fixed'`): parsed in `src/store/settings.ts`, a switch marked "test" in the settings page's finger card, read by the app at start and on return to the foreground; the fixed mode injects `vector-effect: non-scaling-stroke` and a 3 px width when the overlay image is made.

**Acceptance criteria:**

- [x] Unit: setting parsing (default, invalid).
- [x] e2e: scaled — outline width in screen pixels proportional to the page between a phone and a tablet viewport; fixed — same width ±1 px (Chromium and WebKit).

**Verification:** `npx vitest run src/store`; `npx playwright test e2e/template-layers.spec.ts e2e/settings.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 4

**Files likely touched:** `src/store/settings.ts` (+ test), `src/app/template-image.ts`, `src/app/main.ts`, `src/settings/settings.html`, `src/settings/main.ts`, i18n catalogs, e2e specs

**Estimated scope:** Small

## Checkpoint: Module complete

- [x] Spec success criteria 1–7 met
- [ ] Device check (deferred to the final test campaign): deferred to the final test campaign
- [x] Fold into `spec/SPEC-mvp.md`; spec status implemented; capability map progress
