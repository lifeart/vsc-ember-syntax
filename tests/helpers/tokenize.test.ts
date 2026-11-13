import { describe, expect, it } from 'vitest';

import { comparableTokens, findToken, formatTokens, tokenize, tokensBetween } from './tokenize';

const scopeName = 'text.html.ember-handlebars';

describe('tokenize', () => {
  it('returns one token list per line, with text, line and column', async () => {
    const tokens = await tokenize('<b>x</b>\n<i>', scopeName);
    expect(tokens).toHaveLength(2);
    expect(tokens[1][1]).toMatchObject({ text: 'i', line: 1, startIndex: 1 });
    expect(tokens[1][1].scopes[0]).toBe(scopeName);
  });

  it('carries state across lines', async () => {
    const tokens = await tokenize('{{!--\nstill a comment\n--}}', scopeName);
    expect(findToken(tokens, 'still').scopes.some((scope) => scope.startsWith('comment.'))).toBe(true);
  });

  it('rejects an unknown grammar scope', async () => {
    await expect(tokenize('x', 'source.does-not-exist')).rejects.toThrow('source.does-not-exist');
  });
});

describe('findToken', () => {
  it('finds the token by occurrence', async () => {
    const tokens = await tokenize('<b>x</b>', scopeName);
    expect(findToken(tokens, 'b', 1).startIndex).toBe(1);
    expect(findToken(tokens, 'b', 2).startIndex).toBe(6);
  });

  it('throws when there is no matching token', async () => {
    const tokens = await tokenize('<b>x</b>', scopeName);
    expect(() => findToken(tokens, 'b', 3)).toThrow('No token #3 starting with "b"');
  });
});

describe('tokensBetween', () => {
  it('returns the tokens strictly between two tokens, across lines', async () => {
    const tokens = await tokenize('<b>\nx\n</b>', scopeName);
    const between = tokensBetween(tokens, findToken(tokens, 'b', 1), findToken(tokens, 'b', 2));
    expect(between.map((token) => token.text)).toEqual(['>', 'x', '</']);
  });

  it('throws when end comes before start', async () => {
    const tokens = await tokenize('<b>x</b>', scopeName);
    expect(() => tokensBetween(tokens, findToken(tokens, 'b', 2), findToken(tokens, 'b', 1))).toThrow(
      'end comes before start',
    );
  });

  it('throws when a token is not from the given lines', async () => {
    const tokens = await tokenize('<b>x</b>', scopeName);
    const other = await tokenize('<b>x</b>', scopeName);
    expect(() => tokensBetween(tokens, findToken(other, 'b', 1), findToken(tokens, 'b', 2))).toThrow(
      'must be tokens from the given lines',
    );
  });
});

describe('comparableTokens', () => {
  it('drops columns and renames matching token text', async () => {
    const tokens = await tokenize('<b>x</b>', scopeName);
    const comparable = comparableTokens(tokens, { from: 'b', to: 'strong' });
    expect(comparable.map((token) => token.text)).toEqual(['<', 'strong', '>', 'x', '</', 'strong', '>']);
    expect(comparable[1]).toEqual({ line: 0, text: 'strong', scopes: tokens[0][1].scopes });
  });

  it('only renames tokens whose whole text matches', async () => {
    const tokens = await tokenize('<bb>x</bb>', scopeName);
    expect(comparableTokens(tokens, { from: 'b', to: 'strong' }).map((token) => token.text)).toContain('bb');
  });
});

describe('formatTokens', () => {
  it('prints each line, then carets and scopes for each token without the root scope', async () => {
    const source = '<b>x</b>';
    const output = formatTokens(await tokenize(source, scopeName), source);
    expect(output.split('\n').slice(0, 3)).toEqual([
      '><b>x</b>',
      ' ^ meta.tag.any.ember-handlebars punctuation.definition.tag',
      '  ^ meta.tag.any.ember-handlebars entity.name.tag.html.ember-handlebars',
    ]);
  });

  it('skips tokens that are only whitespace', async () => {
    const source = '<b>x</b> <i>';
    const tokens = await tokenize(source, scopeName);
    expect(tokens[0].some((token) => token.text === ' ')).toBe(true);
    const rows = formatTokens(tokens, source).trimEnd().split('\n').slice(1);
    expect(rows).toHaveLength(tokens[0].length - 1);
  });

  it('leaves no trailing space on a token that only has the root scope', async () => {
    const source = 'x';
    expect(formatTokens(await tokenize(source, scopeName), source)).toBe('>x\n ^\n');
  });
});
