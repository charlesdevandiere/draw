import { formatMessage, parseMessage, type MessageParams, type ParsedMessage } from './format';
import en from './messages/en.json';
import fr from './messages/fr.json';

/** Supported UI languages. Adding one: a catalog in messages/, a folder and a manifest. */
export const LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

/** Keys come from the English catalog, the reference. */
export type MessageKey = keyof typeof en;
export type Catalog = Readonly<Record<MessageKey, string>>;

/** A key missing from a catalog is a type error here. */
export const CATALOGS: Readonly<Record<Language, Catalog>> = { en, fr };

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** First supported language among BCP 47 tags (e.g. `navigator.languages`), else English. */
export function pickLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const primary = tag.split('-')[0]?.toLowerCase();
    if (isLanguage(primary)) return primary;
  }
  return DEFAULT_LANGUAGE;
}

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
