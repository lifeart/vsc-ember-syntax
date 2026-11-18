import { describe, expect, it } from 'vitest';

import { findToken, tokenize, tokensForText } from '../helpers/tokenize';

// A mustache that is still being typed has no `}}` yet, such as `{{this.na`.
// The mustache should end at the next `<`, or at a `>` or `/>` that ends the
// tag it is in, so what follows it is not scoped as Handlebars.
// Shared by the .gjs/.gts tests and the .hbs tests, which live in separate files.

const unclosedMustaches: Record<string, string> = {
  'unclosed mustache in text': '{{this.na',
  'unclosed mustache with an argument': '{{t "hello"',
  'unclosed block mustache': '{{#if this.x',
  'unclosed triple mustache': '{{{this.html',
  'unclosed mustache in an attribute value': '<Demo @name={{@name',
  'unclosed mustache before the end of a tag': '<Demo @name={{@name />',
};

const FOLLOWING_LINE = '<p>after</p>';

export function describeUnclosedMustacheTests(scopeName: string, wrap: (body: string) => string) {
  describe.each(Object.entries(unclosedMustaches))('%s', (_name, body) => {
    const source = wrap(`${body}\n\n${FOLLOWING_LINE}`);

    it('scopes the next tag as a tag', async () => {
      const tokens = await tokenize(source, scopeName);
      const [open] = tokensForText(tokens, '<p>');
      expect(open.scopes).toContain('punctuation.definition.tag');
      expect(open.scopes.some((scope) => scope.startsWith('entity.'))).toBe(false);
      expect(findToken(tokens, 'p').scopes).toContain('entity.name.tag.html.ember-handlebars');
    });
  });

  it('does not end a mustache at a `<` or `>` inside a string', async () => {
    const tokens = await tokenize(wrap(`{{t "a<b>c"}}\n${FOLLOWING_LINE}`), scopeName);
    const [close] = tokensForText(tokens, '}}');
    expect(close.scopes).toContain('entity.expression.ember-handlebars');
    expect(findToken(tokens, 'p').scopes).toContain('entity.name.tag.html.ember-handlebars');
  });
}
