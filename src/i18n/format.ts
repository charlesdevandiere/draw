/**
 * A small subset of ICU MessageFormat, the syntax Angular i18n and FormatJS use:
 *
 * - placeholders: `{name}`;
 * - plural: `{count, plural, =0 {none} one {# drawing} other {# drawings}}`, categories
 *   from `Intl.PluralRules`, `#` replaced by the formatted number;
 * - select: `{gender, select, female {…} male {…} other {…}}`.
 *
 * Quoting follows ICU: `''` is an apostrophe, and an apostrophe directly before `{`, `}`
 * (or `#` inside a plural) starts a literal run up to the next apostrophe. Any other
 * apostrophe is literal, so French elisions ("l'app") need no escaping, except directly
 * before a placeholder: "d'{name}" quotes the brace. Write "d’{name}" (typographic
 * apostrophe) or "d''{name}" there; a catalog test rejects "'{".
 */

export type MessageParams = Readonly<Record<string, string | number>>;

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'pound' }
  | { kind: 'argument'; name: string }
  | { kind: 'plural'; name: string; options: ReadonlyMap<string, Node[]> }
  | { kind: 'select'; name: string; options: ReadonlyMap<string, Node[]> };

export type ParsedMessage = readonly Node[];

export class MessageFormatError extends Error {
  constructor(message: string, source: string) {
    super(`${message} in message: ${source}`);
    this.name = 'MessageFormatError';
  }
}

const IDENTIFIER = /^[A-Za-z_][\w]*$/;
const SELECTOR = /^(=\d+(\.\d+)?|[A-Za-z_][\w-]*)$/;

/** Own parameter only: a placeholder named like an `Object.prototype` member stays missing. */
function param(params: MessageParams, name: string): string | number | undefined {
  return Object.hasOwn(params, name) ? params[name] : undefined;
}

/** Number for a plural, or null when the value is missing, blank or not numeric. */
function toNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (value === undefined || value.trim() === '') return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

/** Intl objects are costly to build: one per locale, shared by every call. */
const intlCache = new Map<string, { plural: Intl.PluralRules; number: Intl.NumberFormat }>();

function intlFor(locale: string): { plural: Intl.PluralRules; number: Intl.NumberFormat } {
  let intl = intlCache.get(locale);
  if (!intl) {
    intl = { plural: new Intl.PluralRules(locale), number: new Intl.NumberFormat(locale) };
    intlCache.set(locale, intl);
  }
  return intl;
}

/** Parses a message once; the result can be formatted many times. */
export function parseMessage(source: string): ParsedMessage {
  let index = 0;

  const fail = (reason: string): never => {
    throw new MessageFormatError(`${reason} at offset ${index}`, source);
  };

  const skipSpaces = (): void => {
    while (index < source.length && /\s/.test(source.charAt(index))) index += 1;
  };

  const readWord = (): string => {
    skipSpaces();
    const start = index;
    while (index < source.length && !/[\s,{}]/.test(source.charAt(index))) index += 1;
    return source.slice(start, index);
  };

  const expect = (char: string): void => {
    skipSpaces();
    if (source.charAt(index) !== char) fail(`expected "${char}"`);
    index += 1;
  };

  /** Parses text and arguments until a closing brace (nested) or the end (top level). */
  const parseNodes = (inPlural: boolean, nested: boolean): Node[] => {
    const nodes: Node[] = [];
    let text = '';
    const flush = (): void => {
      if (text) nodes.push({ kind: 'text', value: text });
      text = '';
    };

    while (index < source.length) {
      const char = source.charAt(index);
      if (char === "'") {
        const next = source.charAt(index + 1);
        if (next === "'") {
          text += "'";
          index += 2;
        } else if (next === '{' || next === '}' || (inPlural && next === '#')) {
          // Literal run up to the closing apostrophe; '' inside it is an apostrophe.
          index += 1;
          for (;;) {
            if (index >= source.length) fail('unterminated quote');
            if (source.charAt(index) === "'") {
              if (source.charAt(index + 1) !== "'") break;
              index += 1;
            }
            text += source.charAt(index);
            index += 1;
          }
          index += 1;
        } else {
          text += char;
          index += 1;
        }
      } else if (char === '{') {
        flush();
        index += 1;
        nodes.push(parseArgument(inPlural));
      } else if (char === '}') {
        if (!nested) fail('unexpected "}"');
        flush();
        return nodes;
      } else if (char === '#' && inPlural) {
        flush();
        nodes.push({ kind: 'pound' });
        index += 1;
      } else {
        text += char;
        index += 1;
      }
    }
    if (nested) fail('missing "}"');
    flush();
    return nodes;
  };

  const parseArgument = (inPlural: boolean): Node => {
    const name = readWord();
    if (!IDENTIFIER.test(name)) fail(`invalid argument name "${name}"`);
    skipSpaces();
    if (source.charAt(index) === '}') {
      index += 1;
      return { kind: 'argument', name };
    }
    expect(',');
    const type = readWord();
    if (type !== 'plural' && type !== 'select') fail(`unsupported argument type "${type}"`);
    expect(',');

    const options = new Map<string, Node[]>();
    for (;;) {
      skipSpaces();
      if (source.charAt(index) === '}') {
        index += 1;
        break;
      }
      if (index >= source.length) fail('missing "}"');
      let selector = readWord();
      if (!SELECTOR.test(selector)) fail(`invalid selector "${selector}"`);
      // "=1.0" and "=01" must match the number 1, looked up as "=1".
      if (selector.startsWith('=')) selector = `=${Number(selector.slice(1))}`;
      if (type === 'select' && selector.startsWith('=')) fail('"=N" is only valid in plural');
      if (options.has(selector)) fail(`duplicate selector "${selector}"`);
      expect('{');
      // A select nested in a plural keeps `#` bound to the plural's number.
      options.set(selector, parseNodes(type === 'plural' || inPlural, true));
      index += 1; // closing brace of the option
    }
    if (!options.has('other')) fail(`"${name}" has no "other" option`);
    return type === 'plural'
      ? { kind: 'plural', name, options }
      : { kind: 'select', name, options };
  };

  return parseNodes(false, false);
}

/**
 * Formats a parsed message. A missing parameter is rendered as `{name}` rather than
 * throwing: a visible gap is better than a broken screen.
 */
export function formatMessage(
  message: ParsedMessage,
  params: MessageParams,
  locale: string,
): string {
  const { plural: pluralRules, number: numberFormat } = intlFor(locale);

  const render = (nodes: readonly Node[], count: number | null): string =>
    nodes
      .map((node) => {
        switch (node.kind) {
          case 'text':
            return node.value;
          case 'pound':
            return count === null ? '#' : numberFormat.format(count);
          case 'argument': {
            const value = param(params, node.name);
            if (value === undefined) return `{${node.name}}`;
            return typeof value === 'number' ? numberFormat.format(value) : value;
          }
          case 'plural': {
            const number = toNumber(param(params, node.name));
            if (number === null) return `{${node.name}}`;
            const branch =
              node.options.get(`=${number}`) ??
              node.options.get(pluralRules.select(number)) ??
              node.options.get('other');
            return render(branch ?? [], number);
          }
          case 'select': {
            const value = param(params, node.name);
            const branch =
              (value === undefined ? undefined : node.options.get(String(value))) ??
              node.options.get('other');
            return render(branch ?? [], count);
          }
        }
      })
      .join('');

  return render(message, null);
}
