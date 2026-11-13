import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getGrammar } from '../helpers/tokenize';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
const contributedGrammars: { scopeName: string; path: string }[] = packageJson.contributes.grammars;

// Collects every `include` that points at another grammar, such as "source.ts" or "text.html.basic#tags".
function externalIncludes(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((child) => externalIncludes(child, found));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'include' && typeof value === 'string' && !value.startsWith('#') && !value.startsWith('$')) {
        found.add(value.split('#')[0]);
      } else {
        externalIncludes(value, found);
      }
    }
  }
  return found;
}

describe('grammar dependencies', () => {
  it.each(contributedGrammars)(
    '$scopeName loads, along with every grammar it includes',
    async ({ scopeName, path }) => {
      const raw = JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));
      expect(raw.scopeName).toBe(scopeName);
      await expect(getGrammar(scopeName)).resolves.toBeDefined();
      for (const include of externalIncludes(raw)) {
        await expect(getGrammar(include), `include "${include}" in ${path}`).resolves.toBeDefined();
      }
    },
  );
});
