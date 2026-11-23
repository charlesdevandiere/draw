# Tasks: Trash (redesign module 2 of 5)

Plan: `tasks/trash/plan.md`. Spec: `spec/SPEC-trash.md`. End of every task (CLAUDE.md): `/code-review --fix`, `npm run check`, `npm run e2e`, one commit.

## Phase 1: Rules and storage

## Task 1: Pure trash rules and the save rule

**Description:** `src/store/trash.ts`: `TRASH_RETENTION_MS` (30 days), `isExpired(trashedAt, now)`, `daysLeft(trashedAt, now)`, `sortTrash(records)` (most recently trashed first) and `keepTrashState(stored, next)` (the record a save writes keeps the stored `trashedAt`). No caller yet.

**Acceptance criteria:**

- [x] Expired at exactly 30 days, not 1 ms before; a `trashedAt` in the future counts as trashed now; a missing or non-finite `trashedAt` is never expired.
- [x] `daysLeft` is 30 on the first day, 1 on the last, never 0 while not expired.
- [x] `keepTrashState` keeps a stored `trashedAt`, and gives `null` when nothing was stored.

**Verification:**

- [x] `npx vitest run src/store/trash.test.ts`
- [x] `npm run check` (coverage ≥ 90 %)

**Dependencies:** None

**Files likely touched:** `src/store/trash.ts` (new), `src/store/trash.test.ts` (new)

**Estimated scope:** Small

## Task 2: Database operations, lists, purge at startup, blank page for a trashed last drawing

**Description:** `DrawingRecord.trashedAt`; `moveToTrash`, `restoreFromTrash`, `emptyTrash`, `purgeTrash`, `listTrash`; `listDrawings` skips the trash; `saveDrawing` keeps the trash state (one transaction). The app and the parent page purge at startup; the app opens a blank page when `lastDrawingId` is in the trash. An e2e helper seeds records into IndexedDB.

**Acceptance criteria:**

- [x] At app start, a drawing trashed 31 days ago is deleted, one trashed 1 day ago is kept; neither appears in the gallery or the parent page list; a drawing outside the trash appears (e2e).
- [x] `lastDrawingId` naming a trashed drawing opens a blank page (e2e).
- [x] Existing drawings (no `trashedAt`) behave as before; every existing e2e passes.

**Verification:**

- [x] `npx playwright test e2e/trash.spec.ts`
- [x] `npm run check`, `npm run e2e`

**Dependencies:** Task 1

**Files likely touched:** `src/store/db.ts`, `src/app/main.ts`, `src/parent/main.ts`, `e2e/helpers/storage.ts`, `e2e/trash.spec.ts` (new)

**Estimated scope:** Medium

## Checkpoint: Storage

- [x] `npm run check` and `npm run e2e` pass

## Phase 2: Export and import

## Task 3: Export leaves the trash out, import restores from it

**Description:** Export already reads `listDrawings` (no trash): an e2e guards it. `mergeImport` takes the trashed ids and returns `restored`; the parent page restores them and counts them as "already there".

**Acceptance criteria:**

- [x] Unit: a decoded drawing whose id is in the trash goes to `restored`, not `added`, counted in `alreadyThere`.
- [x] e2e: export from the parent page leaves a trashed drawing out; importing the PNG of a trashed drawing brings it back to the gallery.

**Verification:**

- [x] `npx vitest run src/store/import-merge.test.ts`
- [x] `npx playwright test e2e/trash.spec.ts e2e/transfer.spec.ts`
- [x] `npm run check`, `npm run e2e`

**Dependencies:** Task 2

**Files likely touched:** `src/store/import-merge.ts`, `src/store/import-merge.test.ts`, `src/parent/transfer.ts`, `src/parent/main.ts`, `e2e/trash.spec.ts`

**Estimated scope:** Small–Medium

## Checkpoint: Module complete

- [ ] `npm run check` and `npm run e2e` pass; spec success criteria 1–6 met
- [ ] Quick device check (app opens on the last drawing, gallery, export / import)
- [ ] Fold into `spec/SPEC-mvp.md`, set `spec/SPEC-trash.md` to `Status: implemented`
