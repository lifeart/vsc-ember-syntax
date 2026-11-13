// Template bodies for the nested <template> tests.
// Each body writes the tag under test as TAG. Tests replace TAG with "template" to get the
// source under test, and with "section" to get a control source that uses a normal HTML tag.
// Both sources must tokenize with the same scopes, apart from the tag name text.

export const TAG_PLACEHOLDER = /TAG/g;

export const nestedTemplateBodies: Record<string, string> = {
  'with attributes, one line': `<TAG id="row"><span>x</span></TAG>
<dialog open>After</dialog>`,

  'without attributes, one line': `<TAG><span>x</span></TAG>
<dialog open>After</dialog>`,

  'with attributes, several lines': `<TAG id="row">
  <span>x</span>
</TAG>
<dialog open>After</dialog>`,

  'without attributes, several lines': `<TAG>
  <span>x</span>
</TAG>
<dialog open>After</dialog>`,

  'with handlebars content': `<TAG id="row">
  <p>{{@title}}</p>
  {{#each @rows as |row|}}
    <Row @data={{row}} />
  {{/each}}
  <button type="button" {{on "click" this.go}}>Go</button>
</TAG>
<dialog open>After</dialog>`,

  'with mustache attribute values': `<TAG id={{this.id}} class="row {{if @active 'active'}}" shadowrootmode="open">
  <span>x</span>
</TAG>
<dialog open>After</dialog>`,

  'two siblings': `<TAG id="first"><span>a</span></TAG>
<TAG id="second">
  <span>b</span>
</TAG>
<dialog open>After</dialog>`,

  'inside another element': `<div class="wrapper">
  <TAG><span>x</span></TAG>
</div>
<dialog open>After</dialog>`,

  'three deep': `<TAG>
  <TAG id="middle">
    <TAG><span>x</span></TAG>
  </TAG>
</TAG>
<dialog open>After</dialog>`,

  'self-closing': `<TAG />
<TAG id="row" />
<dialog open>After</dialog>`,
};

function indent(text: string, spaces: number): string {
  const padding = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => padding + line)
    .join('\n');
}

// Ways a Glimmer <template> block can appear in a .gjs or .gts file. Each wraps a body in an outer
// <template> and ends with `const after = 1;` so tests can check the tokenizer returns to script.
export const outerTemplateForms: Record<string, (body: string) => string> = {
  'class body': (body) => `class Modal extends Component {
  <template>
${indent(body, 4)}
  </template>
}
const after = 1;`,

  'export default': (body) => `export default <template>
${indent(body, 2)}
</template>
const after = 1;`,

  'const assignment': (body) => `const Row = <template>
${indent(body, 2)}
</template>;
const after = 1;`,

  'function argument': (body) => `render(<template>
${indent(body, 2)}
</template>);
const after = 1;`,
};
