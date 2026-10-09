// `npm run lint` — eslint, then every guard script, in one place.
//
// Each command runs as a child process with its output left visible. Every
// command runs, even after a failure, so one pass shows all the problems; the
// exit code is 1 if any command failed. Add a new guard to GUARDS, in the
// order it should run. CI runs this through `npm run lint` (ci.yml).
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
  'layout/check-media-widths',
]

const COMMANDS = [
  { name: 'eslint', args: [join(ROOT, 'node_modules/eslint/bin/eslint.js'), '.'] },
  ...GUARDS.map((g) => ({ name: g, args: [join(ROOT, 'scripts', `${g}.mjs`)] })),
]

const failed = []
for (const { name, args } of COMMANDS) {
  const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) failed.push(name)
}

if (failed.length) {
  console.error(`\n✗ ${failed.length} of ${COMMANDS.length} lint step(s) failed: ${failed.join(', ')}`)
  process.exit(1)
}
