import { hbs } from 'ember-cli-htmlbars';
import { render } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';

interface Context {
  name: string;
}

export async function setup(this: Context): Promise<void> {
  await render(hbs`<Greeting @name={{this.name}} as |g|>{{g.text}}</Greeting>`);
}

export const Precompiled = precompileTemplate(`<em>{{@text}}</em>`, {
  strictMode: true,
});

const generic: Array<string> = [];
const compared = generic.length < 1 && generic.length > -1;
