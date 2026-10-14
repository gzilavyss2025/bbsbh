import test from 'node:test'
import assert from 'node:assert/strict'
import { pfoulsView } from '../src/screens/player/next/modules/pfouls/pfoulsView.js'
import { foulLeaders, leagueFoulRates, pitcherFoulLine } from '../src/api/fouls.js'

// Robert Gasser 2026 (688107) as public/data/fouls/2026/07.json holds him. The 0-0 reach is 462, one
// short of MLB's 463 batters faced: one plate appearance is not in the store, and the card prints 462.
const gasser = {
  name: 'Robert Gasser', teamId: 158, g: 21, pitches: 1815, fouls: 403, whiffs: 178, isStarter: true,
  byCount: {
    reach: [462, 250, 112, 163, 182, 146, 47, 81, 119, 12, 25, 65],
    fouls: [84, 54, 35, 32, 42, 52, 6, 22, 48, 1, 4, 23],
    swings: [166, 122, 86, 75, 93, 109, 16, 55, 101, 1, 13, 59],
    hit: [95, 51, 22, 31, 33, 22, 5, 13, 19, 2, 2, 7],
    walk: [44, 21, 5, 23, 21, 12, 15, 20, 20, 6, 12, 22],
    so: [103, 68, 43, 35, 54, 64, 6, 12, 36, 2, 3, 14],
    out: [220, 110, 42, 74, 74, 48, 21, 36, 44, 2, 8, 22],
  },
}
const gasserPost = {
  name: 'Robert Gasser', teamId: 158, g: 1, pitches: 56, fouls: 8, whiffs: 6, isStarter: true,
  byCount: {
    reach: [17, 10, 4, 5, 5, 6, 2, 0, 0, 2, 2, 1],
    fouls: [1, 1, 1, 0, 3, 1, 0, 0, 0, 0, 1, 0],
    swings: [4, 5, 3, 2, 5, 6, 0, 0, 0, 0, 1, 1],
    hit: [3, 1, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0],
    walk: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0],
    so: [3, 3, 1, 0, 2, 3, 0, 0, 0, 0, 0, 0],
    out: [10, 6, 3, 3, 1, 2, 1, 0, 0, 1, 1, 1],
  },
}
const league = {
  totals: { pitches: 714483, fouls: 138195 },
  byCount: {
    reach: [183448, 91863, 39109, 70134, 71218, 54196, 23833, 36847, 44139, 7723, 15755, 25845],
    fouls: [23976, 17893, 9988, 11885, 15483, 16315, 3946, 8634, 15784, 244, 3433, 10638],
    swings: [59189, 45373, 24790, 30032, 39004, 40019, 9460, 21111, 37947, 563, 8088, 25165],
    hit: [39849, 18403, 6089, 14619, 13969, 8482, 4207, 6790, 6855, 724, 2064, 3268],
    walk: [18037, 5748, 1564, 11791, 7827, 3750, 7673, 7890, 6110, 4975, 7442, 8567],
    so: [40700, 27807, 17931, 12885, 19421, 23328, 3329, 8029, 16608, 636, 2058, 6984],
    out: [84862, 39905, 13525, 30839, 30001, 18636, 8624, 14138, 14566, 1388, 4191, 7026],
  },
}
// A made-up pool of five other arms over 200 pitches, and one under the floor.
const others = {
  1: { pitches: 1000, fouls: 250, whiffs: 100 }, // 25.0%, 2.50, 250
  2: { pitches: 2000, fouls: 300, whiffs: 200 }, // 15.0%, 1.50, 300
  3: { pitches: 800, fouls: 200, whiffs: 50 }, // 25.0%, 4.00, 200
  4: { pitches: 500, fouls: 90, whiffs: 60 }, // 18.0%, 1.50, 90
  5: { pitches: 2500, fouls: 500, whiffs: 300 }, // 20.0%, 1.67, 500
  6: { pitches: 150, fouls: 60, whiffs: 5 }, // under 200: not in the pool
}
// One more arm with no whiff: in the foul rate pool, out of the per whiff one, and it makes the
// fouled off middle the mean of 250 and 251.
const noWhiff = { 7: { pitches: 400, fouls: 251, whiffs: 0 } }
const whole = { pitchers: { ...others, 688107: gasser }, league }
const line = (row) => pitcherFoulLine({ pitchers: { 9: row } }, 9)
const view = (over = {}) =>
  pfoulsView({ id: 688107, line: line(gasser), league: leagueFoulRates(whole), pool: foulLeaders(whole).pitchers.byFoulPct, ...over })

test('the grid is his batters by count: 12 cells, the base is the 0-0 reach', () => {
  const v = view()
  assert.equal(v.pa, 462)
  assert.deepEqual(v.cells.map((c) => c.name), ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '3-2'])
  assert.equal(v.cells.reduce((a, c) => a + c.fouls, 0), 403)
  assert.equal(v.cells[0].reach, 462)
  assert.equal(v.cells[0].fouls, 84)
  assert.equal(v.cells[11].reach, 65)
  assert.equal(v.cells[11].reachPct, '14%')
  assert.equal(v.thin, null)
})

test('a cell reads from his side: rate against the league, ends led by the strikeout', () => {
  const c = view().cells[8] // 2-2
  assert.equal(c.two, true)
  assert.equal(c.rate, '47.5%')
  assert.equal(c.lgRate, '41.6%')
  assert.equal(c.diff, '+5.9 pts')
  assert.deepEqual(c.ends.map((e) => [e.name, e.n]), [['Strikeout', 36], ['Out in play', 44], ['Walk', 20], ['Hit', 19]])
  assert.equal(c.ends[0].pct, '30%')
})

test('the heat is fouls per swing, scaled to his hottest count of 10+ swings', () => {
  const v = view()
  assert.equal(v.cells[0].heat, 1) // 0-0: 84 fouls on 166 swings
  assert.equal(v.cells[9].heat, 0) // 3-0: 1 foul on 1 swing is too few to shade
  assert.equal(v.top, 0) // the count he fouled most in opens the panel
})

test('the baseline: foul rate, per whiff and fouled off, each with a rank in the pool', () => {
  const [rate, whiff, fouled] = view().baseline
  assert.equal(rate.his, '22.2%')
  assert.equal(rate.lg, '19.3%')
  assert.equal(rate.lgName, 'League')
  assert.equal(whiff.lgName, 'MLB middle')
  assert.equal(rate.gapNote, '+2.9 pts for him')
  assert.equal(rate.sub, '403 of 1,815 pitches')
  assert.equal(rate.rank, '3rd most of 6 pitchers with 200+ pitches')
  assert.equal(whiff.his, '2.26')
  assert.equal(whiff.lg, '1.96') // the middle of 1.50 1.50 1.67 2.26 2.50 4.00
  assert.equal(whiff.rank, '3rd most of 6 pitchers with 200+ pitches')
  assert.equal(fouled.his, '403')
  assert.equal(fouled.lg, '275')
  assert.equal(fouled.sub, 'in 21 games')
  assert.equal(fouled.rank, '2nd most of 6 pitchers with 200+ pitches')
})

test('a pitcher with no whiff is not ranked per whiff, and the fouled off middle is a whole count', () => {
  const w = { pitchers: { ...others, ...noWhiff, 688107: gasser }, league }
  const [rate, whiff, fouled] = view({ pool: foulLeaders(w).pitchers.byFoulPct }).baseline
  assert.equal(rate.rank, '4th most of 7 pitchers with 200+ pitches')
  assert.equal(whiff.rank, '3rd most of 6 pitchers with 200+ pitches')
  assert.equal(fouled.lg, '251') // the mean of 250 and 251, rounded
})

test('without the whole file his own numbers stay and the league parts drop', () => {
  const v = view({ league: null, pool: null })
  assert.equal(v.cells[8].lgRate, '—')
  assert.equal(v.cells[8].railTick, null)
  const [rate, whiff] = v.baseline
  assert.equal(rate.his, '22.2%')
  assert.equal(rate.lg, '—')
  assert.equal(rate.lgSub, 'No league count')
  assert.equal(whiff.rank, '')
})

test('under 200 pitches the line shows with no rank', () => {
  const v = view({ id: 6, line: line({ ...others[6], byCount: gasser.byCount }) })
  assert.equal(v.baseline[0].his, '40.0%')
  assert.equal(v.baseline[0].rank, 'Not ranked: under 200 pitches')
})

test('a thin postseason keeps the baseline and hides the grid, with no rank', () => {
  const v = view({ line: line(gasserPost), pool: null, post: true })
  assert.equal(v.pa, 17)
  assert.equal(v.thin, 'One postseason start, 17 batters: too few to draw the count grid.')
  assert.equal(v.baseline[0].his, '14.3%')
  assert.equal(v.baseline[1].his, '1.33')
  assert.equal(v.baseline[2].sub, 'in 1 game')
  assert.equal(v.baseline[0].rank, 'Not ranked in the postseason')
})

test('no line, or a line with no cells, is no view', () => {
  assert.equal(view({ line: null }), null)
  assert.equal(view({ line: line({ ...gasser, byCount: undefined }) }), null)
})
