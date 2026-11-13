import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { grammars as externalGrammars } from 'tm-grammars';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import { INITIAL, parseRawGrammar, Registry, type IGrammar, type IRawGrammar } from 'vscode-textmate';

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

function loadRawGrammar(scopeName: string): IRawGrammar | null {
  const path = localGrammarPaths.get(scopeName) ?? externalGrammarPaths.get(scopeName);
  if (!path) {
    return null;
  }
  return parseRawGrammar(readFileSync(path, 'utf8'), path);
}

let registryPromise: Promise<Registry> | undefined;

function getRegistry(): Promise<Registry> {
  registryPromise ??= (async () => {
    const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
    await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
    return new Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (patterns) => new OnigScanner(patterns),
        createOnigString: (text) => new OnigString(text),
      }),
      loadGrammar: async (scopeName) => loadRawGrammar(scopeName),
      getInjections: (scopeName) => injections.get(scopeName),
    });
  })();
  return registryPromise;
}

const grammarCache = new Map<string, Promise<IGrammar>>();

export function getGrammar(scopeName: string): Promise<IGrammar> {
  let grammar = grammarCache.get(scopeName);
  if (!grammar) {
    grammar = getRegistry().then(async (registry) => {
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

export interface Token {
  text: string;
  /** Scope stack from outermost to innermost, including the root scope. */
  scopes: string[];
  line: number;
  startIndex: number;
}

export async function tokenize(source: string, scopeName: string): Promise<Token[][]> {
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
      output.push(` ${marker} ${token.scopes.slice(1).join(' ')}`);
    }
  });
  return output.join('\n') + '\n';
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
