// with attributes, one line
class Example1 extends Component {
  <template>
    <template id="row"><span>x</span></template>
    <dialog open>After</dialog>
  </template>
}

// without attributes, one line
class Example2 extends Component {
  <template>
    <template><span>x</span></template>
    <dialog open>After</dialog>
  </template>
}

// with attributes, several lines
class Example3 extends Component {
  <template>
    <template id="row">
      <span>x</span>
    </template>
    <dialog open>After</dialog>
  </template>
}

// without attributes, several lines
class Example4 extends Component {
  <template>
    <template>
      <span>x</span>
    </template>
    <dialog open>After</dialog>
  </template>
}

// with handlebars content
class Example5 extends Component {
  <template>
    <template id="row">
      <p>{{@title}}</p>
      {{#each @rows as |row|}}
        <Row @data={{row}} />
      {{/each}}
      <button type="button" {{on "click" this.go}}>Go</button>
    </template>
    <dialog open>After</dialog>
  </template>
}

// with mustache attribute values
class Example6 extends Component {
  <template>
    <template id={{this.id}} class="row {{if @active 'active'}}" shadowrootmode="open">
      <span>x</span>
    </template>
    <dialog open>After</dialog>
  </template>
}

// two siblings
class Example7 extends Component {
  <template>
    <template id="first"><span>a</span></template>
    <template id="second">
      <span>b</span>
    </template>
    <dialog open>After</dialog>
  </template>
}

// inside another element
class Example8 extends Component {
  <template>
    <div class="wrapper">
      <template><span>x</span></template>
    </div>
    <dialog open>After</dialog>
  </template>
}

// three deep
class Example9 extends Component {
  <template>
    <template>
      <template id="middle">
        <template><span>x</span></template>
      </template>
    </template>
    <dialog open>After</dialog>
  </template>
}

// self-closing
class Example10 extends Component {
  <template>
    <template />
    <template id="row" />
    <dialog open>After</dialog>
  </template>
}

const after = 1;
