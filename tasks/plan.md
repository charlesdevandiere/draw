# Implementation Plan: Carnet magique — MVP

Source spec: `spec/SPEC-mvp.md` (approved 2026-11-20). Task details and checklists: `tasks/todo.md`.

## Overview

Turn the repository into the first real Carnet magique: an English-only repository with an en/fr UI, a square drawing slate with three input modes, silent autosave, a gallery that shares "magic PNGs", then (phase B) replay and a protected parent page. Each phase ends with validation on the three reference devices.

## Architecture Decisions

- **Pure core, thin DOM.** `engine/`, `input/`, `store/schema.ts`, `store/png-chunk.ts`, `i18n/format.ts` and `i18n/i18n.ts` never touch the DOM and are unit-tested (≥ 90 %). DOM files wire them up and are excluded from coverage.
- **Static screens.** Drawing and gallery are `<section>`s in the same HTML, initialized once, switched with `hidden`.
- **One build, runtime language.** Both catalogs are bundled; `<html lang>` of the language folder picks the default, the parent page can override it.
- **Language folders.** `/draw/en/` and `/draw/fr/` each hold `index.html`, `diagnostic.html` (and `parent.html` in phase B) plus a hand-written manifest. `vite-plugin-pwa` keeps generating the service worker only (`manifest: false`); its scope stays `/draw/`.
- **One canvas.** Strokes in progress are painted incrementally on the drawing canvas every frame (an eraser must act on what is already drawn); the whole drawing is repainted from vectors on undo / resize / open.
- **Engine state is immutable data** (`History` of strokes); the drawing screen holds the current value and re-renders from it.
- **Settings and drawings in IndexedDB** (database `draw`), behind a hand-written promise wrapper.
- **Magic PNG** is the single file format: share (phase A), export / import (phase B).
- **Bootstrap 6 alpha through Sass modules**, only the modules used, custom theme; JS components imported per page when needed.

## Dependency Graph

```
T1–T2 English repo
   │
T3 i18n core (pure) ──► T4 language folders + manifests + redirect ──► T5 diagnostic via i18n
                                   │
                                   ▼
                     T6 Sass/Bootstrap + app shell (static screens, layout, protections)
                                   │
T7 engine: types, page-transform, stroke-builder ──► T8 render + first stroke on screen
                                                          │
                            T9 input-mode (pure) ──► T10 mode button
                                                          │
                                         T11 tools (colors, widths, eraser)
                                                          │
                                         T12 undo / redo / new page
                                                          │
                     T13 schema + IndexedDB + autosave + settings
                                                          │
                     T14 gallery ──► T15 png-chunk (pure) ──► T16 magic PNG + share
                                                          │
                                         T17 PWA update rule + offline
                                                          │
                   ── phase B ── T18 replay schedule ──► T19 replay UI
                                 T20 padlock + parent page shell
                                 T21 drawings list + delete ──► T22 export / import
                                 T23 input settings
```

## Task List

Phase 0 — English repository and languages

- [x] T1: Translate the documentation to English
- [x] T2: Translate the code base leftovers and the deployment workflow
- [x] T3: i18n core (ICU subset formatter, catalogs, language choice)
- [x] T4: Language folders, manifests and root redirect
- [x] T5: Diagnostic page through i18n, in both folders
- [x] T5b: Playwright setup and first end-to-end tests

Checkpoint 0 — install `/draw/fr/` and `/draw/en/` on the devices

Phase A — the sketchbook

- [x] T6: Sass + Bootstrap theme and the app shell
- [x] T7: Engine foundations (types, page transform, stroke builder)
- [x] T8: First stroke on screen (render + drawing screen)

Checkpoint A1 — drawing is fluid on the three devices

- [x] T9: Input modes logic
- [x] T10: Mode button
- [ ] T11: Colors, widths and eraser
- [ ] T12: Undo, redo and new page

Checkpoint A2 — the slate is complete

- [ ] T13: Storage, autosave and settings
- [ ] T14: Gallery
- [ ] T15: PNG iTXt chunk (pure)
- [ ] T16: Magic PNG and sharing
- [ ] T17: Update rule and offline check

Checkpoint A3 — phase A validated (spec criteria 1–13)

Phase B — the magic and the parent

- [ ] T18: Replay schedule
- [ ] T19: Replay screen
- [ ] T20: Padlock and parent page shell
- [ ] T21: Drawings list and deletion
- [ ] T22: Export and import of magic PNGs
- [ ] T23: Input settings

Checkpoint B — phase B validated (spec criteria 14–17)

## Risks and Mitigations

| Risk                                                                                                                       | Impact | Mitigation                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Installing a PWA from a sub-folder (`/draw/fr/`) with a `/draw/` service worker misbehaves on iOS (scope, start URL, name) | High   | Done early (T4), validated at Checkpoint 0 before any app code.                            |
| Bootstrap 6 alpha: Sass module layout differs from 5, breaking changes until final                                         | Medium | T6 checks selective imports first; exact version pinned; child UI uses few components.     |
| Finger mode still leaves palm strokes                                                                                      | Medium | Pure logic with tests (T9), threshold and delay configurable (T23), measured with a child. |
| iPad frame drops (diagnostic p95 34–46 ms)                                                                                 | Medium | Two-layer rendering, no text panels; measured at Checkpoint A1.                            |
| `CompressionStream` or file sharing missing on a target                                                                    | Medium | Feature detection; fallback to uncompressed `iTXt` and to download.                        |
| Messaging apps / Photos strip the PNG chunk                                                                                | Low    | Expected and documented; checked on devices (criterion 11).                                |
| IndexedDB data loss (eviction, iOS)                                                                                        | High   | `persist()`, saves after each stroke, export in phase B; criterion 9.                      |
| Stored format changes after phase A                                                                                        | Medium | Schema version from day one, migrations tested (T13).                                      |
| Existing installs at `/draw/` stop matching the new start URL                                                              | Low    | Reinstall once from `/draw/fr/` (noted in Checkpoint 0).                                   |

## Open Questions

None.
