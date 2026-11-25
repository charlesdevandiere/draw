# Implementation Plan: Gallery and viewer (redesign module 4 of 5)

Source spec: `spec/SPEC-gallery-viewer.md` (module `gallery-viewer` of `spec/capability-map.md`). Tasks: `tasks/gallery-viewer/todo.md`.

## Overview

The gallery becomes a wall of tilted, taped drawings with a "+" sheet first; tapping a drawing opens a viewer (replay with play / pause / restart and a progress bar, continue, share, move to the trash by long press). The replay schedule, the magic PNG and the trash rules do not change.

## Architecture Decisions

- **Pure first**: `src/engine/replay-clock.ts` (play, pause, restart, elapsed, progress, ended, with an injected `now`) and `src/engine/wall.ts` (tilt and tape index from a drawing id, a small string hash). Both unit-tested; the DOM files stay thin.
- **The viewer replaces the replay screen**: `src/app/viewer-screen.ts` (from `replay-screen.ts`) paints from `clock.elapsed(now)`; a resize repaints from the start up to the current point (existing `renderStroke` / `visiblePoints`). `ScreenName` `replay` becomes `viewer`.
- **Share moves as is**: the card's share code (encoding started on the tap, iOS user activation) moves to the viewer's share pebble.
- **Trash pebble** through `initLongPress` (`src/app/long-press.ts`) with a `danger-fill` variant (light red fill); `moveToTrash` then back to the gallery; when the trashed drawing is the one on the slate, `main.ts` switches the slate to a blank page after flushing autosave (the save keeps `trashedAt`).
- **Layouts in CSS** following the drawing screen's patterns (`container: screen / size`, `min-aspect-ratio: 1/1`, `$tablet` for sizes and DF-02 margins); the page side = the largest square left by the control rows / columns.
- **Vertical slices**: the viewer comes first with every action (so nothing is lost when the card pebbles go), then the wall look, then the trash, then the four layouts.

## Task List

### Phase 1: Pure rules

- [x] Task 1: Replay clock and wall tile rule (pure, unit-tested)

### Phase 2: The viewer

- [x] Task 2: Viewer screen: replay with progress, play / pause / restart, tap to pause, back, continue, share; gallery tap opens it, card pebbles removed
- [x] Task 3: Move to the trash from the viewer (long press), blank slate when the slate's drawing is trashed

### Checkpoint: Viewer

- [x] `npm run check` and `npm run e2e` pass; every former gallery action reachable from the viewer

### Phase 3: The wall and the layouts

- [x] Task 4: Gallery wall: "+" sheet, tilted taped tiles, gear settings pebble, responsive grid
- [ ] Task 5: Viewer and gallery layouts in the four window shapes (boards "Visionneuse", "Galerie")

### Checkpoint: Module complete

- [ ] Spec success criteria 1–8 met
- [ ] Device check on the iPad 11 (pen and finger) and the Pixel 9a, both orientations
- [ ] Fold into `spec/SPEC-mvp.md` (A6, B1), set `spec/SPEC-gallery-viewer.md` to `Status: implemented`

## Risks and Mitigations

| Risk                                                        | Impact | Mitigation                                                                                 |
| ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Pause / resume drifts or repaints twice after a resize      | Medium | Clock pure and tested; repaint from scratch to `elapsed`, e2e pixel checks while paused    |
| iOS share loses user activation once moved                  | Medium | Same code path (encoding starts on `pointerdown`), existing share e2e moved; device check  |
| Tilted tiles overflow the edge margins or overlap the tapes | Low    | Row gap ≥ tape height, padding = max tilt overhang; layout e2e                             |
| Trashing the slate's drawing while its autosave is pending  | Medium | Flush autosave before `moveToTrash`; the save rule keeps `trashedAt` (module `trash`); e2e |
| Existing e2e (gallery, replay, share) rely on card pebbles  | Medium | Rewritten in task 2 around the viewer, same behaviors checked                              |

## Open Questions

- None (answered with the spec, 2026-11-25).
