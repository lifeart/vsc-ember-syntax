import { describe, expect, it } from 'vitest';

import { tokenize, tokensForText, type Token } from '../helpers/tokenize';

// Handlebars literals: numbers, booleans, null, undefined and strings.
// The grammar should scope them the same wherever they appear: on their own in a mustache,
// as a positional argument, as a hash value, inside a subexpression, or in an attribute value.
// Shared by the .gjs/.gts tests and the .hbs tests, which live in separate files.
//
// Expected scopes. Numbers use constant.numeric, which the grammar already uses for numbers
// in argument position. Booleans, null and undefined use constant.language.

type LiteralKind = 'number' | 'boolean' | 'null or undefined';

interface LiteralCase {
  body: string;
  literal: string;
  kind: LiteralKind;
}

const literalCases: Record<string, LiteralCase> = {
  'number on its own': { body: '{{42}}', literal: '42', kind: 'number' },
  'negative decimal on its own': { body: '{{-1.5}}', literal: '-1.5', kind: 'number' },
  'decimal on its own': { body: '{{0.25}}', literal: '0.25', kind: 'number' },
  'number as a positional argument': { body: '{{format 42}}', literal: '42', kind: 'number' },
  'negative number as a positional argument': { body: '{{format 42 -3}}', literal: '-3', kind: 'number' },
  'number as a hash value': { body: '{{format count=3}}', literal: '3', kind: 'number' },
  'number in an attribute value': { body: '<p data-x={{42}}></p>', literal: '42', kind: 'number' },
  'true on its own': { body: '{{true}}', literal: 'true', kind: 'boolean' },
  'false on its own': { body: '{{false}}', literal: 'false', kind: 'boolean' },
  'true as a positional argument': { body: '{{if true "a"}}', literal: 'true', kind: 'boolean' },
  'true as a hash value': { body: '{{hash compact=true}}', literal: 'true', kind: 'boolean' },
  'false in a component argument': { body: '<Panel @collapsed={{false}} />', literal: 'false', kind: 'boolean' },
  'null on its own': { body: '{{null}}', literal: 'null', kind: 'null or undefined' },
  'undefined on its own': { body: '{{undefined}}', literal: 'undefined', kind: 'null or undefined' },
  'null as a hash value': { body: '{{hash label=null}}', literal: 'null', kind: 'null or undefined' },
  'undefined in a subexpression': {
    body: '{{format (hash a=undefined)}}',
    literal: 'undefined',
    kind: 'null or undefined',
  },
};

const expectedScope: Record<LiteralKind, RegExp> = {
  'number': /^constant\.numeric/,
  'boolean': /^constant\.language\.boolean/,
  'null or undefined': /^constant\.language/,
};

interface StringCase {
  body: string;
  /** The whole mustache, from {{ to }}. */
  mustache: string;
  quote: 'double' | 'single';
}

const stringCases: Record<string, StringCase> = {
  'double quoted string on its own': { body: '{{"double"}}', mustache: '{{"double"}}', quote: 'double' },
  'single quoted string on its own': { body: "{{'single'}}", mustache: "{{'single'}}", quote: 'single' },
  'string with spaces inside the braces': { body: '{{ "spaced" }}', mustache: '{{ "spaced" }}', quote: 'double' },
  'string in an attribute value': {
    body: '<p title={{"quoted"}}></p>',
    mustache: '{{"quoted"}}',
    quote: 'double',
  },
};

// Paths that start like a literal but are not one. These must stay paths.
const notLiterals: Record<string, { body: string; path: string }> = {
  'path starting with true': { body: '{{trueValue}}', path: 'trueValue' },
  'path starting with null': { body: '{{nullable}}', path: 'nullable' },
  'argument starting with undefined': { body: '{{@undefinedThing}}', path: 'undefinedThing' },
  'path ending in digits': { body: '{{item42}}', path: 'item42' },
};

function describeScopes(tokens: Token[]): string[] {
  return tokens.map((token) => `${JSON.stringify(token.text)}: ${token.scopes.slice(1).join(' ')}`);
}

export function describeLiteralMustacheTests(scopeName: string, wrap: (body: string) => string) {
  describe.each(Object.entries(literalCases))('%s', (_name, { body, literal, kind }) => {
    it(`scopes the literal as ${kind}`, async () => {
      const tokens = tokensForText(await tokenize(wrap(body), scopeName), literal);
      const wrong = tokens.filter(
        (token) =>
          !token.scopes.some((scope) => expectedScope[kind].test(scope)) ||
          (kind === 'null or undefined' && token.scopes.some((scope) => expectedScope.boolean.test(scope))),
      );
      expect(describeScopes(wrong)).toEqual([]);
    });

    it('does not scope the literal as a regular expression', async () => {
      const tokens = tokensForText(await tokenize(wrap(body), scopeName), literal);
      expect(describeScopes(tokens.filter((token) => token.scopes.includes('string.regexp')))).toEqual([]);
    });

    it('keeps the literal inside the Handlebars expression', async () => {
      const tokens = tokensForText(await tokenize(wrap(body), scopeName), literal);
      const outside = tokens.filter((token) => !token.scopes.includes('entity.expression.ember-handlebars'));
      expect(describeScopes(outside)).toEqual([]);
    });
  });

  describe.each(Object.entries(stringCases))('%s', (_name, { body, mustache, quote }) => {
    it('scopes the braces as a Handlebars expression', async () => {
      const tokens = tokensForText(await tokenize(wrap(body), scopeName), mustache);
      for (const braces of [tokens.at(0), tokens.at(-1)]) {
        expect(braces?.text.trim()).toMatch(/^(\{\{|\}\})$/);
        expect(braces?.scopes).toEqual(
          expect.arrayContaining(['entity.expression.ember-handlebars', 'keyword.operator']),
        );
      }
    });

    it(`scopes the string as a ${quote} quoted Handlebars string`, async () => {
      const tokens = tokensForText(await tokenize(wrap(body), scopeName), mustache).slice(1, -1);
      const inString = tokens.filter((token) => token.text.trim() !== '');
      expect(inString.length).toBeGreaterThan(0);
      const wrong = inString.filter(
        (token) =>
          !token.scopes.includes(`string.quoted.${quote}.ember-handlebars`) ||
          !token.scopes.includes('entity.expression.ember-handlebars'),
      );
      expect(describeScopes(wrong)).toEqual([]);
    });
  });

  describe.each(Object.entries(notLiterals))('%s', (_name, { body, path }) => {
    it('scopes it as a path, not a literal', async () => {
      const tokens = tokensForText(await tokenize(wrap(body), scopeName), path);
      const wrong = tokens.filter(
        (token) =>
          !token.scopes.includes('support.function') ||
          token.scopes.some((scope) => scope.startsWith('constant') || scope === 'string.regexp'),
      );
      expect(describeScopes(wrong)).toEqual([]);
    });
  });
}
