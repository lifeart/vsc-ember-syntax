import { describe, expect, it } from 'vitest';

import { findToken, tokenize, tokensForText, type Token } from '../helpers/tokenize';

// precompileTemplate can take a type argument, as in precompileTemplate<Signature>(...).
// The template string should be highlighted the same as without the type argument.
// Each example writes the type argument as TYPE_ARGUMENT. The control copy removes it.

const TYPE_ARGUMENT = /TYPE_ARGUMENT/g;

const examples: Record<string, { source: string; typeArgument: string }> = {
  'type name, single quoted string': {
    source: `const P = precompileTemplateTYPE_ARGUMENT('<em>{{@text}}</em>');`,
    typeArgument: '<Signature>',
  },
  'type name, double quoted string': {
    source: `const P = precompileTemplateTYPE_ARGUMENT("<em>{{@text}}</em>");`,
    typeArgument: '<Signature>',
  },
  'object type, template literal and options': {
    source: 'const P = precompileTemplateTYPE_ARGUMENT(`<em>{{@text}}</em>`, { strictMode: true });',
    typeArgument: '<{ Args: { text: string } }>',
  },
  'template literal over several lines': {
    source: `const P = precompileTemplateTYPE_ARGUMENT(
  \`<em>
    {{@text}}
  </em>\`,
  { strictMode: true },
);`,
    typeArgument: '<Signature>',
  },
};

const AFTER = '\nconst after = 1;';

// Tokens after the call's opening parenthesis, reduced to line, text and scopes.
function tokensAfterOpenParen(lines: Token[][]) {
  const all = lines.flat();
  const openParen = all.findIndex((token) => token.text === '(');
  if (openParen === -1) {
    throw new Error('No ( token found');
  }
  return all.slice(openParen + 1).map(({ line, text, scopes }) => ({ line, text, scopes }));
}

describe.each(['source.ts', 'source.gts'])('precompileTemplate with a type argument in %s', (scopeName) => {
  describe.each(Object.entries(examples))('%s', (_name, { source, typeArgument }) => {
    const withType = source.replace(TYPE_ARGUMENT, typeArgument) + AFTER;
    const withoutType = source.replace(TYPE_ARGUMENT, '') + AFTER;

    it('scopes the template string as Handlebars', async () => {
      const tokens = await tokenize(withType, scopeName);
      const tagName = tokensForText(tokens, 'em').flatMap((token) => token.scopes);
      expect(tagName).toContain('entity.name.tag.html.ember-handlebars');
      const argument = tokensForText(tokens, '@text').flatMap((token) => token.scopes);
      expect(argument).toContain('variable.language');
    });

    it('tokenizes the call arguments the same as without the type argument', async () => {
      const [actual, control] = await Promise.all([tokenize(withType, scopeName), tokenize(withoutType, scopeName)]);
      expect(tokensAfterOpenParen(actual)).toEqual(tokensAfterOpenParen(control));
    });

    it('keeps TypeScript scopes on the type argument', async () => {
      const tokens = await tokenize(withType, scopeName);
      const typeStart = findToken(tokens, '<');
      expect(typeStart.scopes).toContain('punctuation.definition.typeparameters.begin.ts');
    });

    it('returns to script scopes after the call', async () => {
      const tokens = await tokenize(withType, scopeName);
      const lastLine = tokens.at(-1) ?? [];
      expect(lastLine[0]?.scopes).toContain('storage.type.ts');
      expect(lastLine.filter((token) => token.scopes.some((scope) => scope.includes('ember-handlebars')))).toEqual([]);
    });
  });
});
