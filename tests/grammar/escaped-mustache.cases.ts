import { describe, expect, it } from 'vitest';

import { findToken, tokenize, tokensForText } from '../helpers/tokenize';

// A backslash before {{ tells Handlebars to output the mustache as plain text.
// The grammar should not highlight an escaped mustache as Handlebars.
// Shared by the .gjs/.gts tests and the .hbs tests, which live in separate files.

interface EscapedCase {
  body: string;
  /** The text Handlebars outputs as-is. None of it should get Handlebars scopes. */
  plainText: string;
}

const escapedCases: Record<string, EscapedCase> = {
  'escaped mustache on its own line': { body: '\\{{not a mustache}}', plainText: '{{not a mustache}}' },
  'escaped mustache inside text': { body: 'before \\{{name}} after', plainText: '{{name}}' },
  'escaped triple curlies': { body: '\\{{{raw}}}', plainText: '{{{raw}}}' },
  'escaped block helper': { body: '\\{{#if x}}', plainText: '{{#if x}}' },
};

// Scopes that only Handlebars expressions get. Plain text inside a template has none of these.
const HANDLEBARS_SCOPE = /^(entity\.expression|keyword|support|variable|constant|punctuation\.definition\.tag)/;

const FOLLOWING_LINE = '<p>{{@after}}</p>';

export function describeEscapedMustacheTests(scopeName: string, wrap: (body: string) => string) {
  describe.each(Object.entries(escapedCases))('%s', (_name, { body, plainText }) => {
    const source = wrap(`${body}\n${FOLLOWING_LINE}`);

    it('does not scope the escaped mustache as Handlebars', async () => {
      const tokens = await tokenize(source, scopeName);
      const highlighted = tokensForText(tokens, plainText)
        .filter((token) => token.scopes.some((scope) => HANDLEBARS_SCOPE.test(scope)))
        .map((token) => `${JSON.stringify(token.text)}: ${token.scopes.slice(1).join(' ')}`);
      expect(highlighted).toEqual([]);
    });

    it('scopes the next line as Handlebars', async () => {
      const tokens = await tokenize(source, scopeName);
      expect(findToken(tokens, 'p').scopes).toContain('entity.name.tag.html.ember-handlebars');
      const mustache = tokensForText(tokens, '{{@after}}');
      expect(mustache.map((token) => token.text)).toEqual(['{{', '@', 'after', '}}']);
      for (const token of mustache) {
        expect(token.scopes, JSON.stringify(token.text)).toContain('entity.expression.ember-handlebars');
      }
      expect(mustache[1].scopes).toContain('variable.language');
    });
  });

  // Two backslashes are an escaped backslash, so the mustache after them is a real one.
  it('scopes a mustache after an escaped backslash as Handlebars', async () => {
    const tokens = await tokenize(wrap('\\\\{{real}}'), scopeName);
    expect(findToken(tokens, 'real').scopes).toContain('entity.expression.ember-handlebars');
  });
}
