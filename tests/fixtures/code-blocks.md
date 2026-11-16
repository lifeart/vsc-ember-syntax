# Glimmer code blocks

A `gjs` block:

```gjs
import { on } from '@ember/modifier';

<template>
  <button {{on "click" @onClick}}>{{@label}}</button>
</template>
```

A `gts` block with a title after the language:

```gts title="counter.gts"
import Component from '@glimmer/component';

export default class Counter extends Component<{ Args: { start: number } }> {
  <template>
    <output>{{@start}}</output>
  </template>
}
```

A tilde fence:

~~~gjs
const Hello = <template>Hello</template>;
~~~

- A list item with an indented block:

  ```gjs
  <template>{{@item}}</template>
  ```

Text after the code blocks with `inline code`.
