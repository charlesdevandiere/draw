import { formatMessage, parseMessage, type MessageParams, type ParsedMessage } from './format';
import en from './messages/en.json';
import fr from './messages/fr.json';
import { DEFAULT_LANGUAGE, type Language } from './languages';

export { DEFAULT_LANGUAGE, LANGUAGES, isLanguage, pickLanguage, type Language } from './languages';

/** Keys come from the English catalog, the reference. */
export type MessageKey = keyof typeof en;
export type Catalog = Readonly<Record<MessageKey, string>>;

/** A key missing from a catalog is a type error here. */
export const CATALOGS: Readonly<Record<Language, Catalog>> = { en, fr };

export interface Translator {
  readonly language: Language;
  t(key: MessageKey, params?: MessageParams): string;
}

export function createTranslator(
  language: Language,
  catalogs: Readonly<Record<Language, Catalog>> = CATALOGS,
): Translator {
  const parsed = new Map<MessageKey, ParsedMessage>();
  return {
    language,
    t(key, params = {}) {
      let message = parsed.get(key);
      if (!message) {
        // A catalog loaded at runtime could still miss a key: fall back to English, then
        // to the key itself rather than crashing.
        const source = catalogs[language][key] ?? catalogs[DEFAULT_LANGUAGE][key] ?? key;
        message = parseMessage(source);
        parsed.set(key, message);
      }
      return formatMessage(message, params, language);
    },
  };
}
