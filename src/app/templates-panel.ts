/**
 * The templates pebble and its panel (spec/SPEC-template-layers.md,
 * spec/SPEC-writing-templates.md): a dialog with one section per kind of template (ruled
 * paper, letters to trace, coloring pages), a blank tile to remove the current one, then a
 * tile per template. Writing templates are generated when picked, at the physical size of
 * this screen. Picking closes the panel; the slate turns it into a history step.
 */
import Dialog from 'bootstrap/js/dist/dialog.js';
import type { Layers } from '../engine/layers';
import type { LayerSlot, TemplateLayer } from '../engine/types';
import type { Translator, MessageKey } from '../i18n/i18n';
import { CATALOG, layerFor } from '../templates/catalog';
import { sizedSvg } from '../templates/sized-svg';
import {
  LETTER_SETS,
  glyphPreviewSvg,
  lettersLayer,
  linesLayer,
  linesSvg,
  templateKey,
  unitsPerCmFor,
  type LetterSet,
  type LinesKind,
} from '../templates/writing';

export interface TemplatesPanelOptions {
  /** Where the pebble goes (with the drawing tools). */
  container: HTMLElement;
  t: Translator['t'];
  /** The layers on the slate now (selected ring, blank tile). */
  current: () => Layers;
  /** A tile was picked: place this layer (null: remove the slot's template). */
  onPick: (slot: LayerSlot, layer: TemplateLayer | null) => void;
  /** Width of the page on screen (CSS pixels): the size writing templates are made for. */
  pageWidth: () => number;
  haptic?: () => void;
}

/** A tile of the panel: what it places (null: the blank tile, which removes). */
interface Tile {
  element: HTMLButtonElement;
  slot: LayerSlot;
  /** `templateKey` of what it places, null for the blank tile. */
  key: string | null;
  make: () => TemplateLayer | null;
}

const LINES: readonly { kind: LinesKind; nameKey: MessageKey }[] = [
  { kind: 'small-squares', nameKey: 'templates.lines.smallSquares' },
  { kind: 'seyes', nameKey: 'templates.lines.seyes' },
];

const LETTER_TABS: readonly { set: LetterSet; nameKey: MessageKey; sample: string }[] = [
  { set: 'capitals', nameKey: 'templates.letters.capitals', sample: 'A' },
  { set: 'cursive', nameKey: 'templates.letters.cursive', sample: 'a' },
  { set: 'digits', nameKey: 'templates.letters.digits', sample: '1' },
];

function pebbleIcon(name: string): string {
  return `<span class="icon icon-${name}" aria-hidden="true"></span>`;
}

/** Pixels a thumbnail is drawn at, and its outline width there (readable when small). */
const THUMBNAIL_SIZE = 200;
const THUMBNAIL_OUTLINE = 4;

/**
 * A thumbnail of a catalog template, as an image (never the SVG in the document). Sized
 * explicitly (engines differ on a viewBox-only image) with thicker outlines: at the page's
 * width they would be under a pixel wide in a ~100 px tile. `outline` null keeps the
 * strokes of the SVG as drawn (a letter preview: its cursive thickening scales with it).
 */
function thumbnail(source: string, outline: number | null = THUMBNAIL_OUTLINE): HTMLImageElement {
  const image = document.createElement('img');
  image.alt = '';
  image.className = 'template-thumbnail';
  const svg = sizedSvg(source, {
    size: THUMBNAIL_SIZE,
    ...(outline === null ? {} : { fixedStrokeWidth: outline }),
  });
  // A data URL: nothing to revoke.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return image;
}

export function initTemplatesPanel(options: TemplatesPanelOptions): void {
  const { t } = options;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'open-templates';
  button.className = 'btn btn-solid btn-pebble theme-templates';
  button.setAttribute('aria-label', t('templates.open'));
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = pebbleIcon('templates');
  options.container.append(button);

  const dialogElement = document.createElement('dialog');
  dialogElement.id = 'templates-dialog';
  dialogElement.className = 'dialog palette-dialog templates-dialog';
  dialogElement.setAttribute('aria-label', t('templates.open'));
  const body = document.createElement('div');
  body.className = 'palette-dialog-body';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-solid btn-pebble theme-hold palette-close';
  close.setAttribute('aria-label', t('tools.close'));
  close.innerHTML = pebbleIcon('close');
  body.append(close);

  const tiles: Tile[] = [];

  function tileButton(label: string, className = 'template-tile'): HTMLButtonElement {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = className;
    tile.setAttribute('aria-label', label);
    return tile;
  }

  function section(nameKey: MessageKey, icon: string): { group: HTMLElement; grid: HTMLElement } {
    const group = document.createElement('div');
    group.className = 'templates-section';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', t(nameKey));
    const heading = document.createElement('span');
    heading.className = 'templates-heading';
    heading.innerHTML = pebbleIcon(icon);
    const grid = document.createElement('div');
    grid.className = 'templates-grid';
    group.append(heading, grid);
    body.append(group);
    return { group, grid };
  }

  function blankTile(grid: HTMLElement, slot: LayerSlot, noneKey: MessageKey): void {
    const none = tileButton(t(noneKey), 'template-tile template-none');
    none.innerHTML = pebbleIcon('no-template');
    grid.append(none);
    tiles.push({ element: none, slot, key: null, make: () => null });
  }

  /** Page units per cm for this screen, read when a writing template is picked. */
  const unitsPerCm = (): number => unitsPerCmFor(options.pageWidth());

  // Ruled paper (background).
  const lines = section('templates.lines', 'lines');
  blankTile(lines.grid, 'background', 'templates.noBackground');
  for (const { kind, nameKey } of LINES) {
    const tile = tileButton(t(nameKey));
    // Squares at a phone's size: large enough to read in the tile.
    tile.append(thumbnail(linesSvg(kind, unitsPerCmFor(240)), 1));
    lines.grid.append(tile);
    tiles.push({
      element: tile,
      slot: 'background',
      key: `lines/${kind}`,
      make: () => linesLayer(kind, unitsPerCm()),
    });
  }

  // Letters to trace (background): a tab per set, then its characters.
  const letters = section('templates.letters', 'letters');
  letters.grid.classList.add('templates-tabs');
  const panes: HTMLElement[] = [];
  const tabs: HTMLButtonElement[] = [];
  for (const { set, nameKey, sample } of LETTER_TABS) {
    const tab = tileButton(t(nameKey), 'template-tile template-tab');
    tab.append(thumbnail(glyphPreviewSvg(set, sample), null));
    letters.grid.append(tab);
    tabs.push(tab);
    const pane = document.createElement('div');
    pane.className = 'templates-grid templates-letters';
    pane.hidden = true;
    pane.dataset['set'] = set;
    for (const char of LETTER_SETS[set]) {
      const tile = tileButton(
        t(set === 'digits' ? 'templates.digit' : 'templates.letter', { char }),
        'template-tile template-letter',
      );
      tile.append(thumbnail(glyphPreviewSvg(set, char), null));
      pane.append(tile);
      tiles.push({
        element: tile,
        slot: 'background',
        key: `letters/${set}:${char}`,
        make: () => lettersLayer(set, char, unitsPerCm()),
      });
    }
    letters.group.append(pane);
    panes.push(pane);
  }
  function showSet(index: number): void {
    panes.forEach((pane, i) => (pane.hidden = i !== index));
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
  }
  tabs.forEach((tab, index) => tab.addEventListener('click', () => showSet(index)));
  showSet(0);

  // Coloring pages (overlay).
  const coloring = section('templates.coloring', 'coloring');
  blankTile(coloring.grid, 'overlay', 'templates.noColoring');
  for (const entry of CATALOG.filter((item) => item.kind === 'coloring')) {
    const tile = tileButton(t(entry.nameKey));
    tile.dataset['template'] = entry.id;
    tile.append(thumbnail(entry.svg));
    coloring.grid.append(tile);
    tiles.push({ element: tile, slot: entry.slot, key: entry.id, make: () => layerFor(entry) });
  }

  dialogElement.append(body);
  document.body.append(dialogElement);
  const dialog = new Dialog(dialogElement);

  // Bootstrap ignores a hide while the dialog fades in (see the "all colors" dialog).
  let opening = false;
  let closeWhenOpen = false;
  dialogElement.addEventListener('show.bs.dialog', () => {
    opening = true;
    closeWhenOpen = false;
  });
  dialogElement.addEventListener('shown.bs.dialog', () => {
    opening = false;
    if (closeWhenOpen) void dialog.hide();
  });
  function closeDialog(): void {
    if (opening) closeWhenOpen = true;
    else void dialog.hide();
  }
  dialogElement.addEventListener('click', (event) => {
    if (opening && event.target === dialogElement) closeWhenOpen = true;
  });
  dialogElement.addEventListener('cancel', () => {
    if (opening) closeWhenOpen = true;
  });
  close.addEventListener('click', closeDialog);

  /** Is this tile what the slot shows now? */
  function isCurrent(tile: Tile, layers: Layers): boolean {
    const layer = layers[tile.slot];
    return tile.key === null ? layer === null : layer !== null && templateKey(layer) === tile.key;
  }

  function refresh(): void {
    const layers = options.current();
    for (const tile of tiles) {
      tile.element.setAttribute('aria-pressed', String(isCurrent(tile, layers)));
      // The blank tile does nothing when the slot is already empty.
      if (tile.key === null) tile.element.disabled = layers[tile.slot] === null;
    }
    // Open on the set of the letter shown, if any.
    const background = layers.background;
    const set = background?.template.startsWith('letters/') ? background.template.slice(8) : '';
    const index = LETTER_TABS.findIndex((tab) => tab.set === set);
    if (index >= 0) showSet(index);
  }

  for (const tile of tiles) {
    tile.element.addEventListener('click', () => {
      options.haptic?.();
      closeDialog();
      if (isCurrent(tile, options.current())) return;
      options.onPick(tile.slot, tile.make());
    });
  }

  button.addEventListener('click', () => {
    refresh();
    void dialog.show(button);
  });
}
