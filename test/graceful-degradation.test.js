// The MiLB graceful-degradation convention has no structural guard, only
// reviewer discipline: CLAUDE.md mandates that every selector fall back to
// ''/null/[]/— on the sparse or missing feeds the minor-league levels serve
// (no lineup, no weather, no coaches, no pitch tracking) rather than crash, so
// callers can render "not posted yet". This locks that in — a single throw on a
// degraded feed is a real crash on an AA box score, so we feed each selector a
// spectrum of empty/sparse inputs and assert it never throws.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  selectLineup,
  selectOpposingPitcher,
  selectOpposingDefense,
  selectBullpen,
  selectBench,
  selectTeamMeta,
  selectOfficials,
  selectGameInfo,
  selectBirthdayIds,
  selectDelays,
  selectRegulationInnings,
  selectInningCount,
  selectHasStarted,
  selectIsFinal,
  selectGameStatus,
  selectPrePitchChanges,
  dayWord,
  entryIndexById,
} from '../src/api/select.js'
import { revealInning, revealTotals } from '../src/api/linescore.js'
import { computeDerivedByInning, computeGameSuperlatives } from '../src/api/derive.js'
import { computePitcherLines } from '../src/api/pitchers.js'
import { defenseEntering } from '../src/api/defense.js'
import { lineupEntering } from '../src/api/battingorder.js'
import { entrantsBeforeFirstPitch } from '../src/api/enteringHalf.js'

// A spectrum of degraded feeds, coarsest first: nothing at all, then partial
// scaffolding a thin MiLB feed genuinely posts (a linescore with no innings, a
// boxscore team with no players, gameData with no player index).
const EMPTY_FEEDS = {
  'null': null,
  'undefined': undefined,
  'empty object': {},
  'liveData only': { liveData: {} },
  'plays but no players': { liveData: { plays: { allPlays: [] } } },
  'boxscore team, no players': {
    gameData: { teams: { away: {}, home: {} } },
    liveData: { boxscore: { teams: { away: {}, home: {} } }, linescore: {} },
  },
}

// Each selector as a thunk over a feed — covers every arg shape the callers use.
const SELECTORS = {
  selectLineup: (f) => selectLineup(f, 'away'),
  selectOpposingPitcher: (f) => selectOpposingPitcher(f, 'away'),
  selectOpposingDefense: (f) => selectOpposingDefense(f, 'home'),
  selectBullpen: (f) => selectBullpen(f, 'home'),
  selectBench: (f) => selectBench(f, 'away'),
  selectTeamMeta: (f) => selectTeamMeta(f, 'home'),
  selectOfficials,
  selectGameInfo,
  selectBirthdayIds,
  selectDelays,
  selectRegulationInnings,
  selectInningCount,
  selectHasStarted,
  selectIsFinal,
  selectGameStatus,
  selectPrePitchChanges: (f) => selectPrePitchChanges(f, 1, 'top'),
  dayWord,
  entryIndexById,
  revealInning: (f) => revealInning(f, 1, 'away'),
  revealTotals: (f) => revealTotals(f, 'home'),
  computeDerivedByInning,
  computeGameSuperlatives,
  computePitcherLines: (f) => computePitcherLines(f, 5),
  defenseEntering: (f) => defenseEntering(f, 'home', 1, 'top', -1),
  lineupEntering: (f) => lineupEntering(f, 'away', 1, 'top', -1),
  entrantsBeforeFirstPitch: (f) => entrantsBeforeFirstPitch(f, 1, 'top'),
}

for (const [feedName, feed] of Object.entries(EMPTY_FEEDS)) {
  test(`no selector throws on a ${feedName} feed`, () => {
    for (const [name, fn] of Object.entries(SELECTORS)) {
      assert.doesNotThrow(() => fn(feed), `${name} threw on ${feedName}`)
    }
  })
}

// Spot-check the actual fallback *shapes* the callers rely on, not just "no
// throw" — a selector that returned undefined instead of ''/[] would also
// "not throw" but still break a caller doing .map or string interpolation.
test('array selectors degrade to an empty array, never undefined', () => {
  for (const feed of [null, {}, { liveData: {} }]) {
    assert.deepEqual(selectLineup(feed, 'away'), [])
    assert.deepEqual(selectOpposingDefense(feed, 'home'), [])
    assert.deepEqual(selectBullpen(feed, 'home'), [])
    assert.deepEqual(selectBench(feed, 'away'), [])
    assert.deepEqual(selectOfficials(feed), [])
    assert.deepEqual(selectDelays(feed), [])
    assert.deepEqual(selectPrePitchChanges(feed, 1, 'top'), [])
    assert.deepEqual(computePitcherLines(feed, 5), { away: [], home: [] })
  }
})

test('selectTeamMeta degrades every string field to empty, not undefined', () => {
  const meta = selectTeamMeta({}, 'home')
  for (const key of ['name', 'teamName', 'clubName', 'locationName', 'abbreviation']) {
    assert.equal(meta[key], '', key)
  }
  assert.equal(meta.probablePitcher, null)
})

test('selectGameInfo degrades venue/weather/attendance to empty strings', () => {
  const info = selectGameInfo({})
  assert.equal(info.venue, '')
  assert.equal(info.weather, '')
  assert.equal(info.attendance, '')
  assert.equal(info.firstPitch, '')
})

test('regulation/inning counts fall back to the 9-inning default', () => {
  assert.equal(selectRegulationInnings({}), 9)
  assert.equal(selectRegulationInnings(null), 9)
  assert.equal(selectInningCount({}), 9)
})

test('dayWord defaults to "tonight" when the feed has not posted day/night', () => {
  assert.equal(dayWord({}), 'tonight')
  assert.equal(dayWord(null), 'tonight')
})
