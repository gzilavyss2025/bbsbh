// Slice E9 of the EmptyState collapse (#1132): the clean-up. Two late empty
// sites move (they landed with #1202 after the plan), the one dead rule goes,
// and every rule the slices kept is still worn by a site. Asserted from the
// source text, the way E2 to E8 do it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const FILES = walk(SRC)
const css = FILES.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n')
const jsx = FILES.filter((f) => /\.jsx?$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')

test('E9: .hint__link is gone from the stylesheets and from every file under src', () => {
  assert.doesNotMatch(css, /\.hint__link/)
  assert.doesNotMatch(jsx, /hint__link/)
})

test('E9: the season stack renders its empty season on a compact EmptyState', () => {
  const code = src('components/season/SeasonStack.jsx')
  assert.match(code, /import \{ EmptyState \} from '\.\.\/ui\/state\/EmptyState\.jsx'/)
  assert.match(code, /<EmptyState size="compact">\s*\{empty\} in \{year\}\./)
  assert.doesNotMatch(code, /className="hint"/)
  // The empty test stays the caller's: a season with no body.
  assert.match(code, /body \?\? \(/)
})

test('E9: the umpire page renders its "no games on file" line on EmptyState, test unchanged', () => {
  const code = src('screens/UmpirePage.jsx')
  assert.match(code, /<EmptyState>No games on file for this umpire in \{view\.label\}\.<\/EmptyState>/)
  assert.doesNotMatch(code, /<p className="hint">No games on file/)
  assert.match(code, /!loading && !error && !data && \(seasonYear != null \|\| view\.seasons\?\.length > 1\)/)
})

// N4 (#1132) moved the slate's error line onto Notice. N9 found no .hint left on the
// slate, so only the .btn half of the slate's caps rule stays (notice-n9.test.js).
test('E9: the slate keeps its .btn caps rule, and the slate\'s error line is a Notice', () => {
  const nav = src('styles/05-masthead-nav.css')
  assert.match(nav, /\.screen--slate \.btn \{/)
  assert.match(nav, /\.slatebody__main > \.emptystate:first-child \{/)
  assert.doesNotMatch(src('components/ui/AsyncGate.jsx'), /hint hint--error/)
  assert.match(src('components/ui/AsyncGate.jsx'), /<Notice\s+tone="error"/)
})

// Every namespace rule the slices kept is a margin worn by a site. A rule with no
// site is dead weight; this fails the day one of them is orphaned.
const KEPT = [
  'txpage__empty',
  'roster__empty',
  'starter__empty',
  'boxlines__empty',
  'vsteam__none',
  'prospects__empty',
  'payboard__empty',
  'umpmodal__empty',
  'oseason__empty',
  'scout__notposted', // worn by the lab's scout harness (a held tool page)
  'hint--prose',
]
for (const name of KEPT) {
  test(`E9: .${name} still has a rule and a site that wears it`, () => {
    assert.match(css, new RegExp(`\\.${name}\\b`), 'a rule')
    const sites = FILES.filter((f) => /\.jsx$/.test(f)).filter((f) => readFileSync(f, 'utf8').includes(name))
    assert.ok(sites.length > 0, `a JSX site wears .${name}`)
  })
}
