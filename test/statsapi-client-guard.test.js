import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ALLOWLIST,
  EXEMPT,
  codeLines,
  findViolations,
  listSources,
} from '../scripts/check-statsapi-client.mjs'

// The matcher behind the "one statsapi client" lint rule (#1116). It is pure:
// it reads text, so every case here is a string, not a file on disk.

const rules = (source, file = '.scratch/x/pull.mjs') => findViolations(source, file).map((v) => v.rule)

test('a URL built on the host is a violation', () => {
  assert.deepEqual(rules("const res = await fetch('https://statsapi.mlb.com/api/v1/teams')"), ['host'])
  assert.deepEqual(rules('const u = `https://statsapi.mlb.com/api/v1/people/${id}`'), ['host'])
  assert.deepEqual(rules("const BASE = 'https://statsapi.mlb.com'"), ['host'])
})

test('the bare host counts too, so a host split from its path cannot slip past', () => {
  assert.deepEqual(rules("const HOST = 'statsapi.mlb.com'"), ['host'])
})

test('a // comment line is skipped, so a header may say where its data comes from', () => {
  assert.deepEqual(rules('// Pulled from https://statsapi.mlb.com/api/v1/stats'), [])
  assert.deepEqual(rules('    // statsapi.mlb.com is unreachable in the sandbox'), [])
})

test('a block comment is skipped, on its first line, its middle and its last', () => {
  const src = ['/*', ' * see https://statsapi.mlb.com/api/v1/teams', ' statsapi.mlb.com again', ' */', 'const x = 1'].join('\n')
  assert.deepEqual(rules(src), [])
  assert.deepEqual(rules('/* statsapi.mlb.com */ const x = 1'), [])
})

test('code right after a block comment is checked again', () => {
  const src = ['/* note', ' */', "fetch('https://statsapi.mlb.com/x')"].join('\n')
  assert.deepEqual(findViolations(src, '.scratch/a.mjs').map((v) => v.line), [3])
})

test('a line carries its number and its text', () => {
  const [v] = findViolations("\n\n  await fetch('https://statsapi.mlb.com/a')\n", 'scripts/a.mjs')
  assert.equal(v.line, 3)
  assert.equal(v.text, "await fetch('https://statsapi.mlb.com/a')")
})

test('a call through the client is clean', () => {
  assert.deepEqual(rules("const j = await getJson('/api/v1/teams?sportId=1')"), [])
  assert.deepEqual(rules("import { getJson } from '../../scripts/lib/statsapi.mjs'"), [])
  assert.deepEqual(rules("const url = statsapiUrl('/api/v1/teams')"), [])
})

test('STATSAPI_BASE outside the client is a violation, statsapiUrl is not', () => {
  assert.deepEqual(rules('fetch(`${STATSAPI_BASE}/api/v1/teams`)'), ['base'])
  assert.deepEqual(rules("import { STATSAPI_BASE } from './lib/statsapi.mjs'"), ['base'])
  assert.deepEqual(rules('const NOT_STATSAPI_BASE_X = 1'), [])
})

test('cachedGetJson is banned in scripts/ and allowed in .scratch/', () => {
  const src = "const j = await cachedGetJson('/api/v1/teams')"
  assert.deepEqual(rules(src, 'scripts/gen-teams.mjs'), ['cache'])
  assert.deepEqual(rules(src, 'scripts/fever/gen-salaries.mjs'), ['cache'])
  assert.deepEqual(rules(src, '.scratch/spike/pull.mjs'), [])
})

test('one line can break two rules', () => {
  assert.deepEqual(rules("fetch('https://statsapi.mlb.com' + STATSAPI_BASE)"), ['host', 'base'])
})

test('codeLines keeps the real line numbers', () => {
  assert.deepEqual(codeLines('// a\nb\n/*\nc\n*/\nd').map(([n]) => n), [2, 6])
})

// The tree itself. These are the checks lint runs, pinned here so a broken
// matcher fails a unit test and not only the lint step.
test('every allowlisted file exists and is not exempt', () => {
  const files = new Set(listSources())
  for (const file of Object.keys(ALLOWLIST)) {
    assert.ok(files.has(file), `${file} is allowlisted but not found`)
    assert.ok(!EXEMPT.has(file))
    assert.ok(ALLOWLIST[file].length > 20, `${file} needs a real reason`)
  }
})

test('the client and the guard are exempt, and both are found by the walk', () => {
  const files = new Set(listSources())
  for (const file of EXEMPT) assert.ok(files.has(file), file)
})
