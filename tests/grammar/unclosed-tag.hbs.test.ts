import { describe } from 'vitest';

import { describeUnclosedTagTests } from './unclosed-tag.cases';

describe('unclosed tags in a .hbs file', () => {
  describeUnclosedTagTests('text.html.ember-handlebars', (body) => body);
});
