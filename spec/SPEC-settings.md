# Spec Delta: Settings page — redesign module 5 of 5

Status: approved (2026-11-25)

Module `settings` of the UI redesign (`spec/capability-map.md`). Inherits everything from `spec/SPEC-mvp.md` (stack, commands, structure, code style, testing strategy, boundaries) and builds on modules `ui-foundation` (pebbles, paper theme, long press) and `trash` (`listTrash`, `restoreFromTrash`, `emptyTrash`, `daysLeft`).

## Objective

Replace the parent page with a **settings page** in the look of the app, organized around what an adult comes to do: back up and restore the drawings, get a drawing back from the trash, update, share the app, set the language and the finger settings. Mockups: boards "Paramètres — iPhone SE" and "Paramètres — tablette".

Users: parents (rarely, briefly, often on the child's device).

## Current Behavior

- `parent.html` in each language folder (`src/parent/`), Bootstrap cards on the default theme: drawings (list with thumbnails, multiple selection, final delete after confirmation), export / import of magic PNGs (selection or all), finger input (width filter, threshold, defaults), language (folder's or override), storage (persisted or not, space used, ask again), application (version = short commit SHA, check for update, clear cache and reload, link to the diagnostic page). Header: "Back to the sketchbook" link.
- Reached from the gallery's padlock by a 1.5 s long press; the diagnostic page links back to `parent.html`; `parent.html` replaces itself in the history (no stacking).
- Trashed drawings: purged at start; restorable only by importing their PNG.

## New Behavior

### Page

- **`settings.html`** in each language folder replaces `parent.html` (Vite inputs, `src/settings/` replaces `src/parent/`, catalog keys `settings.*` replace `parent.*`). `parent.html` stays one version as a stub that replaces itself with `settings.html` (an installed app or an open tab may still point to it), then goes.
- **Look**: paper background `#fff4d6`, white cards (16 px radius, light shadow), Inter is not loaded: the system font, as the rest of the app. Header: the back pebble (`theme-history`, to the **gallery**) and the title "Settings" / "Paramètres".
- **Buttons**: Bootstrap `.btn` in the action colors (export `theme-gallery`, share the app `theme-create`, secondary actions beige `#f3ead3`, minor actions as links), ≥ 48 px high.
- **Layout**: one column on phones (cards in the order below); three columns on wide windows (≥ 992 px, Bootstrap `lg`): column 1 backup + update, column 2 trash, column 3 share + language + finger drawing; the persistence line and the diagnostic link under them. Nothing in the edge margins (DF-02).

### Sections (phone order)

1. **Backup**: "12 drawings, 1.4 MB." (count outside the trash, size of their records), a line of help (the exported images carry the drawing itself: keep them in Files and import them back here). **Export the drawings** (all drawings outside the trash, as magic PNGs, same share sheet / download code as today) and **Import drawings** (same rules as today: magic PNGs only, merge by id, a trashed id is restored). Status messages as today.
2. **Share the sketchbook**: help text and **Share the app link** (`navigator.share({ url })` with the app's root URL `https://charlesdevandiere.github.io/draw/`; fallback: copy the link to the clipboard and say so).
3. **Trash**: "3 drawings: they are deleted for good 30 days after being thrown away." / "The trash is empty."; one row per trashed drawing (most recently trashed first): thumbnail (64 px), "Deleted yesterday" / "Deleted 6 days ago" ("Supprimé hier", as the mockup; calendar days, `Intl.RelativeTimeFormat`), **Restore** (back to the gallery). **Empty the trash**: a red button, long press 1.5 s (fills from left to right, as the mockup), then `emptyTrash()`, haptic tick; hidden when the trash is empty.
4. **Update**: a badge ("Up to date" green after a check found nothing, "Updating…" while a new version installs, nothing before a check); "Version 3f2a1c9 of 25 November 2026." (short commit SHA and build date, from the build); **Check for updates**; **Clear cache and reload** (link style). Same update code as today.
5. **Language**: select "Default (the language this app was installed in)" / Français / English (same override as today, reload on change; the default is the folder's language, not the device's).
6. **Finger drawing**: switch "Ignore contacts as wide as a palm" (Bootstrap `.form-check.form-switch`), number "Widest contact that still draws (px)" (20–400), **Default values** (link style). Same stored settings as today.
7. **Persistence** line: shield icon, "Drawings protected from automatic cleanup" + "Persistent storage granted by the browser." when persisted; otherwise "Drawings may be cleaned up by the browser" and an **Ask again** button. (Space used moves to the backup line.)
8. Link **Diagnostic page** (the diagnostic page's back link points to `settings.html`).

### Removed

- The drawings list with multiple selection and final delete: deleting is now "move to the trash" from the viewer (module `gallery-viewer`), and "for good" only by emptying the trash or after 30 days. Export always takes every drawing outside the trash.

### Opening and leaving

- The gallery's settings pebble (long press 1.5 s) opens `settings.html` (replacing itself in the history as today). The back pebble returns to the app **on the gallery screen** (`./#gallery`; the app shows the gallery when it starts with this hash, then clears it).
- The page purges expired trash on opening (as today) and refreshes the trash and backup lines after an import, a restore or emptying.

## Success Criteria

1. Unit tests: the trash row text ("yesterday", "6 days ago") from `trashedAt` and now through a pure formatter over `Intl.RelativeTimeFormat` (en, fr); the backup line (count and size, plural forms) in both catalogs.
2. e2e: a 1.5 s press on the gallery's settings pebble opens `settings.html`; back returns to the gallery; `parent.html` lands on `settings.html`; the diagnostic page leads back to the settings.
3. e2e: with a seeded trash, the rows show newest first with their relative dates; Restore brings a drawing back to the gallery; a short press on "Empty the trash" does nothing, a 1.5 s press empties it and hides the button.
4. e2e: export / import round trip (existing transfer tests moved here, without the selection); the backup line counts the drawings.
5. e2e: finger settings, language override, update check and persistence keep working (existing tests moved).
6. e2e: phone (one column) and tablet landscape (three columns) layouts, every control on screen; screenshots compared with the boards by eye.
7. What must NOT change: stored settings keys and values, the magic PNG, import rules, the update and cache reset code, the diagnostic page.

## Boundaries (deltas)

- Always: settings texts through the catalogs (en, fr); final deletion only through `emptyTrash` (and the 30-day purge).
- Ask first: removing the `parent.html` stub; adding a "delete now" per trash row.
- Never: a final delete without a long press; anything in this page reachable without the gallery's long press.

## Out of Scope (Deferred)

- "Delete now" per trash row (the mockup has Restore only; emptying covers it).
- A letter size setting (milestone 2, if a device strays too far).
- A synced folder (`showDirectoryPicker`), backups to a cloud.

## Open Questions

Answered 2026-11-25 (approved as proposed):

1. **No drawings list any more** (mockup): export takes all drawings, deletion goes through the viewer's trash. The parent page's selection and final delete go.
2. **Trash rows**: Restore only, as the mockup (no "delete now"); empty the trash with a long press.
3. **Version line**: short commit SHA plus build date (the app has no semantic version yet; "1.0.0" in the mockup was a placeholder).
4. **`parent.html` stub** kept one version, then removed.
