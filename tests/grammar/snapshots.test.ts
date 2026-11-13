import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatTokens, tokenize } from '../helpers/tokenize';

const testsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = resolve(testsDir, 'fixtures');

// The root scope each fixture is tokenized with, picked by file extension.
const scopeByExtension: Record<string, string> = {
  '.gjs': 'source.gjs',
  '.gts': 'source.gts',
  '.hbs': 'text.html.ember-handlebars',
  '.js': 'source.js',
  '.ts': 'source.ts',
  '.md': 'text.html.markdown',
};

const fixtures = readdirSync(fixturesDir).sort();

describe('fixture snapshots', () => {
  it.each(fixtures)('%s', async (fixture) => {
    const scopeName = scopeByExtension[extname(fixture)];
    if (!scopeName) {
      throw new Error(`No scope configured for fixture extension "${extname(fixture)}"`);
    }
    const source = readFileSync(resolve(fixturesDir, fixture), 'utf8');
    const tokens = await tokenize(source, scopeName);
    await expect(formatTokens(tokens, source)).toMatchFileSnapshot(
      resolve(testsDir, '__snapshots__', `${fixture}.snap`),
    );
  });
});
