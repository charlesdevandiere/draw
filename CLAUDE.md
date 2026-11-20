# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Vite + TypeScript project (no framework). Step 0, the Pointer Events diagnostic page (`spec/SPEC-diagnostic.md`, now `/draw/<lang>/diagnostic.html`), is done: device reports and **conclusions in `docs/diagnostic/conclusions.md`**, to read before touching input handling. Step 0 plan and tasks: `tasks/diagnostic/`. Current work: the MVP, specified in **`spec/SPEC-mvp.md`**, plan in `tasks/plan.md`, tasks in `tasks/todo.md`.

Commands:

```
npm ci                 # install
npm run dev            # dev server (exposed on the local network)
npm run build          # tsc --noEmit && vite build → dist/ (base '/draw/')
npm run preview        # serve the build
npm test               # vitest run (node env)
npx vitest run src/path/file.test.ts -t "test name"   # a single test
npm run lint           # eslint .
npm run format         # prettier --write .
npm run check          # lint + format:check + tests with coverage (90 % threshold) + build
npm run e2e            # Playwright end-to-end tests (Chromium + WebKit), local only (from task T5b)
```

Structure: `index.html` (root page: redirects to the browser's language folder), `en/` and `fr/` (one folder per language: `index.html` app shell, `diagnostic.html`; manifests in `public/en/`, `public/fr/`), `src/app/` (child app, markup in `app.html`), `src/diagnostic/` (diagnostic page, markup in `diagnostic.html`, kept to test new devices), `src/i18n/` (catalogs `messages/*.json`, ICU subset formatter), `src/input/palm-rejection.ts` (pure filtering logic), `src/pwa/` (update helpers), `vite.config.ts` (base `/draw/`, multi-page entries, PWA service worker, Vitest config), tests `src/**/*.test.ts`. Shared markup lives in `.html` templates imported with `?raw`; language shells only carry `<html lang>`, manifest and title. The DOM is confined to a few files excluded from coverage (list in `vite.config.ts`); everything else is pure and tested (90 % threshold). Target layout for the MVP: `spec/SPEC-mvp.md`, section Project Structure.

Deployment: every push to `master` runs `npm run check`, then publishes to `https://charlesdevandiere.github.io/draw/` (GitHub Actions). **Never push: the user pushes.**

End of every task: run `/code-review --fix`, run `npm run check` again (and `npm run e2e` once it exists), then commit the task (one commit per task).

**The repository is public and written entirely in English**: code, comments, docs, specs, commit messages. User-facing text goes through the i18n catalogs (English and French in the MVP, more European languages later). Conversations with the user are in French.

Product vision, MVP scope, assumptions and the "Not Doing" list: **`docs/ideas/carnet-magique.md`** (partly superseded by `spec/SPEC-mvp.md`, which wins).

## Goal

"Carnet magique" (English: "Magic Sketchbook"): a drawing PWA for children aged 5 and up (free drawing, coloring pages with overflow protection, letters to trace), no account, no backend, offline. Targets:

- iPad (Safari iPadOS, installed PWA), with a pen **and** by finger;
- iOS and Android phones (Safari / Chrome), by finger.

PC (mouse / touch): not targeted for validation, but the code stays standard so as not to exclude it.

**Reference devices** — a feature is done only when validated on all three:

1. iPad 11 + Metapen stylus;
2. iPad 11 by finger;
3. Google Pixel 9a by finger.

## Stack

- **Vite + TypeScript, no UI framework** (Angular ruled out: no benefit for a mostly-canvas app).
- `vite-plugin-pwa` (Workbox) for the service worker; manifests written by hand, one per language folder.
- **Bootstrap 6 (alpha, exact version) compiled from Sass**, importing only the modules used, with a custom theme. CSS everywhere, Bootstrap JS only where a component needs it. The child screens have no visible text: pictograms, touch targets ≥ 48 px.
- Storage: IndexedDB (database `draw`), hand-written promise wrapper.
- i18n: JSON catalogs with an ICU MessageFormat subset (placeholders, plural, select), small hand-written formatter.
- Tests: Vitest (pure code), Playwright (end-to-end, Chromium + WebKit, local).

## Structural technical constraints

- **Drawing engine in pure TypeScript**, decoupled from the UI (no DOM dependency beyond a provided canvas context), unit-testable.
- **Pointer Events** as the only input API; `touch-action: none` on the drawing surface; `getCoalescedEvents()` when available, with a fallback.
- **One stroke in progress per `pointerId`** (never a single "current stroke"): multi-finger ready.
- **Input mode: "Pen" / "Finger" / "Multi-finger"** (details in `spec/SPEC-mvp.md` and `docs/diagnostic/conclusions.md`). Pen: only `pen` pointers draw (automatic switch on the first `pen` until a mode is chosen by hand). Finger: one contact draws; the slot is released only when nothing touches the screen any more; contact-width filter against the palm, to tune with a child's hand. Multi-finger: every contact draws. Offered on every platform (Apple Pencil, Logitech Crayon, S Pen, USI pens, Surface Pen all report `pen`). **No finger gesture reserved for pan / zoom**: no zoom, the page fits the screen. Hover (`buttons === 0`) never draws.
- **`getCoalescedEvents()` is essential** (the Metapen sends only 60 events/s, 4 points each). **A tap without movement draws a dot** (the canvas ignores zero-length segments).
- **Never depend on `pressure` / `tilt`**: fake constant values with the Metapen (measured), zero by finger on iPad. Fixed width. Never trust the user agent (Safari on iPad says `Macintosh`).
- **Square page only** (1000 × 1000 page units), scaled and centered in the screen. **Points are stored in page coordinates, never screen pixels**: screen → page on input, page → screen on render (honor `devicePixelRatio`).
- **Drawings stored as vectors** (points + timestamps): required for replay, background layers (coloring pages, letters) and export. Watch the size, simplify points if needed.
- **Magic PNG**: the file format for sharing and export / import is a normal PNG carrying the vector drawing in an `iTXt` chunk (keyword `carnet-magique`). Import accepts only valid magic PNGs.
- **Overflow protection** (milestone 2): SVG coloring pages where each area is a closed path; on `pointerdown`, find the area (`isPointInPath`) and clip the stroke to it.
- **Neutralize system gestures** (magnifier / long press, double-tap zoom, selection, context menu, pull-to-refresh) on iOS and Android: mandatory protections, list in `docs/diagnostic/conclusions.md`. Swipes from the top and bottom edges belong to the system and cannot be blocked: **no control near those edges**.
- **PWA update**: check for a new version every time the app returns to the foreground (an iOS PWA resumes without navigating and otherwise stays on the old version), plus a manual way in the parent page.
- **Persistence**: `navigator.storage.persist()` (granted for the installed PWA on iPad and on Chrome Android; refused by Brave, Chrome is the Android target), silent autosave, manual export / import of the gallery as a safety net.
- **Adaptive UI**: phone portrait ↔ tablet landscape.
- iOS Safari is the most restrictive target: check iOS support for every web API used.

## Step 0 (done)

Diagnostic page tested on the three reference configurations: Safari sees the Metapen as `pen`. Results and decisions: `docs/diagnostic/conclusions.md`.
