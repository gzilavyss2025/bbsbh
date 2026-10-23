// `npm run lint` — eslint, then every guard script, in one place.
//
// Every command runs, even after a failure, so one pass shows all the problems;
// the exit code is 1 if any command failed. Output is quiet: a step that passes
// prints nothing, a step that fails prints all its output, and one summary line
// ends the run. An agent reads every line it runs, so a pass costs one line, not
// ~300. `npm run lint -- --verbose` prints every step. Add a new guard to GUARDS,
// in the order it should run. CI runs this through `npm run lint` (ci.yml).
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { ROOT } from './lib/walk.mjs'

const GUARDS = [
  'check-caps',
  'check-name-casing',
  'check-typography',
  'check-caption-budget',
  'check-raw-values',
  'check-word-choice',
  'check-focus-ring',
  'check-component-reuse',
  'check-strike-links',
  'check-contrast',
  'check-claude-md',
  'check-claude-md-facts',
  'docs/check-doc-paths',
  'docs/check-design-sync',
  'check-adr-numbers',
  'check-diary-voice',
  'check-report-pages',
  'check-searchable-sport-ids',
  'check-skeleton-ball-frames',
  'check-stamp-surfaces',
  'check-seal-scope',
  'check-spoiler-manifest',
  'check-learn-css',
  'check-dir-size',
  'check-file-size',
  'check-statsapi-client',
  'check-dead-exports',
  'check-missing-imports',
  'check-line-endings',
  'check-comment-citations',
  'check-fixture-freshness',
  'layout/check-z-index',
  'layout/check-css-vars',
  'layout/check-media-widths',
  'layout/check-layout-ratchet',
  'layout/check-card-fill',
]

const COMMANDS = [
  // The cache (content hashes, under node_modules/) makes a second local run
  // take about 1 second instead of about 60. CI starts with no cache.
  {
    name: 'eslint',
    args: [
      join(ROOT, 'node_modules/eslint/bin/eslint.js'),
      '.',
      '--cache',
      '--cache-strategy',
      'content',
      '--cache-location',
      join(ROOT, 'node_modules/.cache/eslint/'),
    ],
  },
  ...GUARDS.map((g) => ({ name: g, args: [join(ROOT, 'scripts', `${g}.mjs`)] })),
]

const verbose = process.argv.includes('--verbose')
const failed = []
for (const { name, args } of COMMANDS) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: verbose ? 'inherit' : 'pipe',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status === 0) continue
  failed.push(name)
  if (!verbose) {
    console.error(`\n── ${name} ──`)
    process.stderr.write(result.stdout + result.stderr)
  }
}

if (failed.length) {
  console.error(`\n✗ ${failed.length} of ${COMMANDS.length} lint step(s) failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`✓ lint: all ${COMMANDS.length} steps passed`)
