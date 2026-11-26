/**
 * The templates pebble and its panel (spec/SPEC-template-layers.md): a dialog with one
 * section per kind of template, a blank tile to remove the current one, then a thumbnail
 * per template. Picking closes the panel; the slate turns it into a history step.
 */
import Dialog from 'bootstrap/js/dist/dialog.js';
import type { Layers } from '../engine/layers';
import type { LayerSlot, TemplateLayer } from '../engine/types';
import type { Translator, MessageKey } from '../i18n/i18n';
import { CATALOG, layerFor, type CatalogEntry, type TemplateKind } from '../templates/catalog';
import { sizedSvg } from '../templates/sized-svg';

export interface TemplatesPanelOptions {
  /** Where the pebble goes (with the drawing tools). */
  container: HTMLElement;
  t: Translator['t'];
  /** The layers on the slate now (selected ring, blank tile). */
  current: () => Layers;
  /** A tile was picked: place this layer (null: remove the slot's template). */
  onPick: (slot: LayerSlot, layer: TemplateLayer | null) => void;
  haptic?: () => void;
}

interface Section {
  kind: TemplateKind;
  slot: LayerSlot;
  icon: string;
  nameKey: MessageKey;
  noneKey: MessageKey;
}

const SECTIONS: readonly Section[] = [
  {
    kind: 'coloring',
    slot: 'overlay',
    icon: 'coloring',
    nameKey: 'templates.coloring',
    noneKey: 'templates.noColoring',
  },
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
 * width they would be under a pixel wide in a ~100 px tile.
 */
function thumbnail(entry: CatalogEntry): HTMLImageElement {
  const image = document.createElement('img');
  image.alt = '';
  image.className = 'template-thumbnail';
  const svg = sizedSvg(entry.svg, { size: THUMBNAIL_SIZE, fixedStrokeWidth: THUMBNAIL_OUTLINE });
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

  /** Tiles with what they place, to mark the current one each time the panel opens. */
  const tiles: { element: HTMLButtonElement; slot: LayerSlot; entry: CatalogEntry | null }[] = [];

  for (const section of SECTIONS) {
    const group = document.createElement('div');
    group.className = 'templates-section';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', t(section.nameKey));
    const heading = document.createElement('span');
    heading.className = 'templates-heading';
    heading.innerHTML = pebbleIcon(section.icon);
    const grid = document.createElement('div');
    grid.className = 'templates-grid';
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'template-tile template-none';
    none.setAttribute('aria-label', t(section.noneKey));
    none.innerHTML = pebbleIcon('no-template');
    grid.append(none);
    tiles.push({ element: none, slot: section.slot, entry: null });
    for (const entry of CATALOG.filter((item) => item.kind === section.kind)) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'template-tile';
      tile.dataset['template'] = entry.id;
      tile.setAttribute('aria-label', t(entry.nameKey));
      tile.append(thumbnail(entry));
      grid.append(tile);
      tiles.push({ element: tile, slot: entry.slot, entry });
    }
    group.append(heading, grid);
    body.append(group);
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

  function refresh(): void {
    const layers = options.current();
    for (const { element, slot, entry } of tiles) {
      const layer = layers[slot];
      const selected = entry ? layer?.template === entry.id : layer === null;
      element.setAttribute('aria-pressed', String(selected));
      // The blank tile does nothing when the slot is already empty.
      if (!entry) element.disabled = layer === null;
    }
  }

  for (const { element, slot, entry } of tiles) {
    element.addEventListener('click', () => {
      options.haptic?.();
      closeDialog();
      const layer = options.current()[slot];
      if (entry ? layer?.template === entry.id : layer === null) return;
      options.onPick(slot, entry && layerFor(entry));
    });
  }

  button.addEventListener('click', () => {
    refresh();
    void dialog.show(button);
  });
}
