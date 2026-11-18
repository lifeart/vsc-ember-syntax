import { describe } from 'vitest';

import { describeUnclosedMustacheTests } from './unclosed-mustache.cases';

describe.each(['source.gjs', 'source.gts'])('unclosed mustaches in a <template> in %s', (scopeName) => {
  describeUnclosedMustacheTests(scopeName, (body) => `<template>\n${body}\n</template>`);
});
