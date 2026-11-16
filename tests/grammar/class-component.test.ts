import { describe, expect, it } from 'vitest';

import { findToken, tokenize } from '../helpers/tokenize';

const source = `export default class Greeting extends Component {
  <template>
    <h1>{{@title}}</h1>
    <button {{on "click" this.increment}}>{{this.count}}</button>
  </template>
}`;

describe('class component in .gts', () => {
  it('scopes the template body as an embedded template inside the class', async () => {
    const tokens = await tokenize(source, 'source.gts');
    expect(findToken(tokens, 'template').scopes).toEqual(
      expect.arrayContaining(['meta.class.ts', 'meta.js.embeddedTemplateWithoutArgs', 'entity.name.tag.other.html']),
    );
  });

  it('scopes @ in an argument as variable.language', async () => {
    const tokens = await tokenize(source, 'source.gts');
    expect(findToken(tokens, '@').scopes).toContain('variable.language');
    expect(findToken(tokens, 'title').scopes).toContain('support.function');
  });

  it('scopes this in a modifier argument as variable.language', async () => {
    const tokens = await tokenize(source, 'source.gts');
    expect(findToken(tokens, 'this').scopes).toEqual(
      expect.arrayContaining(['meta.tag.any.ember-handlebars', 'variable.language']),
    );
  });

  it('returns to TypeScript scopes after the template closes', async () => {
    const tokens = await tokenize(`${source}\nconst x = 1;`, 'source.gts');
    expect(findToken(tokens, 'const').scopes).toContain('storage.type.ts');
    expect(findToken(tokens, 'const').scopes).not.toContain('meta.js.embeddedTemplateWithoutArgs');
  });
});
