# Tasks: Drawing tools (redesign module 3 of 5)

Plan: `tasks/draw-tools/plan.md`. Spec: `spec/SPEC-draw-tools.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Phase 1: New tool state

## Task 1: 56-color palette, 6 sizes and the bar of 5 in the current layout

**Description:** Rewrite `src/engine/palette.ts` (families, tones, ids, values, sizes, `ToolState` v2 with `recent`, `styleFor`, bar rule, MVP mapping) and `parseToolState`. In today's layout, replace the 8 swatches by the bar of 5 (`.btn-check` cells) and the two width buttons by the 6-step `.form-range` with its 1:1 preview dot and a haptic tick per step; the eraser takes the slider size. New page or a reopened drawing resets the bar.

**Acceptance criteria:**

- [x] Unit: 56 colors with the spec's values and order; MVP ids map to the same `#rrggbb`; `styleFor` uses the step for pen and eraser; bar rule (enters first, known keeps order, always 5, reset to base colors); MVP setting migrated, invalid → defaults.
- [x] e2e: each slider step changes the stroke width and the preview size; a tick per step; the eraser follows the slider; picking a bar color draws with it; new page resets the bar.
- [x] Existing e2e updated (swatches, widths) and passing; DF-01 still holds on 375 px.

**Verification:**

- [x] `npx vitest run src/engine/palette.test.ts src/store/settings.test.ts`
- [x] `npx playwright test e2e/tools.spec.ts e2e/theme.spec.ts e2e/app-shell.spec.ts`
- [x] `npm run check`, `npm run e2e`

**Dependencies:** None

**Files likely touched:** `src/engine/palette.ts`, `src/engine/palette.test.ts`, `src/store/settings.ts`, `src/store/settings.test.ts`, `src/app/tools.ts`, `src/app/main.ts`, `src/styles/app.scss`, `src/i18n/messages/*.json`, `e2e/tools.spec.ts`

**Estimated scope:** Medium–Large (split engine/settings from the UI if it grows)

## Checkpoint: State

- [x] `npm run check` and `npm run e2e` pass

## Phase 2: Choosing among 56 colors

## Task 2: "All colors" dialog behind the palette pebble (phones)

**Description:** A multicolor palette pebble next to the bar opens a Bootstrap dialog with the 56 colors (two blocks of 7 families × 4 tones, 48 px cells, close button). Picking closes it and selects the color, which enters the bar first if new.

**Acceptance criteria:**

- [x] e2e (phone): open, pick → dialog closed, color first in the bar, next stroke in it; picking a bar color does not reorder; close button and backdrop close without changing the color.
- [x] Selection ring (inset black + white) on the current color in the dialog; kept ring with the eraser.

**Verification:**

- [x] `npx playwright test e2e/palette.spec.ts`
- [x] `npm run check`, `npm run e2e`

**Dependencies:** Task 1

**Files likely touched:** `src/app/app.html`, `src/app/tools.ts` (or `src/app/palette-dialog.ts`), `src/app/app.scss`, `src/styles/_icons.scss`, i18n catalogs, `e2e/palette.spec.ts` (new)

**Estimated scope:** Medium

## Task 3: The full box on tablets

**Description:** On tablets (both sides ≥ 576 px) the 56 cells are always shown instead of the bar and the pebble: two blocks (warm, cool) of 4 tones × 7 families.

**Acceptance criteria:**

- [x] e2e (tablet): 56 cells visible, no bar or pebble; picking one selects it and the next stroke uses it.
- [x] e2e (phone): the box is hidden, the bar and pebble are shown.

**Verification:**

- [x] `npx playwright test e2e/palette.spec.ts`
- [x] `npm run check`, `npm run e2e`

**Dependencies:** Task 2

**Files likely touched:** `src/app/app.html`, `src/app/tools.ts`, `src/styles/app.scss`, `e2e/palette.spec.ts`

**Estimated scope:** Small–Medium

## Phase 3: Layout

## Task 4: Drawing screen layout in the four window shapes

**Description:** Boards 1 (phone portrait) and 2 (tablet landscape), plus phone landscape and tablet portrait as described in the spec: groups (bar / box, page, slider + eraser, actions with their separator line), vertical slider in landscape, free space at the top in portrait.

**Acceptance criteria:**

- [x] e2e for each shape (375 × 667, 412 × 915, 1180 × 820 and the turned viewports): controls on screen, out of the edge margins, the page square and as large as the spec's layout allows; the expected order of groups.
- [x] Screenshots compared with boards 1 and 2 by eye.

**Verification:**

- [x] `npx playwright test e2e/app-shell.spec.ts e2e/palette.spec.ts`
- [x] `npm run check`, `npm run e2e`

**Dependencies:** Task 3

**Files likely touched:** `src/app/app.html`, `src/styles/app.scss`, `e2e/app-shell.spec.ts`

**Estimated scope:** Medium

## Checkpoint: Module complete

- [x] `npm run check` and `npm run e2e` pass; spec success criteria 1–7 met (by eye on the e2e screenshots; on the devices: next box)
- [ ] Device check on the iPad 11 (pen and finger) and the Pixel 9a, both orientations, plus the `trash` quick check
- [ ] Fold into `spec/SPEC-mvp.md`, set `spec/SPEC-draw-tools.md` to `Status: implemented`
