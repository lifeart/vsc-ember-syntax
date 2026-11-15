import { describe } from 'vitest';

import { describeUnclosedMustacheTests } from './unclosed-mustache.cases';

describe('unclosed mustaches in a .hbs file', () => {
  describeUnclosedMustacheTests('text.html.ember-handlebars', (body) => body);
});
