// The Matchup Scout's Edge tab (#1490): the verdict and the ledger, built from
// the hitter side the maps already read. The fixture is the real Pivetta /
// Chourio pair (2026 stores, regular season, both pitcher hands), built by
// .scratch/scout-polish/pull-data.mjs with the Scout's own functions; the
// expected sentences are the ones Gary reviewed in the mockup.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ledgerRows, ledgerScale, leftOut, listOf, locationLens, rowTag, textOf, typeSentences, versus, watchList, whoFavors,
} from '../src/screens/scout/edge/edge.js'
import { fmtValue } from '../src/lib/scout/metrics.js'

const PAIR = JSON.parse(readFileSync(new URL('./fixtures/scout/pair-601713-694192.json', import.meta.url), 'utf8'))
const NAMES = { hitter: 'Chourio', pitcher: 'Pivetta' }

// The fixture in the shapes the page holds: a pitcher board and one hitter
// side per metric (hitterBoard.js `hitterSide`).
const board = {
  types: PAIR.types,
  all: PAIR.pmap.ALL,
  byType: Object.fromEntries(PAIR.types.map((t) => [t.code, PAIR.pmap[t.code]])),
}
const sideOf = (m) => ({
  all: PAIR.hit[m].ALL,
  overall: PAIR.hit[m].overall,
  byType: Object.fromEntries(PAIR.types.map((t) => [t.code, PAIR.hit[m][t.code]])),
})
const sides = { xwoba: sideOf('xwoba'), whiff: sideOf('whiff'), swing: sideOf('swing') }

test('who a band favors: xwOBA up is the hitter, Whiff % up is the pitcher, Swing % is nobody', () => {
  assert.equal(whoFavors('xwoba', 1), 'hitter')
  assert.equal(whoFavors('xwoba', -2), 'pitcher')
  assert.equal(whoFavors('whiff', 1), 'pitcher')
  assert.equal(whoFavors('whiff', -1), 'hitter')
  assert.equal(whoFavors('swing', 2), 'more')
  assert.equal(whoFavors('swing', -1), 'less')
  assert.equal(whoFavors('xwoba', 0), 'even')
  assert.equal(whoFavors('xwoba', null), null)
})

test('the xwOBA ledger: three pitches lean Chourio, the curveball is even', () => {
  const rows = ledgerRows(board.types, sides.xwoba, 'xwoba')
  assert.deepEqual(rows.map((r) => [r.code, r.band, rowTag(r, NAMES).word, versus('xwoba', r)]), [
    ['FF', 1, 'Slight · Chourio', '.391 vs .330'],
    ['ST', 1, 'Slight · Chourio', '.298 vs .260'],
    ['FC', 1, 'Slight · Chourio', '.388 vs .337'],
    ['CU', 0, 'Even', '.267 vs .261'],
  ])
})

test('the whiff and swing ledgers print a "%" on both rates', () => {
  const whiff = ledgerRows(board.types, sides.whiff, 'whiff')
  assert.deepEqual(whiff.map((r) => [r.code, rowTag(r, NAMES).word, versus('whiff', r)]), [
    ['FF', 'Slight · Pivetta', '24% vs 19%'],
    ['ST', 'Even', '28% vs 30%'],
    ['FC', 'Slight · Pivetta', '28% vs 22%'],
    ['CU', 'Slight · Chourio', '25% vs 29%'],
  ])
  const swing = ledgerRows(board.types, sides.swing, 'swing')
  assert.ok(swing.every((r) => /^\d+% vs \d+%$/.test(versus('swing', r))))
  assert.ok(swing.every((r) => ['Even', 'Swings more', 'Swings less'].includes(rowTag(r, NAMES).word)))
})

test('a null rate is "Too few", never zero', () => {
  const thin = { byType: { FF: { typeVal: null, leagueFlat: 0.33 } } }
  const [row] = ledgerRows([{ code: 'FF', name: 'Fastball', pct: '49' }], thin, 'xwoba')
  assert.equal(rowTag(row, NAMES).word, 'Too few')
  assert.equal(versus('xwoba', row), '—')
  assert.equal(fmtValue('whiff', null), '—')
})

test('things to watch for Pivetta vs Chourio: each sentence goes to the player it is about', () => {
  const list = watchList({ board, sides, names: NAMES, stance: 'R' })
  assert.deepEqual(list.map((w) => [w.who, textOf(w.parts)]), [
    ['hitter', 'Chourio beats the league on 3 of Pivetta’s 4 pitches (fastball, sweeper and cutter). Those are 89% of what Pivetta throws to righties.'],
    ['pitcher', 'Swing and miss is Pivetta’s way in: Chourio whiffs more than the league on the fastball (24% vs 19%) and cutter (28% vs 22%).'],
    ['pitcher', 'Pivetta puts 14% of his pitches in Chourio’s hottest regions and 25% where Chourio is below league.'],
  ])
})

test('things to watch: a pitch the pitcher wins goes to him, "No pitch favors" and "Too few" are dropped', () => {
  const who = (x) => watchList({ board, sides: { xwoba: x }, names: NAMES, stance: 'R' }).map((w) => w.who)
  const flip = (code, band) => ({ ...sides.xwoba, byType: { ...sides.xwoba.byType, [code]: { ...sides.xwoba.byType[code], typeVal: sides.xwoba.byType[code].leagueFlat - band } } })
  assert.deepEqual(who(flip('CU', 0.1)), ['hitter', 'pitcher', 'pitcher'])
  assert.deepEqual(watchList({ board, sides: { xwoba: null }, names: NAMES, stance: 'R' }), [])
})

test('the location lens: hottest regions are hi2, below league is lo1 and lo2, thin maps are left out', () => {
  const lens = locationLens(board, sides.xwoba)
  assert.deepEqual(lens.hotRegions.sort(), ['r1c1', 'r2c1', 'r2c2'])
  assert.deepEqual(leftOut(board), [{ name: 'Cutter', n: 44 }, { name: 'Curveball', n: 24 }])
  // A thin All map has no location lens at all.
  assert.equal(locationLens({ ...board, all: { ...board.all, thin: true } }, sides.xwoba), null)
})

test('the ledger scale holds every rate, padded', () => {
  const s = ledgerScale(ledgerRows(board.types, sides.xwoba, 'xwoba'))
  assert.ok(s.at(0.26) > 0 && s.at(0.391) < 100)
  assert.equal(ledgerScale([{ value: null, league: null }]), null)
})

test('lists read as English', () => {
  assert.equal(listOf(['a']), 'a')
  assert.equal(listOf(['a', 'b']), 'a and b')
  assert.equal(listOf(['a', 'b', 'c']), 'a, b and c')
})

test('the hot and cold spots: the share of the pitcher’s mix that goes there, and the regions', async () => {
  const { spotShares } = await import('../src/screens/scout/zones/callout.js')
  const { hot, cold } = spotShares({ board, side: sides.xwoba, stance: 'R' })
  // Hot is the map's top tone (hi2): 6.5 + 1.5 + 5.7 = 13.7%. Cold is both blue tones (lo1 and lo2),
  // 3.0 + 17.9 + 4.6 = 25.5%: 25, not the canvas's 26, which added the rounded cells (3 + 18 + 5).
  assert.deepEqual([hot.share, cold.share].map((x) => Math.round(x * 100)), [14, 25])
  assert.deepEqual(hot.names, ['Up · inside · 3B side', 'Middle · inside · 3B side', 'Heart'])
  assert.deepEqual(hot.range, ['.385', '.604'])
  assert.deepEqual(cold.range, ['.177', '.237'])
  assert.equal(cold.names.length, 3)
  assert.ok(![...hot.names, ...cold.names].some((n) => /\b(left|right)\b/.test(n)))
  // Nothing hot: that tile is null; a thin pitcher board or no hitter map: no tiles at all.
  const noHot = { all: { cells: Object.fromEntries(Object.entries(sides.xwoba.all.cells).map(([r, c]) => [r, { ...c, tone: 'mid' }])) } }
  assert.equal(spotShares({ board, side: noHot, stance: 'R' }).hot, null)
  assert.equal(spotShares({ board: { ...board, all: { ...board.all, thin: true } }, side: sides.xwoba, stance: 'R' }), null)
  assert.equal(spotShares({ board, side: null, stance: 'R' }), null)
})

test('the spot names say no inside or away when the two maps draw different stances', async () => {
  const { spotShares } = await import('../src/screens/scout/zones/callout.js')
  // A switch hitter with the other hand picked: the pitcher board is drawn for R and the
  // hitter map for L, so "inside" would be true on one map only (regionLabel, stance null).
  const text = spotShares({ board, side: sides.xwoba, stance: 'R', hitterStance: 'L' }).hot.names.join('; ')
  assert.ok(!/\b(inside|away)\b/.test(text), text)
  assert.match(text, /3B side/)
  assert.match(spotShares({ board, side: sides.xwoba, stance: 'R', hitterStance: 'R' }).hot.names.join('; '), /inside/)
})

test('the hottest region: the most xwOBA, never a region too thin to show a value', async () => {
  const { hottestRegion } = await import('../src/screens/scout/zones/callout.js')
  // .604 in the heart beats .602 in the middle row's inside cell and every other region.
  assert.equal(hottestRegion(sides.xwoba.all.cells), 'r2c2')
  // A hotter region with no value (under the floor, count only) is never picked.
  assert.equal(hottestRegion({ ...sides.xwoba.all.cells, high: { tone: 'gray', count: 3 } }), 'r2c2')
  const thin = Object.fromEntries(Object.keys(sides.xwoba.all.cells).map((r) => [r, { tone: 'gray', count: 2 }]))
  assert.equal(hottestRegion(thin), null)
  assert.equal(hottestRegion(undefined), null)
})

test('a pitch that favors the pitcher, and a board too thin to judge, read as plain sentences', () => {
  const rows = [
    { name: 'Fastball', pct: '56', who: 'hitter', band: 1 },
    { name: 'Curveball', pct: '34', who: 'pitcher', band: -1 },
    { name: 'Cutter', pct: '8', who: null, band: null },
  ]
  assert.deepEqual(typeSentences(rows, 'xwoba', { hitter: 'Lindor', pitcher: 'Pivetta' }, 'lefties').map(textOf), [
    'Lindor beats the league on 1 of Pivetta’s 3 pitches (fastball). Those are 56% of what Pivetta throws to lefties.',
    'Pivetta has the edge on contact quality with the curveball: 34% of his pitches to lefties.',
    'Too few Lindor pitches on file to judge the cutter.',
  ])
  // Every row too thin: no claim that no pitch favors him.
  const thin = rows.map((r) => ({ ...r, who: null, band: null }))
  assert.deepEqual(typeSentences(thin, 'xwoba', { hitter: 'Judge', pitcher: 'Pivetta' }, 'righties').map(textOf), [
    'Too few Judge pitches on file to judge the fastball, curveball and cutter.',
  ])
})
