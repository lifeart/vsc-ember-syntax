import { describe, expect, it } from 'vitest';

import { findToken, tokenize, tokensForText, type Token } from '../helpers/tokenize';

// precompileTemplate can take a type argument, as in precompileTemplate<Signature>(...).
// The template string should be highlighted the same as without the type argument, and the
// type argument should be tokenized the same as in any other TypeScript generic call.
// Each example writes the type argument as TYPE_ARGUMENT.

const TYPE_ARGUMENT = /TYPE_ARGUMENT/g;

const calls: Record<string, string> = {
  'single quoted string': `const P = precompileTemplateTYPE_ARGUMENT('<em>{{@text}}</em>');`,
  'double quoted string': `const P = precompileTemplateTYPE_ARGUMENT("<em>{{@text}}</em>");`,
  'template literal and options':
    'const P = precompileTemplateTYPE_ARGUMENT(`<em>{{@text}}</em>`, { strictMode: true });',
  'template literal over several lines': `const P = precompileTemplateTYPE_ARGUMENT(
  \`<em>
    {{@text}}
  </em>\`,
  { strictMode: true },
);`,
};

const typeArguments: Record<string, string> = {
  'type name': '<Signature>',
  'object type': '<{ Args: { text: string } }>',
  'function type': '<{ Args: { onClick: () => void } }>',
  'function type with parameters': '<{ Args: { onChange: (value: string) => void } }>',
  'parenthesized type after an arrow': '<{ Args: { format: () => (string | number) } }>',
  'objects and functions nested several levels deep':
    '<{ Args: { config: { onSave: (data: { id: number; tags: Array<string> }) => Promise<void>; nested: { handler: (cb: (err: Error | null) => void) => void } } } }>',
  'several lines, as Prettier formats it': `<{
  Args: {
    text: string;
    onSave: (data: { id: number }) => void;
  };
}>`,
};

const AFTER = '\nconst after = 1;';

// The call's opening parenthesis is the first ( that is not inside the type argument.
function callParenIndex(all: Token[]): number {
  const index = all.findIndex((token) => token.text === '(' && !token.scopes.includes('meta.type.parameters.ts'));
  if (index === -1) {
    throw new Error('No call ( token found');
  }
  return index;
}

// Tokens after the call's opening parenthesis, reduced to text and scopes. Line numbers are
// left out because a type argument over several lines shifts them.
function tokensAfterCallParen(lines: Token[][]) {
  const all = lines.flat();
  return all.slice(callParenIndex(all) + 1).map(({ text, scopes }) => ({ text, scopes }));
}

// Tokens of the type argument, with only the scopes from meta.type.parameters.ts inwards,
// so the comparison ignores what surrounds it. Stops at the call's parenthesis when there is one.
function typeArgumentTokens(lines: Token[][]) {
  const all = lines.flat();
  const hasCall = all.some((token) => token.text === '(' && !token.scopes.includes('meta.type.parameters.ts'));
  return all
    .slice(0, hasCall ? callParenIndex(all) : all.length)
    .filter((token) => token.scopes.includes('meta.type.parameters.ts'))
    .map(({ text, scopes }) => ({ text, scopes: scopes.slice(scopes.indexOf('meta.type.parameters.ts')) }));
}

describe.each(['source.ts', 'source.gts'])('precompileTemplate with a type argument in %s', (scopeName) => {
  describe.each(Object.entries(typeArguments))('%s', (_typeName, typeArgument) => {
    describe.each(Object.entries(calls))('%s', (_callName, call) => {
      const withType = call.replace(TYPE_ARGUMENT, typeArgument) + AFTER;
      const withoutType = call.replace(TYPE_ARGUMENT, '') + AFTER;
      // The TypeScript grammar only recognises a generic function call up to a limited nesting depth,
      // so a type alias is used as the control. TypeScript parses its type arguments at any depth.
      const typeAlias = `type Control = Generic${typeArgument};`;

      it('scopes the template string as Handlebars', async () => {
        const tokens = await tokenize(withType, scopeName);
        const tagName = tokensForText(tokens, '<em>').flatMap((token) => token.scopes);
        expect(tagName).toContain('entity.name.tag.html.ember-handlebars');
        const argument = tokensForText(tokens, '@text').flatMap((token) => token.scopes);
        expect(argument).toContain('variable.language');
      });

      it('tokenizes the call arguments the same as without the type argument', async () => {
        const [actual, control] = await Promise.all([tokenize(withType, scopeName), tokenize(withoutType, scopeName)]);
        expect(tokensAfterCallParen(actual)).toEqual(tokensAfterCallParen(control));
      });

      it('tokenizes the type argument the same as in a TypeScript type alias', async () => {
        const [actual, control] = await Promise.all([tokenize(withType, scopeName), tokenize(typeAlias, scopeName)]);
        const typeTokens = typeArgumentTokens(actual);
        expect(typeTokens.length).toBeGreaterThan(0);
        expect(typeTokens).toEqual(typeArgumentTokens(control));
      });

      it('keeps TypeScript scopes on the type argument', async () => {
        const tokens = await tokenize(withType, scopeName);
        expect(findToken(tokens, '<').scopes).toContain('punctuation.definition.typeparameters.begin.ts');
      });

      it('returns to script scopes after the call', async () => {
        const tokens = await tokenize(withType, scopeName);
        const lastLine = tokens.at(-1) ?? [];
        expect(lastLine[0]?.scopes).toContain('storage.type.ts');
        expect(lastLine.filter((token) => token.scopes.some((scope) => scope.includes('ember-handlebars')))).toEqual(
          [],
        );
      });
    });
  });
});

// precompileTemplate<Signature> without a call is a valid TypeScript instantiation expression.
// It must not leave the grammar inside the precompileTemplate rule.
const withoutCall: Record<string, string> = {
  'followed by a semicolon': 'const T = precompileTemplate<Signature>;',
  'followed by a new line': 'const T = precompileTemplate<Signature>',
};

describe.each(['source.ts', 'source.gts'])('precompileTemplate with a type argument and no call in %s', (scopeName) => {
  describe.each(Object.entries(withoutCall))('%s', (_name, source) => {
    it('returns to script scopes on the next line', async () => {
      const tokens = await tokenize(source + AFTER, scopeName);
      const lastLine = tokens.at(-1) ?? [];
      expect(lastLine.map((token) => token.text)).toEqual(['const', ' ', 'after', ' ', '=', ' ', '1', ';']);
      expect(lastLine[0].scopes).toContain('storage.type.ts');
      expect(lastLine[2].scopes).toContain('variable.other.constant.ts');
    });
  });
});
