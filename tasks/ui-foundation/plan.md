# Implementation Plan: UI foundation (redesign module 1 of 5)

Source spec: `spec/SPEC-ui-foundation.md` (module `ui-foundation` of `spec/capability-map.md`). Tasks: `tasks/ui-foundation/todo.md`. The MVP task list (`tasks/todo.md`) is left untouched: its open boxes are the MVP device validation.

## Overview

Shared building blocks for the redesigned child screens: a device class that never changes with the orientation, a layout fixed to the hardware (counter-rotation, icons upright), the paper theme with pebble buttons in the action colors, a 1.5 s long press with a fill, and a light haptic helper. The screens themselves are rebuilt later (modules `draw-tools`, `gallery-viewer`, `settings`); this module restyles the existing controls in place.

## Architecture Decisions

- **Rotation first, behind a decision gate.** It is the riskiest part (browser rotation animation, `getBoundingClientRect` on rotated elements, safe areas) and shapes the layout CSS. Tasks 1–2 build it; a device check decides whether it stays (spec: Decision gate). If it is dropped, task 2 is reverted to "device class picks the layout, the layout follows the viewport" and the spec is updated before task 3.
- **Pure math in `src/engine/`** (tested, 90 % coverage): the device class from the viewport size, the counter-rotation angle from `screen.orientation.angle`, and a rotation-aware screen → page conversion next to `fitPage` / `toPage` / `strokeStart`. The DOM side (reading `screen.orientation`, setting CSS variables) stays in `src/app/`, excluded from coverage like the other DOM files.
- **One rotated container for every child screen.** The three screens (`#draw-screen`, `#gallery-screen`, `#replay-screen`) sit in one wrapper; rotating the wrapper once rotates them all. Icons turn back through a CSS variable (`--icon-turn`) on `.icon`.
- **Device class in CSS and TypeScript from the same breakpoint**: `@media (min-width: 576px) and (min-height: 576px)` (Bootstrap `sm` from `$grid-breakpoints`) and `matchMedia` with the same query string, built from one constant. Replaces the `min-aspect-ratio: 1/1` layout switch and the 700 px tablet margin rule (DF-02).
- **Buttons are Bootstrap `.btn` with `theme-*` colors**: action colors added to `$theme-colors` through the `config` module, a project `.btn-pebble` class for the shape (radius, size from the existing tool size tokens, DF-01/DF-03 kept). Existing `.tool-button` rules are replaced, not duplicated.
- **Long press**: `createHold` stays pure; `LONG_PRESS_MS = 1500` replaces `PARENT_HOLD_MS`. `padlock.ts` becomes a generic `long-press.ts` (DOM) reused later by the settings and trash buttons; the fill is a CSS gradient driven by the existing `--progress` variable.
- **Haptics**: `src/app/haptic.ts` (DOM), `navigator.vibrate(8)` when present, else the iOS switch trick, swallowed errors; result on iPad recorded as a DF entry.

## Task List

### Phase 1: Layout fixed to the device (high risk, gate)

- [x] Task 1: Device class and rotation math (pure)
- [x] Task 2: Counter-rotate the child screens, upright icons, rotated input

### Checkpoint: Rotation decision gate

- [ ] `npm run check` and `npm run e2e` pass
- [ ] On the iPhone SE size (Pixel 9a) and the iPad 11, the user rotates the installed app: decides keep or drop (spec: Decision gate); spec updated if dropped

### Phase 2: Theme and buttons

- [ ] Task 3: Paper theme, square page, action colors and pebble buttons on the drawing screen
- [ ] Task 4: Pebble buttons on the gallery and replay screens

### Checkpoint: Theme

- [ ] `npm run check` and `npm run e2e` pass; screens match the foundations board

### Phase 3: Long press and haptics

- [ ] Task 5: Haptic helper
- [ ] Task 6: Generic 1.5 s long press with a fill (padlock moves to it)

### Checkpoint: Module complete

- [ ] All spec success criteria met (1–5), DF entries written (rotation, haptics on iPad)
- [ ] Device check on the three reference devices
- [ ] Spec status → implemented after the module is folded into `spec/SPEC-mvp.md`

## Risks and Mitigations

| Risk                                                                                                | Impact | Mitigation                                                                                                |
| --------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| The browser's rotation animation plus the counter-rotation looks bad                                | High   | Decision gate right after task 2; fallback keeps today's viewport-following layout                        |
| `getBoundingClientRect` of a rotated canvas is its axis-aligned box: page mapping off by a rotation | High   | Pure rotation-aware `toPage` / `strokeStart` with unit tests; e2e strokes in rotated viewports            |
| Safe areas and system edges move with the rotation (iOS landscape)                                  | Medium | Edge margins on all four sides of the rotated container; device check                                     |
| `screen.orientation` missing (old iOS)                                                              | Low    | Reference devices run iPadOS 26 / Android 16; fallback: no counter-rotation (layout follows the viewport) |
| The iOS switch haptic trick does nothing                                                            | Low    | Best effort by spec; recorded as a DF entry either way                                                    |
| Bootstrap 6 alpha theme map API changes                                                             | Low    | Exact version pinned; one `@use ... with` in `app.scss`                                                   |
| Existing e2e tests rely on the old layout (aspect-ratio switch, padlock 3 s)                        | Medium | Updated in the same task as the behavior they check                                                       |

## Open Questions

- None for planning. The rotation look is settled by the gate.
