# Spec Delta: Trash — redesign module 2 of 5

Status: approved (2026-11-23)

Module `trash` of the UI redesign (`spec/capability-map.md`). Inherits everything from `spec/SPEC-mvp.md` (stack, commands, structure, code style, testing strategy, boundaries) except what is stated here.

## Objective

Deleting a drawing must be reversible for a while. A child (from the viewer, module `gallery-viewer`) or a parent (from the settings, module `settings`) moves a drawing to a **trash**. It stays there **30 days**, restorable, then disappears on its own. The trash lives on the device only.

This module is the **data layer only**: storage, rules and their tests. It adds **no visible change**. The buttons come with the modules that need them: "move to trash" in `gallery-viewer`, the trash list (restore, delete now, empty) in `settings`.

Users: children aged 5+ (a drawing thrown away by mistake comes back), parents (cleaning up without fear).

## Current Behavior

- IndexedDB database `draw`, version 1. Store `drawings` (key `id`): the stored drawing (`schema`, `id`, `createdAt`, `updatedAt`, `strokes`) plus `thumbnail` bytes (`src/store/db.ts`). `listDrawings` returns every valid drawing, most recently modified first.
- Deletion is final:
  - the parent page deletes selected drawings after a confirmation dialog (`src/parent/drawings.ts`, `deleteDrawing`);
  - autosave deletes a drawing whose last stroke was undone (an empty page never appears in the gallery).
- At startup the app reopens the drawing named by the `lastDrawingId` setting.
- Export writes one magic PNG per drawing; import merges by id (`mergeImport`), skipping drawings already present.

## New Behavior

### Storage

- A trashed drawing keeps its record in `drawings`, with a **`trashedAt`** field (epoch ms) **next to the drawing, like `thumbnail`**, not inside it. The drawing format (`schema`, the magic PNG) does not change: being in the trash is a state of this device, not part of the picture. A record without `trashedAt` (every record written so far) is not in the trash: no database version bump, no data migration.
- `DrawingRecord` gains `trashedAt: number | null`.

### Rules (pure, `src/store/trash.ts`)

- `TRASH_RETENTION_MS` = 30 days.
- A trashed drawing is **expired** once `now - trashedAt >= TRASH_RETENTION_MS`. A `trashedAt` in the future (clock moved back) counts as trashed now: it never extends the stay beyond 30 days from the current time.
- **Days left** for display (module `settings`): whole days remaining, rounded up, at least 1 while not expired.
- Ordering of the trash: most recently trashed first.

### Operations (`src/store/db.ts`)

- `moveToTrash(id, now)`: sets `trashedAt`. Nothing else changes (strokes, dates, thumbnail).
- `restoreFromTrash(id)`: clears `trashedAt`. The drawing goes back to the gallery at its place (by `updatedAt`).
- `deleteDrawing(id)`: unchanged, final (used for "delete now" in the trash, the parent page and the autosave of an emptied page).
- `emptyTrash()`: final deletion of every trashed drawing.
- `purgeTrash(now)`: final deletion of every expired drawing. Run at each app start and each parent page opening, in the background, errors ignored (it runs again next time).
- `listDrawings()` returns **only drawings not in the trash** (gallery, parent page list, export). `listTrash()` returns the trashed ones, most recently trashed first.

### Rules around the trash

- **Saving keeps the state**: `saveDrawing` never clears or sets `trashedAt`. A save that lands after a move to the trash (autosave of the drawing being left) keeps it in the trash. The read and write happen in one transaction.
- **Startup**: if `lastDrawingId` names a drawing in the trash (or gone), the app opens on a blank page, as on a first launch.
- **Export** writes only drawings not in the trash. A magic PNG never says whether its drawing was trashed.
- **Import** of a drawing whose id is in the trash: the trash entry is **restored** (it comes back to the gallery; the stored strokes are kept, as for a drawing already in the gallery). Counted as "already there".
- **Share** (gallery-viewer) only exists for drawings outside the trash; nothing to change here.

## Success Criteria

1. Unit tests (`src/store/trash.test.ts`): expiry at exactly 30 days and not 1 ms before; a future `trashedAt`; days left (30 on the first day, 1 on the last); trash ordering.
2. Unit tests for the save rule: the record written by a save keeps the `trashedAt` already stored (pure function used by `saveDrawing`).
3. e2e with a database seeded through the page (helpers in `e2e/helpers/storage.ts`): at app start, a drawing trashed 31 days ago is deleted, one trashed 1 day ago is kept; neither appears in the gallery; a drawing not in the trash appears.
4. e2e: `lastDrawingId` pointing to a trashed drawing opens a blank page.
5. e2e: export from the parent page leaves trashed drawings out; importing the PNG of a trashed drawing brings it back to the gallery.
6. What must NOT change: the stored drawing format and the magic PNG (`schema` 1), drawings already stored (they are all outside the trash), the parent page's final delete, autosave, every existing e2e.

## Boundaries (deltas)

- Always: trash state outside the drawing format; final deletion only through `deleteDrawing`, `emptyTrash`, `purgeTrash`.
- Ask first: a database version bump or a new store; putting the trash state into the magic PNG.
- Never: purge anything but expired trashed drawings; let a save take a drawing out of the trash.

## Out of Scope (Deferred)

- The "move to trash" button (long press, 1.5 s) and moving to a blank page when the drawing on the slate is trashed: module `gallery-viewer`.
- The trash list in the settings (thumbnails, days left, restore, delete now, empty with a long press): module `settings`.
- The parent page's delete becoming a move to the trash: module `settings` (the parent page is replaced there).
- Freezing the stored format for 1.0.0 (`spec/SPEC-mvp.md`, Out of Scope): it must keep `trashedAt` next to the drawing record.

## Open Questions

None. Answered 2026-11-23: importing the PNG of a trashed drawing restores it; the parent page keeps its final delete until module `settings`.
