import { describe, expect, it } from 'vitest';
import { currentLayers, layerBeforeStroke } from './layers';
import type { LayerSlot, TemplateLayer, TemplateStep } from './types';

const layer = (slot: LayerSlot, template: string): TemplateLayer => ({
  slot,
  template,
  version: 1,
  params: {},
  svg: '<svg/>',
});
const fish = layer('overlay', 'coloring/fish');
const house = layer('overlay', 'coloring/house');
const grid = layer('background', 'lines/small-squares');

// Overlay: fish (stroke 0, t 0), grid (1, 100), house (2, 200), removed (3, 300).
const steps: TemplateStep[] = [
  { slot: 'overlay', layer: fish, at: 0, t: 0 },
  { slot: 'background', layer: grid, at: 1, t: 100 },
  { slot: 'overlay', layer: house, at: 2, t: 200 },
  { slot: 'overlay', layer: null, at: 3, t: 300 },
];

describe('layers', () => {
  it('none without steps', () => {
    expect(currentLayers([])).toEqual({ background: null, overlay: null });
  });

  it('the slate shows the last step of each slot', () => {
    expect(currentLayers(steps)).toEqual({ background: grid, overlay: null });
    expect(currentLayers(steps.slice(0, 3))).toEqual({ background: grid, overlay: house });
  });

  it('a stroke sees the layers placed before it', () => {
    expect(layerBeforeStroke(steps, 'overlay', 0)).toEqual(fish);
    expect(layerBeforeStroke(steps, 'overlay', 1)).toEqual(fish);
    expect(layerBeforeStroke(steps, 'overlay', 2)).toEqual(house);
    expect(layerBeforeStroke(steps, 'overlay', 3)).toBeNull();
    expect(layerBeforeStroke(steps, 'background', 0)).toBeNull();
  });
});
