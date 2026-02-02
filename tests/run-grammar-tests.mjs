#!/usr/bin/env node
/**
 * Grammar Test Runner
 *
 * Runs snapshot-based tokenization tests for all grammar files to ensure
 * syntax highlighting works correctly and to catch regressions.
 *
 * Usage:
 *   npm test                      - Run tests, compare against snapshots
 *   npm run test:update-snapshots - Update snapshot files
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRegistry, tokenizeContent, extToScope } from './lib/grammar-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapshotsDir = resolve(__dirname, 'snapshots');
const fixturesDir = resolve(__dirname, 'fixtures');

// Test result tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

/**
 * Run snapshot tests comparing current tokenization against saved snapshots
 */
async function runSnapshotTests() {
  if (!existsSync(fixturesDir)) {
    console.log('  ⚠️  No fixtures directory found. Run npm run test:update-snapshots first.');
    return;
  }

  if (!existsSync(snapshotsDir)) {
    console.log('  ⚠️  No snapshots directory found. Run npm run test:update-snapshots first.');
    return;
  }

  const fixtures = readdirSync(fixturesDir).filter(f => extToScope[extname(f)]);

  if (fixtures.length === 0) {
    console.log('  ⚠️  No fixture files found.');
    return;
  }

  for (const fixture of fixtures) {
    const fixturePath = join(fixturesDir, fixture);
    const snapshotPath = join(snapshotsDir, `${fixture}.snap`);

    totalTests++;

    if (!existsSync(snapshotPath)) {
      failedTests++;
      console.log(`  ⚠️  ${fixture} - missing snapshot`);
      failures.push({
        file: fixture,
        type: 'missing',
        message: 'No snapshot file found. Run npm run test:update-snapshots',
      });
      continue;
    }

    const ext = extname(fixture);
    const scopeName = extToScope[ext];

    try {
      const content = readFileSync(fixturePath, 'utf-8');
      const expectedSnapshot = readFileSync(snapshotPath, 'utf-8');
      const actualSnapshot = await tokenizeContent(content, scopeName);

      if (actualSnapshot === expectedSnapshot) {
        passedTests++;
        console.log(`  ✅ ${fixture}`);
      } else {
        failedTests++;
        console.log(`  ❌ ${fixture} - snapshot mismatch`);

        // Find first difference for debugging
        const expectedLines = expectedSnapshot.split('\n');
        const actualLines = actualSnapshot.split('\n');

        for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
          if (expectedLines[i] !== actualLines[i]) {
            failures.push({
              file: fixture,
              type: 'mismatch',
              line: i + 1,
              expected: expectedLines[i] || '(end of file)',
              actual: actualLines[i] || '(end of file)',
            });
            break;
          }
        }
      }
    } catch (error) {
      failedTests++;
      console.log(`  ❌ ${fixture} - ${error.message}`);
      failures.push({
        file: fixture,
        type: 'error',
        message: error.message,
      });
    }
  }
}

// Main execution
async function main() {
  console.log('🧪 Grammar Snapshot Tests\n');
  console.log('='.repeat(60));

  // Initialize grammar registry
  await initRegistry();

  // Run tests
  await runSnapshotTests();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed`);

  if (failures.length > 0) {
    console.log(`\n❌ ${failedTests} test(s) failed:\n`);

    for (const failure of failures) {
      if (failure.type === 'mismatch') {
        console.log(`  ${failure.file} (line ${failure.line}):`);
        console.log(`    Expected: ${failure.expected}`);
        console.log(`    Actual:   ${failure.actual}`);
      } else {
        console.log(`  ${failure.file}: ${failure.message}`);
      }
      console.log('');
    }

    console.log('💡 Tip: If the changes are intentional, run: npm run test:update-snapshots');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
