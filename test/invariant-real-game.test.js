// The spoiler invariant, pinned on the REAL pinned game — deterministically, in
// the CI-gated `npm test`. Until now the app's core guarantee was exercised on
// real MLB data only by the two e2e specs (e2e/invariants/**, e2e/smoke.spec.js)
// that hit the LIVE statsapi at test time — non-deterministic, un-gated in CI,
// and dependent on a game that ages out. This loads a captured, trimmed feed for
// that same game (gamePk 823035, 2026-07-07 MIL@STL g2, final 10–2) and asserts
// the reveal-gated data layer never surfaces a number from a still-sealed half.
//
// The fixture is a field-trimmed snapshot of statsapi's
// /api/v1.1/game/823035/feed/live (only the paths the reveal-only selectors
// read — see scripts that built it in the PR); it is not a live fetch, so this
// runs offline and identically every time.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { revealInning, revealTotals } from '../src/api/linescore.js'
import { computePitcherLines } from '../src/api/pitchers.js'
import { computeDerivedByInning, revealDerived } from '../src/api/derive.js'
import { defenseEntering } from '../src/api/defense.js'
import { selectRegulationInnings, halfIndex } from '../src/api/select.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

test('the captured game is the pinned 9-inning MIL@STL final', () => {
  assert.equal(FEED.gamePk, 823035)
  assert.equal(selectRegulationInnings(FEED), 9)
})

test('nothing pitching-related surfaces before the first reveal', () => {
  // Mark -1 = "nothing revealed": the running Pitchers table must be empty even
  // though the feed carries the whole completed game.
  assert.deepEqual(computePitcherLines(FEED, -1), { away: [], home: [] })
})

test('a pitcher line grows monotonically and only reaches its final at full reveal', () => {
  const early = computePitcherLines(FEED, halfIndex(3, 'top')).away[0] // Brewers starter, a few innings in
  const full = computePitcherLines(FEED, 999).away[0]
  assert.equal(early.id, full.id) // same starter (Gasser)
  // The early partial is strictly less than the settled boxscore line — a
  // sealed inning's outs/batters have NOT leaked into the running total.
  assert.ok(early.bf < full.bf, `${early.bf} !< ${full.bf}`)
  assert.ok(Number(early.ip) < Number(full.ip))
  // The final line is the exact boxscore line for the real outing.
  assert.equal(full.ip, '7.2')
  assert.equal(full.bf, 29)
  assert.equal(full.k, 4)
})

test('the revealed R/H/E totals match the real final line score', () => {
  assert.deepEqual(revealTotals(FEED, 'away'), { runs: 10, hits: 11, errors: 0, leftOnBase: 8 })
  assert.deepEqual(revealTotals(FEED, 'home'), { runs: 2, hits: 4, errors: 0, leftOnBase: 4 })
  // A per-inning read still resolves the real row.
  assert.equal(revealInning(FEED, 1, 'away').runs, 0)
})

test('derived per-inning stats compute over the real play-by-play', () => {
  const top1 = revealDerived(computeDerivedByInning(FEED), 1, 'top')
  assert.ok(top1.pitches > 0)
  assert.ok(top1.plateAppearances >= 3)
  assert.equal(top1.maxVeloType, 'Four-Seam Fastball') // real Statcast tracking present
})

test('defenseEntering self-gates on the real feed: a far half returns null', () => {
  // Entering the bottom of the 9th (halfIndex 17) is only safe once the user has
  // revealed at least through halfIndex 16 — asking for it at mark 0 returns null.
  assert.equal(defenseEntering(FEED, 'home', 9, 'bottom', 0), null)
  assert.ok(defenseEntering(FEED, 'home', 1, 'top', -1)) // the very next half is fine
})
