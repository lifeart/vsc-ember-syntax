import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { buildGrammars } from './build.mjs';

const grammars = buildGrammars();

const outDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../');

const errors = [];

console.log('Writing grammars...\n');

for (const grammar of grammars) {
  const fileName = `${grammar.scopeName}.json`;
  const filePath = resolve(outDirectory, fileName);

  try {
    writeFileSync(filePath, JSON.stringify(grammar, null, 2));
    console.log(`✅ ${fileName}`);
  } catch (error) {
    console.error(`❌ ${fileName}`);
    errors.push({ file: fileName, error });
  }
}

if (errors.length) {
  console.error(`💀 ${errors.length} grammars failed to write to ${outDirectory}`);
  for (const { file, error } of errors) {
    console.log(`\n${'-'.repeat(file.length)}\n${file}\n${'-'.repeat(file.length)}`);
    console.error(error);
  }
  process.exitCode = 1;
} else {
  console.log(`\n🎉 All grammars written to ${outDirectory}`);
}
