import Component from '@glimmer/component';
import type { TOC } from '@ember/component/template-only';

interface RowSignature {
  Args: { label: string; value: number };
}

const Row: TOC<RowSignature> = <template>
  <tr><th>{{@label}}</th><td>{{@value}}</td></tr>
</template>;

const components = {
  Empty: <template><p>No rows</p></template>,
  Footer: <template><tfoot><tr><td colspan="2">{{yield}}</td></tr></tfoot></template>,
};

export class Table extends Component<{ Args: { rows: RowSignature['Args'][] } }> {
  <template>
    <table>
      {{#each @rows as |row|}}
        <Row @label={{row.label}} @value={{row.value}} />
      {{else}}
        <components.Empty />
      {{/each}}
      <components.Footer>Total: {{@rows.length}}</components.Footer>
    </table>
  </template>
}

export default <template>
  <Table @rows={{@rows}} />
</template>
