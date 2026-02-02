import Component from '@glimmer/component';

interface Signature {
  Args: { name: string };
}

export default class Greeting extends Component<Signature> {
  <template>
    <div class="greeting">
      <h1>Hello, {{@name}}!</h1>
      {{#if this.showDetails}}
        <p>Welcome to our app.</p>
      {{/if}}
    </div>

    <style>
      .greeting {
        padding: 1rem;
      }
    </style>
  </template>

  get showDetails() {
    return true;
  }
}
