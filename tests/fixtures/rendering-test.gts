import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import Counter from 'my-app/components/counter';

module('Integration | Component | counter', function (hooks) {
  setupRenderingTest(hooks);

  test('it increments', async function (assert) {
    const start = 2;

    await render(<template><Counter @start={{start}} /></template>);
    await click('button');

    assert.dom('output').hasText('3');
  });

  test('it yields the count', async function (assert) {
    await render(
      <template>
        <Counter as |count|>
          <span data-test-count>{{count}}</span>
        </Counter>
      </template>,
    );

    assert.dom('[data-test-count]').hasText('0');
  });
});
