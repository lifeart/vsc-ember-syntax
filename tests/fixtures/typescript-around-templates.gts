import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

interface Signature<T> {
  Args: { items: T[]; compare?: (a: T, b: T) => number };
  Blocks: { default: [item: T, index: number]; empty: [] };
  Element: HTMLUListElement;
}

function first<T>(items: Array<T>): T | undefined {
  return items.length > 0 ? items[0] : undefined;
}

const identity = <T,>(value: T): T => value;
const isBetween = (n: number, min: number, max: number) => n > min && n < max;
const shifted = (1 << 4) >> 2 >>> 0;
const config = { retries: 3 } satisfies Record<string, number>;
let legacy = <string>(<unknown>'cast');

export default class SortedList<T> extends Component<Signature<T>> {
  @tracked private descending = false;

  get sorted(): T[] {
    const items = [...this.args.items];
    return this.args.compare ? items.sort(this.args.compare) : items;
  }

  <template>
    <ul ...attributes>
      {{#each this.sorted as |item index|}}
        <li>{{yield item index}}</li>
      {{else}}
        {{yield to="empty"}}
      {{/each}}
    </ul>
  </template>
}

export const after: Map<string, Set<number>> = new Map();
