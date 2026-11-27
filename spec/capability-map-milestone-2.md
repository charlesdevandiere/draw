# Capability Map: Milestone 2 (templates)

Milestone 2 adds locked **template layers** to a drawing: coloring pages above the strokes, writing lines and letters to trace under them, and overflow protection for coloring. The design decisions taken on 2026-11-22 are in `spec/SPEC-mvp.md` (Out of Scope, Milestone 2); this map and the three module specs refine them (2026-11-26) and win where they differ.

| Module id             | Responsibility                                                                                                                                                                                       | Depends on        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `template-layers`     | Layer model (background / overlay), template steps in the history (undo / redo, replay), storage and magic PNG, the templates panel, rendering of every layer, coloring pages as static SVG overlays | —                 |
| `writing-templates`   | Background templates generated at a constant physical size when added: small squares, French ruled paper (Seyès), capitals, cursive letters and digits repeated to fill the page                     | `template-layers` |
| `overflow-protection` | Zones of a coloring page, each stroke clipped to the zone it started in, a switch to turn the protection off                                                                                         | `template-layers` |

Build order: `template-layers` → `writing-templates`, `overflow-protection` (independent of each other).

Progress: `template-layers` implemented (2026-11-26), `writing-templates` (2026-11-27).

Each module gets its own spec (`spec/SPEC-<module id>.md`), then its plan and tasks, then its implementation, in this order. The stored format grows with each module (schema 2, then 3 …); it stays provisional until the format v1 freeze before release 1.0.0 (`spec/SPEC-mvp.md`, Out of Scope), which will be written from what these modules needed. Device checks: with the final test campaign.
