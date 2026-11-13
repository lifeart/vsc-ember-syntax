import { describe } from 'vitest';

import { describeEscapedMustacheTests } from './escaped-mustache.cases';

describe('escaped mustaches in a .hbs file', () => {
  describeEscapedMustacheTests('text.html.ember-handlebars', (body) => body);
});
