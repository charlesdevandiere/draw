/** DOM side of the drawing tools: color swatches, the two widths and the eraser. */
import {
  PALETTE,
  colorValue,
  selectColor,
  selectEraser,
  selectWidth,
  type ColorId,
  type ToolState,
  type WidthId,
} from '../engine/palette';
import type { MessageKey, Translator } from '../i18n/i18n';

export interface Tools {
  state(): ToolState;
  setState(state: ToolState): void;
}

const COLOR_LABELS: Record<ColorId, MessageKey> = {
  black: 'color.black',
  red: 'color.red',
  orange: 'color.orange',
  yellow: 'color.yellow',
  green: 'color.green',
  blue: 'color.blue',
  purple: 'color.purple',
  brown: 'color.brown',
};
const WIDTH_LABELS: Record<WidthId, MessageKey> = { thin: 'tools.thin', thick: 'tools.thick' };

/** A button with the given classes (`tool-button …`, or a pebble `btn …`). */
function button(className: string, label: string, content: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.setAttribute('aria-label', label);
  element.innerHTML = content;
  return element;
}

export function initTools(
  container: HTMLElement,
  initial: ToolState,
  t: Translator['t'],
  onChange: (state: ToolState) => void,
): Tools {
  let state = initial;

  const swatches = PALETTE.map(({ id, value }) => {
    const swatch = button('tool-button swatch', t(COLOR_LABELS[id]), '');
    swatch.style.setProperty('--swatch', value);
    swatch.dataset['color'] = id;
    swatch.addEventListener('click', () => update(selectColor(state, id)));
    return swatch;
  });

  const widths = (['thin', 'thick'] as const).map((width) => {
    const element = button(
      `tool-button width width-${width}`,
      t(WIDTH_LABELS[width]),
      '<span class="width-dot"></span>',
    );
    element.dataset['width'] = width;
    element.addEventListener('click', () => update(selectWidth(state, width)));
    return element;
  });

  const eraser = button(
    'btn btn-solid btn-pebble theme-eraser eraser',
    t('tools.eraser'),
    '<span class="icon icon-eraser" aria-hidden="true"></span>',
  );
  eraser.addEventListener('click', () => update(selectEraser(state)));

  container.append(...swatches, ...widths, eraser);

  function render(): void {
    const drawing = state.tool === 'pen';
    for (const swatch of swatches) {
      const current = swatch.dataset['color'] === state.color;
      swatch.setAttribute('aria-pressed', String(drawing && current));
      // With the eraser, the color and width that will come back stay visible (softer).
      swatch.toggleAttribute('data-kept', !drawing && current);
    }
    for (const width of widths) {
      const current = width.dataset['width'] === state.width;
      width.setAttribute('aria-pressed', String(drawing && current));
      width.toggleAttribute('data-kept', !drawing && current);
    }
    eraser.setAttribute('aria-pressed', String(!drawing));
    // The width buttons preview the current color.
    container.style.setProperty('--current-color', colorValue(state.color));
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
