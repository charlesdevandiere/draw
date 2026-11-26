/**
 * The templates shipped with the app. Coloring pages are static SVGs (bundled, so they work
 * offline); the layer placed on a drawing carries a copy of the SVG, so a drawing never
 * depends on this catalog to show its template.
 */
import type { LayerSlot, TemplateLayer } from '../engine/types';
import type { MessageKey } from '../i18n/i18n';
import fish from './coloring/fish.svg?raw';
import house from './coloring/house.svg?raw';

/** A section of the templates panel. */
export type TemplateKind = 'coloring';

export interface CatalogEntry {
  /** Stable id, stored in the layer: never reuse one for another picture. */
  id: string;
  /** Bumped when the picture changes. */
  version: number;
  kind: TemplateKind;
  slot: LayerSlot;
  /** Catalog key of the accessible name. */
  nameKey: MessageKey;
  svg: string;
}

/** Largest coloring page shipped (authoring rule, docs/templates.md). */
export const COLORING_MAX_BYTES = 64 * 1024;

export const CATALOG: readonly CatalogEntry[] = [
  {
    id: 'coloring/fish',
    version: 1,
    kind: 'coloring',
    slot: 'overlay',
    nameKey: 'templates.coloring.fish',
    svg: fish,
  },
  {
    id: 'coloring/house',
    version: 1,
    kind: 'coloring',
    slot: 'overlay',
    nameKey: 'templates.coloring.house',
    svg: house,
  },
];

/** The layer to place on a drawing for a catalog entry. */
export function layerFor(entry: CatalogEntry): TemplateLayer {
  return {
    slot: entry.slot,
    template: entry.id,
    version: entry.version,
    params: {},
    svg: entry.svg,
  };
}
