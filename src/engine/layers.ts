import { type LayerSlot, type TemplateLayer, type TemplateStep } from './types';

/** The layers of a drawing at one moment: one per slot, or none. */
export type Layers = Readonly<Record<LayerSlot, TemplateLayer | null>>;

const NONE: Layers = { background: null, overlay: null };

function apply(steps: Iterable<TemplateStep>): Layers {
  const layers: Record<LayerSlot, TemplateLayer | null> = { ...NONE };
  for (const step of steps) layers[step.slot] = step.layer;
  return layers;
}

/** The layers once every step is applied (the slate). */
export function currentLayers(templates: readonly TemplateStep[]): Layers {
  return apply(templates);
}

/** The layer a slot had when stroke number `index` started (the steps made before it). */
export function layerBeforeStroke(
  templates: readonly TemplateStep[],
  slot: LayerSlot,
  index: number,
): TemplateLayer | null {
  return apply(templates.filter((step) => step.at <= index))[slot];
}
