import test from 'node:test'
import assert from 'node:assert/strict'
import { foulsView } from '../src/screens/player/next/modules/fouls/foulsView.js'
import { batterFoulLine, leagueFoulRates } from '../src/api/fouls.js'

// Brice Turang 2026 (668930), the by-count cells and the totals as the store holds them. The cells
// sum to 574 fouls and the season total is 573: the known gap (#1979), left as it is.
const turang = {
  name: 'Brice Turang', g: 150, pa: 677, pitchesSeen: 2890, fouls: 573,
  bestPa: { fouls: 6 },
  byCount: {
    reach: [677, 349, 158, 271, 281, 215, 114, 175, 187, 35, 82, 122],
    fouls: [105, 72, 46, 36, 67, 63, 19, 32, 69, 0, 11, 54],
    swings: [199, 143, 104, 82, 133, 155, 35, 86, 157, 0, 29, 126],
    hit: [156, 67, 14, 62, 71, 38, 20, 42, 30, 1, 12, 19],
    walk: [88, 25, 5, 63, 37, 16, 46, 44, 25, 28, 46, 43],
    so: [171, 125, 86, 46, 71, 88, 14, 31, 71, 3, 9, 27],
    out: [262, 132, 53, 100, 102, 73, 34, 58, 61, 3, 15, 33],
  },
}
const lg = {
  totals: { pitches: 713910, fouls: 138093 },
  medianBestPaFouls: 6,
  byCount: {
    reach: [183133, 91716, 39047, 70007, 71103, 54102, 23791, 36798, 44073, 7710, 15732, 25807],
    fouls: [23940, 17859, 9969, 11864, 15451, 16284, 3942, 8622, 15760, 244, 3423, 10619],
    swings: [59099, 45296, 24752, 29969, 38928, 39949, 9438, 21078, 37891, 563, 8075, 25131],
    hit: [39776, 18369, 6077, 14591, 13945, 8467, 4199, 6781, 6843, 721, 2058, 3259],
    walk: [17996, 5732, 1559, 11768, 7811, 3741, 7659, 7877, 6098, 4965, 7429, 8549],
    so: [40643, 27765, 17905, 12870, 19393, 23289, 3326, 8022, 16586, 636, 2057, 6979],
    out: [84718, 39850, 13506, 30778, 29954, 18605, 8607, 14118, 14546, 1388, 4188, 7020],
  },
}
const view = (over = {}) =>
  foulsView({ line: batterFoulLine({ batters: { 1: { ...turang, ...over } } }, 1), league: leagueFoulRates({ league: lg }) })

test('the grid has 12 cells in balls-then-strikes order', () => {
  const v = view()
  assert.deepEqual(v.cells.map((c) => c.name), ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '3-2'])
  assert.equal(v.cells[2].words, '0 balls, 2 strikes')
  assert.equal(v.cells[3].words, '1 ball, 0 strikes')
  assert.deepEqual(v.cells.filter((c) => c.two).map((c) => c.name), ['0-2', '1-2', '2-2', '3-2'])
})

test('a cell holds the visit share, the fouls, the foul rate per swing and the league rate', () => {
  const c = view().cells[0]
  assert.equal(c.reachPct, '100%')
  assert.equal(c.fouls, 105)
  assert.equal(c.rate, '52.8%')
  assert.equal(c.lgRate, '40.5%')
  assert.equal(c.diff, '+12.3 pts')
  assert.equal(c.per100, '16 per 100 visits')
  assert.equal(view().cells[1].reachPct, '52%')
})

test('a count with no swing has no rate and does not divide by zero', () => {
  const c = view().cells[9]
  assert.equal(c.rate, '—')
  assert.equal(c.diff, '—')
})

test('the at-bat endings run hit, walk, out in play, strikeout and add up to the visits', () => {
  const c = view().cells[0]
  assert.deepEqual(c.ends.map((e) => e.name), ['Hit', 'Walk', 'Out in play', 'Strikeout'])
  assert.deepEqual(c.ends.map((e) => e.n), [156, 88, 262, 171])
  assert.equal(c.ends.reduce((a, e) => a + e.n, 0), 677)
})

test('the season baseline reads the total field for fouls, and the cells for swings', () => {
  const [swing, pa] = view().baseline
  assert.equal(pa.sub, '573 fouls in 677 PA')
  assert.equal(pa.his, '0.85')
  assert.equal(swing.sub, 'of 1,249 swings')
  assert.equal(swing.his, '46.0%')
})

test('best at-bat is compared with the league median of regular hitters', () => {
  const best = (b, l) => foulsView({ line: batterFoulLine({ batters: { 1: { ...turang, bestPa: b } } }, 1), league: { ...leagueFoulRates({ league: lg }), medianBestPaFouls: l } }).baseline[2]
  assert.deepEqual([best({ fouls: 7 }, 6).his, best({ fouls: 7 }, 6).lg, best({ fouls: 7 }, 6).gap], ['7', '6', '+1'])
  assert.equal(best({ fouls: 6 }, 6).gapNote, 'level with the league')
  assert.equal(best({ fouls: 7 }, 6).gapNote, '+1 for him')
  assert.equal(best({ fouls: 4 }, 6).gap, '−2')
})

test('no league file still gives the batter his own numbers', () => {
  const v = foulsView({ line: batterFoulLine({ batters: { 1: turang } }, 1), league: null })
  assert.equal(v.cells[0].lgRate, '—')
  assert.equal(v.cells[0].diff, '—')
  assert.equal(v.baseline[0].lg, '—')
})

test('no by-count cells, or no plate appearance, is no view', () => {
  assert.equal(foulsView({ line: null, league: null }), null)
  assert.equal(foulsView({ line: batterFoulLine({ batters: { 1: { ...turang, byCount: null } } }, 1), league: null }), null)
  assert.equal(view({ pa: 0 }), null)
})

test('the card opens on the count with the most fouls', () => {
  assert.equal(view().top, 0)
})
