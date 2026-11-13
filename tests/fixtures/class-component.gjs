import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';

export default class TodoList extends Component {
  @tracked items = [];
  @tracked filter = 'all';

  get visibleItems() {
    return this.filter === 'all' ? this.items : this.items.filter((item) => item.done);
  }

  @action
  toggle(item) {
    item.done = !item.done;
  }

  <template>
    <ul class="todo-list" ...attributes>
      {{#each this.visibleItems as |item index|}}
        <li class={{if item.done "done"}}>
          <input type="checkbox" checked={{item.done}} {{on "change" (fn this.toggle item)}} />
          {{index}}: {{item.title}}
        </li>
      {{else}}
        <li class="empty">Nothing to do</li>
      {{/each}}
    </ul>
  </template>
}
