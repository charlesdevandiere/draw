/** DOM side of i18n: the page's language and the static texts marked in the markup. */
import { isLanguage, pickLanguage, type Language, type MessageKey, type Translator } from './i18n';

type Translate = Translator['t'];

/** Language of the page (`<html lang>` of its language folder), else the browser's. */
export function documentLanguage(): Language {
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
