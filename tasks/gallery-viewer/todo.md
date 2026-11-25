# Tasks: Gallery and viewer (redesign module 4 of 5)

Plan: `tasks/gallery-viewer/plan.md`. Spec: `spec/SPEC-gallery-viewer.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Task 1: Replay clock and wall tile rule (pure)

**Description:** `src/engine/replay-clock.ts`: a clock over a duration with `play(now)`, `pause(now)`, `restart(now)`, `elapsed(now)`, `progress(now)`, `ended(now)`, `playing`; play at the end restarts from 0. `src/engine/wall.ts`: `tileLook(id)` → `{ tilt, tape }` (tilt in ±2.5°, never 0; tape index among the 6 action colors), from a string hash.

**Acceptance criteria:**

- [x] Unit: elapsed stops while paused and resumes from the same point; restart → 0 and playing; progress clamped 0–1; ended at duration; play when ended restarts.
- [x] Unit: `tileLook` stable for an id, within bounds, never 0°, several ids spread over several tilts and tapes.

**Verification:** `npx vitest run src/engine/replay-clock.test.ts src/engine/wall.test.ts`; `npm run check`

**Dependencies:** None

**Files likely touched:** `src/engine/replay-clock.ts`, `src/engine/replay-clock.test.ts`, `src/engine/wall.ts`, `src/engine/wall.test.ts`

**Estimated scope:** Small

## Task 2: Viewer screen

**Description:** `#viewer-screen` replaces `#replay-screen`: the page, a `.progress` bar, pebbles play / pause (large, `theme-create`), restart (`theme-mode`), continue (`theme-continue`), back (`theme-history`), share (`theme-gallery`). Replay starts on opening; tapping the page (or Space / Enter) toggles pause; Escape goes back; leaving or going to the background pauses. Tapping a gallery tile opens the viewer; the card pebbles go. Simple layout (rows) for now.

**Acceptance criteria:**

- [x] e2e: tile → viewer, replay plays (pixels appear, bar grows); pause freezes the bar; play resumes; restart starts from an empty page; tap on the page pauses; play at the end replays.
- [x] e2e: continue puts the drawing on the slate (a new stroke adds to it); share yields a magic PNG (share e2e moved); back returns to the gallery.
- [x] Resize while paused repaints the same point (pixel check).

**Verification:** `npx playwright test e2e/replay.spec.ts e2e/share.spec.ts e2e/gallery.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 1

**Files likely touched:** `src/app/viewer-screen.ts` (from `replay-screen.ts`), `src/app/app.html`, `src/app/main.ts`, `src/app/gallery-screen.ts`, `src/app/screens.ts`, `src/styles/app.scss`, `src/styles/_icons.scss`, i18n catalogs, e2e specs

**Estimated scope:** Medium–Large

## Task 3: Move to the trash from the viewer

**Description:** A `theme-hold` trash pebble (`bi-trash3`) with a 1.5 s long press filling light red; on completion `moveToTrash(id, now)`, haptic tick, back to the gallery. If the drawing is on the slate: flush autosave, then a blank page.

**Acceptance criteria:**

- [x] e2e: a short press does nothing; a 1.5 s press removes it from the gallery and puts it in `listTrash`; a tick (stubbed `navigator.vibrate`).
- [x] e2e: trashing the slate's drawing leaves a blank slate; reloading does not bring it back.

**Verification:** `npx playwright test e2e/trash.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 2

**Files likely touched:** `src/app/app.html`, `src/app/main.ts`, `src/app/viewer-screen.ts`, `src/app/long-press.ts`, `src/styles/app.scss`, i18n catalogs, `e2e/trash.spec.ts`

**Estimated scope:** Small–Medium

## Checkpoint: Viewer

- [x] `npm run check` and `npm run e2e` pass

## Task 4: Gallery wall

**Description:** Header: back (left) and the settings pebble with the gear icon (right, long press unchanged). First tile: dashed "+" sheet (new page). Drawing tiles: white thumbnails with shadow, tilt and tape from `tileLook(id)`. Grid of fixed tiles (150 px phone, 180 px tablet), spread columns, vertical scroll under a fixed header.

**Acceptance criteria:**

- [x] e2e: "+" first, then the drawings newest first; each tile rotated and taped; "+" opens a blank slate; the gear long press still opens the parent page.
- [x] e2e: empty gallery shows only "+"; tiles stay out of the edge margins.

**Verification:** `npx playwright test e2e/gallery.spec.ts e2e/parent.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Tasks 1, 2

**Files likely touched:** `src/app/gallery-screen.ts`, `src/app/app.html`, `src/app/main.ts`, `src/styles/app.scss`, `src/styles/_icons.scss`, `e2e/gallery.spec.ts`

**Estimated scope:** Medium

## Task 5: Layouts in the four window shapes

**Description:** Viewer: portrait = top row (back | share, trash), page + bar, bottom row (restart, play, continue), centered vertically; landscape = left column (back on top, share + trash at the bottom), page + bar, right column (play, restart, continue) centered, spread across the screen. Play pebble 72 px phone / 88 px tablet. Gallery header and grid checked in the four shapes.

**Acceptance criteria:**

- [ ] e2e (iPhone SE, Pixel, iPad, both orientations): every control visible, ≥ 48 px, out of the edge margins; the page is the largest square left; screenshots compared with the boards by eye.

**Verification:** `npx playwright test e2e/app-shell.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Tasks 2–4

**Files likely touched:** `src/styles/app.scss`, `src/app/app.html`, `e2e/app-shell.spec.ts`

**Estimated scope:** Medium

## Checkpoint: Module complete

- [ ] Spec success criteria 1–8 met
- [ ] Device check on the iPad 11 (pen and finger) and the Pixel 9a, both orientations
- [ ] Fold into `spec/SPEC-mvp.md`, set `spec/SPEC-gallery-viewer.md` to `Status: implemented`
