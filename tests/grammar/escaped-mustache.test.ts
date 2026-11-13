import { describe } from 'vitest';

import { describeEscapedMustacheTests } from './escaped-mustache.cases';

describe.each(['source.gjs', 'source.gts'])('escaped mustaches in a <template> in %s', (scopeName) => {
  describeEscapedMustacheTests(scopeName, (body) => `<template>\n${body}\n</template>`);
});
