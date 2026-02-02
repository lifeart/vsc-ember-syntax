#!/usr/bin/env node
/**
 * Snapshot Update Script
 *
 * Generates snapshot files that capture the full tokenization output
 * for all test fixtures. These snapshots are used for regression testing.
 *
 * Usage:
 *   npm run test:update-snapshots
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRegistry, tokenizeContent, extToScope } from './lib/grammar-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapshotsDir = resolve(__dirname, 'snapshots');
const fixturesDir = resolve(__dirname, 'fixtures');

// Standard test fixtures (created automatically if missing)
const standardFixtures = [
  {
    name: 'basic-hbs.hbs',
    content: `<div class="container">
  <h1>{{this.title}}</h1>
  {{#if this.showContent}}
    <p>{{this.content}}</p>
  {{/if}}
</div>

<MyComponent @value={{this.data}} @onClick={{this.handleClick}} />

{{!-- This is a comment --}}
`
  },
  {
    name: 'style-media.hbs',
    content: `<style>
  .foo {
    color: red;
  }

  @media (min-width: 500px) {
    .bar {
      color: blue;
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
`
  },
  {
    name: 'basic-gts.gts',
    content: `import Component from '@glimmer/component';

interface Signature {
  Args: { name: string };
}

export default class Greeting extends Component<Signature> {
  <template>
    <div class="greeting">
      <h1>Hello, {{@name}}!</h1>
      {{#if this.showDetails}}
        <p>Welcome to our app.</p>
      {{/if}}
    </div>

    <style>
      .greeting {
        padding: 1rem;
      }
    </style>
  </template>

  get showDetails() {
    return true;
  }
}
`
  },
  {
    name: 'basic-gjs.gjs',
    content: `import Component from '@glimmer/component';

export default class Counter extends Component {
  count = 0;

  increment = () => {
    this.count++;
  };

  <template>
    <div class="counter">
      <span>Count: {{this.count}}</span>
      <button {{on "click" this.increment}}>
        Increment
      </button>
    </div>
  </template>
}
`
  }
];

/**
 * Find all fixture files in directory
 */
function findFixtures(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFixtures(fullPath));
    } else {
      const ext = extname(entry.name);
      if (extToScope[ext]) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function main() {
  // Ensure directories exist
  if (!existsSync(fixturesDir)) {
    mkdirSync(fixturesDir, { recursive: true });
  }
  if (!existsSync(snapshotsDir)) {
    mkdirSync(snapshotsDir, { recursive: true });
  }

  // Create standard fixtures if missing
  for (const fixture of standardFixtures) {
    const fixturePath = join(fixturesDir, fixture.name);
    if (!existsSync(fixturePath)) {
      writeFileSync(fixturePath, fixture.content);
      console.log(`📝 Created fixture: ${fixture.name}`);
    }
  }

  // Initialize grammar registry
  await initRegistry();

  // Generate snapshots
  console.log('\n📸 Generating snapshots...\n');

  const fixtures = findFixtures(fixturesDir);

  for (const fixturePath of fixtures) {
    const ext = extname(fixturePath);
    const scopeName = extToScope[ext];
    const name = basename(fixturePath);

    try {
      const content = readFileSync(fixturePath, 'utf-8');
      const snapshot = await tokenizeContent(content, scopeName);

      const snapshotPath = join(snapshotsDir, `${name}.snap`);
      writeFileSync(snapshotPath, snapshot);

      console.log(`  ✅ ${name}`);
    } catch (error) {
      console.log(`  ❌ ${name}: ${error.message}`);
    }
  }

  console.log('\n✅ Snapshots updated!');
}

main().catch(error => {
  console.error('Snapshot update failed:', error);
  process.exit(1);
});
