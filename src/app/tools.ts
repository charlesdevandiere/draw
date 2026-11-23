/**
 * DOM side of the drawing tools (spec/SPEC-draw-tools.md): the bar of 5 colors (a radio
 * group of Bootstrap `.btn-check` cells), the 6-step size slider (`.form-range`) with a
 * preview at real size, the eraser pebble, the palette pebble that opens the "all colors"
 * dialog (phones), and the full box beside the page (tablets). The rules live in
 * src/engine/palette.ts.
 */
import Dialog from 'bootstrap/js/dist/dialog.js';
import {
  COOL_FAMILIES,
  SIZES,
  TONES,
  WARM_FAMILIES,
  colorValue,
  isColorId,
  isSizeStep,
  pickColor,
  resetBar,
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
  /** A new drawing on the slate: the bar goes back to the base colors (saved). */
  resetBar(): void;
}

export interface ToolsOptions {
  /** The page: the size preview is drawn at its scale (1:1). */
  page: HTMLElement;
  /** Where the full box goes (tablets; the stylesheet shows the one fitting the window). */
  boxHost: HTMLElement;
  /** Where the bar of 5 and the palette pebble go (phones). */
  colorsHost: HTMLElement;
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
 * The paint box: two blocks (warm and neutral, then cool) of 7 families × 4 tones, square
 * cells without gaps. `across` puts the families across and the tones down (dialog); else
 * the tones across and the families down (the box beside the page on tablets).
 */
export function paintBox(
  t: Translator['t'],
  name: string,
  across: 'families' | 'tones',
  onPick: (id: ColorId) => void,
): HTMLElement {
  const box = document.createElement('div');
  box.className = `paint-box paint-box-${across}`;
  box.setAttribute('role', 'radiogroup');
  box.setAttribute('aria-label', t('tools.allColors'));
  for (const families of [WARM_FAMILIES, COOL_FAMILIES]) {
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

  const bar = document.createElement('div');
  bar.className = 'color-bar';
  bar.setAttribute('role', 'radiogroup');
  bar.setAttribute('aria-label', t('tools.colors'));

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

  // Phones: the palette pebble opens a dialog with all the colors (Bootstrap dialog).
  const paletteButton = document.createElement('button');
  paletteButton.type = 'button';
  paletteButton.className = 'btn btn-pebble palette-button';
  paletteButton.setAttribute('aria-label', t('tools.allColors'));
  paletteButton.setAttribute('aria-haspopup', 'dialog');
  paletteButton.innerHTML = '<span class="icon icon-palette" aria-hidden="true"></span>';

  const dialogElement = document.createElement('dialog');
  dialogElement.className = 'dialog dialog-instant palette-dialog';
  dialogElement.setAttribute('aria-label', t('tools.allColors'));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-solid btn-pebble theme-hold palette-close';
  close.setAttribute('aria-label', t('tools.close'));
  close.innerHTML = '<span class="icon icon-close" aria-hidden="true"></span>';
  const dialogBox = paintBox(t, 'dialog-color', 'families', (id) => {
    update(pickColor(state, id));
    void dialog.hide();
  });
  // The content sits in an inner box: Bootstrap closes the dialog on a click whose target is
  // the <dialog> itself (the backdrop), so a near miss beside a cell must not land on it.
  const dialogBody = document.createElement('div');
  dialogBody.className = 'palette-dialog-body';
  dialogBody.append(close, dialogBox);
  dialogElement.append(dialogBody);
  document.body.append(dialogElement);
  const dialog = new Dialog(dialogElement);
  paletteButton.addEventListener('click', () => void dialog.show(paletteButton));
  close.addEventListener('click', () => void dialog.hide());

  options.colorsHost.append(bar, paletteButton);
  container.append(sizeControl, eraser);

  // Tablets: the full box, tones across beside the page (landscape) or families across
  // above it (portrait); the stylesheet shows one of them, never on phones.
  const pickFromBox = (id: ColorId): void => update(pickColor(state, id));
  const boxes = (['tones', 'families'] as const).map((across) => {
    const box = paintBox(t, `box-color-${across}`, across, pickFromBox);
    box.classList.add('color-box', `color-box-${across}`);
    return box;
  });
  options.boxHost.append(...boxes);

  // The preview is drawn at the page's scale: the page's width in CSS pixels.
  const observer = new ResizeObserver(() => {
    container.style.setProperty('--page-px', `${options.page.clientWidth}px`);
  });
  observer.observe(options.page);

  /** The cells shown: rebuilt only when the bar changes (a color enters it). */
  let shown = '';

  function render(): void {
    const drawing = state.tool === 'pen';
    const key = state.recent.join(' ');
    if (key !== shown) {
      shown = key;
      bar.replaceChildren(
        ...state.recent.map((id) =>
          colorCell(t, id, 'bar-color', (id) => update(pickColor(state, id))),
        ),
      );
    }
    const groups = [bar, dialogBox, ...boxes];
    for (const input of groups.flatMap((group) => [...group.querySelectorAll('input')])) {
      input.checked = input.value === state.color;
    }
    // With the eraser, the color that will come back shows a softer ring.
    container.toggleAttribute('data-erasing', !drawing);
    options.colorsHost.toggleAttribute('data-erasing', !drawing);
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
    resetBar() {
      const next = resetBar(state);
      // Nothing to save when the bar already holds the base colors.
      if (next.recent.join(' ') !== state.recent.join(' ')) update(next);
    },
  };
}
