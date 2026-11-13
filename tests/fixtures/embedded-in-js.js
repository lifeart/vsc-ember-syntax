import { hbs } from 'ember-cli-htmlbars';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

const Tagged = hbs`<p class="tagged">{{@message}}</p>`;

const MultiLine = hbs`
  {{#if this.show}}
    <MyComponent @value={{this.value}} {{on "click" this.go}} />
  {{/if}}
`;

const WithNamespace = Ember.HTMLBars.hbs`<span>{{this.name}}</span>`;

const Called = hbs('<b>{{@bold}}</b>');

const Precompiled = precompileTemplate('<em>{{@text}}</em>', { strictMode: true });

const PrecompiledBacktick = precompileTemplate(
  `<section>
    {{yield}}
  </section>`,
  { strictMode: true, scope: () => ({}) },
);

const Created = createTemplate("<i>{{@italic}}</i>");

const Html = html`<div class="lit-style">${'not handlebars'}</div>`;

export default setComponentTemplate(hbs`<Tagged />`, templateOnly());

const notATemplate = `{{this}} is a plain string`;
const after = 1 < 2;
