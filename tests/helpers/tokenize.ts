import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { grammars as externalGrammars } from 'tm-grammars';
import vscodeOniguruma from 'vscode-oniguruma';
import vscodeTextmate, {
  type IGrammar,
  type IRawGrammar,
  type IRawTheme,
  type IRawThemeSetting,
} from 'vscode-textmate';

// Both packages are CommonJS. Plain Node only supports a default import for them,
// so the preview script (run by Node, not Vitest) needs this form.
const { loadWASM, OnigScanner, OnigString } = vscodeOniguruma;
const { INITIAL, parseRawGrammar, Registry } = vscodeTextmate;

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

interface ContributedGrammar {
  scopeName: string;
  path: string;
  injectTo?: string[];
}

const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
const contributedGrammars: ContributedGrammar[] = packageJson.contributes.grammars;

// Grammars from this repo take priority over tm-grammars, which ships its own older copy of source.gjs and source.gts.
const localGrammarPaths = new Map(contributedGrammars.map((g) => [g.scopeName, resolve(repoRoot, g.path)]));
const externalGrammarPaths = new Map(
  externalGrammars.map((g) => [g.scopeName, require.resolve(`tm-grammars/grammars/${g.name}.json`)]),
);

// Maps a target scope to the grammars injected into it, built from `injectTo` in package.json.
const injections = new Map<string, string[]>();
for (const grammar of contributedGrammars) {
  for (const target of grammar.injectTo ?? []) {
    injections.set(target, [...(injections.get(target) ?? []), grammar.scopeName]);
  }
}

let wasmLoaded: Promise<void> | undefined;

function loadOniguruma(): Promise<void> {
  wasmLoaded ??= (async () => {
    const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
    await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  })();
  return wasmLoaded;
}

export const THEME_NAMES = ['dark-plus', 'light-plus', 'github-light', 'github-dark'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

interface VSCodeTheme {
  displayName?: string;
  type?: string;
  colors: Record<string, string>;
  tokenColors: IRawThemeSetting[];
}

export function loadTheme(name: ThemeName): VSCodeTheme {
  return JSON.parse(readFileSync(require.resolve(`tm-themes/themes/${name}.json`), 'utf8'));
}

// vscode-textmate expects the editor colours as a first rule with no scope.
function toRawTheme(name: ThemeName): IRawTheme {
  const theme = loadTheme(name);
  return {
    name,
    settings: [
      { settings: { foreground: theme.colors['editor.foreground'], background: theme.colors['editor.background'] } },
      ...theme.tokenColors,
    ],
  };
}

export interface Token {
  text: string;
  /** Scope stack from outermost to innermost, including the root scope. */
  scopes: string[];
  line: number;
  startIndex: number;
}

export interface ColoredToken {
  text: string;
  line: number;
  startIndex: number;
  /** Lowercase hex colour, such as "#569cd6". */
  foreground: string;
  /** Any of "italic", "bold", "underline" and "strikethrough". */
  fontStyles: string[];
}

export interface TokenizerOptions {
  /**
   * Grammars to use in place of the files in syntaxes/, keyed by scope name.
   * Used by the preview page to compare the committed grammars with the working copy.
   */
  grammars?: Map<string, object>;
  /** Theme used by tokenizeColors. */
  theme?: ThemeName;
}

export interface Tokenizer {
  getGrammar(scopeName: string): Promise<IGrammar>;
  tokenize(source: string, scopeName: string): Promise<Token[][]>;
  tokenizeColors(source: string, scopeName: string): Promise<ColoredToken[][]>;
}

// Bit layout of the token metadata returned by tokenizeLine2, from vscode-textmate's EncodedTokenAttributes,
// which the package does not export.
const FONT_STYLE_MASK = 0b0000_0000_0000_0000_0111_1000_0000_0000;
const FONT_STYLE_OFFSET = 11;
const FOREGROUND_MASK = 0b0000_0000_1111_1111_1000_0000_0000_0000;
const FOREGROUND_OFFSET = 15;
const FONT_STYLE_NAMES = ['italic', 'bold', 'underline', 'strikethrough'];

export function createTokenizer(options: TokenizerOptions = {}): Tokenizer {
  const { grammars: grammarOverrides, theme } = options;

  function loadRawGrammar(scopeName: string): IRawGrammar | null {
    const override = grammarOverrides?.get(scopeName);
    if (override) {
      return parseRawGrammar(JSON.stringify(override), `${scopeName}.json`);
    }
    const path = localGrammarPaths.get(scopeName) ?? externalGrammarPaths.get(scopeName);
    if (!path) {
      return null;
    }
    return parseRawGrammar(readFileSync(path, 'utf8'), path);
  }

  const registryPromise = loadOniguruma().then(() => {
    const registry = new Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (patterns) => new OnigScanner(patterns),
        createOnigString: (text) => new OnigString(text),
      }),
      loadGrammar: async (scopeName) => loadRawGrammar(scopeName),
      getInjections: (scopeName) => injections.get(scopeName),
    });
    if (theme) {
      registry.setTheme(toRawTheme(theme));
    }
    return registry;
  });

  const grammarCache = new Map<string, Promise<IGrammar>>();

  function getGrammar(scopeName: string): Promise<IGrammar> {
    let grammar = grammarCache.get(scopeName);
    if (!grammar) {
      grammar = registryPromise.then(async (registry) => {
        const loaded = await registry.loadGrammar(scopeName);
        if (!loaded) {
          throw new Error(`Grammar not found for scope "${scopeName}"`);
        }
        return loaded;
      });
      grammarCache.set(scopeName, grammar);
    }
    return grammar;
  }

  async function tokenize(source: string, scopeName: string): Promise<Token[][]> {
    const grammar = await getGrammar(scopeName);
    let ruleStack = INITIAL;
    return source.split(/\r?\n/).map((lineText, line) => {
      const result = grammar.tokenizeLine(lineText, ruleStack);
      ruleStack = result.ruleStack;
      return result.tokens.map((token) => ({
        text: lineText.slice(token.startIndex, token.endIndex),
        scopes: token.scopes,
        line,
        startIndex: token.startIndex,
      }));
    });
  }

  async function tokenizeColors(source: string, scopeName: string): Promise<ColoredToken[][]> {
    if (!theme) {
      throw new Error('tokenizeColors needs a tokenizer created with a theme');
    }
    const [grammar, registry] = await Promise.all([getGrammar(scopeName), registryPromise]);
    const colorMap = registry.getColorMap();
    let ruleStack = INITIAL;
    return source.split(/\r?\n/).map((lineText, line) => {
      const result = grammar.tokenizeLine2(lineText, ruleStack);
      ruleStack = result.ruleStack;
      const tokens: ColoredToken[] = [];
      // Each token takes two entries in the array, its start index and then its metadata.
      for (let i = 0; i < result.tokens.length; i += 2) {
        const startIndex = result.tokens[i];
        const endIndex = i + 2 < result.tokens.length ? result.tokens[i + 2] : lineText.length;
        const metadata = result.tokens[i + 1];
        const fontStyle = (metadata & FONT_STYLE_MASK) >>> FONT_STYLE_OFFSET;
        const foreground = colorMap[(metadata & FOREGROUND_MASK) >>> FOREGROUND_OFFSET];
        tokens.push({
          text: lineText.slice(startIndex, endIndex),
          line,
          startIndex,
          foreground: foreground.toLowerCase(),
          fontStyles: FONT_STYLE_NAMES.filter((_name, bit) => fontStyle & (1 << bit)),
        });
      }
      return tokens;
    });
  }

  return { getGrammar, tokenize, tokenizeColors };
}

const defaultTokenizer = createTokenizer();
const themedTokenizers = new Map<ThemeName, Tokenizer>();

export const getGrammar = defaultTokenizer.getGrammar;
export const tokenize = defaultTokenizer.tokenize;

export function tokenizeColors(source: string, scopeName: string, theme: ThemeName): Promise<ColoredToken[][]> {
  let tokenizer = themedTokenizers.get(theme);
  if (!tokenizer) {
    tokenizer = createTokenizer({ theme });
    themedTokenizers.set(theme, tokenizer);
  }
  return tokenizer.tokenizeColors(source, scopeName);
}

/**
 * Formats tokens as text for snapshots. Each source line is printed after `>`,
 * then one row per token. Carets mark the token's columns, followed by its scopes.
 * The root scope is left out because it is the same on every token.
 * Tokens that are only whitespace are skipped to keep snapshots short.
 */
export function formatTokens(lines: Token[][], source: string): string {
  const sourceLines = source.split(/\r?\n/);
  const output: string[] = [];
  lines.forEach((tokens, index) => {
    output.push(`>${sourceLines[index]}`);
    for (const token of tokens) {
      if (token.text.trim() === '') {
        continue;
      }
      const marker = ' '.repeat(token.startIndex) + '^'.repeat(token.text.length);
      output.push(` ${marker} ${token.scopes.slice(1).join(' ')}`.trimEnd());
    }
  });
  return output.join('\n') + '\n';
}

/**
 * Formats coloured tokens as text for snapshots, in the same layout as formatTokens.
 * Each row shows the token's colour, then any font styles.
 * Tokens that are only whitespace are skipped.
 */
export function formatColors(lines: ColoredToken[][], source: string): string {
  const sourceLines = source.split(/\r?\n/);
  const output: string[] = [];
  lines.forEach((tokens, index) => {
    output.push(`>${sourceLines[index]}`);
    for (const token of tokens) {
      if (token.text.trim() === '') {
        continue;
      }
      const marker = ' '.repeat(token.startIndex) + '^'.repeat(token.text.length);
      output.push(` ${marker} ${[token.foreground, ...token.fontStyles].join(' ')}`);
    }
  });
  return output.join('\n') + '\n';
}

/**
 * Returns the tokens that come after `start` and before `end`, in source order.
 * Both `start` and `end` must be tokens from `lines`.
 */
export function tokensBetween(lines: Token[][], start: Token, end: Token): Token[] {
  const all = lines.flat();
  const startPosition = all.indexOf(start);
  const endPosition = all.indexOf(end);
  if (startPosition === -1 || endPosition === -1) {
    throw new Error('tokensBetween: start and end must be tokens from the given lines');
  }
  if (endPosition < startPosition) {
    throw new Error('tokensBetween: end comes before start');
  }
  return all.slice(startPosition + 1, endPosition);
}

export interface ComparableToken {
  line: number;
  text: string;
  scopes: string[];
}

/**
 * Reduces tokens to line, text and scopes so two tokenizations can be compared with `toEqual`.
 * Column positions are left out because renaming a tag shifts every column after it.
 * `rename` replaces the text of any token that is exactly `rename.from`.
 */
export function comparableTokens(lines: Token[][], rename?: { from: string; to: string }): ComparableToken[] {
  return lines.flat().map((token) => ({
    line: token.line,
    text: rename && token.text === rename.from ? rename.to : token.text,
    scopes: token.scopes,
  }));
}

/**
 * Finds the token that starts with `text`. Use `occurrence` to pick a later match.
 * Throws if there is no token starting with `text`, so a tokenizer change that splits
 * or merges tokens fails clearly instead of passing on the wrong token.
 */
export function findToken(lines: Token[][], text: string, occurrence = 1): Token {
  let seen = 0;
  for (const token of lines.flat()) {
    if (token.text.startsWith(text) && ++seen === occurrence) {
      return token;
    }
  }
  const all = lines
    .flat()
    .map((t) => JSON.stringify(t.text))
    .join(', ');
  throw new Error(`No token #${occurrence} starting with ${JSON.stringify(text)}. Tokens: ${all}`);
}

/**
 * Finds `text` in the source and returns every token that overlaps it.
 * Unlike findToken, this works when the grammar splits the text into several tokens,
 * or merges it into a larger one. Use `occurrence` to pick a later match.
 */
export function tokensForText(lines: Token[][], text: string, occurrence = 1): Token[] {
  let seen = 0;
  for (const lineTokens of lines) {
    const lineText = lineTokens.map((token) => token.text).join('');
    let column = lineText.indexOf(text);
    while (column !== -1) {
      if (++seen === occurrence) {
        const end = column + text.length;
        return lineTokens.filter((token) => token.startIndex < end && token.startIndex + token.text.length > column);
      }
      column = lineText.indexOf(text, column + 1);
    }
  }
  throw new Error(`Text #${occurrence} ${JSON.stringify(text)} not found in the source`);
}
