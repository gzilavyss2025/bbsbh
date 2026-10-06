// EmptyState slice E3: the spoiler surfaces (#1132). Five empty boxes moved
// onto EmptyState: the innings rail's "No pitching lines yet", the Bench tab's
// roster "Not posted yet.", the lineup page's starter card "Not posted yet.",
// and the two Box Lines empties.
//
// THE RULE HERE IS "MOVE THE BOX, NEVER THE GATE". So each site pins three
// things: the element is EmptyState (with its namespace where a margin needs
// one); the empty TEST that decides when it shows is still in the caller,
// byte for byte; and the file still imports no reveal-only module
// (linescore.js, derive.js, hitchart.js, ADR-0001). Then each removed rule is
// gone, and each namespace rule that stays sets only a margin.
//
// Its own file, not section 5 of empty-state-cascade.test.js, because E2, E4,
// E5 and E8 ran at the same time and each would edit that section.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const props = (body) =>
  body
    .split(';')
    .map((d) => d.trim().split(':')[0].trim())
    .filter(Boolean)
const has = (code, text, msg) => assert.ok(code.includes(text), msg ?? `expected: ${text}`)

const REVEAL_ONLY = /\/api\/(linescore|derive|hitchart)\.js['"]/

// file, the import line, the EmptyState JSX, the old element, the empty test(s)
const SITES = [
  {
    file: 'components/inning/focus/ReferencePanel.jsx',
    import: "import { EmptyState } from '../../ui/state/EmptyState.jsx'",
    jsx: '<EmptyState>No pitching lines yet</EmptyState>',
    old: /refpanel__empty/,
    tests: [
      'const armsEmpty = !notes.length && !pitcherTeams.some((t) => t.rows?.length)',
      '{armsEmpty ? (',
      'const revealed = idx <= revealedThrough',
      'const showEntering = safeToShowEntering(revealedThrough, effInning, effHalf)',
    ],
  },
  {
    file: 'components/inning/RosterPanel.jsx',
    import: "import { EmptyState } from '../ui/state/EmptyState.jsx'",
    jsx: '<EmptyState size="compact" className="roster__empty">\n              Not posted yet.\n            </EmptyState>',
    old: /<p className="hint">Not posted yet\.<\/p>/,
    tests: [
      "const empty =\n    (!shows('starters') || roster.starters.length === 0) &&\n    (!shows('bullpen') || roster.bullpen.length === 0) &&\n    (!shows('bench') || roster.bench.length === 0)",
      '{empty && (',
      'const entered = (p) => enteredAsOf(p, revealedThrough, halfIdx)',
    ],
  },
  {
    file: 'screens/TeamInfo.jsx',
    import: "import { EmptyState } from '../components/ui/state/EmptyState.jsx'",
    jsx: '<EmptyState size="compact" className="starter__empty">\n          Not posted yet.\n        </EmptyState>',
    old: /<p className="hint">Not posted yet\.<\/p>/,
    tests: ['      ) : projected?.length ? (\n        <ProjectedStarters rows={projected} />\n      ) : (\n        <EmptyState'],
  },
  {
    file: 'components/boxlines/BoxLinesSheet.jsx',
    import: "import { EmptyState } from '../ui/state/EmptyState.jsx'",
    jsx: "<EmptyState className=\"boxlines__empty\">\n              {cutoff ? `No game lines before ${humanDateWithYear(cutoff)}.` : 'No game lines yet.'}\n            </EmptyState>",
    old: /<p className="hint boxlines__hint">\s*\{cutoff/,
    tests: ['{rows && rows.length === 0 && (', '{!listing && rows && rows.length > 0 && ('],
  },
  {
    file: 'components/boxlines/GameLinesDoor.jsx',
    import: "import { EmptyState } from '../ui/state/EmptyState.jsx'",
    jsx: '<EmptyState className="boxlines__empty">No games to list.</EmptyState>',
    old: /No games to list\.<\/p>/,
    tests: ['{all.length === 0 ? ('],
  },
]

for (const s of SITES) {
  test(`E3: ${s.file} renders its empty line on EmptyState`, () => {
    const code = src(s.file)
    has(code, s.import)
    has(code, s.jsx)
    assert.doesNotMatch(code, s.old, 'the old element is gone')
    assert.equal(code.match(/<EmptyState\b/g).length, 1, 'one empty state in the file')
  })

  test(`E3: ${s.file} keeps its empty test and its gates where they were`, () => {
    const code = src(s.file)
    for (const t of s.tests) has(code, t, `the caller's test stays, byte for byte: ${t}`)
    assert.doesNotMatch(code, REVEAL_ONLY, 'no reveal-only module reaches this file')
  })
}

test('E3: the .refpanel__empty rule is gone, with no ground left to paint', () => {
  assert.equal(ruleBody(read('focus/reference.css'), '.refpanel__empty'), null)
})

test('E3: the starter card\'s `.starter > .hint` inset is gone; .starter__empty keeps only a margin', () => {
  const css = read('10-lineup.css')
  assert.doesNotMatch(css, /\.starter\s*>\s*\.hint/)
  assert.deepEqual(props(ruleBody(css, '.starter__empty')), ['margin'])
})

test('E3: .roster__empty and .boxlines__empty keep only a margin, never a second frame', () => {
  assert.deepEqual(props(ruleBody(read('13-play-by-play.css'), '.roster__empty')), ['margin'])
  assert.deepEqual(props(ruleBody(read('boxlines/boxlines.css'), '.boxlines__empty')), ['margin'])
})

// N4 (#1132) moved the error line onto Notice (decisions Q2), pinned in
// test/notice-n4.test.js; the loading line stays a hint.
test('E3: Box Lines\' loading line keeps .hint .boxlines__hint', () => {
  const code = src('components/boxlines/BoxLinesSheet.jsx')
  has(code, '<p className="hint boxlines__hint">Pulling his game lines…</p>')
  assert.equal(code.match(/boxlines__hint/g).length, 1, 'only the loading line wears it')
  assert.doesNotMatch(src('components/boxlines/GameLinesDoor.jsx'), /boxlines__hint/)
})
