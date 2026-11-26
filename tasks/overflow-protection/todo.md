# Tasks: Overflow protection (milestone 2, module 3 of 3)

Plan: `tasks/overflow-protection/plan.md`. Spec: `spec/SPEC-overflow-protection.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Task 1: Zones (pure)

**Description:** `src/engine/zones.ts`: `labelZones(mask, size)` (iterative scanline fill, 4-connected, barriers labeled 0) and `zoneAt(labels, size, x, y)` (zone at the page point, else nearest within 12 units, else none).

**Acceptance criteria:**

- [ ] Unit: two zones split by a line; a ring and its hole; the outside is a zone; a 1-pixel gap joins two zones; `zoneAt` on a barrier picks the nearest, none beyond 12 units; out-of-page points.
- [ ] Unit: a 1000 × 1000 mask labels in reasonable time (no recursion).

**Verification:** `npx vitest run src/engine/zones.test.ts`; `npm run check`

**Dependencies:** `template-layers` done

**Files likely touched:** `src/engine/zones.ts` (+ test)

**Estimated scope:** Small

## Task 2: Schema 3, overlay of a stroke

**Description:** `Stroke.zone?: [x, y]`; schema 3 with an identity migration from 2; parsing checks the pair (numbers within the page). Pure `overlayForStroke(templates, index)` in `src/engine/layers.ts`.

**Acceptance criteria:**

- [ ] Unit: `zone` parsed (valid, absent, out of the page, wrong type refused); schema 2 drawings migrate; magic PNG round trip keeps `zone`.
- [ ] Unit: `overlayForStroke` with an overlay added, replaced and removed around strokes.

**Verification:** `npx vitest run src/store src/engine`; `npm run check`

**Dependencies:** Task 1

**Files likely touched:** `src/engine/types.ts`, `src/store/schema.ts` (+ test), `src/engine/layers.ts` (+ test), `src/store/magic-png.test.ts`

**Estimated scope:** Small

## Checkpoint: Pure

- [ ] `npm run check` passes

## Task 3: Clipped rendering of stored strokes

**Description:** `src/app/zone-map.ts` (hint-free rendering at 1000 px, labels, cached zone masks). Rendering of finished strokes with a `zone` through a scratch canvas and the zone mask, in the slate's repaint, the viewer and `rasterize`. `seedDatabase` accepts `zone` on strokes.

**Acceptance criteria:**

- [ ] e2e (seeded drawing: test coloring page, a thick stroke with a zone crossing an outline): ink inside the zone, none beyond the outline; the same in the viewer at the end and in the exported PNG; a stroke without zone crosses.
- [ ] e2e: a seeded eraser stroke with a zone erases only inside its zone.

**Verification:** `npx playwright test e2e/overflow-protection.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 2

**Files likely touched:** `src/app/zone-map.ts`, `src/engine/render.ts`, `src/app/draw-screen.ts`, `src/app/viewer-screen.ts`, `src/app/raster.ts`, `e2e/helpers/storage.ts`, `e2e/overflow-protection.spec.ts`

**Estimated scope:** Medium

## Task 4: Live clipping

**Description:** On `pointerdown`, while protection is on and a coloring page is on the slate, resolve the zone (map ready before the layer shows) and store it in the stroke; the stroke in progress is drawn clipped (bounding box of the new segments only); each `pointerId` has its own zone.

**Acceptance criteria:**

- [ ] e2e: a thick stroke drawn from inside an area across its outline: no ink beyond; same after reload; strokes drawn before the coloring page unchanged.
- [ ] e2e: multi-finger, two strokes in two areas at once, each clipped to its own.
- [ ] e2e: a long stroke keeps up (no dropped segments, timing logged).

**Verification:** `npx playwright test e2e/overflow-protection.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 3

**Files likely touched:** `src/app/draw-screen.ts`, `src/app/main.ts`, `src/app/zone-map.ts`, `e2e/overflow-protection.spec.ts`

**Estimated scope:** Medium

## Task 5: Protection pebble

**Description:** A pebble (icon `magic`, `aria-pressed`) in the tools, shown only with a coloring page; on by default, on again when a coloring page is added or a drawing opened; off: strokes get no zone. Layout in every window shape. CLAUDE.md: the overflow protection constraint describes zones by filling.

**Acceptance criteria:**

- [ ] e2e: protection off → the stroke crosses; on again → the next one is clipped; hidden without a coloring page; accessible names in en and fr.
- [ ] e2e: the pebble on screen, ≥ 48 px, out of the edge margins, in every window shape.

**Verification:** `npx playwright test e2e/overflow-protection.spec.ts e2e/app-shell.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 4

**Files likely touched:** `src/app/app.html`, `src/app/main.ts`, `src/styles/app.scss`, `src/styles/_icons.scss`, i18n catalogs, `CLAUDE.md`, e2e specs

**Estimated scope:** Small

## Checkpoint: Module complete

- [ ] Spec success criteria 1–6 met
- [ ] Device check: deferred to the final test campaign
- [ ] Fold into `spec/SPEC-mvp.md`; spec status implemented; capability map: milestone 2 complete
