import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import glimmerJavascript from './source.gjs.mjs';
import glimmerTypescript from './source.gts.mjs';
import inlineHandlebars from './inline.hbs.mjs';
import inlineTemplate from './inline.template.mjs';
import emberHandlebars from './text.html.ember-handlebars.mjs';

const [inlineTemplateInjectionSelectorGJS, inlineTemplateInjectionSelectorGTS] =
  inlineTemplate.injectionSelector.split(', ');

glimmerJavascript.injections = {
  [inlineTemplateInjectionSelectorGJS]: {
    patterns: [...inlineTemplate.patterns, ...inlineHandlebars.patterns],
  },
};

glimmerTypescript.injections = {
  [inlineTemplateInjectionSelectorGTS]: {
    patterns: [...inlineTemplate.patterns, ...inlineHandlebars.patterns],
  },
};

const grammars = [glimmerJavascript, glimmerTypescript, inlineHandlebars, inlineTemplate, emberHandlebars];

const outDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../');

const errors = [];

console.log('Writing grammars...\n');

for (const grammar of grammars) {
  const filePath = resolve(outDirectory, `${grammar.scopeName}.json`);

  try {
    writeFileSync(filePath, JSON.stringify(grammar, null, 2));
    console.log(`✅ ${grammar.scopeName}.json`);
  } catch (error) {
    console.error(`❌ ${grammar.scopeName}.json`);
    errors.push({ file: `${grammar.scopeName}.json`, error });
  }
}

if (errors.length) {
  console.error(`💀 ${errors.length} grammars failed to write to ${outDirectory}`);
  for (const { file, error } of errors) {
    console.log(`\n${'-'.repeat(file.length)}\n${file}\n${'-'.repeat(file.length)}`);
    console.error(error);
  }
  process.exit(1);
} else {
  console.log(`\n🎉 All grammars written to ${outDirectory}`);
}
