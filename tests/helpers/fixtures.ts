import { extname } from 'node:path';

// The root scope each fixture is tokenized with, picked by file extension.
const scopeByExtension: Record<string, string> = {
  '.gjs': 'source.gjs',
  '.gts': 'source.gts',
  '.hbs': 'text.html.ember-handlebars',
  '.js': 'source.js',
  '.ts': 'source.ts',
  '.md': 'text.html.markdown',
};

export function fixtureScopeName(fixture: string): string {
  const scopeName = scopeByExtension[extname(fixture)];
  if (!scopeName) {
    throw new Error(`No scope configured for fixture extension "${extname(fixture)}"`);
  }
  return scopeName;
}
