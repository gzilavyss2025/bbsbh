import assert from 'node:assert/strict'
import test from 'node:test'
import { handsUrl, shapeUpcoming, upcomingUrl } from '../../src/api/postseason/upcoming.js'

test('the read asks for park and probables and for no result field at all', () => {
  const url = upcomingUrl([849830, 849825])
  assert.match(url, /gamePks=849830,849825/)
  assert.match(url, /hydrate=probablePitcher,venue/)
  const fields = new URL(`https://x${url}`).searchParams.get('fields').split(',')
  for (const banned of [
    'status',
    'abstractGameState',
    'score',
    'isWinner',
    'linescore',
    'seriesStatus',
    'leagueRecord',
    'resumeGameDate',
  ]) {
    assert.equal(fields.includes(banned), false, `${banned} must not be requested`)
  }
})

test('the hands read names ids and the hand code only', () => {
  assert.equal(handsUrl([1, 2]), '/api/v1/people?personIds=1,2&fields=people,id,pitchHand,code')
})

// Trimmed from a live response (2026-10-01): Game 1 names a home probable only.
const live = {
  dates: [
    {
      date: '2026-10-03',
      games: [
        {
          gamePk: 849830,
          officialDate: '2026-10-03',
          teams: {
            away: { team: { id: 135 } },
            home: { team: { id: 158 }, probablePitcher: { id: 694819, fullName: 'Jacob Misiorowski' } },
          },
          venue: { id: 32, name: 'American Family Field' },
        },
      ],
    },
  ],
}

test('a side with no probable is null, and a hand is attached when known', () => {
  const shaped = shapeUpcoming(live, { 694819: 'R' })
  assert.deepEqual(shaped[849830], {
    date: '2026-10-03',
    awayId: 135,
    homeId: 158,
    venue: { id: 32, name: 'American Family Field' },
    away: null,
    home: { id: 694819, name: 'Jacob Misiorowski', hand: 'R' },
  })
})

test('a missing hand reads as empty, never as a guess', () => {
  assert.equal(shapeUpcoming(live, {})[849830].home.hand, '')
})

test('an empty or failed body shapes to nothing', () => {
  assert.deepEqual(shapeUpcoming(null), {})
  assert.deepEqual(shapeUpcoming({ dates: [] }), {})
})
