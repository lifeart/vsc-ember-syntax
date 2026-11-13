import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
import autoFocus from './auto-focus';
import track_clicks from './track-clicks';
import Ui from './ui';

export default class Dashboard extends Component {
  <template>
    <Ui::Panel::Header @title="Dashboard" @collapsed={{this.collapsed}} class="header" ...attributes />
    <this.WidgetComponent @config={{this.config}} />
    <@itemComponent @item={{@item}} />
    <Ui.Button @kind="primary" disabled {{on "click" this.save}}>Save</Ui.Button>

    <Ui::Card as |card index|>
      <card.Title>Item {{index}}</card.Title>
    </Ui::Card>

    <Ui::Layout>
      <:header as |h|>
        <h.Title>Header</h.Title>
      </:header>
      <:body>
        <input
          type="text"
          value={{this.query}}
          {{autoFocus}}
          {{track_clicks "search"}}
          {{didInsert this.setup}}
          {{on "input" this.updateQuery}}
        />
      </:body>
    </Ui::Layout>

    <div class="wrapper {{if @wide 'wide'}}" data-test-id={{@id}} aria-hidden="true"></div>
    <br />
    <img src="a.png" alt="">
  </template>
}
