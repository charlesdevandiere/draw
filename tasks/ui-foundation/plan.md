# Implementation Plan: UI foundation (redesign module 1 of 5)

Source spec: `spec/SPEC-ui-foundation.md` (module `ui-foundation` of `spec/capability-map.md`). Tasks: `tasks/ui-foundation/todo.md`. The MVP task list (`tasks/todo.md`) is left untouched: its open boxes are the MVP device validation.

## Overview

Shared building blocks for the redesigned child screens: a device class for margins (the layout follows the window's shape; a layout fixed to the hardware was tried and dropped at the decision gate), the paper theme with pebble buttons in the action colors, a 1.5 s long press with a fill, and a light haptic helper. The screens themselves are rebuilt later (modules `draw-tools`, `gallery-viewer`, `settings`); this module restyles the existing controls in place.

## Architecture Decisions

- **Rotation first, behind a decision gate** (done). Tasks 1–2 built a layout fixed to the hardware; the gate (2026-11-22) dropped it for a layout following the window's shape (`min-aspect-ratio: 1/1`, as in the MVP). The code was removed; the device class remains in CSS only: `@media (min-width: 576px) and (min-height: 576px)` (Bootstrap `sm` from `$breakpoints`) for the tablet top margin (DF-02, 700 px before).
- **Buttons are Bootstrap `.btn` with `theme-*` colors**: action colors added to `$theme-colors` through the `config` module, a project `.btn-pebble` class for the shape (radius, size from the existing tool size tokens, DF-01/DF-03 kept). Existing `.tool-button` rules are replaced, not duplicated.
- **Long press**: `createHold` stays pure; `LONG_PRESS_MS = 1500` replaces `PARENT_HOLD_MS`. `padlock.ts` becomes a generic `long-press.ts` (DOM) reused later by the settings and trash buttons; the fill is a CSS gradient driven by the existing `--progress` variable.
- **Haptics**: `src/app/haptic.ts` (DOM), `navigator.vibrate(8)` when present, else the iOS switch trick, swallowed errors; result on iPad recorded as a DF entry.

## Task List

### Phase 1: Layout fixed to the device (high risk, gate): dropped

- [x] Task 1: Device class and rotation math (pure)
- [x] Task 2: Counter-rotate the child screens, upright icons, rotated input

### Checkpoint: Rotation decision gate

- [x] Tried on the Pixel 9a and the iPad 11 (2026-11-22): dropped for the window-shape layout; spec updated, rotation code removed

### Phase 2: Theme and buttons

- [ ] Task 3: Paper theme, square page, action colors and pebble buttons on the drawing screen
- [ ] Task 4: Pebble buttons on the gallery and replay screens

### Checkpoint: Theme

- [ ] `npm run check` and `npm run e2e` pass; screens match the foundations board

### Phase 3: Long press and haptics

- [ ] Task 5: Haptic helper
- [ ] Task 6: Generic 1.5 s long press with a fill (padlock moves to it)

### Checkpoint: Module complete

- [ ] All spec success criteria met (1–5), DF entries written (haptics on iPad)
- [ ] Device check on the three reference devices
- [ ] Spec status → implemented after the module is folded into `spec/SPEC-mvp.md`

## Risks and Mitigations

| Risk                                                                         | Impact | Mitigation                                              |
| ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| The iOS switch haptic trick does nothing                                     | Low    | Best effort by spec; recorded as a DF entry either way  |
| Bootstrap 6 alpha theme map API changes                                      | Low    | Exact version pinned; one `@use ... with` in `app.scss` |
| Existing e2e tests rely on the old layout (aspect-ratio switch, padlock 3 s) | Medium | Updated in the same task as the behavior they check     |

## Open Questions

- None.
