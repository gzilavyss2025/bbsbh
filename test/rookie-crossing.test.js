import assert from 'node:assert/strict'
import test from 'node:test'
import { findCrossingSeason, crossingDateFromGameLog, isAlNlSplit } from '../scripts/lib/rookie-crossing.mjs'

const nnl = (season, ip) => ({ season, league: { id: 430, name: 'Negro National League (I)' }, stat: { inningsPitched: ip } })
const nl = (season, ip) => ({ season, league: { id: 104, name: 'National League' }, stat: { inningsPitched: ip } })
const al = (season, ab) => ({ season, league: { id: 103, name: 'American League' }, stat: { atBats: ab } })

// --- isAlNlSplit ---------------------------------------------------------

test('isAlNlSplit is true only for the AL/NL league ids', () => {
  assert.equal(isAlNlSplit({ league: { id: 103 } }), true)
  assert.equal(isAlNlSplit({ league: { id: 104 } }), true)
  assert.equal(isAlNlSplit({ league: { id: 430 } }), false)
  assert.equal(isAlNlSplit({ league: null }), false)
  assert.equal(isAlNlSplit({}), false)
})

// --- findCrossingSeason: the Pedro Dibut regression -----------------------
// Real statsapi shape for personId 113334: a 1923 Negro National League (I)
// season (116.2 IP, league.id 430) precedes his real 1924 Reds/NL debut.
// Unfiltered, cumulative outs cross 50 IP already in 1923 — a season before
// his mlbDebutDate. His real AL/NL career (36.2 IP across 1924-25) never
// reaches 50 IP on its own, so the fixed crossing season must be null, not 1923.

test('a pre-integration Negro League season never counts toward the AL/NL rookie limit', () => {
  const splits = [nnl('1923', '116.2'), nl('1924', '36.2'), nl('1925', '0.0')]
  assert.equal(findCrossingSeason(splits, 'pitching'), null)
})

// --- findCrossingSeason: ordinary AL/NL-only careers still work -----------

test('an ordinary hitter still crosses the AB limit within his real AL/NL career', () => {
  const splits = [al('2019', '100'), al('2020', '40')]
  assert.deepEqual(findCrossingSeason(splits, 'hitting'), { crossingSeason: 2020, priorTotal: 100 })
})

test('a career that never reaches the limit returns null', () => {
  const splits = [al('2019', '20'), al('2020', '15')]
  assert.equal(findCrossingSeason(splits, 'hitting'), null)
})

// --- crossingDateFromGameLog ------------------------------------------------

test('crossingDateFromGameLog skips a non-AL/NL game when pinning the exact date', () => {
  const games = [
    { date: '1923-06-30', league: { id: 430 }, stat: { atBats: '5' } }, // Negro League cameo mid-AL/NL-season
    { date: '2020-04-05', league: { id: 104 }, stat: { atBats: '100' } },
    { date: '2020-04-10', league: { id: 104 }, stat: { atBats: '20' } },
  ]
  assert.equal(crossingDateFromGameLog(games, 'hitting', 20), '2020-04-10')
})

test('crossingDateFromGameLog returns null if the AL/NL games never reach the limit', () => {
  const games = [{ date: '2020-04-05', league: { id: 104 }, stat: { atBats: '10' } }]
  assert.equal(crossingDateFromGameLog(games, 'hitting', 0), null)
})
