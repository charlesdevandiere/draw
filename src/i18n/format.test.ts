import { describe, expect, it } from 'vitest';
import { MessageFormatError, formatMessage, parseMessage, type MessageParams } from './format';

function format(source: string, params: MessageParams = {}, locale = 'en'): string {
  return formatMessage(parseMessage(source), params, locale);
}

describe('plain text and placeholders', () => {
  it('returns plain text unchanged', () => {
    expect(format('Undo')).toBe('Undo');
  });

  it('replaces placeholders with strings and formatted numbers', () => {
    expect(format('{name} has {count} drawings', { name: 'Léa', count: 1200 })).toBe(
      'Léa has 1,200 drawings',
    );
    expect(format('{count} dessins', { count: 1200 }, 'fr')).toBe('1 200 dessins');
  });

  it('renders a missing parameter as its placeholder', () => {
    expect(format('Hello {name}')).toBe('Hello {name}');
  });

  it('ignores parameters inherited from Object.prototype', () => {
    expect(format('{constructor} {toString}')).toBe('{constructor} {toString}');
    expect(format('{toString, select, other {x}}')).toBe('x');
  });

  it('accepts spaces inside a placeholder', () => {
    expect(format('{ name }', { name: 'x' })).toBe('x');
  });
});

describe('apostrophes', () => {
  it('keeps French elisions literal', () => {
    expect(format("Vider le cache de l'app")).toBe("Vider le cache de l'app");
  });

  it("turns '' into one apostrophe", () => {
    expect(format("it''s")).toBe("it's");
  });

  it('quotes braces', () => {
    expect(format("'{name}' is literal")).toBe('{name} is literal');
    expect(format("a '}' b")).toBe('a } b');
  });

  it('quotes # inside a plural only', () => {
    expect(format("{n, plural, other {'#' #}}", { n: 2 })).toBe('# 2');
    expect(format('#1')).toBe('#1');
  });

  it('quotes a placeholder after an elision unless escaped', () => {
    expect(() => parseMessage("Dessin d'{name}")).toThrow(MessageFormatError);
    expect(format("Dessin d''{name}", { name: 'Léa' })).toBe("Dessin d'Léa");
  });

  it("supports '' inside a quoted run", () => {
    expect(format("'{it''s}'")).toBe("{it's}");
  });
});

describe('plural', () => {
  const drawings = '{count, plural, =0 {No drawing} one {# drawing} other {# drawings}}';

  it('prefers an exact match', () => {
    expect(format(drawings, { count: 0 })).toBe('No drawing');
  });

  it('uses the English categories', () => {
    expect(format(drawings, { count: 1 })).toBe('1 drawing');
    expect(format(drawings, { count: 2 })).toBe('2 drawings');
  });

  it('uses the French categories (0 and 1 are singular)', () => {
    const fr = '{count, plural, one {# dessin} other {# dessins}}';
    expect(format(fr, { count: 0 }, 'fr')).toBe('0 dessin');
    expect(format(fr, { count: 1 }, 'fr')).toBe('1 dessin');
    expect(format(fr, { count: 2 }, 'fr')).toBe('2 dessins');
  });

  it('uses categories beyond one / other when the language has them', () => {
    const pl = '{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}';
    expect(format(pl, { n: 3 }, 'pl')).toBe('3 pliki');
    expect(format(pl, { n: 5 }, 'pl')).toBe('5 plików');
  });

  it('falls back to other when the category has no option', () => {
    expect(format('{n, plural, other {# items}}', { n: 1 })).toBe('1 items');
  });

  it('accepts a numeric string', () => {
    expect(format(drawings, { count: '2' })).toBe('2 drawings');
  });

  it('renders a missing, blank or non-numeric count as its placeholder', () => {
    expect(format(drawings)).toBe('{count}');
    expect(format(drawings, { count: 'many' })).toBe('{count}');
    expect(format(drawings, { count: '' })).toBe('{count}');
    expect(format(drawings, { count: ' ' })).toBe('{count}');
    expect(format(drawings, { count: Number.NaN })).toBe('{count}');
  });

  it('matches an exact selector written with a decimal or leading zero', () => {
    expect(format('{n, plural, =1.0 {exact} other {# x}}', { n: 1 })).toBe('exact');
    expect(format('{n, plural, =01 {exact} other {# x}}', { n: 1 })).toBe('exact');
  });

  it('keeps # literal outside a plural', () => {
    expect(format('{g, select, other {#}}', { g: 'x' })).toBe('#');
  });
});

describe('select', () => {
  const message = '{gender, select, female {She drew} male {He drew} other {They drew}}';

  it('picks the matching option', () => {
    expect(format(message, { gender: 'female' })).toBe('She drew');
    expect(format(message, { gender: 'male' })).toBe('He drew');
  });

  it('falls back to other for an unknown or missing value', () => {
    expect(format(message, { gender: 'robot' })).toBe('They drew');
    expect(format(message)).toBe('They drew');
  });

  it('nests a plural inside a select, # bound to the plural', () => {
    const nested =
      '{gender, select, female {{count, plural, one {Elle a # dessin} other {Elle a # dessins}}} other {{count, plural, one {# dessin} other {# dessins}}}}';
    expect(format(nested, { gender: 'female', count: 3 }, 'fr')).toBe('Elle a 3 dessins');
    expect(format(nested, { gender: 'x', count: 1 }, 'fr')).toBe('1 dessin');
  });

  it('inherits the plural number for # in a select nested in a plural', () => {
    const nested = '{n, plural, other {{g, select, other {# items}}}}';
    expect(format(nested, { n: 4, g: 'a' })).toBe('4 items');
  });
});

describe('malformed messages', () => {
  it.each([
    ['unclosed placeholder', '{name'],
    ['stray closing brace', 'a } b'],
    ['empty placeholder', '{}'],
    ['invalid argument name', '{1abc}'],
    ['unknown type', '{n, number}'],
    ['missing other', '{n, plural, one {x}}'],
    ['duplicate selector', '{n, plural, one {a} one {b} other {c}}'],
    ['=N in select', '{g, select, =1 {a} other {b}}'],
    ['option without braces', '{n, plural, one x other {y}}'],
    ['unclosed option list', '{n, plural, other {y}'],
    ['unclosed option', '{n, plural, other {y'],
    ['unterminated quote', "'{abc"],
    ['invalid selector', '{n, plural, @ {a} other {b}}'],
  ])('rejects %s', (_label, source) => {
    expect(() => parseMessage(source)).toThrow(MessageFormatError);
  });

  it('names the message in the error', () => {
    expect(() => parseMessage('{oops')).toThrow(/in message: \{oops/);
  });
});
