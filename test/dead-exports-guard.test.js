// check-dead-exports.mjs runs in `npm run lint`. An export whose only importer is a
// test is dead product code (#2845): tests do not count as a use. The guard finds the
// repo from its own location, so each case copies it into a scratch tree.

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const SCRIPTS = path.join(fileURLToPath(new URL('.', import.meta.url)), '../scripts')

function run(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dead-exports-guard-'))
  try {
    mkdirSync(path.join(dir, 'scripts/lib'), { recursive: true })
    copyFileSync(path.join(SCRIPTS, 'check-dead-exports.mjs'), path.join(dir, 'scripts/check-dead-exports.mjs'))
    copyFileSync(path.join(SCRIPTS, 'lib/walk.mjs'), path.join(dir, 'scripts/lib/walk.mjs'))
    for (const root of ['src', 'api', 'test', 'e2e']) mkdirSync(path.join(dir, root), { recursive: true })
    writeFileSync(path.join(dir, 'index.html'), '')
    for (const [file, text] of Object.entries(files)) writeFileSync(path.join(dir, file), text)
    return spawnSync(process.execPath, [path.join(dir, 'scripts/check-dead-exports.mjs')], { encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const LIB = 'export const used = 1\nexport const testOnly = 2\n'

test('an export only a test imports fails', () => {
  const r = run({
    'src/lib.js': LIB,
    'src/main.js': "import { used } from './lib.js'\nconsole.log(used)\n",
    'test/lib.test.js': "import { used, testOnly } from '../src/lib.js'\nconsole.log(used, testOnly)\n",
  })
  // The scratch tree lacks the real ALLOWLIST files, so stale-entry lines also print: match only ours.
  assert.match(r.stderr, /src\/lib\.js: export "testOnly"/)
  assert.doesNotMatch(r.stderr, /src\/lib\.js: export "used"/)
})

test('an export a src file imports passes, and a same-file use counts', () => {
  const r = run({
    'src/lib.js': 'export const a = 1\nexport const b = a + 1\n',
    'src/main.js': "import { b } from './lib.js'\nconsole.log(b)\n",
  })
  assert.doesNotMatch(r.stderr, /src\/lib\.js/)
})
