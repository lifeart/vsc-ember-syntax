import Component from '@glimmer/component';

export default class Counter extends Component {
  count = 0;

  increment = () => {
    this.count++;
  };

  <template>
    <div class="counter">
      <span>Count: {{this.count}}</span>
      <button {{on "click" this.increment}}>
        Increment
      </button>
    </div>
  </template>
}
