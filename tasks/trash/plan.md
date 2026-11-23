# Implementation Plan: Trash (redesign module 2 of 5)

Source spec: `spec/SPEC-trash.md` (module `trash` of `spec/capability-map.md`). Tasks: `tasks/trash/todo.md`.

## Overview

The data layer of a 30-day trash: a `trashedAt` field next to each stored drawing (like `thumbnail`), pure rules (expiry, days left, ordering, the save rule), database operations (move, restore, empty, purge, lists), and the rules around them (startup, export, import). No visible change: the buttons come with modules `gallery-viewer` and `settings`.

## Architecture Decisions

- **State next to the drawing, not in it.** `trashedAt` sits on the IndexedDB record beside `thumbnail`; `parseDrawing`, `toStored` and the magic PNG are untouched (`schema` stays 1). A record without the field is outside the trash: no database version bump, no migration.
- **Pure rules in `src/store/trash.ts`** (tested, 90 % coverage): `TRASH_RETENTION_MS`, `isExpired`, `daysLeft`, `sortTrash`, and `keepTrashState(stored, next)` which builds the record a save writes. `db.ts` (DOM, excluded from coverage) only reads and writes.
- **Save keeps the state in one transaction**: `saveDrawing` reads the existing record and writes the new one in the same `readwrite` transaction, so no autosave can take a drawing out of the trash.
- **Lists split at the source**: `listDrawings()` (gallery, parent page, export) skips trashed records; `listTrash()` returns them. Export needs no change of its own.
- **Import restores**: `mergeImport` learns the trashed ids and returns the ones to restore; the parent page restores them (counted as "already there").
- **Purge at startup**: app and parent page call `purgeTrash(Date.now())` in the background, errors ignored.
- **e2e through a seeded database**: the e2e run the production build, which cannot import modules; a helper writes records straight into IndexedDB before the app opens.

## Task List

### Phase 1: Rules and storage

- [x] Task 1: Pure trash rules and the save rule
- [ ] Task 2: Database operations, lists, purge at startup, blank page for a trashed last drawing

### Checkpoint: Storage

- [ ] `npm run check` and `npm run e2e` pass

### Phase 2: Export and import

- [ ] Task 3: Export leaves the trash out, import restores from it

### Checkpoint: Module complete

- [ ] Spec success criteria 1–6 met
- [ ] Quick check on a device: the app opens on the last drawing, the gallery and the parent page export / import work as before
- [ ] Fold into `spec/SPEC-mvp.md`, set `spec/SPEC-trash.md` to `Status: implemented`

## Risks and Mitigations

| Risk                                                                  | Impact | Mitigation                                                                        |
| --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| An autosave lands after a move to the trash and takes the drawing out | High   | Read and write in one transaction, pure `keepTrashState` with unit tests          |
| Purge deletes too much (clock changes, bad value)                     | High   | Only records with a finite `trashedAt` older than 30 days; unit tests on the edge |
| Seeding IndexedDB from e2e races with the app opening the database    | Medium | Seed on a blank page of the same origin before loading the app                    |
| No UI yet: the operations could drift from what the next modules need | Low    | Spec lists the needs of `gallery-viewer` and `settings`; revisited in their specs |

## Open Questions

- None.
