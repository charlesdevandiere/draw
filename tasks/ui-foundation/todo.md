# Tasks: UI foundation (redesign module 1 of 5)

Plan: `tasks/ui-foundation/plan.md`. Spec: `spec/SPEC-ui-foundation.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Phase 1: Layout fixed to the device (dropped)

Tasks 1 and 2 built a layout fixed to the hardware (counter-rotated screens, upright icons, rotation-aware input; commits 676a9d5, b7550d9, then ddcac6d for Pixel browser tabs). Decision gate, 2026-11-22: clean on the iPad 11, working on the Pixel 9a after the fix, but **dropped** by the user for the simpler rule: the layout follows the window's shape. The code is removed; what stays is the device class breakpoint (576 px, Bootstrap `sm`) for the tablet margins (DF-02). Spec: "Layout follows the window's shape" and "Decision history".

- [x] Rotation code removed, DF-02 on the 576 px breakpoint, `npm run check` and `npm run e2e` pass
- [x] Manual check: rotate the Pixel 9a and the iPad 11 (tools along the long sides, nothing under the iPadOS status bar blur), OK 2026-11-22

## Phase 2: Theme and buttons

## Task 3: Paper theme, square page, action colors and pebble buttons on the drawing screen

**Description:** Add the action colors to Bootstrap's `$theme-colors`, a `.btn-pebble` shape class (radius ≈ 29 %, one 56 px size shrinking by the DF-01 rule, never under 48 px), the ink selection ring, the disabled style, and a square page. Apply them to the drawing screen's action buttons (undo, redo, mode, new page, gallery) and the eraser; the color swatches and width buttons keep their shape until module `draw-tools`, but take the new selection ring.

**Acceptance criteria:**

- [x] The drawing screen's action buttons are `.btn.btn-pebble.theme-<role>` with the spec colors; the eraser selected shows the ink ring; disabled undo/redo use the disabled colors.
- [x] The page has square corners; DF-01 (6 per row on 375 px) and DF-03 (24 px icons on even pixel sizes) still hold.
- [x] No orange selection border left in the app.

**Verification:**

- [x] `npx playwright test e2e/app-shell.spec.ts e2e/tools.spec.ts e2e/history.spec.ts e2e/theme.spec.ts`
- [x] `npm run check`, `npm run e2e`
- [x] Manual check: compare with the foundations board

**Dependencies:** Phase 1

**Files likely touched:**

- `src/styles/_tokens.scss`, `src/styles/app.scss`
- `src/app/app.html`, `src/app/tools.ts`, `src/app/mode-button.ts`
- `e2e/app-shell.spec.ts`

**Estimated scope:** Medium

## Task 4: Pebble buttons on the gallery and replay screens

**Description:** Same styling for the gallery header (back, new page, padlock), the gallery card actions (share, replay) and the replay "play again" button, with their spec colors.

**Acceptance criteria:**

- [x] Every child-screen button is a pebble in its role color; the padlock uses the long-press rest colors.
- [x] Gallery, share and replay e2e still pass.

**Verification:**

- [x] `npx playwright test e2e/gallery.spec.ts e2e/share.spec.ts e2e/replay.spec.ts`
- [x] `npm run check`, `npm run e2e`

**Dependencies:** Task 3

**Files likely touched:**

- `src/app/app.html`, `src/app/gallery-screen.ts`, `src/styles/app.scss`

**Estimated scope:** Small

## Checkpoint: Theme

- [x] `npm run check` and `npm run e2e` pass; child screens match the foundations board

## Phase 3: Long press and haptics

## Task 5: Haptic helper

**Description:** `haptic()`: `navigator.vibrate(8)` when available; else the iOS 18+ switch trick (hidden `<input type="checkbox" switch>` toggled through its label within the user gesture); never throws, never delays.

**Acceptance criteria:**

- [x] With `navigator.vibrate` stubbed, `haptic()` calls it once with 8; without it, the switch is toggled; an exception inside is swallowed.
- [x] No visible element added to the screens (the switch is visually hidden and out of the accessibility tree).

**Verification:**

- [x] `npx playwright test e2e/haptic.spec.ts`
- [x] `npm run check`

**Dependencies:** None (independent of tasks 1–4)

**Files likely touched:**

- `src/app/haptic.ts` (new), `e2e/haptic.spec.ts` (new), `vite.config.ts` (coverage exclusion)
- Done as: pure choice in `src/input/haptic.ts` (unit tests, the production build used by e2e cannot import modules), DOM switch in `src/app/haptic.ts`; already wired to the padlock opening (e2e with a stubbed `navigator.vibrate` and with the switch), task 6 moves it to the generic long press.
- Superseded (2026-11-24, DF-12 in `docs/device-fixes.md`): the switch gave nothing on the iPad and was removed; the tick is `navigator.vibrate` only.

**Estimated scope:** Small

## Task 6: Generic 1.5 s long press with a fill (padlock moves to it)

**Description:** `LONG_PRESS_MS = 1500` replaces `PARENT_HOLD_MS`. `padlock.ts` becomes `long-press.ts`: any button can be made a long-press button (fill from the bottom through `--progress`, scale 1.12 while held, haptic tick then the action on completion, tap does nothing). The padlock uses it, without the SVG ring.

**Acceptance criteria:**

- [x] A release before 1.5 s does nothing; a 1.5 s press opens the parent page (e2e updated from 3 s).
- [x] While held the button fills from the bottom and grows; the haptic tick fires once on completion (e2e with a stubbed `navigator.vibrate`).
- [x] Labels updated ("press and hold 1.5 seconds", en + fr); spec criterion 15 of `spec/SPEC-mvp.md` noted as changed by this module.

**Verification:**

- [x] `npx vitest run src/input/hold.test.ts`
- [x] `npx playwright test e2e/parent.spec.ts`
- [x] `npm run check`, `npm run e2e`

**Dependencies:** Task 5

**Files likely touched:**

- `src/input/hold.ts`, `src/input/hold.test.ts`
- `src/app/long-press.ts` (from `padlock.ts`), `src/app/main.ts`, `src/app/app.html`, `src/styles/app.scss`
- `src/i18n/messages/en.json`, `src/i18n/messages/fr.json`, `e2e/parent.spec.ts`

**Estimated scope:** Medium

## Checkpoint: Module complete

- [x] `npm run check` and `npm run e2e` pass
- [x] Spec success criteria 1–5 met; DF entries written (haptics on iPad: DF-12)
- [x] Device check on the iPad 11 (pen and finger) and the Pixel 9a
- [x] Fold the module into `spec/SPEC-mvp.md`, set `spec/SPEC-ui-foundation.md` to `Status: implemented`
