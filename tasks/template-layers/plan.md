# Implementation Plan: Template layers (milestone 2, module 1 of 3)

Source spec: `spec/SPEC-template-layers.md` (module `template-layers` of `spec/capability-map-milestone-2.md`). Tasks: `tasks/template-layers/todo.md`.

## Overview

A drawing gets up to two locked template layers (background under the strokes, overlay above), added and removed as history steps, replayed at their time, stored with the drawing and in the magic PNG (schema 2). A templates pebble opens a panel; this module ships coloring pages (static SVG overlays) and the two outline width modes to compare on the devices.

## Architecture Decisions

- **Strokes untouched, steps beside them**: `Drawing.templates: TemplateStep[]`, each step with `at` (strokes before it) and `t`. The current layer of a slot is derived (pure `src/engine/layers.ts`), never stored twice.
- **History over two lists**: `History` keeps `strokes` and `templates` plus one redo list of tagged entries (`{ stroke } | { step }`); undo picks the later of the last stroke and the last step (`at === strokes.length` means the step is later). Same immutable style as today.
- **Pure SVG checker** (`src/templates/svg-check.ts`): viewBox, size, forbidden elements and attributes (`script`, `foreignObject`, `image`, any `href` not starting with `#`, `on*`). Used by the catalog test and by `parseDrawing` (refuse a drawing whose SVG fails). Rendering as an image is the real protection; the check keeps junk out of storage.
- **SVG as images only**: `src/app/template-image.ts` turns a layer into a decoded `HTMLImageElement` (Blob URL, `decode()`), cached per SVG text (and outline mode); canvases draw it with `drawImage`. DOM file, excluded from coverage.
- **Two extra canvases** (`#background-layer`, `#overlay-layer`) around `#drawing-layer` in the page, sized by the same code; `pointer-events: none` on the overlay. The viewer does the same around `#viewer-layer`.
- **Raster becomes async**: `rasterize(drawing, size)` awaits the layer images; thumbnails and export already return promises.
- **Outline width**: `fixed` mode injects `<style>*{vector-effect:non-scaling-stroke}</style>` and sets the stroke width in CSS pixels at the target pixel size, at render time only. Temporary setting `outlineWidth` (`'scaled' | 'fixed'`), parsed in `src/store/settings.ts`, the app reads it at start and on return to the foreground.
- **Panel**: a `<dialog>` like the "all colors" dialog; sections generated from the catalog, so modules 2 and 3 only add catalog entries and a section.

## Task List

### Phase 1: Data (pure)

- [x] Task 1: Types, schema 2 (migration, limits, SVG checker), magic PNG round trip
- [x] Task 2: History over strokes and template steps; layer of a slot at a stroke count and at a time

### Checkpoint: Data

- [x] `npm run check` passes; schema 1 drawings still parse; nothing visible changes

### Phase 2: On the slate

- [x] Task 3: Catalog, two test coloring pages, `docs/templates.md`
- [ ] Task 4: Layers rendered on the slate, undo / redo of steps, saved and reopened (e2e through seeded drawings)
- [ ] Task 5: Templates pebble and panel (add, replace, remove), layout in every window shape

### Checkpoint: Slate

- [ ] `npm run check` and `npm run e2e` pass; a child can put a coloring page and color it

### Phase 3: Everywhere

- [ ] Task 6: Viewer replay with layers; thumbnails, magic PNG image and export / import with layers
- [ ] Task 7: Outline width modes and the temporary "test" setting

### Checkpoint: Module complete

- [ ] Spec success criteria 1–7 met
- [ ] Device check: deferred to the final test campaign (compare the outline modes there)
- [ ] Fold into `spec/SPEC-mvp.md`, `spec/SPEC-template-layers.md` → `Status: implemented`, progress line in the capability map

## Risks and Mitigations

| Risk                                                                         | Impact | Mitigation                                                                                      |
| ---------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| SVG decode is async: a frame without the layer, or a race on quick undo/redo | Medium | Image cache keyed by SVG; repaint generation counter (as the gallery refresh)                   |
| Safari taints or refuses an SVG Blob image on a canvas (export would fail)   | High   | e2e export on WebKit in task 6; fallback to a `data:` URL if the Blob URL fails                 |
| `vector-effect` ignored in SVG images on one engine                          | Medium | e2e width test on both engines (task 7); if unsupported, rewrite `stroke-width` per target size |
| Bigger records (SVG per drawing) slow the gallery or exceed the PNG limits   | Low    | 64 KB authoring limit, 256 KB per SVG, 2 MB per drawing; magic PNG limits checked in task 1     |
| History change breaks existing undo/redo behavior                            | Medium | Existing history unit tests kept unchanged and passing before the new ones are added            |

## Open Questions

- None (answered with the spec, 2026-11-26).
