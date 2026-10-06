// EmptyState collapse, slice E4 (#1132): the team hub's six empty states render
// on EmptyState. Each empty test stays in its caller; the two namespace rules
// that held only a margin and a colour are gone (EmptyState has margin 0 and
// its own copy colour). Stamp In renders copy only, no stamp art (ADR-0035).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

const IMPORT = /import \{ EmptyState \} from '(\.\.\/)+components\/ui\/state\/EmptyState\.jsx'/

test('E4: the three compact sites render EmptyState size="compact"', () => {
  const sites = [
    ['screens/team/modules/records/RecordsCard.jsx', 'No games in this stretch of the season yet.', /\) : \(\s*<EmptyState/],
    ['screens/team/modules/minors/HorizonCard.jsx', 'No full-season line at this level yet.', /p\.stats \? <StatGrid/],
    ['screens/team/modules/minors/DepthChartCard.jsx', 'Too early for a level-relative read at this position.', /\) : \(\s*<EmptyState/],
  ]
  for (const [file, copy, emptyTest] of sites) {
    const code = src(file)
    assert.match(code, IMPORT, file)
    assert.ok(code.includes(`<EmptyState size="compact">${copy}</EmptyState>`), file)
    assert.match(code, emptyTest, `${file}: the empty test stays in the caller`)
    assert.doesNotMatch(code, /hzntile__nostat|trec__empty/, file)
  }
})

test('E4: the Contracts tab renders both empties on EmptyState, tests unchanged', () => {
  const code = src('screens/team/ContractsTab.jsx')
  assert.match(code, IMPORT)
  assert.match(
    code,
    /data\?\.isMilb && \(\s*<EmptyState>Contract terms are published for the major leagues only, so this club has no ledger\.<\/EmptyState>/,
  )
  assert.match(
    code,
    /data && !data\.isMilb && !ledger && \(\s*<EmptyState>This club’s contract ledger has not been published yet\.<\/EmptyState>/,
  )
  assert.match(code, /<p className="hint">\s*The book falls/, 'the cliff footnote stays a hint')
})

test('E4: Stamp In renders its empty line on EmptyState, copy only', () => {
  const code = src('screens/team/StampInPage.jsx')
  assert.match(code, IMPORT)
  assert.match(code, /games\.length === 0 \? \(\s*<EmptyState>No games posted yet for this season\.<\/EmptyState>/)
  assert.match(code, /<Notice tone="error" size="compact">Couldn’t load this game’s result/, 'the error line is a compact error Notice since N2 (#1132)')
  assert.doesNotMatch(code, /EmptyState[^\n]*stamp/i)
})

test('E4: the retired namespace rules are gone', () => {
  assert.doesNotMatch(read('65-team-records.css'), /\.trec__empty/)
  assert.doesNotMatch(read('31-wild-card.css'), /\.hzntile__nostat/)
})
