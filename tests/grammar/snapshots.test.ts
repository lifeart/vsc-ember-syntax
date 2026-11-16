import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatColors, formatTokens, tokenize, tokenizeColors, type ThemeName } from '../helpers/tokenize';
import { fixtureScopeName } from '../helpers/fixtures';

const testsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = resolve(testsDir, 'fixtures');
const snapshotsDir = resolve(testsDir, '__snapshots__');

// Dark+ is the VS Code default theme. GitHub Light is what most people see on github.com.
const SNAPSHOT_THEMES: ThemeName[] = ['dark-plus', 'github-light'];

const fixtures = readdirSync(fixturesDir).sort();

describe.each(fixtures)('%s', (fixture) => {
  const scopeName = fixtureScopeName(fixture);
  const source = readFileSync(resolve(fixturesDir, fixture), 'utf8');

  it('matches the scope snapshot', async () => {
    const tokens = await tokenize(source, scopeName);
    await expect(formatTokens(tokens, source)).toMatchFileSnapshot(resolve(snapshotsDir, `${fixture}.snap`));
  });

  it.each(SNAPSHOT_THEMES)('matches the %s colour snapshot', async (theme) => {
    const tokens = await tokenizeColors(source, scopeName, theme);
    await expect(formatColors(tokens, source)).toMatchFileSnapshot(resolve(snapshotsDir, `${fixture}.${theme}.snap`));
  });
});
