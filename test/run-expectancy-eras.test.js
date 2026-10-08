import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  accumulateGame,
  checkpointOf,
  decadeSeasons,
  mergeCheckpoints,
  schedulePks,
  sweepGames,
} from '../scripts/lib/run-expectancy/eras.mjs'
import { eraDecade, lookupEraRE, pitchFavor } from '../src/lib/runExpectancy.js'

// One half-inning: a walk (ball, ball, ball, ball), then a two-run homer on the
// first pitch. Runs on the homer: the feed's running total goes 0 -> 2.
const pitch = (balls, strikes) => ({ isPitch: true, count: { balls, strikes } })
const FEED = {
  liveData: {
    plays: {
      allPlays: [
        {
          about: { inning: 1, halfInning: 'top' },
          result: { awayScore: 0, homeScore: 0 },
          playEvents: [pitch(1, 0), pitch(2, 0), pitch(3, 0), pitch(4, 0)],
          runners: [{ details: { runner: { id: 7 } }, movement: { start: null, end: '1B', isOut: false } }],
        },
        {
          about: { inning: 1, halfInning: 'top' },
          result: { awayScore: 2, homeScore: 0 },
          playEvents: [pitch(0, 1)],
          runners: [
            { details: { runner: { id: 7 } }, movement: { start: '1B', end: 'score', isOut: false } },
            { details: { runner: { id: 8 } }, movement: { start: null, end: 'score', isOut: false } },
          ],
        },
      ],
    },
  },
}

test('accumulateGame tags each pitch with its pre-pitch state and the half-inning runs left', () => {
  const states = new Map()
  const re24 = new Map()
  accumulateGame(FEED, states, re24)
  // Walk pitches: bases empty, 0 out, counts 0-0, 1-0, 2-0, 3-0 (4 balls is never PRE-pitch). 2 runs follow each.
  assert.deepEqual(states.get('0-0-0-0'), { sum: 2, n: 1 })
  assert.deepEqual(states.get('0-0-3-0'), { sum: 2, n: 1 })
  // Homer pitch: runner on 1st, 0 out, 0-0.
  assert.deepEqual(states.get('1-0-0-0'), { sum: 2, n: 1 })
  assert.deepEqual(re24.get('0-0'), { sum: 8, n: 4 })
  assert.deepEqual(re24.get('1-0'), { sum: 2, n: 1 })
})

// Two plate appearances from bases empty, 0 out: a 3-pitch homer, then a 1-pitch
// homer. Per pitch, the 0-out empty state counts 4 pitches. Per play, it counts 2.
const TWO_PLAYS = {
  liveData: {
    plays: {
      allPlays: [
        {
          about: { inning: 1, halfInning: 'top' },
          result: { awayScore: 1, homeScore: 0 },
          playEvents: [pitch(0, 0), pitch(0, 1), pitch(1, 1)],
          runners: [{ details: { runner: { id: 7 } }, movement: { start: null, end: 'score', isOut: false } }],
        },
        {
          about: { inning: 1, halfInning: 'top' },
          result: { awayScore: 2, homeScore: 0 },
          playEvents: [pitch(0, 0)],
          runners: [{ details: { runner: { id: 8 } }, movement: { start: null, end: 'score', isOut: false } }],
        },
      ],
    },
  },
}

test('accumulateGame tags re24 per pitch by default, and per play with perPlay (#1611)', () => {
  const pitchStates = new Map()
  const pitchWise = new Map()
  accumulateGame(TWO_PLAYS, pitchStates, pitchWise)
  assert.deepEqual(pitchWise.get('0-0'), { sum: 7, n: 4 }) // 3 pitches x 2 runs, then 1 x 1 run

  const playStates = new Map()
  const playWise = new Map()
  accumulateGame(TWO_PLAYS, playStates, playWise, { perPlay: true })
  assert.deepEqual(playWise.get('0-0'), { sum: 3, n: 2 }) // one entry per play: 2 runs, then 1 run
  // The 288-bucket states stay per pitch in both modes.
  const pitches = (m) => [...m.values()].reduce((a, c) => a + c.n, 0)
  assert.equal(pitches(playStates), 4)
  assert.equal(pitches(pitchStates), 4)
})

test('accumulateGame with perPlay counts a play that has no pitch events (#1611)', () => {
  const feed = {
    liveData: {
      plays: {
        allPlays: [{ about: { inning: 1, halfInning: 'top' }, result: { awayScore: 0, homeScore: 0 }, playEvents: [], runners: [] }],
      },
    },
  }
  const re24 = new Map()
  accumulateGame(feed, new Map(), re24, { perPlay: true })
  assert.deepEqual(re24.get('0-0'), { sum: 0, n: 1 })
  const byPitch = new Map()
  accumulateGame(feed, new Map(), byPitch)
  assert.equal(byPitch.size, 0)
})

test('accumulateGame ignores a feed with no plays', () => {
  const states = new Map()
  assert.equal(accumulateGame({}, states, new Map()), false)
  assert.equal(states.size, 0)
  assert.equal(accumulateGame(FEED, states, new Map()), true)
})

test('checkpointOf turns the running Maps into plain JSON sums', () => {
  const states = new Map([['0-0-0-0', { sum: 3, n: 2 }]])
  const re24 = new Map([['0-0', { sum: 3, n: 2 }]])
  assert.deepEqual(checkpointOf('1985', 10, 9, states, re24), {
    season: '1985',
    scheduled: 10,
    gamesSwept: 9,
    states: { '0-0-0-0': { sum: 3, n: 2 } },
    re24: { '0-0': { sum: 3, n: 2 } },
  })
})

test('mergeCheckpoints adds season sums cell by cell and lists the seasons', () => {
  const a = { season: '1980', gamesSwept: 2, states: { x: { sum: 1, n: 2 } }, re24: { y: { sum: 4, n: 4 } } }
  const b = { season: '1981', gamesSwept: 3, states: { x: { sum: 2, n: 3 }, z: { sum: 1, n: 1 } }, re24: {} }
  assert.deepEqual(mergeCheckpoints([a, b]), {
    seasons: ['1980', '1981'],
    gamesSwept: 5,
    states: { x: { sum: 3, n: 5 }, z: { sum: 1, n: 1 } },
    re24: { y: { sum: 4, n: 4 } },
  })
})

test('decadeSeasons: ten seasons, except the 2020s end at 2023; nothing outside 1960-2023', () => {
  assert.deepEqual(decadeSeasons(1980), ['1980', '1981', '1982', '1983', '1984', '1985', '1986', '1987', '1988', '1989'])
  assert.deepEqual(decadeSeasons(2020), ['2020', '2021', '2022', '2023'])
  assert.equal(decadeSeasons(1960).length, 10)
  assert.deepEqual(decadeSeasons(1950), [])
  assert.deepEqual(decadeSeasons(2030), [])
  assert.deepEqual(decadeSeasons(1985), []) // not a decade start
  assert.deepEqual(decadeSeasons('1980xyz'), [])
  assert.equal(decadeSeasons('1980s').length, 10)
})

test('eraDecade maps 1960-2023 to a decade label, else null', () => {
  assert.equal(eraDecade(1985), '1980s')
  assert.equal(eraDecade('2023'), '2020s')
  assert.equal(eraDecade(1960), '1960s')
  assert.equal(eraDecade(1959), null)
  assert.equal(eraDecade(2024), null) // the current table covers it
  assert.equal(eraDecade('abc'), null)
})

const ERA_TABLE = {
  states: { '0-0-0-0': { sum: 100, n: 200 } }, // 0.5
  re24: { '0-0': { sum: 60, n: 100 } },
}

test('lookupEraRE picks the decade table, else null', () => {
  const tables = { '1990s': ERA_TABLE }
  assert.equal(lookupEraRE(1995, { baseMask: 0, outs: 0, balls: 0, strikes: 0 }, tables), 0.5)
  assert.equal(lookupEraRE(1995, { baseMask: 0, outs: 3, balls: 0, strikes: 0 }, tables), 0) // terminal outs
  assert.equal(lookupEraRE(1975, { baseMask: 0, outs: 0, balls: 0, strikes: 0 }, tables), null) // table not loaded
  assert.equal(lookupEraRE(2025, { baseMask: 0, outs: 0, balls: 0, strikes: 0 }, tables), null) // no era table
  assert.equal(lookupEraRE(1995, { baseMask: 0, outs: 0, balls: 0, strikes: 0 }), null) // no tables at all
})

test('lookupEraRE ignores the per-count cells before 1990 (partial pitch lists)', () => {
  const table = {
    states: { '0-0-0-0': { sum: 1000, n: 100 } }, // 10: would win if read
    re24: { '0-0': { sum: 50, n: 100 } }, // 0.5
  }
  const state = { baseMask: 0, outs: 0, balls: 0, strikes: 0 }
  assert.equal(lookupEraRE(1985, state, { '1980s': table }), 0.5)
  assert.equal(lookupEraRE(1995, state, { '1990s': table }), 10)
})

test('pitchFavor returns the same numbers as before for fixed inputs', () => {
  const table = {
    states: {
      '0-0-1-0': { sum: 100, n: 200 }, // 0.5
      '0-0-0-1': { sum: 50, n: 200 }, // 0.25
      '7-0-0-0': { sum: 100, n: 100 }, // 1
      '7-0-3-1': { sum: 250, n: 100 }, // 2.5
    },
    re24: {},
  }
  // Called strike on a ball: the batting side is hurt by 0.25 runs.
  assert.equal(pitchFavor(table, 0, 0, 0, 0, false), -0.25)
  // Called a strike on ball four, bases loaded: ball four forces in a run (1 + 1) vs 2.5 after the strike.
  assert.equal(pitchFavor(table, 7, 0, 3, 0, false), 0.5)
})

const game = (gamePk, detailedState, officialDate, abstractGameState = 'Final') => ({
  gamePk,
  officialDate,
  status: { abstractGameState, detailedState },
})

test('schedulePks keeps Final games under their own date and drops cancelled ones (#1611)', () => {
  const schedule = {
    dates: [
      {
        date: '2001-09-11',
        games: [
          game(1, 'Final', '2001-09-11'),
          game(2, 'Cancelled', '2001-09-11'), // abstract state is Final, but it was never played
          game(3, 'Final', '2001-10-02'), // a replay listed under its original date
          game(4, 'Scheduled', '2001-09-11', 'Preview'),
        ],
      },
      { date: '2001-10-02', games: [game(3, 'Final', '2001-10-02')] },
    ],
  }
  assert.deepEqual(schedulePks(schedule), [1, 3])
  assert.deepEqual(schedulePks({}), [])
})

test('sweepGames counts a feed with no plays and a failed fetch apart (#1611)', async () => {
  const feeds = { 10: FEED, 11: {}, 12: FEED }
  const fetchFeed = async (pk) => {
    if (pk === 13) throw new Error('503 after retries')
    return feeds[pk]
  }
  const states = new Map()
  const result = await sweepGames([10, 11, 12, 13], 2, fetchFeed, states, new Map())
  assert.equal(result.games, 2)
  assert.equal(result.noPlays, 1)
  assert.deepEqual(result.failed, [13])
  assert.equal(states.get('0-0-0-0').n, 2) // the two good feeds still add up
})

test('checkpointOf records the no-play count when it is given', () => {
  const cp = checkpointOf('2000', 10, 8, new Map(), new Map(), 2)
  assert.equal(cp.noPlays, 2)
  assert.equal('noPlays' in checkpointOf('2000', 10, 8, new Map(), new Map()), false)
})

test('sweepGames passes the perPlay option down to accumulateGame (#1611)', async () => {
  const re24 = new Map()
  await sweepGames([10], 1, async () => TWO_PLAYS, new Map(), re24, undefined, { perPlay: true })
  assert.deepEqual(re24.get('0-0'), { sum: 3, n: 2 })
})
