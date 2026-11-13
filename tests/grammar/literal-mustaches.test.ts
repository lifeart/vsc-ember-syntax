import { describe } from 'vitest';

import { describeLiteralMustacheTests } from './literal-mustaches.cases';

describe.each(['source.gjs', 'source.gts'])('Handlebars literals in a <template> in %s', (scopeName) => {
  describeLiteralMustacheTests(scopeName, (body) => `<template>\n${body}\n</template>`);
});
