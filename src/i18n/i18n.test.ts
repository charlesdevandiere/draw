import { describe, expect, it } from 'vitest';
import { parseMessage } from './format';
import {
  CATALOGS,
  LANGUAGES,
  createTranslator,
  isLanguage,
  pickLanguage,
  type Catalog,
  type Language,
} from './i18n';

describe('pickLanguage', () => {
  it('takes the first supported language, region ignored', () => {
    expect(pickLanguage(['fr-FR', 'en-US'])).toBe('fr');
    expect(pickLanguage(['de-DE', 'en-GB', 'fr'])).toBe('en');
    expect(pickLanguage(['FR-be'])).toBe('fr');
  });

  it('falls back to English', () => {
    expect(pickLanguage(['de-DE', 'it'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
    expect(pickLanguage([''])).toBe('en');
  });
});

describe('isLanguage', () => {
  it('accepts only supported codes', () => {
    expect(isLanguage('fr')).toBe(true);
    expect(isLanguage('fr-FR')).toBe(false);
    expect(isLanguage(42)).toBe(false);
  });
});

describe('catalogs', () => {
  const reference = Object.keys(CATALOGS.en).sort();

  it.each(LANGUAGES)('%s has exactly the keys of en.json', (language) => {
    expect(Object.keys(CATALOGS[language]).sort()).toEqual(reference);
  });

  it.each(LANGUAGES)('%s messages all parse', (language) => {
    for (const message of Object.values(CATALOGS[language])) {
      expect(() => parseMessage(message)).not.toThrow();
    }
  });

  // "d'{name}" quotes the brace (ICU): the placeholder would silently become literal text.
  it.each(LANGUAGES)('%s messages have no apostrophe right before a brace', (language) => {
    for (const message of Object.values(CATALOGS[language])) {
      expect(message.replaceAll("''", '')).not.toMatch(/'[{}]/);
    }
  });
});

describe('createTranslator', () => {
  it('translates with the catalog of its language', () => {
    expect(createTranslator('fr').t('app.name')).toBe('Carnet magique');
    expect(createTranslator('en').t('app.name')).toBe('Magic Sketchbook');
  });

  it('formats parameters with the plural rules of its language', () => {
    const catalog = { 'app.name': '{n, plural, one {# dessin} other {# dessins}}' } as Catalog;
    const catalogs = { en: catalog, fr: catalog } as Record<Language, Catalog>;
    const { t } = createTranslator('fr', catalogs);
    expect(t('app.name', { n: 0 })).toBe('0 dessin');
    expect(t('app.name', { n: 2 })).toBe('2 dessins');
  });

  it('falls back to English for a key missing at runtime', () => {
    const catalogs = { en: CATALOGS.en, fr: {} as Catalog };
    expect(createTranslator('fr', catalogs).t('app.name')).toBe('Magic Sketchbook');
  });

  it('falls back to the key when no catalog has it', () => {
    const catalogs = { en: {} as Catalog, fr: {} as Catalog };
    expect(createTranslator('fr', catalogs).t('app.name')).toBe('app.name');
  });
});
