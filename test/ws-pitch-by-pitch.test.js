// The World Series scouting report's Pitch by pitch card (#2316, slice 2): the model that turns
// the arsenal and the hitters' grids into table rows, and the card's slot in the list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EDGE_BAND, pitchByPitchModel, seatOf, shares, topHitters } from '../src/lib/postseason/worldseries/scouting/pitchByPitch.js'
import { surnameOf } from '../src/lib/postseason/worldseries/scouting/filmRoom.js'
import { scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'

// One counter cell holds `pa` plate appearances worth `woba` in total.
const cell = (pa, woba) => {
  const z = () => new Array(25).fill(0)
  const c = { pitches: z(), swings: z(), whiffs: z(), paEnd: z(), wobaFixed: z(), bipUntracked: z(), xwobaBip: z() }
  c.paEnd[0] = pa
  c.wobaFixed[0] = woba
  return c
}
// A grid whose every pitch in `byCode` ({ FF: [pa, woba] }) was thrown by a righty to a righty.
const grid = (byCode) => ({
  xwoba: true,
  reg: { mlb: Object.fromEntries(Object.entries(byCode).map(([k, [pa, w]]) => [k, { R: { R: cell(pa, w) } }])) },
  post: null,
})
const arsenal = [
  { code: 'FF', pitches: 500 },
  { code: 'SL', pitches: 300 },
  { code: 'CH', pitches: 200 },
]
const run = (hit, lg, extra = {}) => pitchByPitchModel({ arsenal, hitters: [grid(hit)], league: grid(lg), hand: 'R', ...extra })
const edgeOf = (m, code) => m.rows.find((r) => r.code === code).edge

test('uses sum to 100, biggest pitch first', () => {
  const m = run({ FF: [100, 30] }, { FF: [1000, 320] })
  assert.deepEqual(m.rows.map((r) => r.code), ['FF', 'SL', 'CH'])
  assert.equal(m.rows.reduce((s, r) => s + r.uses, 0), 100)
})

test('uses still sum to 100 when the shares do not round clean', () => {
  const a = [{ code: 'FF', pitches: 1 }, { code: 'SL', pitches: 1 }, { code: 'CH', pitches: 1 }]
  const m = pitchByPitchModel({ arsenal: a, hitters: [grid({ FF: [100, 30] })], league: grid({ FF: [1000, 300] }), hand: 'R' })
  assert.equal(m.rows.reduce((s, r) => s + r.uses, 0), 100)
})

test('shares add up to 100 when the rounding is short by more than one point', () => {
  // The Brewers' fly balls on the Park fit card (115, 246, 280): 17.9, 38.4 and 43.7 floor to 98,
  // so two shares take a point. The card showed 18, 38, 43, which adds to 99.
  assert.deepEqual(shares([115, 246, 280]), [18, 38, 44])
  // Seven equal parts: 14.29 each floors to 98, so two of them take the extra point.
  assert.equal(shares(new Array(7).fill(1)).reduce((a, b) => a + b, 0), 100)
})

test('a pitch under the use floor is left out and the rest still sum to 100', () => {
  const a = [{ code: 'FF', pitches: 970 }, { code: 'KN', pitches: 30 }]
  const m = pitchByPitchModel({ arsenal: a, hitters: [grid({ FF: [100, 30] })], league: grid({ FF: [1000, 300] }), hand: 'R' })
  assert.deepEqual(m.rows.map((r) => r.code), ['FF'])
  assert.equal(m.rows[0].uses, 100)
})

test('xwOBA is pooled over the hitters and set against the league', () => {
  const m = pitchByPitchModel({
    arsenal, hand: 'R', league: grid({ FF: [1000, 320] }),
    hitters: [grid({ FF: [20, 6] }), grid({ FF: [20, 5.2] })],
  })
  const ff = m.rows[0]
  assert.equal(ff.xwoba.toFixed(3), '0.280')
  assert.equal(ff.league.toFixed(3), '0.320')
})

test('the edge call: Arm below, Bats above, Even inside the band', () => {
  const lg = { FF: [1000, 300], SL: [1000, 300], CH: [1000, 300] }
  const hit = (x) => [100, x] // x / 100 = hitters' xwOBA
  const m = run({ FF: hit(27.9), SL: hit(32.1), CH: hit(29.5) }, lg)
  assert.equal(edgeOf(m, 'FF'), 'arm')
  assert.equal(edgeOf(m, 'SL'), 'bats')
  assert.equal(edgeOf(m, 'CH'), 'even')
})

test('the band is .020: a .015 gap reads Even and a .025 gap reads Arm or Bats', () => {
  const lg = { FF: [1000, 300], SL: [1000, 300], CH: [1000, 300], KN: [1000, 300] }
  const arsenal4 = [...arsenal, { code: 'KN', pitches: 100 }]
  const m = pitchByPitchModel({
    arsenal: arsenal4, hand: 'R', league: grid(lg),
    hitters: [grid({ FF: [100, 28.5], SL: [100, 31.5], CH: [100, 27.5], KN: [100, 32.5] })],
  })
  assert.equal(EDGE_BAND, 0.02)
  assert.equal(edgeOf(m, 'FF'), 'even')
  assert.equal(edgeOf(m, 'SL'), 'even')
  assert.equal(edgeOf(m, 'CH'), 'arm')
  assert.equal(edgeOf(m, 'KN'), 'bats')
})

test('the band is strict at the boundary', () => {
  const lg = { FF: [1000, 300], SL: [1000, 300] }
  const m = run({ FF: [1000, 300 - EDGE_BAND * 1000], SL: [1000, 300 + EDGE_BAND * 1000] }, lg)
  assert.equal(edgeOf(m, 'FF'), 'even')
  assert.equal(edgeOf(m, 'SL'), 'even')
})

test('a pitch with no figure gets no call; a pitch with figures inside the band is Even', () => {
  const m = run({ FF: [100, 30], SL: [3, 0] }, { FF: [1000, 300], SL: [1000, 300], CH: [1000, 300] })
  assert.equal(edgeOf(m, 'FF'), 'even')
  for (const code of ['SL', 'CH']) {
    assert.equal(m.rows.find((r) => r.code === code).xwoba, null)
    assert.equal(edgeOf(m, code), null)
  }
})

test('a row with the hitters\' figure but no league figure gets no call', () => {
  const m = run({ FF: [100, 30] }, { CH: [1000, 300] })
  assert.equal(m.rows[0].league, null)
  assert.equal(edgeOf(m, 'FF'), null)
})

test('no card when no row has a figure', () => {
  assert.equal(run({}, { FF: [1000, 300] }), null)
  assert.equal(run({ FF: [3, 1] }, { FF: [1000, 300] }), null)
})

test('two unknown pitch codes get distinct row keys, and the hitter count is the grids that loaded', () => {
  const a = [{ code: 'XX', pitches: 50 }, { code: 'YY', pitches: 50 }]
  const m = pitchByPitchModel({ arsenal: a, hitters: [grid({ XX: [100, 30] }), null], league: grid({ XX: [1000, 300] }), hand: 'R' })
  assert.deepEqual(m.rows.map((r) => r.code), ['UN', 'UN'])
  assert.equal(new Set(m.rows.map((r) => r.key)).size, 2)
  assert.equal(m.hitters, 1)
})

test('seatOf: the club\'s own seat, and nothing when the club is in neither', () => {
  const game = { awayId: 1, homeId: 2 }
  assert.equal(seatOf(game, 1), 'away')
  assert.equal(seatOf(game, 2), 'home')
  assert.equal(seatOf(game, 3), null)
})

test('surnameOf drops a suffix', () => {
  assert.equal(surnameOf('Luis Garcia Jr.'), 'Garcia')
  assert.equal(surnameOf('Ken Griffey III'), 'Griffey')
  assert.equal(surnameOf('Jacob Misiorowski'), 'Misiorowski')
})

test('no card without an arsenal, a hitter grid or a usable grid', () => {
  assert.equal(pitchByPitchModel({ arsenal: [], hitters: [grid({})], league: grid({}), hand: 'R' }), null)
  assert.equal(pitchByPitchModel({ arsenal, hitters: [], league: grid({}), hand: 'R' }), null)
  assert.equal(pitchByPitchModel({ arsenal, hitters: [null], league: null, hand: 'R' }), null)
  assert.equal(pitchByPitchModel({ arsenal: null, hitters: null, league: null, hand: '' }), null)
})

test('topHitters: most plate appearances first, pitchers out, capped', () => {
  const s = (id, pa, pos = 'LF') => ({ player: { id }, position: { abbreviation: pos }, stat: { plateAppearances: pa } })
  assert.deepEqual(topHitters([s(1, 5), s(2, 40), s(3, 90, 'P'), s(4, 12)], 2), [2, 4])
  assert.deepEqual(topHitters(undefined), [])
})

test('the card sits at rank 4 on an off day and 3 on a game day, and drops without data', () => {
  const i = { pitchByPitch: { rows: [{}] }, edges: [{ id: 1 }], nineKeys: true, plateUmpire: { name: 'A' } }
  assert.deepEqual(scoutingModel({ dayType: 'off', ...i }).map((c) => c.id), ['nine-keys', 'matchup-edges', 'pitch-by-pitch'])
  assert.deepEqual(scoutingModel({ dayType: 'game', ...i }).map((c) => c.id), ['matchup-edges', 'umpire-edge', 'pitch-by-pitch'])
  assert.equal(scoutingModel({ dayType: 'off', edges: [{ id: 1 }] }).some((c) => c.id === 'pitch-by-pitch'), false)
})
