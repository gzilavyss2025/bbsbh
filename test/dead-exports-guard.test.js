// check-dead-exports.mjs runs in `npm run lint`. An export whose only importer is a
// test is dead product code (#2845): tests do not count as a use. The guard finds the
// repo from its own location, so each case copies it into a scratch tree.

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
    // The scratch tree has none of the real ALLOWLIST's files, so drop the stale-entry check.
    const guard = readFileSync(path.join(SCRIPTS, 'check-dead-exports.mjs'), 'utf8')
    const bare = guard.replace('const staleAllowlist = new Set(Object.keys(ALLOWLIST))', 'const staleAllowlist = new Set()')
    assert.notEqual(bare, guard, 'the stale-entry line moved: update this test')
    writeFileSync(path.join(dir, 'scripts/check-dead-exports.mjs'), bare)
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
const flagged = (r, name) => new RegExp(`src/lib\\.js: export "${name}"`).test(r.stderr)

test('an export only a test imports fails', () => {
  const r = run({
    'src/lib.js': LIB,
    'src/main.js': "import { used } from './lib.js'\nconsole.log(used)\n",
    'test/lib.test.js': "import { used, testOnly } from '../src/lib.js'\nconsole.log(used, testOnly)\n",
  })
  assert.equal(r.status, 1)
  assert.ok(flagged(r, 'testOnly'))
  assert.ok(!flagged(r, 'used'))
})

test('an export a src file imports passes, and a same-file use counts', () => {
  const r = run({
    'src/lib.js': 'export const a = 1\nexport const b = a + 1\n',
    'src/main.js': "import { b } from './lib.js'\nconsole.log(b)\n",
  })
  assert.equal(r.status, 0, r.stderr)
})

test('a lazyNamed import from src counts as a use', () => {
  const r = run({
    'src/lib.js': 'export const Screen = 1\nexport const other = 2\n',
    'src/main.js': "import { used } from './lib.js'\nconst S = lazyNamed(() => import('./lib.js'), 'Screen')\nconsole.log(S, used)\n",
  })
  assert.ok(!/"Screen"/.test(r.stderr))
})

test('a scripts/ import counts as a use', () => {
  const r = run({
    'src/lib.js': 'export const fromScript = 1\n',
    'scripts/gen.mjs': "import { fromScript } from '../src/lib.js'\nconsole.log(fromScript)\n",
  })
  assert.equal(r.status, 0, r.stderr)
})

test('a test-only `import * as ns` does not exempt the file', () => {
  const r = run({
    'src/lib.js': LIB,
    'src/main.js': "import { used } from './lib.js'\nconsole.log(used)\n",
    'test/lib.test.js': "import * as lib from '../src/lib.js'\nconsole.log(lib.testOnly)\n",
  })
  assert.equal(r.status, 1)
  assert.ok(flagged(r, 'testOnly'))
})

test('a barrel re-export counts as a use only when the barrel name is used outside test/', () => {
  const files = {
    'src/lib.js': 'export const viaBarrel = 1\nexport const keep = 2\n',
    'src/barrel.js': "export { viaBarrel, keep } from './lib.js'\n",
    'src/main.js': "import { keep } from './barrel.js'\nconsole.log(keep)\n",
    'test/lib.test.js': "import { viaBarrel } from '../src/barrel.js'\nconsole.log(viaBarrel)\n",
  }
  const r = run(files)
  assert.equal(r.status, 1)
  assert.ok(flagged(r, 'viaBarrel'))
  assert.ok(!flagged(r, 'keep'))
  // The same barrel name imported by src makes the leaf export live.
  const ok = run({ ...files, 'src/main.js': "import { keep, viaBarrel } from './barrel.js'\nconsole.log(keep, viaBarrel)\n" })
  assert.equal(ok.status, 0, ok.stderr)
})
