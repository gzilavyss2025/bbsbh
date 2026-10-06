// Slice E2 of the EmptyState collapse (#1132): AsyncStatus's empty branch
// renders EmptyState and the emptyProse prop is gone. Source-text pins, the way
// test/empty-state-cascade.test.js does it. Each would fail silently otherwise:
// lint green, the page rendering, only a screenshot noticing.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

const gate = src('components/ui/AsyncGate.jsx')
const status = gate.slice(gate.indexOf('export function AsyncStatus'))

test('E2: AsyncGate imports EmptyState and the empty branch renders it', () => {
  assert.match(gate, /import \{ EmptyState \} from '\.\/state\/EmptyState\.jsx'/)
  assert.match(status, /return <EmptyState>\{emptyMessage\}<\/EmptyState>/)
  assert.doesNotMatch(status, /className="hint"|'hint'/, 'the empty branch wears no .hint')
})

test('E2: the empty test stays byte for byte (a day with no games is not a result)', () => {
  assert.match(status, /if \(!loading && !error && !hasData && emptyMessage\) \{/)
  assert.match(status, /if \(loading && !hasData\) return <Loader \/>/)
})

// N4 (#1132) moved the three error lines onto Notice (decisions Q2); the
// branch tests are pinned in test/notice-n4.test.js.
test('E2: both AsyncStatus error branches and the not-found line render an error Notice', () => {
  assert.equal((status.match(/<Notice\s+tone="error"/g) || []).length, 2)
  assert.equal((gate.match(/<Notice\s+tone="error"/g) || []).length, 3)
  assert.doesNotMatch(gate, /hint--error/)
})

test('E2: no file under src/ names emptyProse any more', () => {
  const hits = walk(SRC)
    .filter((p) => /\.(jsx?|css)$/.test(p))
    .filter((p) => readFileSync(p, 'utf8').includes('emptyProse'))
  assert.deepEqual(hits, [])
})

test('E2: the slate keeps its schedule-length test for "No games scheduled."', () => {
  const code = src('screens/GameSelect.jsx')
  assert.match(code, /hasData=\{sorted\.length > 0\}/)
  assert.match(code, /: 'No games scheduled\.'/)
})
