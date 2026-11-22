# Capability Map: UI redesign

The redesign mocked up in Claude Design (2026-11-21/22) changes the MVP (`spec/SPEC-mvp.md`, which stays the description of what is shipped until each module is folded back into it). Mockups: the "Carnet magique — maquettes" design canvas (private to the owner), boards 1–9: drawing, gallery, viewer and settings, each for a phone (iPhone SE, 375 × 667) and a tablet (iPad 11, 1180 × 820), plus the foundations board.

| Module id        | Responsibility                                                                                                                                                                                      | Depends on               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `ui-foundation`  | Paper theme, action colors and "pebble" buttons (Bootstrap `.btn` + theme colors), 1.5 s long-press with fill, light haptic feedback, layout fixed to the device across rotations (only icons turn) | —                        |
| `trash`          | Data: move a drawing to the trash, restore it, purge after 30 days, storage migration                                                                                                               | —                        |
| `draw-tools`     | 56-color palette (5-color bar + modal on phones, full box on tablets), 6-step stroke size slider with a 1:1 preview, new drawing screen layout                                                      | `ui-foundation`          |
| `gallery-viewer` | Gallery "wall" (tilted pinned drawings, blank "+" sheet), viewer: replay with play / pause / restart, continue, share, move to trash                                                                | `ui-foundation`, `trash` |
| `settings`       | Settings page replacing the parent page (`settings.html`): opened by a long press, backup, trash, update, language, finger settings, share the app                                                  | `ui-foundation`, `trash` |

Build order: `ui-foundation`, `trash` → `draw-tools` → `gallery-viewer` → `settings`.

Each module gets its own spec in `spec/` (`spec/SPEC-<module id>.md`), then its plan and tasks, then its implementation, one at a time in this order. Not part of this redesign: template layers (milestone 2) and the frozen stroke format v1 (before release 1.0.0), both in `spec/SPEC-mvp.md`, Out of Scope.
