// Writes tests/preview/index.html, a page that shows every fixture highlighted with real themes.
// Each example is shown twice. The base side uses the compiled grammars in syntaxes/*.json at a git
// ref, master by default, so the page shows everything a branch changes. "Working copy" builds the
// grammars from syntaxes/src, so a change can be previewed without running `yarn build:grammars`.
// Characters whose scopes or colour differ are marked.
//
// Run with `yarn test:preview`. Options:
//   --base <ref>  compare with another branch, tag or commit instead of master
//   --no-open     write the page without opening it in a browser

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildGrammars } from '../../syntaxes/src/build.mjs';
import { fixtureScopeName } from '../helpers/fixtures.ts';
import {
  createTokenizer,
  loadTheme,
  THEME_NAMES,
  type ColoredToken,
  type ThemeName,
  type Token,
  type Tokenizer,
} from '../helpers/tokenize.ts';
import { nestedTemplateBodies, outerTemplateForms, TAG_PLACEHOLDER } from '../grammar/nested-template.examples.ts';

const testsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(testsDir, '..');
const outFile = resolve(testsDir, 'preview/index.html');

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} needs a value`);
  }
  return value;
}

const baseRef = optionValue('--base') ?? 'master';

interface Example {
  group: string;
  name: string;
  scopeName: string;
  source: string;
}

function readExampleDir(dir: string, group: string): Example[] {
  const fullDir = resolve(testsDir, dir);
  return readdirSync(fullDir)
    .sort()
    .map((file) => ({
      group,
      name: file,
      scopeName: fixtureScopeName(file),
      source: readFileSync(resolve(fullDir, file), 'utf8'),
    }));
}

function collectExamples(): Example[] {
  const fixtures = readExampleDir('fixtures', 'Fixtures (snapshotted)');
  // Suspected grammar bugs found while reviewing the fixtures. They have no snapshots or tests yet.
  const knownIssues = readExampleDir('known-issues', 'Known issues (not snapshotted)');
  // The nested <template> examples are known to be broken, so they have no snapshots yet.
  const nested = Object.entries(nestedTemplateBodies).map(([name, body]) => ({
    group: 'Nested <template> examples (known broken, not snapshotted)',
    name,
    scopeName: 'source.gts',
    source: outerTemplateForms['class body'](body).replace(TAG_PLACEHOLDER, 'template'),
  }));
  return [...fixtures, ...knownIssues, ...nested];
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function baseGrammars(ref: string, scopeNames: string[]): Map<string, object> {
  try {
    git(['rev-parse', '--verify', `${ref}^{commit}`]);
  } catch {
    throw new Error(`--base: "${ref}" is not a branch, tag or commit in this repository`);
  }
  const grammars = new Map<string, object>();
  for (const scopeName of scopeNames) {
    try {
      const json = execFileSync('git', ['show', `${ref}:syntaxes/${scopeName}.json`], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      grammars.set(scopeName, JSON.parse(json));
    } catch {
      // The grammar does not exist at the base ref, so the working copy is used for both sides.
    }
  }
  return grammars;
}

interface CharStyle {
  scopes: string;
  foreground: string;
  fontStyles: string;
}

// Expands tokens to one entry per character so two tokenizations with different token
// boundaries can be compared position by position.
function charStyles(scopeLines: Token[][], colorLines: ColoredToken[][]): CharStyle[][] {
  return scopeLines.map((scopeTokens, line) => {
    const styles: CharStyle[] = [];
    for (const token of scopeTokens) {
      for (let i = 0; i < token.text.length; i++) {
        styles.push({ scopes: token.scopes.slice(1).join(' '), foreground: '', fontStyles: '' });
      }
    }
    for (const token of colorLines[line]) {
      for (let i = 0; i < token.text.length; i++) {
        const style = styles[token.startIndex + i];
        style.foreground = token.foreground;
        style.fontStyles = token.fontStyles.join(' ');
      }
    }
    return styles;
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sameStyle(a: CharStyle, b: CharStyle): boolean {
  return a.scopes === b.scopes && a.foreground === b.foreground && a.fontStyles === b.fontStyles;
}

// Renders one side as spans. `other` is the opposite side, used to mark changed characters.
function renderCode(sourceLines: string[], styles: CharStyle[][], other: CharStyle[][]): string {
  return sourceLines
    .map((lineText, line) => {
      let html = '';
      let runStart = 0;
      const changedAt = (i: number) => {
        const otherStyle = other[line]?.[i];
        return !otherStyle || !sameStyle(styles[line][i], otherStyle);
      };
      for (let i = 1; i <= lineText.length; i++) {
        const boundary =
          i === lineText.length ||
          !sameStyle(styles[line][i], styles[line][runStart]) ||
          changedAt(i) !== changedAt(runStart);
        if (!boundary) {
          continue;
        }
        const style = styles[line][runStart];
        const css = [`color:${style.foreground}`];
        if (style.fontStyles.includes('italic')) css.push('font-style:italic');
        if (style.fontStyles.includes('bold')) css.push('font-weight:bold');
        if (style.fontStyles.includes('underline')) css.push('text-decoration:underline');
        const title = style.scopes || '(root scope only)';
        const changedClass = changedAt(runStart) ? ' class="changed"' : '';
        html += `<span${changedClass} style="${css.join(';')}" title="${escapeHtml(title)}">${escapeHtml(
          lineText.slice(runStart, i),
        )}</span>`;
        runStart = i;
      }
      return html;
    })
    .join('\n');
}

function countChanged(a: CharStyle[][], b: CharStyle[][]): number {
  let changed = 0;
  a.forEach((line, index) => line.forEach((style, i) => (changed += sameStyle(style, b[index][i]) ? 0 : 1)));
  return changed;
}

async function main() {
  const examples = collectExamples();
  const working = new Map<string, object>(
    buildGrammars().map((grammar: { scopeName: string }) => [grammar.scopeName, grammar]),
  );
  const base = baseGrammars(baseRef, [...working.keys()]);
  for (const [scopeName, grammar] of working) {
    if (!base.has(scopeName)) base.set(scopeName, grammar);
  }

  const tokenizers = new Map<ThemeName, { before: Tokenizer; after: Tokenizer }>(
    THEME_NAMES.map((theme) => [
      theme,
      {
        before: createTokenizer({ grammars: base, theme }),
        after: createTokenizer({ grammars: working, theme }),
      },
    ]),
  );

  const sections: string[] = [];
  let changedExamples = 0;
  let currentGroup = '';

  for (const example of examples) {
    const sourceLines = example.source.split(/\r?\n/);
    const panes: string[] = [];
    let changedChars = 0;
    for (const theme of THEME_NAMES) {
      const { before, after } = tokenizers.get(theme) ?? {};
      if (!before || !after) throw new Error(`No tokenizer for ${theme}`);
      const [beforeScopes, beforeColors, afterScopes, afterColors] = await Promise.all([
        before.tokenize(example.source, example.scopeName),
        before.tokenizeColors(example.source, example.scopeName),
        after.tokenize(example.source, example.scopeName),
        after.tokenizeColors(example.source, example.scopeName),
      ]);
      const beforeStyles = charStyles(beforeScopes, beforeColors);
      const afterStyles = charStyles(afterScopes, afterColors);
      changedChars = Math.max(changedChars, countChanged(afterStyles, beforeStyles));
      const { colors } = loadTheme(theme);
      const background = colors['editor.background'];
      panes.push(`<div class="theme" data-theme="${theme}">
  <figure class="pane base"><figcaption>${escapeHtml(
    baseRef,
  )}</figcaption><pre style="background:${background}">${renderCode(
    sourceLines,
    beforeStyles,
    afterStyles,
  )}</pre></figure>
  <figure class="pane working"><figcaption>Working copy</figcaption><pre style="background:${background}">${renderCode(
    sourceLines,
    afterStyles,
    beforeStyles,
  )}</pre></figure>
</div>`);
    }
    if (changedChars > 0) changedExamples++;
    if (example.group !== currentGroup) {
      currentGroup = example.group;
      sections.push(`<h2>${escapeHtml(currentGroup)}</h2>`);
    }
    const badge =
      changedChars > 0
        ? `<span class="badge changed-badge">${changedChars} ${
            changedChars === 1 ? 'character' : 'characters'
          } changed</span>`
        : '<span class="badge">no changes</span>';
    sections.push(`<section class="example" data-changed="${changedChars > 0}">
  <h3><code>${escapeHtml(example.name)}</code> <span class="scope">${example.scopeName}</span> ${badge}</h3>
  ${panes.join('\n')}
</section>`);
  }

  const themeOptions = THEME_NAMES.map(
    (theme) => `<option value="${theme}">${loadTheme(theme).displayName ?? theme}</option>`,
  ).join('');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grammar Preview</title>
<style>
  :root { --bg: #ffffff; --fg: #1f2328; --muted: #59636e; --border: #d1d9e0; --mark: #d63384; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0d1117; --fg: #e6edf3; --muted: #9198a1; --border: #3d444d; --mark: #ff7bbd; } }
  body { margin: 0; padding: 0 16px 48px; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; }
  header { position: sticky; top: 0; background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 0; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; z-index: 1; }
  header h1 { font-size: 16px; margin: 0; }
  header label { color: var(--muted); }
  h2 { font-size: 15px; margin: 32px 0 8px; }
  h3 { font-size: 14px; font-weight: 500; margin: 24px 0 8px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .scope { color: var(--muted); font-family: ui-monospace, monospace; font-size: 12px; }
  .badge { font-size: 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0 8px; }
  .changed-badge { color: var(--mark); border-color: var(--mark); }
  .theme { display: none; gap: 12px; grid-template-columns: 1fr; }
  body[data-theme="dark-plus"] .theme[data-theme="dark-plus"],
  body[data-theme="light-plus"] .theme[data-theme="light-plus"],
  body[data-theme="github-light"] .theme[data-theme="github-light"],
  body[data-theme="github-dark"] .theme[data-theme="github-dark"] { display: grid; }
  body.compare .theme { grid-template-columns: 1fr 1fr; }
  body:not(.compare) .pane.base { display: none; }
  @media (max-width: 900px) { body.compare .theme { grid-template-columns: 1fr; } }
  figure { margin: 0; min-width: 0; }
  figcaption { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  body:not(.compare) figcaption { display: none; }
  pre { margin: 0; padding: 12px; border-radius: 6px; overflow-x: auto; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre span.changed { outline: 1px dashed var(--mark); outline-offset: -1px; }
  body.only-changed .example[data-changed="false"] { display: none; }
</style>
</head>
<body data-theme="dark-plus" class="compare">
<header>
  <h1>Grammar Preview</h1>
  <label>Theme <select id="theme">${themeOptions}</select></label>
  <label><input type="checkbox" id="compare" checked> Compare <code>${escapeHtml(
    baseRef,
  )}</code> with working copy</label>
  <label><input type="checkbox" id="only-changed"> Only examples with changes (${changedExamples})</label>
  <span class="scope">Hover a token to see its scopes. Dashed outlines mark changes.</span>
</header>
${sections.join('\n')}
<script>
  const body = document.body;
  const remember = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const recall = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const theme = document.getElementById('theme');
  const compare = document.getElementById('compare');
  const onlyChanged = document.getElementById('only-changed');
  theme.value = recall('theme') || 'dark-plus';
  body.dataset.theme = theme.value;
  theme.addEventListener('change', () => { body.dataset.theme = theme.value; remember('theme', theme.value); });
  compare.addEventListener('change', () => body.classList.toggle('compare', compare.checked));
  onlyChanged.addEventListener('change', () => body.classList.toggle('only-changed', onlyChanged.checked));
</script>
</body>
</html>
`;

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
  console.log(`Wrote ${outFile}`);
  console.log(`${examples.length} examples, ${changedExamples} with changes between ${baseRef} and the working copy.`);

  if (!process.argv.includes('--no-open')) {
    const url = pathToFileURL(outFile).href;
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();
  }
}

await main();
