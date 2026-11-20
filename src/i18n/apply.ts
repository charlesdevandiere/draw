/** DOM side of i18n: the page's language and the static texts marked in the markup. */
import { isLanguage, pickLanguage, type Language, type MessageKey, type Translator } from './i18n';

type Translate = Translator['t'];

/**
 * Language chosen in the parent page for this browser (overrides the folder's). Kept in
 * localStorage, not IndexedDB like the other settings: it must be read synchronously,
 * before the first text is shown.
 */
const OVERRIDE_KEY = 'draw:language';

export function readLanguageOverride(): Language | null {
  try {
    const value = localStorage.getItem(OVERRIDE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLanguageOverride(language: Language | null): void {
  try {
    if (language) localStorage.setItem(OVERRIDE_KEY, language);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // Storage unavailable (private mode): the folder's language stays.
  }
}

/**
 * Language of the page: the parent's choice, else `<html lang>` of its language folder,
 * else the browser's. The page's `lang` attribute is updated to match.
 */
export function documentLanguage(): Language {
  const override = readLanguageOverride();
  if (override) {
    document.documentElement.lang = override;
    return override;
  }
  const lang = document.documentElement.lang;
  if (isLanguage(lang)) return lang;
  return pickLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

/**
 * Fills `data-i18n="key"` (text content) and `data-i18n-aria="key"` (aria-label) under
 * `root`. An unknown key shows the key itself (the translator's fallback).
 */
export function applyTranslations(root: ParentNode, t: Translate): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n as MessageKey);
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nAria as MessageKey));
  }
}
