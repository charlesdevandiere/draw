/**
 * DOM side of the drawing tools (spec/SPEC-draw-tools.md): the colors as radio groups of
 * Bootstrap `.btn-check` cells (the full palette beside the page on tablets, behind a
 * palette pebble and its "all colors" dialog on phones), the 6-step size slider
 * (`.form-range`) with a preview at real size, and the eraser pebble. The rules live in
 * src/engine/palette.ts.
 */
import Dialog from 'bootstrap/js/dist/dialog.js';
import {
  BOX_FAMILIES,
  COOL_FAMILIES,
  SIZES,
  TONES,
  WARM_FAMILIES,
  colorValue,
  isColorId,
  isSizeStep,
  pickColor,
  selectEraser,
  selectSize,
  type ColorId,
  type Family,
  type Tone,
  type ToolState,
} from '../engine/palette';
import type { MessageKey, Translator } from '../i18n/i18n';

export interface Tools {
  state(): ToolState;
  setState(state: ToolState): void;
}

export interface ToolsOptions {
  /** The page: the size preview is drawn at its scale (1:1). */
  page: HTMLElement;
  /** Where the full box goes (tablets; the stylesheet shows the one fitting the window). */
  boxHost: HTMLElement;
  /** Light tick at each step of the slider. */
  haptic?: () => void;
}

const FAMILY_LABELS: Record<Family, MessageKey> = {
  pink: 'color.family.pink',
  red: 'color.family.red',
  orange: 'color.family.orange',
  yellow: 'color.family.yellow',
  beige: 'color.family.beige',
  brown: 'color.family.brown',
  grey: 'color.family.grey',
  'light-green': 'color.family.lightGreen',
  green: 'color.family.green',
  teal: 'color.family.teal',
  'sky-blue': 'color.family.skyBlue',
  blue: 'color.family.blue',
  indigo: 'color.family.indigo',
  purple: 'color.family.purple',
};
const TONE_LABELS: Record<Tone, MessageKey> = {
  light: 'color.tone.light',
  bright: 'color.tone.bright',
  medium: 'color.tone.medium',
  dark: 'color.tone.dark',
};
/** The grey family has names of its own (white, black). */
const GREY_LABELS: Partial<Record<ColorId, MessageKey>> = {
  'grey-light': 'color.white',
  'grey-bright': 'color.lightGrey',
  'grey-medium': 'color.grey',
  'grey-dark': 'color.black',
};

/** The translated name of a color ("Red", "Red, dark", "White"…). */
export function colorLabel(t: Translator['t'], id: ColorId): string {
  const own = GREY_LABELS[id];
  if (own) return t(own);
  const tone = id.slice(id.lastIndexOf('-') + 1) as Tone;
  const family = id.slice(0, id.lastIndexOf('-')) as Family;
  return t(TONE_LABELS[tone], { family: t(FAMILY_LABELS[family]) });
}

/** A paint-box cell: a `.btn-check` label around a radio of the group `name`. */
export function colorCell(
  t: Translator['t'],
  id: ColorId,
  name: string,
  onPick: (id: ColorId) => void,
): HTMLLabelElement {
  const cell = document.createElement('label');
  cell.className = 'btn-check color-cell';
  cell.dataset['color'] = id;
  cell.style.setProperty('--cell-color', colorValue(id));
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = id;
  input.setAttribute('aria-label', colorLabel(t, id));
  // `click`, not `change`: tapping the color already checked (kept while erasing) fires no
  // `change`, yet must go back to the pen. Arrow keys in the group fire `click` too.
  input.addEventListener('click', () => {
    if (input.checked && isColorId(input.value)) onPick(input.value);
  });
  cell.append(input);
  return cell;
}

/**
 * The paint box, square cells without gaps. `across` puts the families across and the
 * tones down, else the tones across and the families down. `split` makes two blocks (warm
 * and neutral, then cool: the dialog), else one grid of the 14 families by wavelength
 * (tablets, `BOX_FAMILIES`).
 */
export function paintBox(
  t: Translator['t'],
  name: string,
  across: 'families' | 'tones',
  split: boolean,
  onPick: (id: ColorId) => void,
): HTMLElement {
  const box = document.createElement('div');
  box.className = `paint-box paint-box-${across}${split ? '' : ' paint-box-single'}`;
  box.setAttribute('role', 'radiogroup');
  box.setAttribute('aria-label', t('tools.allColors'));
  const groups = split ? [WARM_FAMILIES, COOL_FAMILIES] : [BOX_FAMILIES];
  for (const families of groups) {
    const block = document.createElement('div');
    block.className = 'paint-box-block';
    const ids =
      across === 'families'
        ? TONES.flatMap((tone) => families.map((family) => `${family}-${tone}` as ColorId))
        : families.flatMap((family) => TONES.map((tone) => `${family}-${tone}` as ColorId));
    block.append(...ids.map((id) => colorCell(t, id, name, onPick)));
    box.append(block);
  }
  return box;
}

export function initTools(
  container: HTMLElement,
  initial: ToolState,
  t: Translator['t'],
  onChange: (state: ToolState) => void,
  options: ToolsOptions,
): Tools {
  let state = initial;

  const sizeControl = document.createElement('div');
  sizeControl.className = 'size-control';
  const preview = document.createElement('span');
  preview.className = 'size-preview';
  preview.setAttribute('aria-hidden', 'true');
  const range = document.createElement('div');
  range.className = 'form-range';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'form-range-input size-range';
  slider.min = '0';
  slider.max = String(SIZES.length - 1);
  slider.step = '1';
  slider.setAttribute('aria-label', t('tools.size'));
  slider.addEventListener('input', () => {
    const size = Number(slider.value);
    if (!isSizeStep(size) || size === state.size) return;
    options.haptic?.();
    update(selectSize(state, size));
  });
  range.append(slider);
  sizeControl.append(preview, range);

  const eraser = document.createElement('button');
  eraser.type = 'button';
  eraser.className = 'btn btn-solid btn-pebble theme-eraser eraser';
  eraser.setAttribute('aria-label', t('tools.eraser'));
  eraser.innerHTML = '<span class="icon icon-eraser" aria-hidden="true"></span>';
  eraser.addEventListener('click', () => update(selectEraser(state)));

  // Phones: the palette pebble opens a dialog with all the colors (Bootstrap dialog); the
  // current color shows in the slider's preview dot.
  const paletteButton = document.createElement('button');
  paletteButton.type = 'button';
  paletteButton.className = 'btn btn-pebble palette-button';
  paletteButton.setAttribute('aria-label', t('tools.allColors'));
  paletteButton.setAttribute('aria-haspopup', 'dialog');
  paletteButton.innerHTML = '<span class="icon icon-palette" aria-hidden="true"></span>';

  const dialogElement = document.createElement('dialog');
  dialogElement.className = 'dialog palette-dialog';
  dialogElement.setAttribute('aria-label', t('tools.allColors'));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-solid btn-pebble theme-hold palette-close';
  close.setAttribute('aria-label', t('tools.close'));
  close.innerHTML = '<span class="icon icon-close" aria-hidden="true"></span>';
  const dialogBox = paintBox(t, 'dialog-color', 'families', true, (id) => {
    update(pickColor(state, id));
    closeDialog();
  });
  // The content sits in an inner box: Bootstrap closes the dialog on a click whose target is
  // the <dialog> itself (the backdrop), so a near miss beside a cell must not land on it.
  const dialogBody = document.createElement('div');
  dialogBody.className = 'palette-dialog-body';
  dialogBody.append(close, dialogBox);
  dialogElement.append(dialogBody);
  document.body.append(dialogElement);
  const dialog = new Dialog(dialogElement);
  // Bootstrap ignores a hide while the dialog fades in: a color picked, the close button, a
  // backdrop tap or Escape that fast close the dialog as soon as it is fully open.
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
  paletteButton.addEventListener('click', () => void dialog.show(paletteButton));
  close.addEventListener('click', closeDialog);

  container.append(paletteButton, sizeControl, eraser);

  // Tablets: the full palette as one grid, 4 tones × 14 families beside the page
  // (landscape) or turned above it (portrait); the stylesheet shows one, never on phones.
  const pickFromBox = (id: ColorId): void => update(pickColor(state, id));
  const boxes = (['tones', 'families'] as const).map((across) => {
    const box = paintBox(t, `box-color-${across}`, across, false, pickFromBox);
    box.classList.add('color-box', `color-box-${across}`);
    return box;
  });
  options.boxHost.append(...boxes);

  // The preview is drawn at the page's scale: the page's width in CSS pixels.
  const observer = new ResizeObserver(() => {
    container.style.setProperty('--page-px', `${options.page.clientWidth}px`);
  });
  observer.observe(options.page);

  function render(): void {
    const drawing = state.tool === 'pen';
    const groups = [dialogBox, ...boxes];
    for (const input of groups.flatMap((group) => [...group.querySelectorAll('input')])) {
      input.checked = input.value === state.color;
    }
    // With the eraser, the color that will come back stands out less.
    container.toggleAttribute('data-erasing', !drawing);
    dialogElement.toggleAttribute('data-erasing', !drawing);
    options.boxHost.toggleAttribute('data-erasing', !drawing);
    eraser.setAttribute('aria-pressed', String(!drawing));
    slider.value = String(state.size);
    container.style.setProperty('--current-color', colorValue(state.color));
    container.style.setProperty('--size-units', String(SIZES[state.size]));
  }

  function update(next: ToolState): void {
    state = next;
    render();
    onChange(state);
  }

  render();
  return {
    state: () => state,
    setState(next) {
      state = next;
      render();
    },
  };
}
