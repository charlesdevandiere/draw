# Spec: Carnet magique — MVP "the sketchbook" — V1

Status: **proposed**, awaiting approval.

Sources: `docs/ideas/carnet-magique.md` (vision, scope, "Not Doing") and `docs/diagnostic/conclusions.md` (device measurements, input rules). This spec wins where they disagree.

## Objective

**What.** The first real Carnet magique: a drawing slate for children aged 5 and up, with a gallery that keeps every drawing. Installable PWA, works offline, no account, no backend. Available in **English and French**, built so that more European languages are just one dictionary file each.

**For whom.**

- **The child**: drawing screen and gallery. No visible text, pictograms only, touch targets ≥ 48 px.
- **The parent**: a protected "adult" page to delete, export, import, configure and update.

**Reference devices** (a feature is done only when validated on all three): iPad 11 + Metapen, iPad 11 by finger, Pixel 9a by finger (Chrome, installed PWA).

**Two delivery phases**, each validated on the three devices before starting the next:

- **Phase A — the sketchbook**: slate, input modes, autosave, gallery, PNG sharing, languages, PWA.
- **Phase B — the magic and the parent**: replay, parent page, gallery export / import.

### Decisions (2026-11-20)

- **Square page only**: one format, 1000 × 1000 page units. The format picker from the framing note is dropped.
- **"Pencil" eraser**: rubbing erases what is underneath. In vector terms it is an eraser stroke rendered with `destination-out`, and replayable.
- **Accelerated replay**: pauses between strokes shortened, total duration capped at ~15 s.
- **Parent access**: press and hold a small padlock icon for 1.5 s; the button fills from the bottom (3 s with a ring until module `ui-foundation`, `spec/SPEC-ui-foundation.md`).
- **Input mode** Pen / Finger / Multi-finger, offered on **every platform**: Apple Pencil, Logitech Crayon, Metapen, S Pen (Galaxy Tab), USI 2.0 pens (Pixel Tablet) and Surface Pen all report `pen`. Passive styluses report `touch`. Automatic switch to Pen only until a mode has been chosen by hand.
- **Bootstrap 6.0.0-alpha.1**, exact version, **compiled from Sass**, importing only the modules we use, with our own theme. Its CSS is used everywhere; its JavaScript only where a component needs it.
- **"Magic PNG"**: a drawing file is a normal PNG that also carries the vector drawing in a metadata chunk. It is the format for sharing (phase A) and for export / import (phase B).
- **Everything in the repository is in English** (code, comments, docs, specs, commit messages). Git history already published stays as is. The UI is translated.
- **One URL and one manifest per language** (`/draw/en/`, `/draw/fr/`), so the installed app has a name in the user's language: "Magic Sketchbook" / "Carnet magique".
- **Translations in JSON with an ICU MessageFormat subset** (placeholders, plural, select), formatted by a small hand-written module.
- **Screens are static HTML sections**, initialized once and switched with the `hidden` attribute. No router, no component system.

### Phase A — the sketchbook

**A1 — Page and rendering**

- The square page is scaled and centered in the drawing area. Points are stored in **page coordinates** (0–1000): converted on input (screen → page) and on render (page → screen, honoring `devicePixelRatio`).
- One canvas over the white page background (changed during T8: an eraser stroke in progress must act on what is already drawn, so a separate live layer does not work). Strokes in progress are painted incrementally on every `requestAnimationFrame`; the whole drawing is repainted from its vectors only when needed (undo, resize, open). The eraser clears the canvas down to the white background without erasing it.
- A tap without movement draws a **dot** (a disc of the stroke diameter).
- Resizing or rotating the screen redraws the page at its new size, losing nothing.

**A2 — Slate tools**

- **56 colors** (module `draw-tools`, `spec/SPEC-draw-tools.md`): 14 families × 4 tones (light, bright, medium, dark), ids `<family>-<tone>`, values and orders in `src/engine/palette.ts`. The 8 MVP colors are all in it (medium tone, black = grey dark). Phones: no colors on screen, a palette pebble opens an "all colors" dialog (warm and neutral families, then cool ones); tablets: the whole palette as one grid by wavelength (4 × 14 left of the page in landscape, the same turned by −90° above it in portrait). The selected cell is drawn larger, rounded, with a light shadow.
- **6 sizes**: 4, 8, 16, 24, 40, 64 page units, on a stepped `.form-range` slider with a preview dot at real size (1:1 with the page), a haptic tick per step. The **eraser** ("pencil" style) takes the slider size; the selected eraser pebble is drawn larger with the same shadow. Picking a color goes back to the pen; the slider keeps the tool.
- **Undo / Redo**: undo removes the last finished stroke (eraser strokes included), redo puts it back. Any new stroke clears the redo stack. History covers the whole drawing, including after reopening it.
- **New page**: the current drawing is already saved; a blank page opens. A drawing with no strokes is never stored in the gallery.
- Current color and size always visible (selected cell, slider preview dot).

**A3 — Input modes**

A button always visible on the drawing screen, with 3 pictograms. The choice is remembered.

| Mode             | Who draws                                                                                    | Default |
| ---------------- | -------------------------------------------------------------------------------------------- | ------- |
| **Pen**          | Only `pen` pointers; every `touch` is ignored (palm included, even before the first stroke). | —       |
| **Finger**       | One contact at a time (rules below).                                                         | Yes     |
| **Multi-finger** | Every contact, one stroke per `pointerId`.                                                   | —       |

- **Automatic switch**: on the first `pen` seen, if no mode was ever chosen by hand, the app switches to Pen (the pen stroke draws). Once a mode is chosen by hand, no more automatic switching.
- **Finger mode rules** (improving the diagnostic's "single touch" option):
  - the first contact keeps the slot until **no contact at all** touches the screen; the next contact may then draw at once (a release delay was tried and removed: it dropped strokes in fast handwriting with a round-tip stylus, `docs/device-fixes.md` DF-10);
  - **width filter**: a contact wider than a threshold (default 80 CSS px; measured iPad finger 42–63 px, palm up to 292 px) is ignored and holds the slot like any other contact. No effect on Android (reported widths ≤ 61 px); threshold to revisit with a child's hand;
  - `pen` pointers also draw in Finger mode.
- All platforms: drawing happens only between `pointerdown` and `pointerup` / `pointercancel`. Movement without contact (**hover** of Android / Windows pens, `buttons === 0`) is ignored. `pointercancel` ends the stroke and keeps it, unless the contact never moved more than 2 % of the page from where it landed: then it is a palm iPadOS rejected, and its dot is removed. The same goes for a contact the Finger mode width filter turns away after it started (a palm landing edge first, then spreading). A tap lifted normally keeps its dot.
- `getCoalescedEvents()` when available, falling back to the event itself.
- Never `pressure`, `tilt` or the user agent.

**A4 — Drawing screen and layout**

- **Portrait**: the page spans the full width, tools below. **Landscape**: the page spans the full height, tools on the sides. The layout follows the window's shape (`min-aspect-ratio: 1/1`), not the device type; a layout fixed to the hardware was tried and dropped (`spec/SPEC-ui-foundation.md`, Decision history).
- **Device class**, for margins only: a tablet has both viewport sides ≥ 576 px (Bootstrap `sm`), in either orientation (DF-02).
- **Theme** (module `ui-foundation`): paper background `#fff4d6`, square white page with a shadow, ink `#2b2b2b`. Action buttons are **pebbles**: Bootstrap `.btn.btn-solid.btn-pebble.theme-<role>`, rounded squares (29 %) at the tool size (56 px, shrinking by DF-01, never under 48 px), one color per role (`$action-colors` in `src/styles/_tokens.scss`), dark icons; disabled pebbles beige with a grey icon. The drawing screen layout (palette, slider, tool groups per orientation and device class) is described in `spec/SPEC-draw-tools.md`.
- **No control** within a margin near the top and bottom edges (≥ 32 px plus `safe-area-inset`).
- **Gesture protections** always on (list in `docs/diagnostic/conclusions.md`).
- No visible text: pictograms from Bootstrap Icons (only the icons used, imported in Sass as CSS masks, `src/styles/_icons.scss`), targets ≥ 48 px, translated `aria-label`s.

**A5 — Autosave**

- Each drawing is an IndexedDB record: id, created and modified dates, schema version, strokes, PNG thumbnail, and `trashedAt` once moved to the trash (module `trash`, `spec/SPEC-trash.md`). The database is named `draw`: the origin `charlesdevandiere.github.io` is shared with every other GitHub Pages project of the account.
- A stroke = tool (`pen` or `eraser`), color, width, points `[x, y, t]` (t in ms since the drawing started, for replay). Coordinates rounded to 0.1 unit.
- Saved **after each finished stroke** (batched over ~1 s) and when the app goes to the background (`visibilitychange`). No UI, no message.
- On launch, the app reopens the **last drawing**, unless it is in the trash (then a blank page).
- **Trash** (module `trash`): a deleted drawing can go to the trash first. Its record stays, with `trashedAt` next to the drawing (never in the drawing format or the magic PNG); it leaves the gallery, the parent page list and the export, stays restorable 30 days, and is purged for good at the next app or parent page start after that. A save never takes a drawing out of the trash; importing the PNG of a trashed drawing restores it. Pure rules in `src/store/trash.ts`. The buttons come with modules `gallery-viewer` (move to trash) and `settings` (trash list); until then the parent page's delete stays final.
- `navigator.storage.persist()` requested on first launch in standalone mode.

**A6 — Gallery, viewer and sharing** (module `gallery-viewer`, `spec/SPEC-gallery-viewer.md`)

- A button on the drawing screen opens the gallery, a **wall**: a blank dashed "+" sheet first (a new page), then the drawings newest first, each slightly tilted under a strip of tape (both derived from the drawing id, `src/engine/wall.ts`, never stored). The settings pebble (gear, long press) sits in its header.
- Tapping a drawing opens the **viewer**: the drawing replays at once (B1) above a progress bar, with play / pause, restart, **continue** (puts it on the slate), **share** and **move to the trash** (long press 1.5 s, light red fill; the drawing on the slate then turns to a blank page). Touching the page toggles pause; Escape goes back.
- **Share**: a **magic PNG** (2048 × 2048, white background, vector drawing embedded) through the native share sheet (`navigator.share` with a file), encoding started on the tap (iOS user activation). Fallback when file sharing is unavailable: download the PNG.
- Deleting for good is never in the child UI: the trash keeps a drawing 30 days (A5).

**A7 — Magic PNG**

- A standard PNG with an `iTXt` chunk, keyword `carnet-magique`, zlib-compressed text (compression flag 1) holding the drawing as JSON with its schema version.
- Compression through `CompressionStream('deflate')`, which produces the zlib format PNG expects (Safari ≥ 16.4).
- The chunk encoder / decoder (chunk layout, CRC-32, validation) is pure and unit-tested.
- Any image viewer shows the drawing. Apps that re-encode images (messaging apps, possibly Photos) drop the chunk: the image stays viewable but is no longer importable. To check on devices.

**A8 — Languages**

- **One JSON file per language** (`src/i18n/messages/en.json`, `fr.json`), flat keys, values in **ICU MessageFormat** (the syntax Angular i18n uses), limited to a small subset:
  - placeholders: `{name}`;
  - plural: `{count, plural, =0 {…} one {# drawing} other {# drawings}}`, categories from the native `Intl.PluralRules` (correct for every European language);
  - select (gender or any variant): `{gender, select, female {…} male {…} other {…}}`.
- A hand-written formatter (~100 lines, pure, tested) parses this subset; no dependency. If needs ever grow, `intl-messageformat` reads the same syntax: the JSON files would not change.
- `en.json` is the reference. The build fails if another language misses a key (TypeScript type of `en.json`) and a unit test refuses extra keys and malformed messages.
- All languages are bundled (a few dozen strings) and the language is chosen at runtime, unlike Angular's per-locale build: one build, and the settings page can switch language without reloading another URL. English is the fallback.
- In the HTML, `data-i18n="key"` (text) and `data-i18n-aria="key"` (accessible label), filled at startup.
- **One folder per language**: `/draw/en/` and `/draw/fr/`, each with its own HTML entry and its own manifest (name, `lang`, `start_url`, `scope`). Both load the same code, which reads the language from `<html lang>`.
- The root `/draw/` picks the language from `navigator.languages` and redirects to `/draw/fr/` or `/draw/en/`. The app is installed from there, so its name under the icon is in the right language.
- The diagnostic page also exists in both folders and uses the same dictionaries.
- A single service worker at `/draw/` caches both languages.

**A9 — PWA**

- Installable, works offline (drawing screen, gallery, viewer, settings, diagnostic).
- Update check every time the app returns to the foreground. When a new version installs, the page reloads **only if no stroke is in progress** (otherwise on the next return to the foreground), after saving.
- The current temporary home page is replaced by the language redirect.

### Phase B — the magic and the parent

**B1 — Replay** (in the viewer, A6)

- The drawing redraws itself stroke by stroke, eraser included, on its page, with a progress bar; play / pause and restart through a pure clock (`src/engine/replay-clock.ts`); play at the end starts again.
- **Speed**: inside a stroke, real time is kept (a finger held still more than 1 s mid-stroke is shortened to 1 s); every pause between strokes is shortened to 300 ms at most; if the result still exceeds **15 s**, everything is sped up uniformly to fit 15 s.

**B2 — Settings access**

- The gear pebble in the gallery's header, a **long press** (`LONG_PRESS_MS` = 1.5 s, the same for every long press): while held the button grows and fills from the bottom with a darker shade of its color; on completion a light haptic tick (Android; none on iPad, DF-12), then the settings page opens (`settings.html`, in the same language folder); releasing earlier cancels. `parent.html` redirects there for one version.

**B3 — Settings page** (module `settings`, `spec/SPEC-settings.md`; Bootstrap in the paper look, translated)

- **Backup**: "N drawings, X MB."; export every drawing outside the trash as magic PNGs (share sheet or downloads); **import** magic PNGs only (valid chunk, known schema), merged by id, a trashed id is restored; size limit per file.
- **Share the sketchbook**: the app's link through the share sheet, or copied to the clipboard.
- **Trash**: rows newest first (thumbnail, "Deleted yesterday", Restore); empty it with a 1.5 s press.
- **Update**: version (short SHA) and build date, "Check for updates" with a badge, "Clear cache and reload".
- **Language**: override the UI language (otherwise the folder's language).
- **Finger drawing**: palm width filter switch and threshold, defaults.
- **Persistence** line (protected or not, ask again) and a link to the diagnostic page.
- One column on phones, three on wide windows; the back pebble returns to the gallery (`./#gallery`).

## Tech Stack

- **Node 24**, npm, **Vite 8** + **TypeScript 6** (`strict`), no UI framework.
- Already in place: `vite-plugin-pwa` (Workbox, `generateSW`), Vitest 5, ESLint 10 + `typescript-eslint`, Prettier 3.
- **New**: `bootstrap@6.0.0-alpha.1` (exact version, with its peers `@floating-ui/dom` and `vanilla-calendar-pro`), `sass` (Vite compiles `.scss` natively once it is installed).
- IndexedDB **without a library**: a small hand-written promise wrapper.
- **`@playwright/test` 1.65** (dev only) for end-to-end tests on Chromium and WebKit, run locally.
- Manifests written by hand per language (`vite-plugin-pwa` keeps the service worker only, `manifest: false`).
- Deployment unchanged: GitHub Pages via GitHub Actions, `base: '/draw/'`.

## Commands

Unchanged:

```
npm ci                 # install
npm run dev            # dev server (local network)
npm run build          # tsc --noEmit && vite build
npm run preview        # test the build and the service worker
npm test               # vitest run
npx vitest run src/engine/history.test.ts -t "undo removes the last stroke"
npm run lint
npm run format
npm run check          # lint + format:check + tests with coverage ≥ 90 % + build
npm run e2e            # build, then Playwright on Chromium and WebKit against vite preview
npx playwright test e2e/draw.spec.ts --project=webkit   # one file, one browser
```

## Project Structure

Deliberately simple: **pure, tested modules, and a few thin DOM files that wire them up**. No router, no state library.

```
index.html                 → Language redirect (/draw/ → /draw/fr/ or /draw/en/)
en/index.html, fr/index.html          → The child app (drawing + gallery), lang + manifest link
en/parent.html, fr/parent.html        → Parent page (phase B)
en/diagnostic.html, fr/diagnostic.html → Diagnostic page
public/en/manifest.webmanifest, public/fr/manifest.webmanifest
src/
  engine/                  → PURE — the drawing engine
    types.ts               → Point, Stroke, Drawing, Tool, page constants
    page-transform.ts      → Screen ↔ page (scale, centering, devicePixelRatio)
    stroke-builder.ts      → Builds a stroke from samples
    history.ts             → Undo / redo
    render.ts              → Draws strokes on a provided 2D context (minimal interface)
    replay.ts              → Replay schedule (phase B)
  input/                   → PURE — input decisions
    input-mode.ts          → Pen / Finger / Multi-finger, width filter, hover
    palm-rejection.ts      → (diagnostic, kept)
  store/
    schema.ts              → PURE — stored format, version, validation, migration
    png-chunk.ts           → PURE — read / write the iTXt chunk, CRC-32
    db.ts                  → DOM — IndexedDB access (drawings, settings)
    magic-png.ts           → DOM — canvas → PNG, compression, chunk insertion
  i18n/
    messages/en.json, fr.json → Translations (ICU MessageFormat subset)
    format.ts              → PURE — parses and formats placeholders, plural, select
    i18n.ts                → PURE — language choice, lookup, typed keys
    apply.ts               → DOM — fills [data-i18n] texts and aria-labels
  app/                     → DOM — child app
    main.ts                → Startup, screen switching (hidden), autosave
    draw-screen.ts         → Canvases, tools, Pointer Events → engine
    gallery-screen.ts      → Grid, open, share, replay, padlock
  parent/main.ts           → DOM — parent page (phase B)
  pwa/app-update.ts        → Moved from src/diagnostic/, shared
  styles/                  → Sass: theme variables, Bootstrap modules used, Bootstrap Icons used (_icons.scss), app styles
  diagnostic/              → Existing, translated through i18n
```

Rules:

- `engine/`, `input/` and files marked PURE **never** import the DOM or `window`: tested in the `node` environment, coverage ≥ 90 %.
- DOM files stay thin and are added to the coverage exclusion list in `vite.config.ts`.
- Each screen is a static `<section>` in the HTML, set up once at startup by an `initX()` function; switching screens toggles `hidden`.

## Code Style

Step 0 conventions: `kebab-case.ts` files, tests next to them; functions and factories over classes; no `any` or `@ts-ignore`; time injected (never `Date.now()` in pure code); Prettier (`singleQuote`, `printWidth: 100`). Now **English everywhere** in the repository; user-facing text only through the dictionaries.

```ts
// src/engine/types.ts
export const PAGE_SIZE = 1000;

export type Tool = 'pen' | 'eraser';

export interface Stroke {
  tool: Tool;
  color: string;
  /** Diameter in page units. */
  width: number;
  /** Flat list of x, y, t triplets: page units, ms since the drawing started. */
  points: number[];
}

// src/engine/history.ts
export interface History {
  strokes: readonly Stroke[];
  redo: readonly Stroke[];
}

export function commitStroke(history: History, stroke: Stroke): History {
  return { strokes: [...history.strokes, stroke], redo: [] };
}

export function undo(history: History): History {
  const last = history.strokes.at(-1);
  if (!last) return history;
  return { strokes: history.strokes.slice(0, -1), redo: [...history.redo, last] };
}

// src/i18n/messages/fr.json
// {
//   "tool.undo": "Annuler",
//   "parent.selected": "{count, plural, =0 {Aucun dessin sélectionné} one {# dessin sélectionné} other {# dessins sélectionnés}}"
// }

// src/i18n/i18n.ts
import en from './messages/en.json';
import fr from './messages/fr.json';

export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

// A key missing from fr.json is a type error here.
const catalogs: Record<Language, Messages> = { en, fr };

// Usage: t('parent.selected', { count: 3 }) → "3 dessins sélectionnés"
```

## Testing Strategy

- **Unit (Vitest, `node` env)** on all pure code:
  - `page-transform`: screen → page → screen round trip, portrait and landscape centering, `devicePixelRatio` 1, 2, 3;
  - `stroke-builder`: coalesced and fallback, tap without movement → one dot, rounding;
  - `history`: undo, redo, new stroke clears redo, undo on empty;
  - `render`: with a fake context recording calls (color, `destination-out` for the eraser, disc for a dot);
  - `input-mode`: each mode; automatic switch on first `pen` and not after a manual choice; Finger mode (slot kept, released as soon as everything is lifted, width filter, `pen` accepted, palm spreading after touch-down); hover and `pointercancel` are handled by the drawing screen (cancel = up) and covered end to end;
  - `schema`: validation, unknown version refused, migration;
  - `png-chunk`: write then read back, CRC-32 against known values, missing chunk, corrupt chunk, oversized chunk;
  - `i18n`: language choice from `navigator.languages`, fallback to English; formatter: placeholders, plural (`=0`, `one`, `other`, `#`) in English and French, select, nested plural inside select, malformed message rejected; every catalog has exactly the keys of `en.json`;
  - `replay`: pauses capped at 300 ms, 15 s cap, empty drawing.
- **End-to-end (Playwright, local only)** in `e2e/`, against the production build served by `vite preview`, on **Chromium and WebKit** (WebKit is Safari's engine, not iPadOS Safari):
  - viewports: iPad 11 landscape and Pixel 9a portrait, touch enabled;
  - synthetic `pen` and `touch` pointer events (multi-touch included), canvas pixels read back to check strokes, dots, eraser, undo, input modes;
  - reload persistence, gallery, replay, language redirect (`locale` `fr-FR` / `en-US`), manifests, offline launch through the service worker, magic PNG round trip and refusal of a plain image;
  - screenshots per screen and layout, reviewed by eye during each UI task.
  - Not in GitHub Actions for now (deployment speed); can be added later.
- **Manual validation on the 3 devices** stays required (installed PWA, system gestures, real palm, Metapen, fluidity), following the protocol in the plan.
- **Size check**: a 10-minute scribble must weigh < 500 KB.

## Boundaries

- **Always**: `npm run check` green before any commit; pure logic tested before it is wired to the DOM; feature detection; check every web API on iOS Safari; points in page coordinates; gesture protections on in the child UI; English in the repository; user-facing text through the dictionaries.
- **Ask first**: adding a dependency outside the Tech Stack; changing the stored format once phase A has shipped (it then needs a migration); changing `base`, the URL or the deployment workflow; adding visible text to the child UI; adding a language.
- **Never**: `git push` (the user pushes); commit a secret; branch behavior on the user agent; use `pressure` / `tilt`; put a control near the top or bottom edge; disable a lint rule or a test to get green; lose a drawing (every schema migration is tested); import an image that is not a valid magic PNG.

## Success Criteria

**Phase A**

1. `npm run check` passes; a push to `master` publishes the app at `https://charlesdevandiere.github.io/draw/`.
2. `/draw/` opens `/draw/fr/` on a French browser and `/draw/en/` otherwise; installed from there, the app is named in that language, and its pictogram labels are translated.
3. On the 3 devices, installed PWA: draw with several colors and sizes and the eraser; dot an "i"; undo and redo 10 times in a row without error.
4. The stroke follows the pen / finger with no perceptible lag and no angular segments; no zoom, scroll, selection or system menu during 5 min of scribbling.
5. **Pen mode** (iPad + Metapen): writing with the palm resting, **including before the first stroke**, leaves no palm mark.
6. **Finger mode** (iPad by finger): clearly fewer palm strokes than the diagnostic's "single touch" option, especially when lifting the finger.
7. **Multi-finger**: two fingers draw two simultaneous strokes.
8. Automatic switch to Pen happens on the Metapen's first stroke; after choosing Finger by hand, the finger always draws.
9. Killing the app mid-drawing and relaunching it: the drawing is there, to the last stroke. Drawings survive a device restart.
10. Rotating the iPad or the phone: the layout adapts, the drawing is intact.
11. Gallery: reopen an old drawing and continue it; share a PNG to another app (Photos, messaging) on iPad and on Pixel. The shared PNG still holds its chunk when saved to Files.
12. In airplane mode, the installed app opens and works (drawing, gallery).
13. A newly published version is picked up on return to the foreground, without losing the current drawing.

**Phase B**

14. Replaying a 10-minute drawing takes ~15 s, eraser included; a 20-second drawing replays at real speed (shortened pauses).
15. A child tapping the padlock does not open the parent page; a 1.5-second press does.
16. Delete a drawing, export the gallery to Files, delete everything, import the PNGs back: every drawing returns, identical and replayable. Importing a photo is refused.
17. **Child test**: a 5-year-old draws, finds and reopens a drawing alone, without explanation, on the iPad and on a phone.

## Out of Scope (Deferred)

- **Milestone 2**: coloring pages with overflow protection, capital letters to trace. Decisions taken during the design phase (2026-11-22):
  - **Template layers, never a page type.** A drawing always starts on a blank page. A "templates" button (next to the eraser, with the drawing tools) opens a panel of thumbnails: none, writing lines, letters, coloring pages. A template is a locked layer added to the drawing without touching its strokes: **background** (lines, letters to trace, under the strokes) or **overlay** (coloring outlines, above the strokes, so they stay crisp under a thick marker). The eraser only ever erases strokes. Adding or removing a template is a history step (undo / redo), and each layer keeps the drawing time it was added at, so the replay shows it appearing.
  - **Overflow protection** applies to strokes started after a coloring overlay was added: each such stroke records the zone it started in and is clipped to it, so the result is identical live, in the replay and when reopened. Strokes drawn before the overlay stay as they are.
  - **Constant physical size for writing templates.** The page is about 6.5 cm wide on the Pixel 9a and 13 cm on the iPad 11: a letter scaled with the page would be twice as small on the phone. Lines and letters are therefore **generated when added**, at a fixed height in CSS pixels (e.g. 110 px ≈ 2 cm), converted to page units at the page scale of that device: fewer lines per page on a phone, the same letter height in cm everywhere. The web has no physical size API (CSS `cm` is fixed at 37.8 px), but the CSS pixel keeps a nearly constant physical size on handheld devices (spec-sheet estimates, in CSS px per real cm: iPad 11 ≈ 52, Pixel 9a ≈ 62, iPhone 8 ≈ 63), about ±10 %: enough for letters, no calibration. If a device strays too far, add a "letter size" setting in the settings page rather than a calibration step. The alphabet continues on the next page when a page is full.
  - **The generated template is stored with the drawing**: its SVG in page units plus its parameters (kind, id and version, line height, letters), in IndexedDB and in the magic PNG's metadata. A drawing reopened on another device keeps its original template (scaled with the page), and a PNG imported into a version that does not know that template still shows it. The PNG image itself is rendered from all layers.
- **Milestone 3**: cursive, replay export as video / GIF.
- **Before release 1.0.0 (required)**: freeze a stable, extensible format for the stroke history stored in magic PNGs and IndexedDB, so a picture made with any earlier version still imports in every later one. At least: a documented format spec (`docs/`), forward-compatible rules (unknown fields kept or ignored, new tools / stroke kinds degrade gracefully), a migration for each schema version, and a test corpus of PNGs from each released version that must keep importing. Until then the MVP format (schema 1) may still change. Order decided 2026-11-26: milestone 2 first, to learn what the format needs, then freeze it before 1.0.0. The frozen format must already carry what milestone 2 and the redesign need: a generic list of template layers (kind background / overlay, template id and version, parameters, embedded SVG, drawing time added; an unknown kind is ignored by older versions), an optional start zone per stroke (overflow protection), and the time a drawing was moved to the trash.
- **Design phase (with Claude Design)**: reduce energy use. A pure black background was mocked up and dropped (2026-11-22): once the page, the color box and the tools fill the screen, little black is left to save power on the Pixel's OLED (the iPad 11 is LCD), and the original paper background is friendlier. Energy is saved by doing no work when nothing moves: no animation frame loop at rest, no background work.
- **Synced folder**: automatically writing magic PNGs to a chosen folder (`showDirectoryPicker`). Chrome Android ≥ 155 and desktop only; impossible on iOS Safari. To check on the Pixel first.
- More European languages: one dictionary and one folder each, after the MVP.
- A4 formats: dropped for the square; reopen only on real need.
- Stroke smoothing, width simulated from speed: only if the raw stroke disappoints on device.
- Point simplification (Ramer–Douglas–Peucker): only if the size check exceeds 500 KB.
- Pressure, tilt, free user layers, brushes, zoom: see "Not Doing" in the framing note. (Locked template layers are milestone 2, above.)
- PDF export, printing.
- Validation on Android tablets and PC mouse / touch: no test device; the code stays standard.
- Palm width tuning with a child: measured during the phase B child test, then the threshold is adjusted.

## Open Questions

None. Resolved on 2026-11-20:

- **App name**: "Carnet magique" in French, "Magic Sketchbook" in English. The repository stays `draw`.
- **Translating the existing repository** (CLAUDE.md, framing note, diagnostic spec, conclusions, campaign notes, diagnostic page): first task of the plan, before any MVP code.
