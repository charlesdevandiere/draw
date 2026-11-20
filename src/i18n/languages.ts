/**
 * Language codes and the choice of language, kept apart from the catalogs so the root
 * redirect page stays tiny.
 */

/** Supported UI languages. Adding one: a catalog in messages/, a folder and a manifest. */
export const LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

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
