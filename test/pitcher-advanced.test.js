// The pitcher page's three new full-season slices: the Advanced rate card
// (advancedPitchingView, fed by person-fetch's season/seasonAdvanced/
// sabermetrics bundle), the curated Situational splits ledger
// (situationalSplitsView), the league-rank chip strip (pitchingRanksView),
// and the game log's quality-start flag (gameLogView). All pure shaping —
// fixtures mirror live statsapi field names/values captured for player
// 694819 on 2026-08-02 (proportions arrive as ".406"-style strings, saber
// figures as floats, rankings as per-league rank numbers).
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advancedPitchingView,
  situationalSplitsView,
  pitchingRanksView,
  gameLogView,
} from '../src/api/person.js'

// ---------------------------------------------------------------------------
// advancedPitchingView
// ---------------------------------------------------------------------------

const STARTER_BUNDLE = {
  season: { avg: '.145', gamesStarted: 21 },
  advanced: {
    strikeoutsPerPlateAppearance: '.406',
    walksPerPlateAppearance: '.060',
    strikeoutsMinusWalksPercentage: '.346',
    ballsInPlay: 247,
    groundOuts: 92,
    groundHits: 23,
    ops: '.445',
    qualityStarts: 13,
    inheritedRunners: 0,
    inheritedRunnersScored: 0,
  },
  saber: { fip: 2.02385, eraMinus: 37.7826 },
}

test('advancedPitchingView shapes the starter card from a live-shaped bundle', () => {
  const view = advancedPitchingView(STARTER_BUNDLE)
  const byLabel = Object.fromEntries(view.facts.map((f) => [f.label, f.value]))
  assert.equal(byLabel.FIP, '2.02')
  assert.equal(byLabel['ERA−'], '38')
  assert.equal(byLabel['K%'], '40.6%')
  assert.equal(byLabel['BB%'], '6.0%')
  assert.equal(byLabel['K−BB%'], '34.6%')
  // (92 + 23) / 247 = 46.6% → rounds to 47%
  assert.equal(byLabel['Ground ball %'], '47%')
  assert.equal(byLabel['Opp. AVG / OPS'], '.145 / .445')
  assert.equal(byLabel['Quality starts'], '13 of 21')
  // Every fact carries its own explainer for the card's per-fact "i" glyph.
  assert.ok(view.facts.every((f) => typeof f.note === 'string' && f.note.length > 0))
})

test('advancedPitchingView gives a reliever the inherited-runners cell, not QS', () => {
  const view = advancedPitchingView({
    season: { avg: '.210', gamesStarted: 0 },
    advanced: {
      ...STARTER_BUNDLE.advanced,
      qualityStarts: 0,
      inheritedRunners: 14,
      inheritedRunnersScored: 3,
    },
    saber: STARTER_BUNDLE.saber,
  })
  const labels = view.facts.map((f) => f.label)
  assert.ok(!labels.includes('Quality starts'))
  const ir = view.facts.find((f) => f.label === 'Inherited scored')
  assert.equal(ir.value, '3 of 14')
})

test('advancedPitchingView degrades to null on a missing or sparse bundle', () => {
  assert.equal(advancedPitchingView(null), null)
  assert.equal(advancedPitchingView({ season: null, advanced: null, saber: null }), null)
  // A saber-only bundle (two facts) is below the four-fact floor.
  assert.equal(
    advancedPitchingView({ season: null, advanced: null, saber: { fip: 3.1, eraMinus: 99 } }),
    null,
  )
})

// ---------------------------------------------------------------------------
// situationalSplitsView
// ---------------------------------------------------------------------------

function sitSplit(code, stat) {
  return { split: { code }, stat }
}
const SIT_STAT = {
  battersFaced: 100, avg: '.170', obp: '.242', ops: '.509',
  homeRuns: 2, rbi: 11, doubles: 3, triples: 0, strikeOuts: 40, baseOnBalls: 6,
}

test('situationalSplitsView keeps the curated order and splitSide shape', () => {
  // Deliberately shuffled input — the view orders by the curated list, not
  // arrival order.
  const view = situationalSplitsView(
    ['2s', 'risp', 'r0', 'bc', 'ron', 'ac'].map((c) => sitSplit(c, SIT_STAT)),
    'pitching',
  )
  assert.deepEqual(
    view.map((r) => r.label),
    ['Bases empty', 'Runners on', 'RISP', 'Ahead in count', 'Behind in count', 'Two strikes'],
  )
  const risp = view.find((r) => r.label === 'RISP')
  assert.equal(risp.side.count, 100)
  assert.equal(risp.side.slash, '.170/.242/.509')
  assert.equal(risp.side.soPct, '40%')
})

test('situationalSplitsView needs most of the set — stray rows are noise', () => {
  const view = situationalSplitsView(
    ['risp', '2s'].map((c) => sitSplit(c, SIT_STAT)),
    'pitching',
  )
  assert.equal(view, null)
  assert.equal(situationalSplitsView([], 'pitching'), null)
})

// ---------------------------------------------------------------------------
// pitchingRanksView
// ---------------------------------------------------------------------------

test('pitchingRanksView keeps top-10 ranks only, sorted, capped at four chips', () => {
  const view = pitchingRanksView([
    {
      league: { name: 'National League' },
      stat: {
        era: '1', whip: '2', strikeOuts: 1, wins: 7, avg: '3',
        inningsPitched: '9', gamesStarted: 20, balks: 6,
      },
    },
  ])
  assert.equal(view.league, 'NL')
  // era 1, K 1, whip 2, avg 3, wins 7, IP 9 all qualify — capped to the top 4.
  assert.equal(view.items.length, 4)
  assert.deepEqual(view.items.map((i) => i.text), ['1st', '1st', '2nd', '3rd'])
  assert.deepEqual(view.items.map((i) => i.label), ['ERA', 'K', 'WHIP', 'Opp. AVG'])
  // gamesStarted/balks are not curated rank stats, and 20th wouldn't qualify.
  assert.ok(!view.items.some((i) => i.label === 'Wins' && i.rank === 20))
})

test('pitchingRanksView returns null with no qualifying rank or no split', () => {
  assert.equal(pitchingRanksView([]), null)
  assert.equal(
    pitchingRanksView([{ league: { name: 'American League' }, stat: { era: '38', wins: 22 } }]),
    null,
  )
})

// ---------------------------------------------------------------------------
// gameLogView — quality-start flag
// ---------------------------------------------------------------------------

function logSplit(date, stat) {
  return { date, isHome: true, opponent: { teamName: 'Cubs' }, game: { gamePk: 1 }, stat }
}

test('gameLogView marks quality starts (6+ IP, ≤3 ER, as a starter) and only those', () => {
  const rows = gameLogView(
    [
      // 7.0 IP, 3 ER start — QS.
      logSplit('2026-07-28', { gamesStarted: 1, inningsPitched: '7.0', earnedRuns: 3, hits: 5, runs: 3, baseOnBalls: 1, strikeOuts: 8 }),
      // 6.0 IP exactly, 0 ER — QS (the boundary).
      logSplit('2026-07-22', { gamesStarted: 1, inningsPitched: '6.0', earnedRuns: 0, hits: 2, runs: 0, baseOnBalls: 0, strikeOuts: 10 }),
      // 5.2 IP, 1 ER — one out short.
      logSplit('2026-07-16', { gamesStarted: 1, inningsPitched: '5.2', earnedRuns: 1, hits: 4, runs: 1, baseOnBalls: 2, strikeOuts: 6 }),
      // 7.0 IP, 4 ER — one run over.
      logSplit('2026-07-10', { gamesStarted: 1, inningsPitched: '7.0', earnedRuns: 4, hits: 9, runs: 4, baseOnBalls: 0, strikeOuts: 5 }),
      // 6.0 IP of long relief — no start, no QS.
      logSplit('2026-07-04', { gamesStarted: 0, inningsPitched: '6.0', earnedRuns: 1, hits: 3, runs: 1, baseOnBalls: 1, strikeOuts: 7 }),
    ],
    'pitching',
    null,
    6,
  )
  assert.deepEqual(rows.rows.map((r) => r.qs), [true, true, false, false, false])
})

test('gameLogView leaves hitters unflagged', () => {
  const rows = gameLogView(
    [logSplit('2026-07-28', { hits: 2, atBats: 4, doubles: 1, rbi: 2, strikeOuts: 1 })],
    'hitting',
    null,
    8,
  )
  assert.equal(rows.rows[0].qs, false)
})
