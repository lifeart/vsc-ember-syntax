import Component from '@glimmer/component';
import { on } from '@ember/modifier';

interface Signature {
  Args: { title: string };
}

export default class Greeting extends Component<Signature> {
  count = 0;

  <template>
    <h1 class="title">{{@title}}</h1>
    <button type="button" {{on "click" this.increment}}>{{this.count}}</button>
  </template>
}
