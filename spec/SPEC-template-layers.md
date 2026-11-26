# Spec Delta: Template layers — milestone 2, module 1 of 3

Status: approved (2026-11-26)

Module `template-layers` of milestone 2 (`spec/capability-map-milestone-2.md`). Inherits everything from `spec/SPEC-mvp.md` (stack, commands, structure, code style, testing strategy, boundaries).

## Objective

A child can put a **coloring page** on the drawing: black outlines on a transparent square, above the strokes, so the outlines stay crisp under a thick marker and the eraser never removes them. This module builds the layer machinery every template uses (model, history, replay, storage, panel, rendering) and ships the first kind: static SVG coloring pages. Writing lines and letters (module `writing-templates`) and overflow protection (module `overflow-protection`) build on it.

Users: children aged 5+ (pick a picture and color it, no reading); parents (none: no setting except the temporary one below).

## Current Behavior

- A drawing is a list of strokes on a white page (`src/engine/types.ts`): the white comes from the page's CSS, the drawing canvas is transparent and the eraser paints `destination-out` (`src/engine/render.ts`), so it already gives back transparency.
- History (`src/engine/history.ts`): undo / redo over strokes only.
- Stored format: schema 1 (`src/store/schema.ts`), in IndexedDB and in the magic PNG's `iTXt` chunk.
- Thumbnails, PNG export and the viewer render strokes on a white page (`src/app/raster.ts`, `src/app/viewer-screen.ts`).

## New Behavior

### Layers

- A drawing has at most **two template layers**: one **background** (under the strokes: writing lines and letters, next module) and one **overlay** (above the strokes: coloring pages). Stack, bottom to top: white page, background, strokes, overlay.
- A template layer is **locked**: it is never drawn on, erased or moved. The eraser only ever erases strokes.
- A layer is an **SVG** with `viewBox="0 0 1000 1000"` (page units), transparent outside its marks. It is stored **with the drawing** (the SVG text itself, not a reference), so a drawing shows its template on any version and any device, scaled with the page.

### Data model (schema 2, provisional until format v1)

```ts
export type LayerSlot = 'background' | 'overlay';

/** A template as placed on a drawing: everything needed to show it without the catalog. */
export interface TemplateLayer {
  slot: LayerSlot;
  /** Catalog id, e.g. 'coloring/fish'; informative: rendering uses `svg`. */
  template: string;
  /** Version of that template in the catalog. */
  version: number;
  /** Generation parameters (next module: letter, sizes); {} for a static template. */
  params: Record<string, string | number>;
  /** The SVG, viewBox 0 0 1000 1000. */
  svg: string;
}

/** Adding, replacing or removing (layer null) the template of one slot. */
export interface TemplateStep {
  slot: LayerSlot;
  layer: TemplateLayer | null;
  /** Number of strokes drawn before this step: orders steps and strokes for undo. */
  at: number;
  /** Drawing time of the step (ms, same clock as stroke points): when the replay shows it. */
  t: number;
}

export interface Drawing {
  // … as today, plus:
  templates: TemplateStep[];
}
```

- The layer of a slot at a given moment is the `layer` of the last step for that slot (none if no step).
- Schema 2; migration 1 → 2 adds `templates: []`. Parsing checks the steps (slot, `at` within the strokes, `t` ≥ 0, string sizes) and refuses a drawing over the limits: at most 200 steps, an SVG at most 256 KB, 2 MB of SVG per drawing. A step with an unknown `slot` is ignored (kept as raw data is not needed before format v1).

### History

- Adding, replacing and removing a template are **history steps**: undo takes back the last step, whether a stroke or a template step (a template step with `at` equal to the stroke count is the later one); redo puts it back; a new stroke or step clears the redo list. Undoing the first stroke after a coloring page was added leaves the page with its coloring page.
- The undo / redo buttons and their disabled states follow the merged history.

### Templates panel

- A **templates pebble** (icon `layers`, theme of the drawing tools) next to the eraser opens a dialog (the same dialog component as the phone's "all colors" dialog): one section per kind, a pictogram as its heading, thumbnails as buttons with an accessible name from the catalogs ("Coloring page: fish"). This module has one section, **coloring pages**, whose first tile is a **blank tile** (remove the coloring page; disabled when there is none). The current template has the selected ring.
- Picking a tile closes the dialog and adds the step; picking the current template does nothing. No confirmation: undo covers mistakes. Haptic tick as for the other tools.
- Layout checks in the six window shapes of `e2e/gallery-viewer-layout.spec.ts`: the pebble on screen, ≥ 48 px, out of the edge margins (DF-02).

### Coloring pages

- Shipped in the app: `src/templates/coloring/<name>.svg`, imported `?raw` (bundled, offline), listed in `src/templates/catalog.ts` (id, version, slot, accessible name key, SVG). Two test pages made for this module (simple, e.g. a fish and a house, one with color hints); the final set will be drawn by another tool following `docs/templates.md`.
- **Authoring rules** (`docs/templates.md`, written by this module): square `viewBox="0 0 1000 1000"`, no background, outlines in black (`#000`) as strokes, every area closed (needed by `overflow-protection`), outline width 4–8 units, **color hints** allowed: small filled circles in a palette color with `class="hint"` (the classic "magic coloring" dot telling which color goes there); no text, no images, no external references, no scripts, no filters, ≤ 64 KB.
- **Outline width**, two modes to compare on the devices, then keep one:
  - **scaled** (default): the authored width, scaled with the page like the rest of the SVG;
  - **fixed**: the same width in CSS pixels on every screen (3 px), through `vector-effect: non-scaling-stroke` injected at render time (the stored SVG does not change).
  - The mode is a temporary setting (`outlineWidth`) on the settings page, finger drawing card, marked "test"; it is removed with the losing mode after the test campaign. It applies to overlays only.

### Rendering

- **Template SVGs are only ever rendered as images** (`Image` from a `Blob` URL, then `drawImage`, or an `<img>`), never inserted into the DOM: an SVG from an imported PNG is untrusted, and an SVG image runs no script and loads nothing.
- Drawing screen: the background and the overlay are two canvases stacked around the drawing canvas, same size and pixel ratio, repainted on resize; pointer events go to the drawing surface as today.
- Viewer replay: each layer appears (or goes) at its step's `t`, in order with the strokes; restart shows the page without the layers added after time 0.
- Thumbnails and the magic PNG image: rendered from every layer, white page included. Rendering becomes asynchronous (SVG decode); the magic PNG keeps its metadata in the same chunk, with the new fields.

### Elsewhere

- New drawing ("+", new page): a blank page with no layer, as today. Continue (viewer) keeps the layers.
- Import merge: unchanged rules; a drawing's templates travel with it.

## Success Criteria

1. Unit: history over strokes and template steps (undo / redo order, redo cleared, `at` ordering); current layer of a slot at a time t (replay); schema 2 parse, limits, migration 1 → 2; magic PNG round trip with layers; catalog entries valid against the authoring rules (pure checker: viewBox, size, no `<script>`, `<image>`, `href` to outside, `<foreignObject>`).
2. e2e: pick a coloring page → its outlines show; a thick black stroke across an outline leaves the outline's pixels black; a white stroke over an outline leaves it visible (overlay above); the eraser never removes it.
3. e2e: undo removes the coloring page, redo puts it back; undo after a stroke drawn on it removes the stroke first; the blank tile removes it.
4. e2e: reopened drawing (reload) keeps its coloring page; the viewer shows the strokes drawn before it, then the page, then the later strokes; the gallery thumbnail and an export / import round trip keep it.
5. e2e: outline width — scaled: the outline's width in screen pixels is proportional to the page size between a phone and a tablet viewport; fixed: the same within 1 px.
6. e2e: the templates pebble in every window shape (layout test); the panel's tiles have accessible names in en and fr.
7. What must NOT change: drawings without templates look, replay and export as before; a schema 1 drawing (PNG or IndexedDB) still opens; strokes keep their format.

## Boundaries (deltas)

- Always: template SVG rendered as an image, never as DOM; every template-related limit checked on parse; texts through the catalogs.
- Ask first: adding a kind of layer beyond background / overlay; more than one layer per slot; any change to the stroke format.
- Never: erasing or drawing into a template layer; fetching a template from the network at run time.

## Out of Scope (Deferred)

- The final coloring pages (drawn later following `docs/templates.md`).
- Writing templates (`writing-templates`) and overflow protection (`overflow-protection`).
- Free user layers, moving or resizing a template.
- Keeping unknown fields for forward compatibility: format v1.

## Open Questions

Answered 2026-11-26 (approved as proposed):

1. **Outline width comparison**: a temporary "test" setting on the settings page.
2. **Panel**: built as described, no mockup first.
