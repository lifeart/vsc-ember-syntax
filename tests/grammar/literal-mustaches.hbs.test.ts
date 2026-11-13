import { describe } from 'vitest';

import { describeLiteralMustacheTests } from './literal-mustaches.cases';

describe('Handlebars literals in a .hbs file', () => {
  describeLiteralMustacheTests('text.html.ember-handlebars', (body) => body);
});
