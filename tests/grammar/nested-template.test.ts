import { describe, expect, it } from 'vitest';

import { comparableTokens, findToken, tokenize, tokensBetween, type Token } from '../helpers/tokenize';
import { nestedTemplateBodies, outerTemplateForms, TAG_PLACEHOLDER } from './nested-template.examples';

// A <template> tag inside a Glimmer <template> block is a plain HTML element as far as the
// grammar is concerned. It must be scoped like any other tag and must not open a second
// embedded template. Glimmer itself rejects nested and self-closing <template> tags, but the
// grammar still has to tokenize them without breaking.

const languages = [
  { scopeName: 'source.gts', suffix: 'ts' },
  { scopeName: 'source.gjs', suffix: 'js' },
];

const EMBEDDED_TEMPLATE_SCOPES = ['meta.js.embeddedTemplateWithoutArgs', 'meta.js.embeddedTemplateWithArgs'];

function embeddedTemplateDepth(token: Token): number {
  return token.scopes.filter((scope) => EMBEDDED_TEMPLATE_SCOPES.includes(scope)).length;
}

// Tokenizes the example with TAG as "template", and a control copy with TAG as "section".
async function tokenizeWithControl(example: string, scopeName: string) {
  const [actual, control] = await Promise.all([
    tokenize(example.replace(TAG_PLACEHOLDER, 'template'), scopeName),
    tokenize(example.replace(TAG_PLACEHOLDER, 'section'), scopeName),
  ]);
  return { actual, control };
}

// The outer Glimmer template is the first and last "template" token in each example.
function outerTemplateNames(lines: Token[][]): { open: Token; close: Token } {
  const names = lines.flat().filter((token) => token.text === 'template');
  const open = names.at(0);
  const close = names.at(-1);
  if (!open || !close || open === close) {
    throw new Error('Expected an outer <template> opening and closing tag');
  }
  return { open, close };
}

// Line tokens as [text, ...scopes after the shared prefix], skipping whitespace-only tokens.
function lineTokensAfterPrefix(lines: Token[][], line: number, prefix: string[]): string[][] {
  return lines[line]
    .filter((token) => token.text.trim() !== '')
    .map((token) => {
      expect(token.scopes.slice(0, prefix.length), `prefix of ${JSON.stringify(token.text)}`).toEqual(prefix);
      return [token.text, ...token.scopes.slice(prefix.length)];
    });
}

describe.each(languages)('nested <template> tag in $scopeName', ({ scopeName, suffix }) => {
  describe.each(Object.entries(outerTemplateForms))('outer template as %s', (_formName, wrap) => {
    describe.each(Object.entries(nestedTemplateBodies))('%s', (_bodyName, body) => {
      const example = wrap(body);

      it('tokenizes the same as a <section> tag in the same place', async () => {
        const { actual, control } = await tokenizeWithControl(example, scopeName);
        expect(comparableTokens(actual)).toEqual(comparableTokens(control, { from: 'section', to: 'template' }));
      });

      it('keeps every token inside the outer template at one embedded template level', async () => {
        const { actual } = await tokenizeWithControl(example, scopeName);
        const { open, close } = outerTemplateNames(actual);
        const inside = tokensBetween(actual, open, close);
        expect(inside.length).toBeGreaterThan(0);
        const wrongDepth = inside
          .filter((token) => embeddedTemplateDepth(token) !== 1)
          .map((token) => `line ${token.line} ${JSON.stringify(token.text)}: depth ${embeddedTemplateDepth(token)}`);
        expect(wrongDepth).toEqual([]);
      });

      it('does not scope anything inside the outer template as meta.html.embedded.block', async () => {
        const { actual } = await tokenizeWithControl(example, scopeName);
        const { open, close } = outerTemplateNames(actual);
        const embeddedBlocks = tokensBetween(actual, open, close)
          .filter((token) => token.scopes.includes('meta.html.embedded.block'))
          .map((token) => `line ${token.line} ${JSON.stringify(token.text)}`);
        expect(embeddedBlocks).toEqual([]);
      });

      it('scopes every inner <template> tag name as a normal HTML tag name', async () => {
        const { actual } = await tokenizeWithControl(example, scopeName);
        const { open, close } = outerTemplateNames(actual);
        const innerNames = tokensBetween(actual, open, close).filter((token) => token.text === 'template');
        expect(innerNames.length).toBeGreaterThan(0);
        for (const name of innerNames) {
          expect(name.scopes, `line ${name.line}`).toContain('meta.tag.any.ember-handlebars');
          expect(name.scopes, `line ${name.line}`).toContain('entity.name.tag.html.ember-handlebars');
          expect(name.scopes, `line ${name.line}`).not.toContain('entity.name.tag.other.html');
        }
      });

      it('scopes the outer <template> tags as the Glimmer template boundary', async () => {
        const { actual } = await tokenizeWithControl(example, scopeName);
        const { open, close } = outerTemplateNames(actual);
        for (const name of [open, close]) {
          expect(name.scopes, `line ${name.line}`).toContain('entity.name.tag.other.html');
          expect(embeddedTemplateDepth(name), `line ${name.line}`).toBe(1);
        }
      });

      it('scopes the <dialog> after the inner template as a normal tag', async () => {
        const { actual } = await tokenizeWithControl(example, scopeName);
        const dialog = findToken(actual, 'dialog');
        expect(dialog.scopes).toContain('meta.tag.any.ember-handlebars');
        expect(dialog.scopes).toContain('entity.name.tag.html.ember-handlebars');
        expect(embeddedTemplateDepth(dialog)).toBe(1);
      });

      it('returns to script scopes after the outer template', async () => {
        const { actual } = await tokenizeWithControl(example, scopeName);
        // Every outer form ends with `const after = 1;` on the last line.
        const lastLine = actual.at(-1) ?? [];
        expect(lastLine.map((token) => token.text)).toEqual(['const', ' ', 'after', ' ', '=', ' ', '1', ';']);
        const [constKeyword, , after] = lastLine;
        expect(constKeyword.scopes).toContain(`storage.type.${suffix}`);
        expect(after.scopes).toContain(`variable.other.constant.${suffix}`);
        expect(lastLine.filter((token) => embeddedTemplateDepth(token) > 0)).toEqual([]);
      });
    });
  });

  describe('exact scopes in a class body', () => {
    const prefix = [scopeName, `meta.class.${suffix}`, 'meta.js.embeddedTemplateWithoutArgs'];
    const tag = 'meta.tag.any.ember-handlebars';
    const name = 'entity.name.tag.html.ember-handlebars';
    const punctuation = 'punctuation.definition.tag';
    const attribute = 'entity.other.attribute-name.ember-handlebars';
    const equals = 'punctuation.separator.key-value.html.ember-handlebars';
    const string = 'string.quoted.double.html.ember-handlebars';
    const stringBegin = 'punctuation.definition.string.begin.ember-handlebars';
    const stringEnd = 'punctuation.definition.string.end.ember-handlebars';

    it('scopes every token of an inner <template> on one line', async () => {
      const source = outerTemplateForms['class body'](nestedTemplateBodies['with attributes, one line']).replace(
        TAG_PLACEHOLDER,
        'template',
      );
      const tokens = await tokenize(source, scopeName);
      expect(lineTokensAfterPrefix(tokens, 2, prefix)).toEqual([
        ['<', tag, punctuation],
        ['template', tag, name],
        ['id', tag, attribute],
        ['=', tag, equals],
        ['"', tag, string, stringBegin],
        ['row', tag, string],
        ['"', tag, string, stringEnd],
        ['>', tag, punctuation],
        ['<', tag, punctuation],
        ['span', tag, name],
        ['>', tag, punctuation],
        ['x'],
        ['</', tag, punctuation],
        ['span', tag, name],
        ['>', tag, punctuation],
        ['</', tag, punctuation],
        ['template', tag, name],
        ['>', tag, punctuation],
      ]);
    });

    it('scopes every token of an inner <template> over several lines', async () => {
      const source = outerTemplateForms['class body'](nestedTemplateBodies['with attributes, several lines']).replace(
        TAG_PLACEHOLDER,
        'template',
      );
      const tokens = await tokenize(source, scopeName);
      expect(lineTokensAfterPrefix(tokens, 2, prefix)).toEqual([
        ['<', tag, punctuation],
        ['template', tag, name],
        ['id', tag, attribute],
        ['=', tag, equals],
        ['"', tag, string, stringBegin],
        ['row', tag, string],
        ['"', tag, string, stringEnd],
        ['>', tag, punctuation],
      ]);
      expect(lineTokensAfterPrefix(tokens, 3, prefix)).toEqual([
        ['<', tag, punctuation],
        ['span', tag, name],
        ['>', tag, punctuation],
        ['x'],
        ['</', tag, punctuation],
        ['span', tag, name],
        ['>', tag, punctuation],
      ]);
      expect(lineTokensAfterPrefix(tokens, 4, prefix)).toEqual([
        ['</', tag, punctuation],
        ['template', tag, name],
        ['>', tag, punctuation],
      ]);
    });

    it('scopes every token of a self-closing inner <template>', async () => {
      const source = outerTemplateForms['class body'](nestedTemplateBodies['self-closing']).replace(
        TAG_PLACEHOLDER,
        'template',
      );
      const tokens = await tokenize(source, scopeName);
      expect(lineTokensAfterPrefix(tokens, 2, prefix)).toEqual([
        ['<', tag, punctuation],
        ['template', tag, name],
        ['/', tag, punctuation],
        ['>', tag, punctuation],
      ]);
      expect(lineTokensAfterPrefix(tokens, 3, prefix)).toEqual([
        ['<', tag, punctuation],
        ['template', tag, name],
        ['id', tag, attribute],
        ['=', tag, equals],
        ['"', tag, string, stringBegin],
        ['row', tag, string],
        ['"', tag, string, stringEnd],
        ['/', tag, punctuation],
        ['>', tag, punctuation],
      ]);
    });
  });
});

describe('nested <template> tag followed by TypeScript in source.gts', () => {
  const example = `class Modal extends Component {
  <template>
    <TAG id="row"><span>x</span></TAG>
  </template>
}
let value: Array<string> = [];`;

  it('tokenizes the same as a <section> tag in the same place', async () => {
    const { actual, control } = await tokenizeWithControl(example, 'source.gts');
    expect(comparableTokens(actual)).toEqual(comparableTokens(control, { from: 'section', to: 'template' }));
  });

  it('scopes the type annotation after the class as TypeScript', async () => {
    const { actual } = await tokenizeWithControl(example, 'source.gts');
    expect(findToken(actual, 'Array').scopes).toEqual(
      expect.arrayContaining(['meta.type.annotation.ts', 'entity.name.type.ts']),
    );
    expect(findToken(actual, 'string').scopes).toEqual(
      expect.arrayContaining(['meta.type.annotation.ts', 'support.type.primitive.ts']),
    );
    expect(embeddedTemplateDepth(findToken(actual, 'Array'))).toBe(0);
  });
});

describe.each(['gjs', 'gts'])('nested <template> tag in a markdown %s code block', (fence) => {
  const example = `# Example

\`\`\`${fence}
${outerTemplateForms['class body'](nestedTemplateBodies['with attributes, one line'])}
\`\`\`

Text after the code block.
`;

  it('tokenizes the same as a <section> tag in the same place', async () => {
    const { actual, control } = await tokenizeWithControl(example, 'text.html.markdown');
    expect(comparableTokens(actual)).toEqual(comparableTokens(control, { from: 'section', to: 'template' }));
  });

  it('scopes the inner <template> tag names as normal HTML tag names', async () => {
    const { actual } = await tokenizeWithControl(example, 'text.html.markdown');
    for (const occurrence of [2, 3]) {
      const name = findToken(actual, 'template', occurrence);
      expect(name.scopes).toContain(`meta.embedded.block.${fence}`);
      expect(name.scopes).toContain('entity.name.tag.html.ember-handlebars');
      expect(embeddedTemplateDepth(name)).toBe(1);
    }
  });

  it('returns to markdown after the code block', async () => {
    const { actual } = await tokenizeWithControl(example, 'text.html.markdown');
    expect(findToken(actual, 'Text after').scopes).toEqual(['text.html.markdown', 'meta.paragraph.markdown']);
  });
});
