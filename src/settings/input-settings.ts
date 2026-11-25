/**
 * Settings page: settings of the Finger input mode (palm width filter).
 * Saved at once; the app applies them the next time it starts.
 */
import { requireElement } from '../app/dom';
import { DEFAULT_FINGER_SETTINGS, type FingerSettings } from '../input/input-mode';
import { SETTING_KEYS, clampFingerSettings, parseFingerSettings } from '../store/settings';

export interface InputSettingsOptions {
  read: (key: string) => Promise<unknown>;
  write: (key: string, value: unknown) => Promise<void>;
}

export async function initInputSettings(options: InputSettingsOptions): Promise<void> {
  const filter = requireElement('width-filter', HTMLInputElement);
  const threshold = requireElement('width-threshold', HTMLInputElement);
  const defaults = requireElement('input-defaults', HTMLButtonElement);

  /** Last threshold shown, kept while the filter is off so turning it on restores it. */
  let lastThreshold = DEFAULT_FINGER_SETTINGS.widthThreshold ?? 80;

  function show(settings: FingerSettings): void {
    filter.checked = settings.widthThreshold !== null;
    if (settings.widthThreshold !== null) lastThreshold = settings.widthThreshold;
    threshold.value = String(lastThreshold);
    threshold.disabled = !filter.checked;
  }

  function current(): FingerSettings {
    return clampFingerSettings({
      widthThreshold: filter.checked ? threshold.valueAsNumber : null,
    });
  }

  function save(): void {
    const settings = current();
    show(settings);
    options.write(SETTING_KEYS.fingerSettings, settings).catch(() => undefined);
  }

  // Inert until the stored settings are shown: an edit made meanwhile would be overwritten.
  for (const control of [filter, threshold, defaults]) control.disabled = true;
  const stored = await options.read(SETTING_KEYS.fingerSettings).catch(() => null);
  for (const control of [filter, defaults]) control.disabled = false;
  show(parseFingerSettings(stored));
  filter.addEventListener('change', save);
  threshold.addEventListener('change', save);
  defaults.addEventListener('click', () => {
    show(DEFAULT_FINGER_SETTINGS);
    save();
  });
}
