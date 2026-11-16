import { describe, expect, it } from 'vitest';

import { findToken, tokenize, type Token } from '../helpers/tokenize';

// These tests cover the parts of the grammar a change is most likely to break:
// where a <template> block starts and ends, and text that looks like a template but is not one.

const languages = [
  { scopeName: 'source.gts', suffix: 'ts' },
  { scopeName: 'source.gjs', suffix: 'js' },
];

const EMBEDDED_TEMPLATE_SCOPES = ['meta.js.embeddedTemplateWithoutArgs', 'meta.js.embeddedTemplateWithArgs'];

function inTemplate(token: Token): boolean {
  return token.scopes.some((scope) => EMBEDDED_TEMPLATE_SCOPES.includes(scope));
}

function tokensInTemplate(lines: Token[][]): string[] {
  return lines
    .flat()
    .filter(inTemplate)
    .map((token) => `line ${token.line} ${JSON.stringify(token.text)}`);
}

// Each form has one template containing <p>{{@x}}</p>, followed by `const after = 1;` on the last line.
const templateForms: Record<string, string> = {
  'top level': `<template><p>{{@x}}</p></template>
const after = 1;`,
  'export default': `export default <template><p>{{@x}}</p></template>
const after = 1;`,
  'const assignment': `const Foo = <template><p>{{@x}}</p></template>;
const after = 1;`,
  'object property': `const map = { Foo: <template><p>{{@x}}</p></template> };
const after = 1;`,
  'array element': `const list = [<template><p>{{@x}}</p></template>];
const after = 1;`,
  'function argument': `render(<template><p>{{@x}}</p></template>);
const after = 1;`,
  'arrow function body': `const make = () => <template><p>{{@x}}</p></template>;
const after = 1;`,
  'class body': `class Foo extends Component {
  <template><p>{{@x}}</p></template>
}
const after = 1;`,
  'several lines': `const Foo = <template>
  <p>
    {{@x}}
  </p>
</template>;
const after = 1;`,
  'two templates on one line': `const A = <template><p>{{@x}}</p></template>; const B = <template><p>{{@x}}</p></template>;
const after = 1;`,
};

describe.each(languages)('template boundaries in $scopeName', ({ scopeName, suffix }) => {
  describe.each(Object.entries(templateForms))('%s', (_name, source) => {
    it('scopes the opening and closing template tags as the template boundary', async () => {
      const tokens = await tokenize(source, scopeName);
      const names = tokens.flat().filter((token) => token.text === 'template');
      expect(names.length).toBeGreaterThanOrEqual(2);
      for (const name of names) {
        expect(name.scopes, `line ${name.line}`).toContain('entity.name.tag.other.html');
        expect(
          name.scopes.filter((scope) => EMBEDDED_TEMPLATE_SCOPES.includes(scope)),
          `line ${name.line}`,
        ).toHaveLength(1);
      }
    });

    it('scopes the template content as Handlebars', async () => {
      const tokens = await tokenize(source, scopeName);
      const p = findToken(tokens, 'p');
      expect(p.scopes).toContain('entity.name.tag.html.ember-handlebars');
      expect(inTemplate(p)).toBe(true);
      expect(findToken(tokens, '@').scopes).toContain('variable.language');
    });

    it('returns to script scopes on the next line', async () => {
      const tokens = await tokenize(source, scopeName);
      const lastLine = tokens.at(-1) ?? [];
      expect(lastLine.map((token) => token.text)).toEqual(['const', ' ', 'after', ' ', '=', ' ', '1', ';']);
      expect(lastLine[0].scopes).toContain(`storage.type.${suffix}`);
      expect(lastLine[2].scopes).toContain(`variable.other.constant.${suffix}`);
      expect(lastLine.filter(inTemplate)).toEqual([]);
    });
  });
});

// Text that contains `<` or the word template but is not a Glimmer template.
const notTemplates: Record<string, string> = {
  'less than comparison': 'const a = b < c && d > e;',
  'comparison with no spaces': 'const a = b<c;',
  'shift operators': 'const a = (1 << 2) >> 1 >>> 0;',
  'string containing a template tag': `const a = '<template>{{@x}}</template>';`,
  'double quoted string containing a template tag': `const a = "<template>";`,
  'template literal containing a template tag': 'const a = `<template>{{@x}}</template>`;',
  'line comment containing a template tag': '// <template>{{@x}}</template>',
  'block comment containing a template tag': '/* <template> */',
  'identifier named template': 'const template = 1; template < 2;',
  'property named template': 'this.template = obj.template;',
  'regular expression containing a template tag': 'const re = /<template>/g;',
};

const typeScriptOnly: Record<string, string> = {
  'generic function': 'function first<T>(items: T[]): T { return items[0]; }',
  'generic type annotation': 'const a: Array<string> = [];',
  'nested generics': 'const a: Map<string, Set<number>> = new Map();',
  'generic arrow function': 'const id = <T,>(value: T): T => value;',
  'type assertion': 'const a = <string>value;',
  'generic call': 'const a = make<Foo>(1);',
  'generic class': 'class List<T> extends Base<T> {}',
  'satisfies with generic': 'const a = {} satisfies Record<string, number>;',
};

describe.each(languages)('text that is not a template in $scopeName', ({ scopeName }) => {
  const examples = scopeName === 'source.gts' ? { ...notTemplates, ...typeScriptOnly } : notTemplates;

  describe.each(Object.entries(examples))('%s', (_name, line) => {
    it('does not open a template', async () => {
      const tokens = await tokenize(`${line}\nconst after = 1;`, scopeName);
      expect(tokensInTemplate(tokens)).toEqual([]);
    });
  });
});

describe.each(languages)('<style> and <script> inside a template in $scopeName', ({ scopeName, suffix }) => {
  const source = `<template>
  <style>
    .card { color: red; }
  </style>
  <script>
    const inScript = 1 < 2;
  </script>
  <p class="card">{{@x}}</p>
</template>
const after = 1;`;

  it('scopes <style> content as CSS', async () => {
    const tokens = await tokenize(source, scopeName);
    const card = findToken(tokens, 'card');
    expect(card.scopes).toEqual(expect.arrayContaining(['source.css', 'entity.other.attribute-name.class.css']));
    expect(findToken(tokens, 'color').scopes).toContain('support.type.property-name.css');
  });

  it('scopes <script> content as JavaScript', async () => {
    const tokens = await tokenize(source, scopeName);
    expect(findToken(tokens, 'inScript').scopes).toEqual(
      expect.arrayContaining(['source.js', 'variable.other.constant.js']),
    );
    const scriptLine = tokens[findToken(tokens, 'inScript').line];
    const lessThan = scriptLine.find((token) => token.text === '<');
    expect(lessThan?.scopes).toContain('keyword.operator.relational.js');
  });

  it('returns to Handlebars after </style> and </script>', async () => {
    const tokens = await tokenize(source, scopeName);
    const p = findToken(tokens, 'p');
    expect(p.scopes).toContain('entity.name.tag.html.ember-handlebars');
    expect(p.scopes).not.toContain('source.css');
    expect(p.scopes).not.toContain('source.js');
  });

  it('returns to script scopes after the template', async () => {
    const tokens = await tokenize(source, scopeName);
    const after = findToken(tokens, 'after');
    expect(after.scopes).toContain(`variable.other.constant.${suffix}`);
    expect(inTemplate(after)).toBe(false);
  });
});
