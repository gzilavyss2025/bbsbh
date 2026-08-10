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
import { computeHalfInningFeed, nextStepBoundary, stepTotals } from '../src/api/playbyplay.js'
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

// Every step of a half, as the floating bar walks it: the cap the NEXT "Next
// at-bat" tap would pass, from the first one to the whole half. Mirrors
// PlayByPlay's own effectiveCap/nextStepBoundary pairing (ADR-0016).
function* stepsOf(inning, half, side) {
  const probe = computeHalfInningFeed(FEED, inning, half, side, null)
  if (probe.length === 0) return
  let cap = nextStepBoundary(computeHalfInningFeed(FEED, inning, half, side, 1), 0)
  while (cap <= probe.length) {
    const entries = computeHalfInningFeed(FEED, inning, half, side, cap)
    yield { cap, entries }
    const next = nextStepBoundary(entries, cap)
    if (next <= cap) break
    cap = next
  }
}

test('stepping the top 1st reports no hit until the batter who got it is on screen', () => {
  // The real top of the 1st: Yelich grounds out, Lara grounds out, Turang
  // doubles, Vaughn strikes out. The only hit is the THIRD plate appearance,
  // so the first two steps must report H=0.
  //
  // This is the regression. `entries` is NOT a revealed prefix —
  // computeHalfInningFeed pushes a card for every play in the half whatever the
  // stepCap — so counting hit-coded cards over the whole array reported 1 from
  // the leadoff batter's own tap, and RollingLine's totals column printed it.
  const reported = [...stepsOf(1, 'top', 'away')].map(
    ({ cap, entries }) => stepTotals(entries, cap).hits,
  )
  assert.deepEqual(reported, [0, 0, 1, 1])
})

// WHAT THIS FIXTURE CAN AND CANNOT PIN. It was trimmed to the paths the
// reveal-only selectors read, and `runners[]` kept only
// `details.isScoringEvent`, `details.earned` and `movement.end` — no
// `details.runner.id`, no `movement.start`. computeHalfInningFeed's advancement
// bookkeeping keys on the runner id to find whose card a leg belongs to, so
// `scored`/`reached` are false/0 on every card here no matter what the real
// game did (the top of the 3rd is a triple that scored, and reads `scored:
// false`). So the RUNS half of stepTotals cannot be asserted against this
// feed: any test that tried would pass on an implementation that always
// returned 0. The hits half reads `eventType`, which IS in the fixture, and is
// the half that regressed. Runs stay covered by the hand-built feeds in
// test/fixtures/mini-game.js, which carry whole runner records. Do not add a
// runs assertion here without re-capturing the fixture first.
test('no step of any half reports more hits than plate appearances it has shown', () => {
  // The invariant behind the case above, swept over the whole real game: you
  // cannot have seen more hits than batters. Stated over the at-bat CARDS
  // within the cap rather than over hit-coded ones, so it is an independent
  // check on the tally and not a restatement of it. Unclamped, the top of the
  // 7th reported all 6 of its hits on the first tap, off one card.
  let checked = 0
  for (let inning = 1; inning <= 12; inning++) {
    for (const half of ['top', 'bottom']) {
      const side = half === 'top' ? 'away' : 'home'
      for (const { cap, entries } of stepsOf(inning, half, side)) {
        const shown = entries.slice(0, cap).filter((e) => e.kind === 'atbat').length
        const { hits } = stepTotals(entries, cap)
        assert.ok(hits <= shown, `${half} ${inning} cap=${cap}: reported ${hits} hits off ${shown} at-bats`)
        checked += 1
      }
    }
  }
  assert.ok(checked > 50, `expected a real sweep, only checked ${checked} steps`)
})

test('a fully stepped half agrees exactly with its committed linescore cell', () => {
  // The other end of the clamp: once the last step lands, the running tally the
  // bar has been building must equal what revealInning prints when the half
  // commits — a partial that undercounts is as wrong as one that leaks. Hits
  // only; see the note above on why runs cannot be checked against this feed.
  for (let inning = 1; inning <= 9; inning++) {
    for (const half of ['top', 'bottom']) {
      const side = half === 'top' ? 'away' : 'home'
      const steps = [...stepsOf(inning, half, side)]
      if (steps.length === 0) continue
      const last = steps[steps.length - 1]
      const { hits } = stepTotals(last.entries, last.cap)
      assert.equal(hits, revealInning(FEED, inning, side).hits, `${half} ${inning} hits`)
    }
  }
})
