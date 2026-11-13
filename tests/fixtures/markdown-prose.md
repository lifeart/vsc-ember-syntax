# The <template> tag

Use a <template> tag in a gjs file, then <b>bold</b> text.

Call hbs`<b>{{name}}</b>` or precompileTemplate("<p>{{name}}</p>") to make a template.

- Write a <template> tag
- Then the next item

> Write a <template> tag in a quote.

```gjs
const Greeting = <template>
  <template id="row"><span>{{@name}}</span></template>
</template>;
```

```js
const T = <template><b>{{x}}</b></template>;
const H = hbs`<b>{{x}}</b>`;
```

A paragraph after the code blocks.
