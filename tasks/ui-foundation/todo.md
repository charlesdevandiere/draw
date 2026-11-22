# Tasks: UI foundation (redesign module 1 of 5)

Plan: `tasks/ui-foundation/plan.md`. Spec: `spec/SPEC-ui-foundation.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Phase 1: Layout fixed to the device

## Task 1: Device class and rotation math (pure)

**Description:** Pure functions, no visible change yet: the device class from the viewport size (tablet when both sides ≥ 576 px, Bootstrap `sm`), the counter-rotation angle for the child screens from the device class, the viewport and `screen.orientation.angle`, and a rotation-aware screen → page conversion (`toPage`, `strokeStart`) for a page drawn rotated by a multiple of 90°.

**Acceptance criteria:**

- [x] `deviceClass(375, 667)` and `(667, 375)` are `phone`; `(1180, 820)`, `(820, 1180)`, `(744, 1133)` are `tablet`; the breakpoint value and the media query string come from one constant.
- [x] The counter-rotation is 0 in the design orientation (phone portrait, tablet landscape) and ±90° otherwise, with the sign from the screen angle (90 vs 270).
- [x] A point under the finger maps to the same page point whatever the rotation (0, 90, 270), the edge margin of `strokeStart` (DF-06) included.

**Verification:**

- [x] `npx vitest run src/engine/screen-layout.test.ts src/engine/page-transform.test.ts`
- [x] `npm run check` (coverage stays ≥ 90 %)

**Dependencies:** None

**Files likely touched:**

- `src/engine/screen-layout.ts` (new), `src/engine/screen-layout.test.ts` (new)
- `src/engine/page-transform.ts`, `src/engine/page-transform.test.ts`

**Estimated scope:** Small (2 modules + tests)

## Task 2: Counter-rotate the child screens, upright icons, rotated input

**Description:** Wrap the three child screens in one container. Pick the phone or tablet layout from the device class (replacing the `min-aspect-ratio` switch and the 700 px tablet margin rule, DF-02). When the device is held in the other orientation, rotate the container back at once (no transition) and turn the icons upright; recompute on `screen.orientation` change. The drawing screen passes the rotation to the page conversion so a stroke lands under the finger.

**Acceptance criteria:**

- [x] Phone viewport in landscape and tablet viewport in portrait: the controls keep their hardware positions (e2e reads the rotated boxes), icons are upright, nothing overflows.
- [x] A stroke drawn in a rotated viewport lands under the pointer (e2e pixel check), a tap on a tool still works.
- [x] Design orientations are unchanged (existing layout e2e still pass, updated for the device-class breakpoint); DF-02 entry updated to the new breakpoint; new DF entry if a device workaround is needed.

**Verification:**

- [x] `npx playwright test e2e/app-shell.spec.ts e2e/draw.spec.ts e2e/rotation.spec.ts`
- [x] `npm run check`, `npm run e2e`
- [ ] Manual check (decision gate): rotate the installed app on the Pixel 9a and the iPad 11 (iPad 11: OK 2026-11-22, clean transition; Pixel 9a: not turned in a Chrome tab, fixed by DF-11, to recheck)

**Dependencies:** Task 1

**Files likely touched:**

- `src/app/app.html` (wrapper), `src/app/screen-layout.ts` (new, DOM), `src/app/main.ts`
- `src/app/draw-screen.ts`, `src/styles/app.scss`
- `e2e/rotation.spec.ts` (new), `e2e/app-shell.spec.ts`

**Estimated scope:** Medium–Large (split app.scss changes from the DOM wiring if it grows)

## Checkpoint: Rotation decision gate

- [ ] `npm run check` and `npm run e2e` pass
- [ ] The user rotates the installed app on the Pixel 9a and the iPad 11 and decides: keep, or drop (revert to the viewport-following layout, update the spec) before task 3

## Phase 2: Theme and buttons

## Task 3: Paper theme, square page, action colors and pebble buttons on the drawing screen

**Description:** Add the action colors to Bootstrap's `$theme-colors`, a `.btn-pebble` shape class (radius ≈ 29 %, one 56 px size shrinking by the DF-01 rule, never under 48 px), the ink selection ring, the disabled style, and a square page. Apply them to the drawing screen's action buttons (undo, redo, mode, new page, gallery) and the eraser; the color swatches and width buttons keep their shape until module `draw-tools`, but take the new selection ring.

**Acceptance criteria:**

- [ ] The drawing screen's action buttons are `.btn.btn-pebble.theme-<role>` with the spec colors; the eraser selected shows the ink ring; disabled undo/redo use the disabled colors.
- [ ] The page has square corners; DF-01 (6 per row on 375 px) and DF-03 (24 px icons on even pixel sizes) still hold.
- [ ] No orange selection border left in the app.

**Verification:**

- [ ] `npx playwright test e2e/app-shell.spec.ts e2e/tools.spec.ts e2e/history.spec.ts`
- [ ] `npm run check`, `npm run e2e`
- [ ] Manual check: compare with the foundations board

**Dependencies:** Checkpoint (gate)

**Files likely touched:**

- `src/styles/_tokens.scss`, `src/styles/app.scss`
- `src/app/app.html`, `src/app/tools.ts`, `src/app/mode-button.ts`
- `e2e/app-shell.spec.ts`

**Estimated scope:** Medium

## Task 4: Pebble buttons on the gallery and replay screens

**Description:** Same styling for the gallery header (back, new page, padlock), the gallery card actions (share, replay) and the replay "play again" button, with their spec colors.

**Acceptance criteria:**

- [ ] Every child-screen button is a pebble in its role color; the padlock uses the long-press rest colors.
- [ ] Gallery, share and replay e2e still pass.

**Verification:**

- [ ] `npx playwright test e2e/gallery.spec.ts e2e/share.spec.ts e2e/replay.spec.ts`
- [ ] `npm run check`, `npm run e2e`

**Dependencies:** Task 3

**Files likely touched:**

- `src/app/app.html`, `src/app/gallery-screen.ts`, `src/styles/app.scss`

**Estimated scope:** Small

## Checkpoint: Theme

- [ ] `npm run check` and `npm run e2e` pass; child screens match the foundations board

## Phase 3: Long press and haptics

## Task 5: Haptic helper

**Description:** `haptic()`: `navigator.vibrate(8)` when available; else the iOS 18+ switch trick (hidden `<input type="checkbox" switch>` toggled through its label within the user gesture); never throws, never delays.

**Acceptance criteria:**

- [ ] With `navigator.vibrate` stubbed, `haptic()` calls it once with 8; without it, the switch is toggled; an exception inside is swallowed.
- [ ] No visible element added to the screens (the switch is visually hidden and out of the accessibility tree).

**Verification:**

- [ ] `npx playwright test e2e/haptic.spec.ts`
- [ ] `npm run check`

**Dependencies:** None (independent of tasks 1–4)

**Files likely touched:**

- `src/app/haptic.ts` (new), `e2e/haptic.spec.ts` (new), `vite.config.ts` (coverage exclusion)

**Estimated scope:** Small

## Task 6: Generic 1.5 s long press with a fill (padlock moves to it)

**Description:** `LONG_PRESS_MS = 1500` replaces `PARENT_HOLD_MS`. `padlock.ts` becomes `long-press.ts`: any button can be made a long-press button (fill from the bottom through `--progress`, scale 1.12 while held, haptic tick then the action on completion, tap does nothing). The padlock uses it, without the SVG ring.

**Acceptance criteria:**

- [ ] A release before 1.5 s does nothing; a 1.5 s press opens the parent page (e2e updated from 3 s).
- [ ] While held the button fills from the bottom and grows; the haptic tick fires once on completion (e2e with a stubbed `navigator.vibrate`).
- [ ] Labels updated ("press and hold 1.5 seconds", en + fr); spec criterion 15 of `spec/SPEC-mvp.md` noted as changed by this module.

**Verification:**

- [ ] `npx vitest run src/input/hold.test.ts`
- [ ] `npx playwright test e2e/parent.spec.ts`
- [ ] `npm run check`, `npm run e2e`

**Dependencies:** Task 5

**Files likely touched:**

- `src/input/hold.ts`, `src/input/hold.test.ts`
- `src/app/long-press.ts` (from `padlock.ts`), `src/app/main.ts`, `src/app/app.html`, `src/styles/app.scss`
- `src/i18n/messages/en.json`, `src/i18n/messages/fr.json`, `e2e/parent.spec.ts`

**Estimated scope:** Medium

## Checkpoint: Module complete

- [ ] `npm run check` and `npm run e2e` pass
- [ ] Spec success criteria 1–5 met; DF entries written (rotation if any workaround, haptics on iPad)
- [ ] Device check on the iPad 11 (pen and finger) and the Pixel 9a
- [ ] Fold the module into `spec/SPEC-mvp.md`, set `spec/SPEC-ui-foundation.md` to `Status: implemented`
