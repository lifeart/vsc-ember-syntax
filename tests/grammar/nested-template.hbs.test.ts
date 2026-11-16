import { describe, expect, it } from 'vitest';

import { comparableTokens, tokenize } from '../helpers/tokenize';
import { nestedTemplateBodies, TAG_PLACEHOLDER } from './nested-template.examples';

// In a .hbs file every <template> tag is a plain HTML element, including the outermost one.
// These tests confirm the Handlebars grammar already scopes them like any other tag.

const scopeName = 'text.html.ember-handlebars';

const examples: Record<string, string> = {
  ...nestedTemplateBodies,
  ...Object.fromEntries(
    Object.entries(nestedTemplateBodies).map(([name, body]) => [
      `${name}, inside a top-level <template>`,
      `<TAG>\n${body
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n')}\n</TAG>`,
    ]),
  ),
};

describe.each(Object.entries(examples))('<template> tag in a .hbs file, %s', (_name, example) => {
  const source = example.replace(TAG_PLACEHOLDER, 'template');
  const control = example.replace(TAG_PLACEHOLDER, 'section');

  it('tokenizes the same as a <section> tag in the same place', async () => {
    const [actualTokens, controlTokens] = await Promise.all([
      tokenize(source, scopeName),
      tokenize(control, scopeName),
    ]);
    expect(comparableTokens(actualTokens)).toEqual(
      comparableTokens(controlTokens, { from: 'section', to: 'template' }),
    );
  });

  it('scopes every <template> tag name as a normal HTML tag name', async () => {
    const tokens = await tokenize(source, scopeName);
    const names = tokens.flat().filter((token) => token.text === 'template');
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.scopes, `line ${name.line}`).toEqual([
        scopeName,
        'meta.tag.any.ember-handlebars',
        'entity.name.tag.html.ember-handlebars',
      ]);
    }
  });

  it('does not use any embedded template or embedded block scopes', async () => {
    const tokens = await tokenize(source, scopeName);
    const unexpected = tokens
      .flat()
      .filter((token) =>
        token.scopes.some(
          (scope) => scope.startsWith('meta.js.embeddedTemplate') || scope === 'meta.html.embedded.block',
        ),
      )
      .map((token) => `line ${token.line} ${JSON.stringify(token.text)}`);
    expect(unexpected).toEqual([]);
  });
});
