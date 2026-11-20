# Carnet magique

> Superseded in part by `spec/SPEC-mvp.md` (square page only, Pen / Finger / Multi-finger input mode). The spec wins.

Carnet magique (English name: Magic Sketchbook).

## Problem Statement

How can we give a child aged 5 and up — on an iPad with a stylus or on a smartphone with a finger — a drawing notebook where they can draw, color and learn to write, without ever losing a drawing, with no ads, no account, and offline?

## Recommended Direction

A framework-free PWA (Vite + TypeScript, `vite-plugin-pwa`) built around a pure-TS drawing engine, decoupled from the UI. The drawing screen has no text: big color swatches, two stroke widths, an eraser, a giant "undo" button. Each drawing is stored as vector strokes (points + timestamps) in IndexedDB, which makes replay, background layers and export possible. Bootstrap is reserved for "adult" screens (detailed gallery, settings, export).

Three successive layers: **the notebook** (slate + shareable "fridge" gallery via native sharing), **the magic** (stroke-by-stroke replay), **the activity book** (SVG coloring pages with closed zones and overflow prevention by clipping to the starting zone, and letter templates — capitals first, then cursive — on a locked background layer). The engine handles one stroke per `pointerId` from the start: multi-finger becomes a cheap bonus, not a rewrite.

Two first-class input modes:

- **Tablet with stylus** (iPad + Metapen): the stylus draws, the palm is ignored.
- **Finger only** (iPad without stylus, iOS and Android smartphones): the finger draws. No finger gesture is reserved for pan/zoom.

The interface must fit a portrait smartphone screen as well as a landscape tablet (palette folded into a compact bar on small screens, touch targets ≥ 48 px everywhere).

**Reference devices to validate the MVP:**

1. iPad 11 with Metapen stylus (Safari, installed PWA);
2. iPad 11 with finger;
3. Google Pixel 9a with finger (Chrome, installed PWA).

A feature is only "done" once it is validated on all three.

## Key Assumptions to Validate

- [ ] **The Metapen is seen as a stylus** (`pointerType: "pen"`) by Safari iPadOS — with or without pressure/tilt. → Diagnostic page displaying the Pointer Events properties, tested **before anything else**.
- [ ] **Stylus / finger switching without settings**: as soon as a stylus is detected, finger/palm contacts are ignored; without a stylus, the finger draws. → Test on the iPad in both uses, and check that a child does not end up "stuck" (finger no longer drawing after using the stylus).
- [ ] **System gestures can be neutralized** on iOS and Android (magnifier/long press, double-tap zoom, selection, context menu, pull-to-refresh, edge gestures). → Full-screen test canvas in an installed PWA, 10 minutes of intensive scribbling on each device.
- [ ] **Vector storage stays light**: a 10-minute drawing < ~500 KB. → Measure; point simplification (Ramer–Douglas–Peucker) if needed.
- [ ] **Rendering is smooth**, with no perceptible latency, with stylus and finger. → Check `getCoalescedEvents()` on the target iPadOS/iOS and Chrome versions, fallback planned.
- [ ] **Data survives** in an installed PWA with `navigator.storage.persist()`. → Test after several days without opening; manual export as a safety net.
- [ ] **A 5-year-old uses it alone**, including on a small smartphone screen. → Test with the child, without explanation.

## MVP Scope

**Step 0 (one evening):** Pointer Events diagnostic page, tested on the three reference configurations. If the Metapen is not seen as `pen`, we rethink the input strategy before writing anything else.

**MVP — the notebook:**

- slate: 6–8 colors, 2 stroke widths, eraser, undo/redo, "new page";
- page format chosen at page creation, via 3 pictograms: **square**, **A4 portrait**, **A4 landscape** (1:√2 ratio). The page is centered and scaled to the screen (bands around it if needed);
- stylus and finger input, palm rejection when a stylus is active;
- adaptive UI, portrait smartphone ↔ landscape tablet;
- silent automatic saving;
- thumbnail gallery, reopen a drawing, share as PNG (native sharing);
- replay of a drawing;
- parent mode: deletion protected by an adult gesture, gallery export/import, storage persistence;
- installable as a PWA, works offline.

**Milestone 2 — the activity book:** 5–10 hand-made SVG coloring pages with overflow prevention, then capitals to trace (starting point + arrows, no correction).

**Milestone 3:** cursive letters, simultaneous multi-finger, replay export as video/GIF.

## Not Doing (and Why)

- **Angular / UI framework** — no added value for an app that is mostly a canvas; needless weight.
- **Accounts, sync, backend** — out of reach for a solo evening project, and native sharing covers "send to grandma".
- **Pressure-based width, layers, advanced brushes** — the Metapen probably has no pressure, the finger never does; this is an illustrator's app, not a child's notebook.
- **Zoom / infinite canvas, finger pan** — confusing at 5, and in conflict with "the finger draws". The page is the size of the screen.
- **Automatic handwriting correction** — a full stroke-recognition project in itself. We guide, we don't grade.
- **Coloring pages generated from the child's drawings** — complex and fragile zone detection; a few hand-made coloring pages are enough to validate the idea.
- **Tests targeting PC with mouse / PC with touch** — the code stays standard (Pointer Events) and should work, but no validation effort until the MVP holds on the three reference configurations.
- **Text in the child UI** — the child does not read well yet; everything goes through pictograms.

## Open Questions

- Which cursive model, under which license (free school font, or outlines redrawn as SVG)?
- Replay at real speed, or accelerated to last ~10 s whatever the drawing?
- Which "adult" gesture for parent mode (3 s long press, small calculation, other)?
- "Pixel" eraser or "whole stroke" eraser (simpler with vectors, less intuitive)?
- On a smartphone, a format whose orientation does not match the screen's (A4 landscape on a phone held in portrait) becomes very small: invite the user to rotate the phone, or let it be?

## Decisions Made

- **Page format chosen at creation**: square, A4 portrait or A4 landscape. Strokes are stored in **page coordinates** (independent of the screen), which makes a drawing identical on iPad and smartphone and allows PNG/PDF export at A4 size. Each coloring page and letter template declares its format.
- **"New page" reuses the last format used** (one tap less); the format choice remains accessible from the drawing screen.
