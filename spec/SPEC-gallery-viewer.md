# Spec Delta: Gallery and viewer — redesign module 4 of 5

Status: implemented (2026-11-26, folded into `spec/SPEC-mvp.md`; device check with the final test campaign)

Module `gallery-viewer` of the UI redesign (`spec/capability-map.md`). Inherits everything from `spec/SPEC-mvp.md` (stack, commands, structure, code style, testing strategy, boundaries) and builds on modules `ui-foundation` (pebbles, action colors, long press, haptic tick) and `trash` (`moveToTrash`, trash rules).

## Objective

Make the gallery a place the child enjoys, and give each drawing its own screen:

1. the gallery as a **wall**: drawings pinned with a strip of tape, slightly tilted, and a blank dashed sheet with a "+" to start a new page;
2. a **viewer** for one drawing: the replay with **play / pause / restart** and a progress bar, **continue** the drawing, **share** it, **move it to the trash** (long press);
3. the layouts of the mockups: boards "Galerie — iPhone SE", "Galerie — tablette", "Visionneuse — iPhone SE", "Visionneuse — iPad 11".

Users: children aged 5+ (find a drawing, watch it redraw itself, go on with it, throw it away without fear: the trash keeps it 30 days).

## Current Behavior

- Gallery (`src/app/gallery-screen.ts`, `#gallery-screen` in `src/app/app.html`): a header with back (to the slate), new page and the padlock (long press, opens `parent.html`); a grid of square thumbnails, newest first. Tapping a thumbnail reopens the drawing on the slate. Each card carries two pebbles: play (opens the replay screen) and share (magic PNG, share sheet).
- Replay (`src/app/replay-screen.ts`, `#replay-screen`): a full-screen page; the drawing redraws itself on the schedule of `src/engine/replay.ts` (15 s at most). Touching the page stops it and goes back to the gallery; a "play again" pebble at the end.
- No deletion in the child UI. The trash exists in storage only (module `trash`).

## New Behavior

### Gallery: the wall

- **Header**: back to the slate (left, `theme-history`, unchanged) and the **settings** pebble (right, `theme-hold`, gear icon `bi-gear`, long press 1.5 s, unchanged behavior: it opens the parent page, renamed settings page by module `settings`). The new page pebble leaves the header.
- **First tile**: a blank sheet with a dashed beige border (`#c9b98f`, 3 px) and a green "+" (`bi-plus-lg`, `#43a047` as the mockup: the light `create` green would not show on the paper), slightly tilted (1°): a new page, as the old header button.
- **Drawing tiles**: white square thumbnails with the paper shadow, each **tilted** between −2.5° and +2.5° and carrying a **strip of tape** on top (one of the six action colors, 85 % opacity, tilted the other way). Tilt and tape are derived from the drawing id (pure function, stable across reloads and new drawings), never stored.
- Order unchanged: newest first (by `updatedAt`), trashed drawings left out.
- **Grid**: as many columns as fit, tiles of a fixed size per device class (phone 150 px, tablet 180 px), columns spread across the width (`space-evenly` on phones, `space-between` on tablets), generous row gap so the tilts and tapes never overlap; the wall scrolls vertically, the header stays. Nothing in the edge margins (DF-02).
- **Tapping a drawing opens the viewer** (not the slate any more). The card pebbles (play, share) are removed: they live in the viewer.
- Empty gallery: only the "+" tile.

### Viewer

A new screen `#viewer-screen` (replaces `#replay-screen`).

- **Content**: the drawing on its white page with the paper shadow, and a thin **progress bar** under it (Bootstrap `.progress`, 6 px, beige track `#ebe0c4`, ink fill `#2b2b2b`): the share of the replay already played.
- **Replay starts as soon as the viewer opens** (stroke by stroke, eraser included, same schedule as today: 15 s at most).
- **Controls** (pebbles):
  - **play / pause** (large: 72 px phone, 88 px tablet, `theme-create`): pauses and resumes where it was; at the end it shows "play" and starts again from the beginning;
  - **restart** (`theme-mode`, `bi-arrow-repeat`): starts again from the beginning and plays;
  - **continue** (`theme-continue`, `bi-pencil`): puts the drawing on the slate (as tapping a thumbnail did) and shows the drawing screen;
  - **back** (`theme-history`): to the gallery;
  - **share** (`theme-gallery`, `bi-share`): the magic PNG through the share sheet (same code as today's card button, encoding started on the tap for iOS);
  - **move to the trash** (`theme-hold`, `bi-trash3`, long press 1.5 s, fills from the bottom with light red `#ef9a9a`): `moveToTrash(id, now)`, haptic tick, back to the gallery (the drawing is gone from the wall). If it is the drawing on the slate, the slate switches to a blank page (its last stroke saved first, then the record stays trashed: the save rule of module `trash`).
- **Touching the page** toggles play / pause (it no longer leaves the screen). Keyboard: Space / Enter on the page as well; Escape goes back to the gallery.
- **Layouts** (follow the window's shape, `ui-foundation`):
  - **Portrait** (board "Visionneuse — iPhone SE"): a top row with back on the left, share and trash on the right; the page with its progress bar; a bottom row restart, play / pause, continue; the whole centered vertically.
  - **Landscape** (board "Visionneuse — iPad 11"): a left column with back on top and share + trash at the bottom; the page with its bar in the middle; a right column with play / pause, restart and continue, centered vertically; spread across the screen like the drawing screen (`justify-content: space-between`).
  - Page size: the largest square that fits with the controls, as on the drawing screen; nothing in the edge margins.
- Rotation or resize while it plays or is paused: the page is resized and repainted at the current point of the replay, losing nothing.

### Replay clock (pure)

- Pause and resume need a clock that can stop: a pure module (`src/engine/replay-clock.ts`) holds the replay position (elapsed replay time) with `play(now)`, `pause(now)`, `restart(now)`, `elapsed(now)`, `progress(now)` (0–1) and `ended(now)`; the DOM side paints from `elapsed(now)` as today. Painting from the beginning after a resize or a restart uses the existing `renderStroke` / `visiblePoints`.

### Leaving and coming back

- The replay stops when the viewer is left (back, continue, trash) or the app goes to the background; it stays paused there and resumes on the play button.

## Success Criteria

1. Unit tests (`src/engine/replay-clock.test.ts`): elapsed time stops while paused and resumes from the same point; restart goes back to 0 and plays; progress clamps to 0–1; play at the end starts again from 0.
2. Unit tests: tilt (within ±2.5°, never 0) and tape color from a drawing id are stable and spread over several ids.
3. e2e: the gallery shows the "+" tile first, then the drawings newest first, each tilted with a tape; the "+" tile opens a blank page; no play or share pebble on the cards.
4. e2e: tapping a drawing opens the viewer, the replay plays (canvas pixels appear over time, progress bar grows), pause freezes the progress, play resumes, restart starts from an empty page, a tap on the page pauses.
5. e2e: continue opens the drawing on the slate (a new stroke is added to it); share yields a magic PNG carrying the drawing (existing share test moved to the viewer).
6. e2e: a short press on the trash pebble does nothing; a 1.5 s press moves the drawing to the trash (gone from the gallery, present in `listTrash`); trashing the drawing that is on the slate leaves a blank slate.
7. e2e: viewer and gallery layouts, phone and tablet, portrait and landscape: every control on screen, out of the edge margins, ≥ 48 px; screenshots compared with the boards by eye.
8. What must NOT change: the replay schedule (`src/engine/replay.ts`), the magic PNG, the long press to the parent page, the drawing screen, autosave, the trash rules.

## Boundaries (deltas)

- Always: the replay clock and the tilt / tape rule pure and tested; long press through `initLongPress` (`src/app/long-press.ts`); trash through `moveToTrash` only.
- Ask first: deleting for good from the child UI; changing the replay speed rules.
- Never: store the tilt or tape in the drawing; let a child empty the trash.

## Out of Scope (Deferred)

- The settings page (trash list, restore, empty): module `settings`.
- Replay export as video / GIF (milestone 3); replay speed control; scrubbing on the progress bar.
- Sorting or grouping the gallery (by date, by folder).

## Open Questions

Answered 2026-11-25 (approved as proposed):

1. **Replay on opening**: the viewer plays at once (mockup shows it playing). Alternative: open on the finished drawing, play on demand.
2. **Touching the page** toggles pause (proposed), instead of leaving as today.
3. **Phone landscape and tablet portrait** have no board: built from the two boards as described under Layouts (landscape = three columns, portrait = rows), without a mockup first.
4. **The settings pebble** takes the gear icon now (it still opens `parent.html` until module `settings` renames it).
