import glimmerJavascriptSource from './source.gjs.mjs';
import glimmerTypescriptSource from './source.gts.mjs';
import inlineHandlebarsSource from './inline.hbs.mjs';
import inlineTemplateSource from './inline.template.mjs';
import emberHandlebarsSource from './text.html.ember-handlebars.mjs';
import markdownGlimmerSource from './markdown.glimmer.codeblock.mjs';

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeGlimmerSourceGrammars(grammar, injectionSelector, { emberHandlebars, inlineTemplate, inlineHandlebars }) {
  // copy patterns and repository to avoid mutating the original grammars
  const copiedEmberHandlebarPatterns = deepCopy(emberHandlebars.patterns);
  const copiedEmberHandlebarRepository = deepCopy(emberHandlebars.repository);
  const copiedInlineTemplatePatterns = deepCopy(inlineTemplate.patterns);
  const copiedInlineHandlebarsPatterns = deepCopy(inlineHandlebars.patterns);

  grammar.injections = {
    [injectionSelector]: {
      patterns: [{ include: '#main' }],
    },
  };

  grammar.patterns.unshift({ include: '#main' });

  grammar.repository = {
    main: {
      patterns: [...copiedInlineTemplatePatterns, ...copiedInlineHandlebarsPatterns],
    },
    ...copiedEmberHandlebarRepository,
  };

  // The content of a <template> block. A nested <template> element comes first, so that its closing tag
  // does not end the outer block.
  const templateContentPatterns = () => [
    { include: '#nested-template-element' },
    ...deepCopy(copiedEmberHandlebarPatterns),
  ];

  grammar.repository['nested-template-element'].patterns.find((pattern) => pattern.begin === '(>)').patterns =
    templateContentPatterns();

  // Embedded Template With Args
  const embeddedTemplateWithArgs = grammar.repository.main.patterns.find(
    (pattern) => pattern.name === 'meta.js.embeddedTemplateWithArgs',
  );
  embeddedTemplateWithArgs.patterns.find((pattern) => pattern.begin === '(>)').patterns = templateContentPatterns();

  const tagLikeContent = embeddedTemplateWithArgs.patterns.find((pattern) => pattern.begin === '(?<=\\<template)');
  tagLikeContent.patterns = [
    {
      include: '#tag-like-content',
    },
  ];

  // Embedded Template Without Args
  const embeddedTemplateWithoutArgs = grammar.repository.main.patterns.find(
    (pattern) => pattern.name === 'meta.js.embeddedTemplateWithoutArgs',
  );
  embeddedTemplateWithoutArgs.patterns = templateContentPatterns();

  // Tagged template (hbs/html)
  const taggedTemplate = grammar.repository.main.patterns.find(
    (pattern) => pattern.begin === '(?x)(\\b(?:\\w+\\.)*(?:hbs|html)\\s*)(`)',
  );
  const filteredPatterns = taggedTemplate.patterns.filter(
    (pattern) => pattern.include !== 'text.html.ember-handlebars',
  );
  taggedTemplate.patterns = [...filteredPatterns, ...copiedEmberHandlebarPatterns];

  // createTemplate/hbs/html functions
  const createTemplate = grammar.repository.main.patterns
    .find((pattern) => pattern.begin === '((createTemplate|hbs|html))(\\()')
    .patterns.find((pattern) => pattern.begin === '((`|\'|"))');

  createTemplate.patterns = [...copiedEmberHandlebarPatterns];

  // precompileTemplate function. The template string rule is inside the rule for the call's parentheses.
  const precompileTemplate = grammar.repository.main.patterns
    .find((pattern) => pattern.begin?.startsWith('((precompileTemplate)\\s*)'))
    .patterns.find((pattern) => pattern.begin === '(\\()')
    .patterns.find((pattern) => pattern.begin === '((`|\'|"))');

  precompileTemplate.patterns = [...copiedEmberHandlebarPatterns];
}

function mergeMarkdownGrammar(markdownGlimmer, { inlineTemplate, inlineHandlebars }) {
  const copiedInlineTemplatePatterns = deepCopy(inlineTemplate.patterns);
  const copiedInlineHandlebarsPatterns = deepCopy(inlineHandlebars.patterns);

  markdownGlimmer.patterns.push(...copiedInlineTemplatePatterns, ...copiedInlineHandlebarsPatterns);
}

/**
 * Builds the compiled grammars from the sources in this directory.
 * Works on copies of the source modules, so it can be called more than once.
 */
export function buildGrammars() {
  const glimmerJavascript = deepCopy(glimmerJavascriptSource);
  const glimmerTypescript = deepCopy(glimmerTypescriptSource);
  const inlineHandlebars = deepCopy(inlineHandlebarsSource);
  const inlineTemplate = deepCopy(inlineTemplateSource);
  const emberHandlebars = deepCopy(emberHandlebarsSource);
  const markdownGlimmer = deepCopy(markdownGlimmerSource);

  const sources = { emberHandlebars, inlineTemplate, inlineHandlebars };
  const [inlineTemplateInjectionSelectorGJS, inlineTemplateInjectionSelectorGTS] =
    inlineTemplate.injectionSelector.split(', ');

  mergeGlimmerSourceGrammars(glimmerJavascript, inlineTemplateInjectionSelectorGJS, sources);
  mergeGlimmerSourceGrammars(glimmerTypescript, inlineTemplateInjectionSelectorGTS, sources);
  mergeMarkdownGrammar(markdownGlimmer, sources);

  return [glimmerJavascript, glimmerTypescript, inlineHandlebars, inlineTemplate, emberHandlebars, markdownGlimmer];
}
