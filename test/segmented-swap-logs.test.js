// Slice 04a (#2073): the game logs', Season's and Advanced's scope rows are the joined
// Segmented control. Asserted from the source text: a .jsx file cannot be imported here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MODS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'screens', 'player', 'next', 'modules')
const src = (rel) => readFileSync(join(MODS, rel), 'utf8')
const IMPORT = "import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'"

const SWAPS = [
  ['batlog/index.jsx', 'Show games', /count: counts\[id\]/],
  ['pitchlog/index.jsx', 'Show games', /count: counts\[id\]/],
  ['season/index.jsx', 'Show stats for', null],
  ['advanced/index.jsx', 'Scope', null],
]

for (const [rel, label, count] of SWAPS) {
  test(`${rel}: the scope row is a Segmented labelled "${label}"`, () => {
    const s = src(rel)
    assert.ok(s.includes(IMPORT), `${rel} imports Segmented`)
    assert.match(s, new RegExp(`<Segmented\\s+label="${label}"`))
    if (count) assert.match(s, count, `${rel} passes the game counts`)
  })
  test(`${rel}: no Button or Pill toggle is left (no pressed= prop)`, () => {
    assert.doesNotMatch(src(rel), /(?<![-\w])pressed=\{/)
  })
}

test('the side effects stay: batlog closes "Show all", Season closes the WAR dialog, Advanced closes the note', () => {
  assert.match(src('batlog/index.jsx'), /onChange=\{\(id\) => \(setScope\(id\), setMore\(false\)\)\}/)
  assert.match(src('season/index.jsx'), /onChange=\{\(id\) => \{ setPick\(id\); setOpen\(null\) \}\}/)
  assert.match(src('advanced/index.jsx'), /onChange=\{\(k\) => \(setScope\(k\), setOpen\(null\)\)\}/)
})

test('season and advanced import no Button they no longer use', () => {
  assert.doesNotMatch(src('season/index.jsx'), /import \{ Button \}/)
  assert.doesNotMatch(src('advanced/index.jsx'), /import \{ (Button|Cluster) \}/)
})
