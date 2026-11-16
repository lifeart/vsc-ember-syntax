import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { comparableTokens, createTokenizer, tokenize, tokensForText, type Token } from '../helpers/tokenize';

// The markdown.glimmer.codeblock grammar is injected into every Markdown file. The build adds the
// Glimmer template rules to it, so templates in code blocks are highlighted. Those rules should only
// apply inside code blocks. In prose, a <template> tag or an hbs`...` call is plain Markdown.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const markdownGlimmer = JSON.parse(readFileSync(resolve(repoRoot, 'syntaxes/markdown.glimmer.codeblock.json'), 'utf8'));

// The control turns the injection off, which gives the scopes plain Markdown produces.
const withoutInjection = createTokenizer({
  grammars: new Map([['markdown.glimmer.codeblock', { ...markdownGlimmer, patterns: [] }]]),
});

const GLIMMER_SCOPE = /embeddedTemplate|ember-handlebars|tagged-template|\.js$|\.ts$/;

function glimmerTokens(lines: Token[][]): string[] {
  return lines
    .flat()
    .filter((token) => token.scopes.some((scope) => GLIMMER_SCOPE.test(scope)))
    .map((token) => `line ${token.line} ${JSON.stringify(token.text)}: ${token.scopes.slice(1).join(' ')}`);
}

const prose: Record<string, string> = {
  'template tag in a paragraph': 'Use a <template> tag in a gjs file.\n\nThe next paragraph.',
  'template tag followed by HTML in a paragraph': 'A <template> tag, then <b>bold</b> text.',
  'opening and closing template tags in separate paragraphs':
    'Open a block with <template>.\n\nClose it with </template>.\n\nThe last paragraph.',
  'template tag in a heading': '## The <template> tag\n\nA paragraph.',
  'template tag in a list item': '- Write a <template> tag\n- Then the next item',
  'template tag in a block quote': '> Write a <template> tag\n\nA paragraph.',
  'hbs tagged template in a paragraph': 'Call hbs`<b>{{name}}</b>` to make a template.',
  'hbs call in a paragraph': 'Call hbs("<b>{{name}}</b>") to make a template.',
  'precompileTemplate call in a paragraph': 'Call precompileTemplate("<p>{{name}}</p>") at build time.',
};

describe.each(Object.entries(prose))('%s', (_name, source) => {
  it('tokenizes the same as plain Markdown', async () => {
    const [actual, control] = await Promise.all([
      tokenize(source, 'text.html.markdown'),
      withoutInjection.tokenize(source, 'text.html.markdown'),
    ]);
    expect(comparableTokens(actual)).toEqual(comparableTokens(control));
  });

  it('does not use Glimmer, JavaScript or TypeScript scopes', async () => {
    expect(glimmerTokens(await tokenize(source, 'text.html.markdown'))).toEqual([]);
  });
});

// These already work and must keep working: templates in code blocks are highlighted.
const codeBlocks: Record<string, string> = {
  'gjs code block': '```gjs\nconst T = <template><b>{{x}}</b></template>;\n```',
  'gts code block': '```gts\nconst T = <template><b>{{x}}</b></template>;\n```',
  'js code block': '```js\nconst T = <template><b>{{x}}</b></template>;\n```',
  'ts code block': '```ts\nconst T = <template><b>{{x}}</b></template>;\n```',
  'js code block with an hbs tagged template': '```js\nconst T = hbs`<b>{{x}}</b>`;\n```',
};

describe.each(Object.entries(codeBlocks))('template in a %s', (_name, source) => {
  it('highlights the template content as Handlebars', async () => {
    const tokens = await tokenize(`${source}\n\nA paragraph after the code block.`, 'text.html.markdown');
    expect(tokensForText(tokens, '<b>').flatMap((token) => token.scopes)).toContain(
      'entity.name.tag.html.ember-handlebars',
    );
    expect(tokensForText(tokens, '{{').flatMap((token) => token.scopes)).toContain(
      'entity.expression.ember-handlebars',
    );
  });

  it('returns to plain Markdown after the code block', async () => {
    const tokens = await tokenize(`${source}\n\nA paragraph after the code block.`, 'text.html.markdown');
    const paragraph = tokensForText(tokens, 'A paragraph after');
    expect(paragraph.map((token) => token.scopes)).toEqual([['text.html.markdown', 'meta.paragraph.markdown']]);
  });
});
