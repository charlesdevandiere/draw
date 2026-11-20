# Tasks: Carnet magique — MVP

Spec: `spec/SPEC-mvp.md` · Plan: `tasks/plan.md`

Every task also meets the standing bar: `npm run check` green, English in the repository, user-facing text through the catalogs (from T3 on).

**End of every task:** run `/code-review --fix`, re-run `npm run check`, then commit the task (one commit per task; the user pushes).

## Phase 0 — English repository and languages

### T1: Translate the documentation to English

**Description:** Translate every Markdown document to English, keeping the content and the decisions intact. French file names become English.

**Acceptance criteria:**

- [ ] `CLAUDE.md`, `docs/ideas/carnet-magique.md`, `spec/SPEC-diagnostic.md`, `docs/diagnostic/conclusions.md`, `docs/diagnostic/notes-campagne.md` (→ `campaign-notes.md`), `tasks/diagnostic/plan.md`, `tasks/diagnostic/todo.md` are in English.
- [ ] Links between documents still resolve; the JSON reports are untouched.
- [ ] `CLAUDE.md` states the new rules: English repository, i18n catalogs, MVP spec and plan locations.

**Verification:**

- [ ] `npm run format:check`
- [ ] `grep -rlP "[àâçéèêëîïôùûü]" --include=*.md .` (outside `node_modules`) only lists files that quote French UI text on purpose.

**Dependencies:** None

**Files likely touched:** the 7 documents above.

**Estimated scope:** Medium (mechanical)

### T2: Translate the code base leftovers and the deployment workflow

**Description:** Remove the remaining French from code: comments, the workflow name, incident keys such as `gesturestart:bloqué` (report format bumped). Diagnostic UI strings stay French until T5.

**Acceptance criteria:**

- [ ] No French in `src/**/*.ts` except UI strings, listed for T5.
- [ ] Report incident keys in English, `REPORT_VERSION = 3`, tests updated.
- [ ] Workflow `deploy.yml` named in English.

**Verification:**

- [ ] `npm run check`

**Dependencies:** None

**Files likely touched:** `src/diagnostic/gesture-protections.ts`, `src/diagnostic/report.ts`, `src/diagnostic/report.test.ts`, `src/diagnostic/environment.ts`, `.github/workflows/deploy.yml`

**Estimated scope:** Small

### T3: i18n core

**Description:** The pure translation layer: ICU MessageFormat subset formatter, typed catalogs in JSON, language choice.

**Acceptance criteria:**

- [ ] `format.ts` handles placeholders `{name}`, `plural` (`=N`, CLDR categories via `Intl.PluralRules`, `#`), `select`, nesting, and throws on malformed messages.
- [ ] `i18n.ts`: `t(key, params)` with keys typed from `en.json`; a key missing in `fr.json` is a type error; language chosen from `<html lang>` / override / `navigator.languages`, fallback English.
- [ ] A test checks that every catalog has exactly the keys of `en.json` and that every message parses.

**Verification:**

- [ ] `npx vitest run src/i18n`
- [ ] `npm run check`

**Dependencies:** None

**Files likely touched:** `src/i18n/format.ts`, `src/i18n/format.test.ts`, `src/i18n/i18n.ts`, `src/i18n/i18n.test.ts`, `src/i18n/messages/en.json`, `src/i18n/messages/fr.json`

**Estimated scope:** Medium

### T4: Language folders, manifests and root redirect

**Description:** `/draw/` redirects by browser language; `/draw/en/` and `/draw/fr/` are separate installable entries with their own manifest and app name. The app page is still a placeholder.

**Acceptance criteria:**

- [ ] `index.html` at the root redirects to `fr/` when the first matching language of `navigator.languages` is French, else `en/` (logic pure and tested).
- [ ] `en/index.html` and `fr/index.html` with `lang`, manifest link, translated title; manifests in `public/en/` and `public/fr/` ("Magic Sketchbook" / "Carnet magique", `start_url` and `scope` per folder).
- [ ] `vite-plugin-pwa` with `manifest: false`; the service worker at `/draw/` precaches every page of both folders.
- [ ] `src/i18n/apply.ts` fills `data-i18n` and `data-i18n-aria`.

**Verification:**

- [ ] `npm run check`; `npm run preview`: `/draw/` lands on the right folder; Chrome DevTools shows a valid manifest per folder.

**Dependencies:** T3

**Files likely touched:** `index.html`, `en/index.html`, `fr/index.html`, `public/en/manifest.webmanifest`, `public/fr/manifest.webmanifest`, `vite.config.ts`, `src/i18n/apply.ts`, `src/redirect.ts`

**Estimated scope:** Medium

### T5: Diagnostic page through i18n, in both folders

**Description:** Move the diagnostic page into both language folders, replace its French strings with catalog keys, and move `app-update.ts` to `src/pwa/`.

**Acceptance criteria:**

- [ ] `en/diagnostic.html` and `fr/diagnostic.html` share the same code; every visible string comes from the catalogs (counters with plural).
- [ ] The root `diagnostic.html` is removed (or redirects to the language folder).
- [ ] `src/pwa/app-update.ts` used by the diagnostic page.

**Verification:**

- [ ] `npm run check`; in the browser, both pages work and are fully translated.

**Dependencies:** T4

**Files likely touched:** `en/diagnostic.html`, `fr/diagnostic.html`, `src/diagnostic/main.ts`, `src/i18n/messages/*.json`, `src/pwa/app-update.ts`, `vite.config.ts`

**Estimated scope:** Medium

### Checkpoint 0 — after T1–T5

- [ ] `npm run check` green; the user pushes; deployment succeeds.
- [ ] Remove the old `/draw/` install, then install from `/draw/fr/` on the iPad and the Pixel: the name under the icon is "Carnet magique"; with an English browser, "Magic Sketchbook".
- [ ] The installed app opens offline; the diagnostic page opens from inside it.
- [ ] Review with the user before phase A.

## Phase A — the sketchbook

### T6: Sass + Bootstrap theme and the app shell

**Description:** Install `bootstrap@6.0.0-alpha.1` and `sass`, import only the needed modules with our theme, and build the static shell: drawing section (page area + tool areas) and gallery section, portrait / landscape layout, edge margins, gesture protections.

**Acceptance criteria:**

- [ ] Bootstrap compiled from Sass with selective imports; theme variables in `src/styles/`.
- [ ] Portrait: square page area full width, tools below; landscape: page full height, tools on the sides; no control within 32 px + safe area of the top and bottom edges.
- [ ] Gesture protections (shared module extracted from the diagnostic) always on in the app.
- [ ] Drawing and gallery sections switch with `hidden`.

**Verification:**

- [ ] `npm run check`; CSS bundle size noted; layout checked in the browser at phone portrait and tablet landscape sizes.

**Dependencies:** T4

**Files likely touched:** `package.json`, `src/styles/app.scss`, `src/styles/_theme.scss`, `en/index.html` / `fr/index.html` (shared markup), `src/app/main.ts`, `src/app/gesture-protections.ts`

**Estimated scope:** Medium

### T7: Engine foundations

**Description:** Pure types and math: page constants, screen ↔ page transform, stroke building from samples.

**Acceptance criteria:**

- [ ] `types.ts`: `PAGE_SIZE`, `Tool`, `Stroke` (flat `x, y, t` points), `Drawing`.
- [ ] `page-transform.ts`: fit + center of the square page in an area, screen → page and page → screen, `devicePixelRatio`; round trip tested in portrait and landscape.
- [ ] `stroke-builder.ts`: starts, extends (coalesced samples or single), ends a stroke; rounds to 0.1 unit; a stroke with one point is valid (dot).

**Verification:**

- [ ] `npx vitest run src/engine`; `npm run check`

**Dependencies:** None (can start after T2)

**Files likely touched:** `src/engine/types.ts`, `src/engine/page-transform.ts` (+ test), `src/engine/stroke-builder.ts` (+ test)

**Estimated scope:** Medium

### T8: First stroke on screen

**Description:** Pure renderer against a minimal 2D context interface, and the drawing screen wiring Pointer Events (coalesced) to the engine with the two canvas layers. Every pointer draws in black for now.

**Acceptance criteria:**

- [ ] `render.ts` draws strokes, dots (disc) and eraser strokes (`destination-out`); tested with a recording fake context.
- [ ] Drawing layer redrawn only on change / resize; live layer per frame; one stroke per `pointerId`; hover (`buttons === 0`) ignored; `pointercancel` keeps the stroke.
- [ ] Rotation / resize redraws the page without loss.

**Verification:**

- [ ] `npm run check`; draw in the browser (mouse and touch emulation), rotate the window.

**Dependencies:** T6, T7

**Files likely touched:** `src/engine/render.ts` (+ test), `src/app/draw-screen.ts`, `src/app/main.ts`, `vite.config.ts` (coverage exclusions)

**Estimated scope:** Medium

### Checkpoint A1 — after T6–T8

- [ ] On the 3 devices: strokes follow without lag, fast strokes are smooth, a tap makes a dot, no system gesture while drawing.
- [ ] Frame interval feels fluid on the iPad (compare with the diagnostic p95).

### T9: Input modes logic

**Description:** Pure `input-mode.ts` replacing palm rejection for the app: Pen / Finger / Multi-finger, automatic switch, Finger rules.

**Acceptance criteria:**

- [ ] Pen: only `pen` draws. Multi-finger: everything draws. Finger: one slot, released only when no contact remains plus the delay (default 300 ms); contacts wider than the threshold (default 80 px, or off) ignored but holding the slot; `pen` accepted.
- [ ] Automatic switch to Pen on the first `pen` while no mode was chosen by hand; never after a manual choice.
- [ ] Time injected; tests cover every rule above, hover and cancel.

**Verification:**

- [ ] `npx vitest run src/input/input-mode.test.ts`; `npm run check`

**Dependencies:** T7

**Files likely touched:** `src/input/input-mode.ts`, `src/input/input-mode.test.ts`

**Estimated scope:** Small

### T10: Mode button

**Description:** Three-pictogram mode button on the drawing screen, wired to `input-mode` (in memory until T13).

**Acceptance criteria:**

- [ ] Button shows the current mode; tapping cycles or opens the three choices; translated `aria-label`s.
- [ ] Automatic switch visibly updates the button.

**Verification:**

- [ ] `npm run check`; manual check with touch emulation and a pen if available.

**Dependencies:** T8, T9

**Files likely touched:** `src/app/draw-screen.ts`, `src/app/icons.ts`, `src/i18n/messages/*.json`, `src/styles/app.scss`

**Estimated scope:** Small

### T11: Colors, widths and eraser

**Description:** The tool palette: 8 color swatches, 2 widths, eraser, active state visible.

**Acceptance criteria:**

- [ ] 8 colors (black, red, orange, yellow, green, blue, purple, brown), thin / thick widths, eraser ~48 units.
- [ ] Active color and width highlighted; targets ≥ 48 px; translated labels.
- [ ] Eraser strokes clear to the white page background.

**Verification:**

- [ ] `npm run check`; manual drawing in the browser in portrait and landscape.

**Dependencies:** T8

**Files likely touched:** `src/app/draw-screen.ts`, `src/app/tools.ts`, `src/app/icons.ts`, `src/engine/types.ts`, `src/styles/app.scss`

**Estimated scope:** Medium

### T12: Undo, redo and new page

**Description:** `history.ts` (pure) and its buttons.

**Acceptance criteria:**

- [ ] Undo removes the last finished stroke, redo restores it, a new stroke clears redo, undo on empty does nothing (tests).
- [ ] Undo / redo buttons disabled when not applicable; drawing layer redrawn from vectors.
- [ ] New page starts an empty drawing (in memory until T13).

**Verification:**

- [ ] `npx vitest run src/engine/history.test.ts`; `npm run check`; undo / redo 10 times in the browser.

**Dependencies:** T11

**Files likely touched:** `src/engine/history.ts` (+ test), `src/app/draw-screen.ts`, `src/app/icons.ts`

**Estimated scope:** Small

### Checkpoint A2 — after T9–T12

- [ ] Spec criteria 3–8 and 10 checked on the 3 devices (no persistence yet).
- [ ] Review with the user: colors, widths and button layout feel right for a child.

### T13: Storage, autosave and settings

**Description:** Stored schema (pure, versioned), IndexedDB wrapper, autosave, reopening the last drawing, persisted settings, `persist()`.

**Acceptance criteria:**

- [ ] `schema.ts` validates drawings and rejects unknown versions; migration hook tested.
- [ ] Database `draw` with `drawings` and `settings` stores; save after each finished stroke (batched ~1 s) and on `visibilitychange` hidden; empty drawings never stored.
- [ ] Launch reopens the last drawing; input mode and "chosen by hand" flag persisted; `persist()` requested in standalone mode.

**Verification:**

- [ ] `npx vitest run src/store`; `npm run check`; kill and relaunch the page mid-drawing.

**Dependencies:** T12

**Files likely touched:** `src/store/schema.ts` (+ test), `src/store/db.ts`, `src/app/autosave.ts`, `src/app/main.ts`, `vite.config.ts`

**Estimated scope:** Medium

### T14: Gallery

**Description:** Thumbnails generated on save, gallery grid newest first, open a drawing, new page from the gallery.

**Acceptance criteria:**

- [ ] Thumbnail stored with each save; grid shows all drawings, newest first.
- [ ] Tapping a thumbnail reopens it with its full history; "new page" and "back to drawing" buttons.

**Verification:**

- [ ] `npm run check`; manual: 5 drawings, reopen and continue one.

**Dependencies:** T13

**Files likely touched:** `src/app/gallery-screen.ts`, `src/app/thumbnail.ts`, `src/app/main.ts`, `src/styles/app.scss`, `src/app/icons.ts`

**Estimated scope:** Medium

### T15: PNG iTXt chunk

**Description:** Pure reading / writing of the `carnet-magique` `iTXt` chunk in PNG bytes.

**Acceptance criteria:**

- [ ] Insert a chunk before `IEND` with a correct CRC-32 (checked against known values); read it back; compressed and uncompressed flags.
- [ ] Missing chunk, bad CRC, non-PNG input and oversized chunk return a clear error.

**Verification:**

- [ ] `npx vitest run src/store/png-chunk.test.ts`; `npm run check`

**Dependencies:** None (after T13 for the payload shape)

**Files likely touched:** `src/store/png-chunk.ts`, `src/store/png-chunk.test.ts`

**Estimated scope:** Small

### T16: Magic PNG and sharing

**Description:** Render a drawing to a 2048 px PNG on white, embed the compressed drawing, share it (or download).

**Acceptance criteria:**

- [ ] `magic-png.ts` produces a PNG whose chunk decodes back to the identical drawing (round-trip check in the browser).
- [ ] Share button on the selected gallery thumbnail; `navigator.share` with a file when `canShare` allows it, download otherwise.

**Verification:**

- [ ] `npm run check`; manual: share on desktop (download), inspect the chunk.

**Dependencies:** T14, T15

**Files likely touched:** `src/store/magic-png.ts`, `src/app/gallery-screen.ts`, `src/app/icons.ts`, `src/i18n/messages/*.json`

**Estimated scope:** Small

### T17: Update rule and offline check

**Description:** Check for updates on return to the foreground; reload only when no stroke is in progress, after saving.

**Acceptance criteria:**

- [ ] `controllerchange` while drawing defers the reload until no pointer is down and the save completed.
- [ ] Offline launch works for both language folders.

**Verification:**

- [ ] `npm run check`; `npm run preview` with two successive builds.

**Dependencies:** T13

**Files likely touched:** `src/app/main.ts`, `src/pwa/app-update.ts`

**Estimated scope:** Small

### Checkpoint A3 — phase A done

- [ ] Spec criteria 1–13 validated on the 3 devices (installed PWA).
- [ ] Size check: a 10-minute scribble < 500 KB.
- [ ] Shared PNG saved to Files keeps its chunk (iPad and Pixel); what Photos and a messaging app do is noted.
- [ ] Review with the user before phase B.

## Phase B — the magic and the parent

### T18: Replay schedule

**Description:** Pure computation of when each point appears during replay.

**Acceptance criteria:**

- [ ] Real time inside strokes; pauses between strokes capped at 300 ms; uniform speed-up to fit 15 s when longer; empty drawing → zero duration (tests).

**Verification:**

- [ ] `npx vitest run src/engine/replay.test.ts`; `npm run check`

**Dependencies:** T7

**Files likely touched:** `src/engine/replay.ts`, `src/engine/replay.test.ts`

**Estimated scope:** Small

### T19: Replay screen

**Description:** Full-screen replay from the gallery, eraser included.

**Acceptance criteria:**

- [ ] "Play" on the selected thumbnail; touching stops and returns to the gallery; "play again" at the end.

**Verification:**

- [ ] `npm run check`; manual replay of a long and a short drawing.

**Dependencies:** T14, T18

**Files likely touched:** `src/app/replay-screen.ts`, `src/app/gallery-screen.ts`, `en/index.html` / `fr/index.html` markup, `src/app/icons.ts`

**Estimated scope:** Small

### T20: Padlock and parent page shell

**Description:** Press-and-hold padlock (3 s, progress ring) opening `parent.html`, with language override, storage and app sections.

**Acceptance criteria:**

- [ ] Hold logic pure and tested (release early cancels); ring animation.
- [ ] `en/parent.html` and `fr/parent.html` with Bootstrap components; language override persisted; storage status and persist button; version, check for updates, clear cache, diagnostic link; back button.
- [ ] Bootstrap JS loaded only by the parent page.

**Verification:**

- [ ] `npm run check`; build output shows Bootstrap JS only in the parent chunk.

**Dependencies:** T13, T17

**Files likely touched:** `src/app/padlock.ts` (+ pure `hold.ts` and test), `en/parent.html`, `fr/parent.html`, `src/parent/main.ts`, `vite.config.ts`

**Estimated scope:** Medium

### T21: Drawings list and deletion

**Description:** Parent list of drawings with thumbnails, multiple selection, delete after confirmation.

**Acceptance criteria:**

- [ ] Selection count with plural; confirmation dialog; deleted drawings gone from the gallery; deleting the current drawing opens a new page.

**Verification:**

- [ ] `npm run check`; manual deletion.

**Dependencies:** T20

**Files likely touched:** `src/parent/drawings.ts`, `src/parent/main.ts`, `src/store/db.ts`, `src/i18n/messages/*.json`

**Estimated scope:** Small

### T22: Export and import of magic PNGs

**Description:** Export selected / all drawings as magic PNGs; import PNGs with validation and merge by id.

**Acceptance criteria:**

- [ ] Export through the share sheet (several files) or downloads.
- [ ] Import accepts only valid magic PNGs with a known schema version and under the size limit; merge by id (pure, tested); clear report of imported / skipped / refused files.

**Verification:**

- [ ] `npm run check`; manual: export, delete all, import back, replay one; import a photo → refused.

**Dependencies:** T16, T21

**Files likely touched:** `src/store/import-merge.ts` (+ test), `src/parent/transfer.ts`, `src/parent/main.ts`, `src/i18n/messages/*.json`

**Estimated scope:** Medium

### T23: Input settings

**Description:** Parent settings for the Finger mode: width threshold (or off) and release delay.

**Acceptance criteria:**

- [ ] Values persisted and applied on the next drawing session; defaults restorable.

**Verification:**

- [ ] `npm run check`; manual change then drawing.

**Dependencies:** T20

**Files likely touched:** `src/parent/input-settings.ts`, `src/parent/main.ts`, `src/store/db.ts`, `src/i18n/messages/*.json`

**Estimated scope:** Small

### Checkpoint B — MVP done

- [ ] Spec criteria 14–16 validated on the 3 devices.
- [ ] Child test (criterion 17), with the palm width measured; threshold adjusted.
- [ ] Final review with the user.
