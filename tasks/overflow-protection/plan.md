# Implementation Plan: Overflow protection (milestone 2, module 3 of 3)

Source spec: `spec/SPEC-overflow-protection.md` (module `overflow-protection` of `spec/capability-map-milestone-2.md`). Tasks: `tasks/overflow-protection/todo.md`. Requires `template-layers` done.

## Overview

The zones of a coloring page come from filling a 1000 px rendering of its outlines. Each stroke started while the protection is on stores a point of its start zone and is clipped to that zone everywhere it is drawn. A pebble turns the protection off.

## Architecture Decisions

- **Pure zones** (`src/engine/zones.ts`): `labelZones(mask: Uint8Array, size)` → `Int32Array` labels (scanline flood fill, 4-connected, iterative); `zoneAt(labels, size, x, y)` with a nearest search up to 12 units. Pure `overlayForStroke(templates, index)` finds the overlay that applied to a stroke.
- **Zone maps in the DOM layer** (`src/app/zone-map.ts`): the overlay SVG without its `.hint` elements (DOMParser on the text, serialized back; never attached to the document) drawn at 1000 × 1000, alpha ≥ 128 → barrier, labels computed once and cached per SVG; a mask canvas per zone made on demand and cached.
- **Clipped strokes render through a scratch canvas**: stroke drawn on it, `destination-in` with the zone mask (scaled to the backing size, smoothing on), then composited onto the drawing canvas with the stroke's own operation (`source-over`, or `destination-out` for the eraser). One code path (`renderStrokes` with an optional clip callback) used by the slate, the viewer and `rasterize`.
- **Format**: schema 3, `Stroke.zone?: [number, number]` (page units, rounded to 0.1). Migration 2 → 3 is the identity.
- **Switch state** lives in `main.ts` (on by default, set on again when a coloring page is added or a drawing opened), passed to the drawing screen, which resolves the zone on `pointerdown` per `pointerId`.

## Task List

### Phase 1: Pure

- [x] Task 1: `labelZones`, `zoneAt`
- [x] Task 2: Schema 3 (`zone`), overlay of a stroke

### Checkpoint: Pure

- [x] `npm run check` passes

### Phase 2: Clipping

- [ ] Task 3: Zone maps and clipped rendering of stored strokes (slate, viewer, raster)
- [ ] Task 4: Live: zone resolved on pointerdown, stroke in progress clipped, several fingers
- [ ] Task 5: Protection pebble; CLAUDE.md constraint updated

### Checkpoint: Module complete

- [ ] Spec success criteria 1–6 met
- [ ] Device check (performance of the scratch canvas with a marker on the iPad and the Pixel): deferred to the final test campaign
- [ ] Fold into `spec/SPEC-mvp.md`; spec status implemented; capability map: milestone 2 complete

## Risks and Mitigations

| Risk                                                                      | Impact | Mitigation                                                                                          |
| ------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Live clipping too slow (mask composite on every frame)                    | High   | Only the new segment's bounding box is composited; measured in e2e with a long stroke; task 4 early |
| Antialiasing differs between engines: a start point near an outline flips | Low    | Stored zone point is the resolved point, not the raw start; nearest-zone search                     |
| A thin gap in a coloring page joins two zones                             | Medium | Authoring rule (outlines ≥ 4 units, closed) in `docs/templates.md`; unit test documents it          |
| Labeling 1 M pixels blocks the main thread                                | Low    | Done once per overlay, before it shows; measured (target < 50 ms on the Pixel)                      |

## Open Questions

- None (answered with the spec, 2026-11-26).
