/** DOM side of the input mode: the button that shows and cycles Pen / Finger / Multi-finger. */
import type { MessageKey, Translator } from '../i18n/i18n';
import { nextInputMode, type InputFilter, type InputMode } from '../input/input-mode';

const LABELS: Record<InputMode, MessageKey> = {
  pen: 'mode.pen',
  finger: 'mode.finger',
  multi: 'mode.multi',
};

export interface ModeButton {
  /** Shows the filter's current mode; true when it changed (automatic switch). */
  refresh(): boolean;
}

export function initModeButton(
  button: HTMLButtonElement,
  filter: InputFilter,
  t: Translator['t'],
  onChange: (mode: InputMode, chosenByHand: boolean) => void,
): ModeButton {
  const icon = button.querySelector('use');
  let shown: InputMode | null = null;

  function refresh(): boolean {
    const { mode } = filter.state();
    if (mode === shown) return false;
    shown = mode;
    icon?.setAttribute('href', `#icon-mode-${mode}`);
    button.setAttribute('aria-label', t(LABELS[mode]));
    button.dataset['mode'] = mode;
    return true;
  }

  button.addEventListener('click', () => {
    filter.setMode(nextInputMode(filter.state().mode));
    refresh();
    const state = filter.state();
    onChange(state.mode, state.chosenByHand);
  });

  refresh();
  return { refresh };
}
