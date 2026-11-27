# Spec Delta: Overflow protection — milestone 2, module 3 of 3

Status: implemented (2026-11-27, folded into `spec/SPEC-mvp.md` C3; device check with the final test campaign)

Module `overflow-protection` of milestone 2 (`spec/capability-map-milestone-2.md`). Inherits `spec/SPEC-mvp.md` and builds on `template-layers` (coloring overlays, steps, rendering, storage).

## Objective

On a coloring page, a stroke never goes **out of the area it started in**: the child colors freely, the color stops at the outlines. The protection can be **turned off**.

Users: children aged 5+ coloring.

## Current Behavior

After `template-layers`: a coloring page is an overlay above the strokes; strokes cross its outlines freely (the outline stays drawn above them).

## New Behavior

### Zones

- The **zones** of a coloring page are found by **filling** rather than by its paths: the overlay's outlines (color hints with `class="hint"` left out) are rendered at 1000 × 1000 pixels (one pixel per page unit), every pixel at least half opaque is a barrier, and the connected regions of the other pixels (4-connected) are the zones; the outside of the picture is a zone too. Any SVG that follows the authoring rules works, whatever its paths look like (no need for one closed path per area).
- Pure: `src/engine/zones.ts`, `labelZones(mask, size)` returns a label per pixel; `zoneAt(labels, size, x, y)` returns the zone of a page point, or the nearest zone within 12 units when the point is on a barrier, or none.
- The zone map of an overlay is computed when the layer is added or the drawing is opened, before the layer shows (a few tens of ms), and cached per layer.

### Strokes

- While the protection is on and a coloring page is on the drawing, every stroke started (pen **and** eraser) records its **start zone**: an optional `zone: [x, y]`, a point of that zone (the start point, or the nearest zone point found). Schema 3, migration 2 → 3 does nothing (the field is optional).
- A stroke with a zone is **clipped** to the zone of the coloring page that was on the drawing when it started (found from the history order), live, in the replay, when reopened and in the exported image: drawn on a scratch canvas, kept only inside the zone mask (scaled from 1000 px, smoothed), then composited. The overlay's outlines above hide the mask's edge.
- Strokes drawn before the coloring page was added, or with the protection off, have no zone and are not clipped. Removing or replacing the coloring page does not change the strokes already clipped.
- Several fingers (multi-finger mode): each stroke in progress has its own zone.
- A stroke starting where no zone is found (on a barrier, nothing within 12 units) has no zone.

### Switch

- A **protection pebble** in the drawing tools, beside the eraser (icon `magic`, pressed state with `aria-pressed`), shown only while a coloring page is on the drawing. On by default, on again each time a coloring page is added and when a drawing is opened. Not stored: what each stroke did is in its `zone`.

## Success Criteria

1. Unit: `labelZones` on synthetic masks (two zones; a ring and its hole; the outside); `zoneAt` on a barrier picks the nearest zone, none when too far; a 1-pixel gap joins two zones (documents the authoring rule); schema 3 parse of `zone` (valid, out of the page, wrong type).
2. e2e: on a test coloring page, a thick stroke started inside an area and crossing its outline: ink inside, no ink beyond the outline; the same after reload, in the viewer and in the exported PNG.
3. e2e: the eraser started in an area does not erase the neighboring area.
4. e2e: protection switched off: the same stroke crosses the outline; switched on again for the next one.
5. e2e: strokes drawn before the coloring page are not clipped; the pebble shows only with a coloring page.
6. What must NOT change: drawings without a coloring page; coloring pages with the protection off look as in `template-layers`.

## Boundaries (deltas)

- Always: clip from stored data only (zone point + the overlay in the history), never from the device's current state, so every device shows the same result.
- Ask first: storing the zone map itself; changing the 1000 px zone resolution (it changes old drawings).
- Never: clipping a stroke that has no `zone`.

## Out of Scope (Deferred)

- A "fill a zone" bucket tool.
- Protection on writing templates.

## Open Questions

Answered 2026-11-26 (approved as proposed):

1. **Zones by filling a 1000 px rendering** instead of `isPointInPath`; CLAUDE.md updated with this module.
2. **Eraser clipped too**.
3. **Switch on the drawing screen**, for the child.
