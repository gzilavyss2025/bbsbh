// Slice E6 of the EmptyState collapse (#1132): the empty line on ten standalone
// pages renders EmptyState. Source-text pins, the way test/empty-state-e2.test.js
// does it. Each would fail silently otherwise: lint green, the page rendering,
// only a screenshot noticing.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

// [file, a fragment of the empty copy, true when the empty appears after the
// reader acts (a club filter), so it carries role="status"; the All-Star card line shows on load, in every club card, so it has none]
const SITES = [
  ['screens/AllStarLegacyPage.jsx', 'No one on the current roster has ever been named an All-Star.', false],
  ['screens/MilestoneWatchPage.jsx', 'No one on that club is within range of a career milestone right now.', true],
  ['screens/RehabPage.jsx', 'No players from that club are on a rehab assignment right now.', true],
  ['screens/TradeDeadlineSeasonPage.jsx', 'That club made no trades within this season’s deadline window.', true],
  ['screens/LeadersPage.jsx', 'No leaders to show here yet', false],
  ['screens/around-the-game/DoubleheadersPage.jsx', 'No doubleheader was played in these years.', false],
  ['screens/UmpirePage.jsx', 'No games behind the plate this season.', false],
  ['screens/SalariesPage.jsx', 'League salaries have not been published yet.', false],
  ['screens/GamePhotosPage.jsx', 'Pick a club above to browse its games.', false],
  ['components/game/GameFinder.jsx', 'games between these two.', false],
]

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

for (const [file, copy, status] of SITES) {
  test(`E6: ${file} renders its empty line on EmptyState`, () => {
    const s = src(file)
    assert.match(s, /import \{ EmptyState \} from '[./]+\/components\/ui\/state\/EmptyState\.jsx'|import \{ EmptyState \} from '\.\.\/ui\/state\/EmptyState\.jsx'/)
    const open = new RegExp(`<EmptyState([^>]*)>\\s*(?:\\{[^}]*)?[^<]*${escape(copy)}`)
    const m = s.match(open)
    assert.ok(m, 'the empty copy sits inside <EmptyState>')
    assert.equal(/role="status"/.test(m[1]), status, status ? 'a filter result carries role="status"' : 'no role')
  })

  test(`E6: ${file} no longer wears a bare .hint for its empty line`, () => {
    const s = src(file)
    const bare = new RegExp(`<p className="hint[^"]*">\\s*(?:\\{[^}]*)?[^<]*${escape(copy)}`)
    assert.doesNotMatch(s, bare)
  })
}

test('E6: the game finder keeps its two-teams error as a hint, not an empty state', () => {
  assert.match(src('components/game/GameFinder.jsx'), /<p className="hint">Pick two different teams\.<\/p>/)
})

test('E6: the empty tests stay (an empty line shows when its own test says so)', () => {
  assert.match(src('screens/MilestoneWatchPage.jsx'), /allRows\.length > 0 && rows\.length === 0/)
  assert.match(src('screens/RehabPage.jsx'), /allPlayers\.length > 0 && players\.length === 0/)
  assert.match(src('screens/TradeDeadlineSeasonPage.jsx'), /allTrades\.length > 0 && trades\.length === 0/)
  assert.match(src('screens/GamePhotosPage.jsx'), /\{!teamId && <EmptyState>/)
  assert.match(src('screens/SalariesPage.jsx'), /data == null && !league\.loading && !league\.error/)
})
