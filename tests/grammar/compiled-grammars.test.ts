import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildGrammars } from '../../syntaxes/src/build.mjs';

const syntaxesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../syntaxes');

// The tests tokenize the compiled JSON in syntaxes/, but grammar changes are made in syntaxes/src.
// This fails when the sources were changed without running `yarn build:grammars`.
describe('compiled grammars', () => {
  const grammars: { scopeName: string }[] = buildGrammars();

  it.each(grammars.map((grammar) => [grammar.scopeName, grammar] as const))(
    'syntaxes/%s.json matches the output of syntaxes/src',
    (scopeName, grammar) => {
      const compiled = readFileSync(resolve(syntaxesDir, `${scopeName}.json`), 'utf8');
      expect(compiled, 'run `yarn build:grammars`').toBe(JSON.stringify(grammar, null, 2));
    },
  );

  it('returns fresh copies on each call', () => {
    expect(buildGrammars()).toEqual(buildGrammars());
  });
});
