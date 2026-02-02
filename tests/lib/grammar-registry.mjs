/**
 * Grammar Registry
 *
 * Shared module for loading and managing TextMate grammars for testing.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vsctm from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';

const { Registry, parseRawGrammar } = vsctm;
const { createOnigScanner, createOnigString, loadWASM } = oniguruma;

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYNTAXES_DIR = resolve(__dirname, '../../syntaxes');
const TESTS_DIR = resolve(__dirname, '..');

/** Map file extensions to grammar scopes */
export const extToScope = {
  '.hbs': 'text.html.ember-handlebars',
  '.gts': 'source.gts',
  '.gjs': 'source.gjs',
};

/** Singleton state for the registry */
let registry = null;

/**
 * Load a JSON grammar file
 * @param {string} filePath - Path to the grammar file
 * @returns {object} Parsed grammar object
 * @throws {Error} If file doesn't exist or is invalid JSON
 */
function loadGrammarFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Grammar file not found: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Initialize the grammar registry. Safe to call multiple times.
 * @returns {Promise<Registry>} The initialized registry
 */
export async function initRegistry() {
  if (registry) {
    return registry;
  }

  // Load oniguruma WASM
  const wasmPath = resolve(__dirname, '../../node_modules/vscode-oniguruma/release/onig.wasm');
  if (!existsSync(wasmPath)) {
    throw new Error(`Oniguruma WASM not found: ${wasmPath}. Run npm install.`);
  }
  const wasmBin = readFileSync(wasmPath).buffer;
  await loadWASM(wasmBin);

  // Load all project grammars
  const grammars = {
    'text.html.ember-handlebars': loadGrammarFile(join(SYNTAXES_DIR, 'text.html.ember-handlebars.json')),
    'source.gts': loadGrammarFile(join(SYNTAXES_DIR, 'source.gts.json')),
    'source.gjs': loadGrammarFile(join(SYNTAXES_DIR, 'source.gjs.json')),
    'inline.hbs': loadGrammarFile(join(SYNTAXES_DIR, 'inline.hbs.json')),
    'inline.template': loadGrammarFile(join(SYNTAXES_DIR, 'inline.template.json')),
    'markdown.glimmer.codeblock': loadGrammarFile(join(SYNTAXES_DIR, 'markdown.glimmer.codeblock.json')),
  };

  // Load CSS grammar for style tag testing (optional)
  const cssGrammarPath = resolve(TESTS_DIR, 'css.tmLanguage.json');
  if (existsSync(cssGrammarPath)) {
    grammars['source.css'] = loadGrammarFile(cssGrammarPath);
  }

  // Create registry with grammar loader
  registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
    loadGrammar: async (scopeName) => {
      const grammar = grammars[scopeName];
      if (grammar) {
        // parseRawGrammar expects a string, so we stringify the object
        return parseRawGrammar(JSON.stringify(grammar), `${scopeName}.json`);
      }

      // Provide stub grammars for TypeScript/JavaScript (used by GTS/GJS)
      if (scopeName === 'source.ts' || scopeName === 'source.js') {
        return parseRawGrammar(JSON.stringify({
          name: scopeName,
          scopeName,
          patterns: [],
        }), `${scopeName}.json`);
      }

      return null;
    },
  });

  return registry;
}

/**
 * Tokenize content and return formatted output suitable for snapshot comparison.
 * @param {string} content - The source code to tokenize
 * @param {string} scopeName - The grammar scope (e.g., 'source.gts')
 * @returns {Promise<string>} Formatted tokenization output
 */
export async function tokenizeContent(content, scopeName) {
  const reg = await initRegistry();
  const grammar = await reg.loadGrammar(scopeName);

  if (!grammar) {
    throw new Error(`Could not load grammar: ${scopeName}`);
  }

  const lines = content.split('\n');
  const output = [];

  output.push(`Grammar: ${scopeName}`);
  output.push('='.repeat(80));
  output.push('');

  let ruleStack = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const result = grammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;

    output.push(`Line ${i + 1}: ${JSON.stringify(line)}`);

    for (const token of result.tokens) {
      const tokenText = line.substring(token.startIndex, token.endIndex);
      output.push(`  [${token.startIndex}-${token.endIndex}] ${JSON.stringify(tokenText)}`);
      output.push(`    ${token.scopes.join(' > ')}`);
    }
    output.push('');
  }

  return output.join('\n');
}
