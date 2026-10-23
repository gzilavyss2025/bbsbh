// check-missing-imports.mjs runs in `npm run lint`. Its import scan has to read
// each `import`/`export ... from` statement on its own: in this repo's
// semicolon-free style nothing else ends a statement, so a scan that lets the
// clause run on swallowed an `export function` body and then read a re-export
// below it as part of the same import (#2602: camera.js reported T, F, cx and y
// as missing from pitchFlight.js).
//
// The guard finds the repo from its own location, so each case copies it into a
// scratch tree and runs it there.

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const SCRIPTS = path.join(fileURLToPath(new URL('.', import.meta.url)), '../scripts')

function run(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'missing-imports-guard-'))
  try {
    mkdirSync(path.join(dir, 'scripts/lib'), { recursive: true })
    copyFileSync(path.join(SCRIPTS, 'check-missing-imports.mjs'), path.join(dir, 'scripts/check-missing-imports.mjs'))
    copyFileSync(path.join(SCRIPTS, 'lib/walk.mjs'), path.join(dir, 'scripts/lib/walk.mjs'))
    for (const root of ['src', 'api', 'test', 'e2e']) mkdirSync(path.join(dir, root), { recursive: true })
    for (const [file, text] of Object.entries(files)) writeFileSync(path.join(dir, file), text)
    return spawnSync(process.execPath, [path.join(dir, 'scripts/check-missing-imports.mjs')], { encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const B = 'export const A = 1\nexport const C = 2\n'

// The destructuring commas in these bodies are what the old scan turned into
// bare names (`Q`, `R`, as camera.js's `T, F, cx, cy`) and checked against the
// re-export's target.
test('a re-export below an export function with a nested body resolves', () => {
  const a = [
    'export function camera(view) {',
    '  const { P, Q, R } = view',
    '  return (x) => {',
    '    return x + P',
    '  }',
    '}',
    '',
    "export { A, C } from './b.js'",
    '',
  ].join('\n')
  const r = run({ 'src/a.js': a, 'src/b.js': B })
  assert.equal(r.status, 0, r.stderr)
})

test('a re-export below a one-line export function resolves', () => {
  const a = "export function f(o) { const { P, Q, R } = o\n return P }\nexport { A } from './b.js'\n"
  const r = run({ 'src/a.js': a, 'src/b.js': B })
  assert.equal(r.status, 0, r.stderr)
})

test('a missing name in an import below an export function still fails', () => {
  const a = "export function f(o) { return o }\nimport { nope } from './b.js'\nexport const g = nope\n"
  const r = run({ 'src/a.js': a, 'src/b.js': B })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /imports \{ nope \} from src\/b\.js/)
})

test('a name the target does not export still fails and is named', () => {
  const r = run({ 'src/a.js': "import { nope } from './b.js'\nexport const g = nope\n", 'src/b.js': B })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /imports \{ nope \} from src\/b\.js/)
})

test('a missing name in a re-export below an export function still fails', () => {
  const r = run({ 'src/a.js': "export function f(o) { return o }\nexport { nope } from './b.js'\n", 'src/b.js': B })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /imports \{ nope \} from src\/b\.js/)
})

test('default and namespace clauses next to a named one are still read', () => {
  const b = 'export default 1\nexport const A = 1\n'
  const a = "import d, { A } from './b.js'\nimport * as ns from './b.js'\nimport e, { gone } from './b.js'\nexport { d, A, ns, e, gone }\n"
  const r = run({ 'src/a.js': a, 'src/b.js': b })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /imports \{ gone \}/)
  assert.doesNotMatch(r.stderr, /imports \{ A \}/)
})
