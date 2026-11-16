import { describe } from 'vitest';

import { describeUnclosedTagTests } from './unclosed-tag.cases';

describe.each(['source.gjs', 'source.gts'])('unclosed tags in a <template> in %s', (scopeName) => {
  describeUnclosedTagTests(scopeName, (body) => `<template>\n${body}\n</template>`);
});
