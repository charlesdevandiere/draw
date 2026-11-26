# Implementation Plan: Settings page (redesign module 5 of 5)

Source spec: `spec/SPEC-settings.md` (module `settings` of `spec/capability-map.md`). Tasks: `tasks/settings/todo.md`.

## Overview

`settings.html` replaces `parent.html`, in the paper look: backup (count and size, export all, import), share the app link, trash (relative dates, restore, empty by long press), update (badge, version and build date), language, finger drawing, persistence line, diagnostic link. One column on phones, three on wide windows. Back leads to the gallery.

## Architecture Decisions

- **Rename first, behavior unchanged**: `src/parent/` → `src/settings/`, `parent.*` keys → `settings.*`, Vite inputs `en/settings.html` / `fr/settings.html`, a `parent.html` stub that `location.replace`s to `settings.html`. Every later task works on the new page.
- **Pure helpers**: `src/settings/format.ts` (trash row text through `Intl.RelativeTimeFormat`, size in MB) tested in node; plural forms through the catalogs.
- **Build date** from Vite `define` (`import.meta.env.VITE_BUILD_DATE`, set in `vite.config.ts`), shown with the short SHA (`src/app-version.ts`).
- **Back to the gallery**: the app reads `#gallery` at start, shows the gallery and clears the hash (`history.replaceState`), so a reload lands on the slate as usual.
- **Long press** to empty the trash reuses `initLongPress` with a horizontal fill variant.
- **Bootstrap**: cards, `.btn` with the action theme colors, `.form-check.form-switch`, `.form-select`, `.badge`, grid `row-cols-lg-3`; `parent.scss` → `settings.scss` with the paper tokens.

## Task List

### Phase 1: The page

- [x] Task 1: `settings.html` replaces `parent.html` (rename, stub, diagnostic link, back to the gallery, paper look)
- [x] Task 2: Backup section: drawings list removed, export all, count and size line

### Checkpoint: Page

- [x] `npm run check` and `npm run e2e` pass; nothing of the parent page lost but the list

### Phase 2: New sections

- [x] Task 3: Trash section: rows with relative dates, restore, empty by long press
- [x] Task 4: Share the app link, update badge with version and build date, persistence line, finger switch

### Phase 3: Layout

- [x] Task 5: One column on phones, three columns on wide windows (boards "Paramètres")

### Checkpoint: Module complete

- [x] Spec success criteria 1–7 met
- [ ] Device check on the iPad 11 and the Pixel 9a (share sheet, file picker, long press) (deferred to the final test campaign, 2026-11-26)
- [x] Fold into `spec/SPEC-mvp.md` (B2, B3), set `spec/SPEC-settings.md` to `Status: implemented`; capability map: redesign complete

## Risks and Mitigations

| Risk                                                            | Impact | Mitigation                                                        |
| --------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| An installed PWA or open tab still on `parent.html`             | Medium | Stub redirect kept one version; service worker precaches both     |
| `navigator.share({ url })` missing (desktop Firefox) or refused | Low    | Clipboard fallback with a message; e2e stubs both paths           |
| Renaming breaks history replacement (pages stacking)            | Medium | Existing "never stack up" e2e kept and pointed at `settings.html` |
| Relative dates differ across engines (`Intl`)                   | Low    | Pure formatter tested in node; e2e matches loosely                |

## Open Questions

- None (answered with the spec, 2026-11-25).
