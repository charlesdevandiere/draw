# Tasks: Settings page (redesign module 5 of 5)

Plan: `tasks/settings/plan.md`. Spec: `spec/SPEC-settings.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Task 1: `settings.html` replaces `parent.html`

**Description:** Move `src/parent/` to `src/settings/`, `parent.html` to `settings.html` (both folders, Vite inputs, coverage exclusions), catalog keys `parent.*` to `settings.*`. `parent.html` becomes a stub replacing itself with `settings.html`. The gallery's long press and the diagnostic back link point to `settings.html`. Header: back pebble to `./#gallery` (the app opens on the gallery and clears the hash) and the title. Paper background, white rounded cards.

**Acceptance criteria:**

- [x] e2e: the long press opens `settings.html`; back shows the gallery; `parent.html` lands on `settings.html`; settings and diagnostic pages never stack up in the history.
- [x] Every existing parent e2e passes against `settings.html`.

**Verification:** `npx playwright test e2e/parent.spec.ts e2e/input-settings.spec.ts e2e/transfer.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** None

**Files likely touched:** `src/settings/*` (moved), `en/`, `fr/` HTML, `vite.config.ts`, `src/app/main.ts`, `src/diagnostic/diagnostic.html`, `src/styles/settings.scss`, i18n catalogs, e2e specs

**Estimated scope:** Medium (mostly moves)

## Task 2: Backup section

**Description:** Remove the drawings list (selection, final delete, dialog). One "Backup" card: "N drawings, X MB." (outside the trash; size of their records), help text, Export the drawings (all), Import drawings; statuses as today.

**Acceptance criteria:**

- [ ] Unit: size formatter; catalogs' plural forms (0, 1, n) in en and fr.
- [ ] e2e: the line counts the drawings; export / import round trip without selection; trashed drawings left out of the export and restored by import (existing tests adapted).

**Verification:** `npx vitest run src/settings`; `npx playwright test e2e/transfer.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 1

**Files likely touched:** `src/settings/settings.html`, `src/settings/main.ts`, `src/settings/transfer.ts`, `src/settings/drawings.ts` (removed), `src/settings/format.ts`, i18n catalogs, `e2e/parent-drawings.spec.ts` (removed), `e2e/transfer.spec.ts`

**Estimated scope:** Medium

## Checkpoint: Page

- [ ] `npm run check` and `npm run e2e` pass

## Task 3: Trash section

**Description:** "Trash" card: summary line (empty / n drawings, deleted for good 30 days after), one row per trashed drawing (thumbnail 64 px, "Thrown away yesterday / n days ago", Restore), "Empty the trash" red button with a 1.5 s long press (horizontal fill), hidden when empty. Backup line refreshed after a restore.

**Acceptance criteria:**

- [ ] Unit: relative text from `trashedAt` and now (today, yesterday, n days), en and fr.
- [ ] e2e: seeded trash shows newest first with dates; Restore brings a drawing back to the gallery; a short press on Empty does nothing, 1.5 s empties and hides it.

**Verification:** `npx vitest run src/settings`; `npx playwright test e2e/trash.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 2

**Files likely touched:** `src/settings/trash.ts`, `src/settings/format.ts`, `src/settings/settings.html`, `src/settings/main.ts`, `src/app/long-press.ts`, `src/styles/settings.scss`, i18n catalogs, `e2e/trash.spec.ts`

**Estimated scope:** Medium

## Task 4: Share, update, persistence, finger switch

**Description:** "Share the sketchbook" card (`navigator.share({ url })`, clipboard fallback with a message). "Update" card: badge (up to date / updating), "Version SHA of date." (build date from Vite `define`), check, clear cache (link style). Persistence line with shield icon (granted / not, Ask again). Finger width filter as a `.form-switch`, defaults as a link. Language select restyled.

**Acceptance criteria:**

- [ ] e2e: share calls `navigator.share` with the app URL; without it the link goes to the clipboard and a message shows.
- [ ] e2e: version line shows the SHA and a date; the badge appears after a check; finger settings and language still persist (existing tests).

**Verification:** `npx playwright test e2e/parent.spec.ts e2e/input-settings.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Task 1

**Files likely touched:** `src/settings/settings.html`, `src/settings/main.ts`, `src/app-version.ts`, `vite.config.ts`, `src/styles/settings.scss`, i18n catalogs, e2e specs

**Estimated scope:** Medium

## Task 5: Layout

**Description:** Phone: one column in the spec order. Wide windows (≥ 992 px): three columns (backup + update | trash | share + language + finger), persistence and diagnostic below. Edge margins (DF-02).

**Acceptance criteria:**

- [ ] e2e (iPhone SE, iPad landscape): column count, every control ≥ 48 px high and on screen after scrolling; screenshots compared with the boards by eye.

**Verification:** `npx playwright test e2e/app-shell.spec.ts`; `npm run check`, `npm run e2e`

**Dependencies:** Tasks 2–4

**Files likely touched:** `src/settings/settings.html`, `src/styles/settings.scss`, an e2e spec

**Estimated scope:** Small

## Checkpoint: Module complete

- [ ] Spec success criteria 1–7 met
- [ ] Device check on the iPad 11 and the Pixel 9a
- [ ] Fold into `spec/SPEC-mvp.md`, set `spec/SPEC-settings.md` to `Status: implemented`
