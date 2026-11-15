import { describe, expect, it } from 'vitest';

import { findToken, tokenize, tokensForText } from '../helpers/tokenize';

// A tag that is still being typed has no `>` yet, such as `<Demo @na`. The tag
// should end at the next `<`, so the tags after it are still scoped as tags.
// Shared by the .gjs/.gts tests and the .hbs tests, which live in separate files.

const unclosedTags: Record<string, string> = {
  'unclosed HTML tag': '<div',
  'unclosed HTML tag with an attribute': '<div class="a"',
  'unclosed component tag': '<Demo @na',
  'unclosed component tag with an argument': '<Demo @name="one" @foo="ssf"',
};

const FOLLOWING_LINE = '<p>after</p>';

export function describeUnclosedTagTests(scopeName: string, wrap: (body: string) => string) {
  describe.each(Object.entries(unclosedTags))('%s', (_name, body) => {
    const source = wrap(`${body}\n\n${FOLLOWING_LINE}`);

    it('scopes the next tag as a tag', async () => {
      const tokens = await tokenize(source, scopeName);
      const [open] = tokensForText(tokens, '<p>');
      expect(open.scopes).toContain('punctuation.definition.tag');
      expect(open.scopes.some((scope) => scope.startsWith('invalid'))).toBe(false);
      expect(findToken(tokens, 'p').scopes).toContain('entity.name.tag.html.ember-handlebars');
    });
  });

  it('does not end a tag at a `<` inside a quoted attribute value', async () => {
    const tokens = await tokenize(wrap(`<div title="a<b" class="c">\n${FOLLOWING_LINE}`), scopeName);
    expect(findToken(tokens, 'class').scopes).toContain('meta.tag.any.ember-handlebars');
    expect(findToken(tokens, 'p').scopes).toContain('entity.name.tag.html.ember-handlebars');
  });
}
