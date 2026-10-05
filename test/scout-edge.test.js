// The Matchup Scout's Edge tab (#1490): the verdict and the ledger, built from
// the hitter side the maps already read. The fixture is the real Pivetta /
// Chourio pair (2026 stores, regular season, both pitcher hands), built by
// .scratch/scout-polish/pull-data.mjs with the Scout's own functions; the
// expected sentences are the ones Gary reviewed in the mockup.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  headline, leanMetric, ledgerRows, ledgerScale, leftOut, listOf, locationLens, rowTag, textOf, typeSentences, verdict, versus, whoFavors,
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

test('the headline sums usage: Lean the side past 50 and ahead, else Close to even', () => {
  assert.deepEqual(headline(ledgerRows(board.types, sides.xwoba, 'xwoba')), { lean: 'hitter', hitter: 89, pitcher: 0 })
  const rows = (a, b) => [{ pct: String(a), who: 'hitter' }, { pct: String(b), who: 'pitcher' }]
  assert.equal(headline(rows(49, 30)).lean, null) // under 50
  assert.equal(headline(rows(50, 30)).lean, 'hitter') // 50 counts
  assert.equal(headline(rows(30, 60)).lean, 'pitcher')
  assert.equal(headline(rows(50, 50)).lean, null) // a tie
})

test('the headline reads xwOBA (est.), or Whiff % when the grid has no estimate', () => {
  assert.equal(leanMetric(['xwoba', 'whiff', 'swing']), 'xwoba')
  assert.equal(leanMetric(['whiff', 'swing']), 'whiff')
  assert.equal(leanMetric(['swing']), null)
})

test('the verdict for Pivetta vs Chourio, word for word', () => {
  const v = verdict({ board, sides, names: NAMES, stance: 'R' })
  assert.equal(v.metric, 'xwoba')
  assert.equal(v.leanName, 'Chourio')
  assert.deepEqual(v.typeLines.map(textOf), [
    'Chourio beats the league on 3 of Pivetta’s 4 pitches (fastball, sweeper and cutter). Those are 89% of what Pivetta throws to righties.',
    'No pitch favors Pivetta on contact quality.',
    'Swing and miss is Pivetta’s way in: Chourio whiffs more than the league on the fastball (24% vs 19%) and cutter (28% vs 22%).',
  ])
  // 25%, not the mockup's 26%: 67 of 263 pitches is 25.5%. The mockup summed
  // shares it had already rounded to three places.
  assert.deepEqual(v.locationLines.map(textOf), [
    '.332 vs league .308 on the same spots.',
    'Pivetta puts 14% of his pitches in Chourio’s hottest regions and 25% where Chourio is below league.',
    'Leaves out the cutter (44) and curveball (24): too few to righties for a map.',
  ])
})

test('the location lens: hottest regions are hi2, below league is lo1 and lo2, thin maps are left out', () => {
  const lens = locationLens(board, sides.xwoba)
  assert.deepEqual(lens.hotRegions.sort(), ['r1c1', 'r2c1', 'r2c2'])
  assert.deepEqual(leftOut(board), [{ name: 'Cutter', n: 44 }, { name: 'Curveball', n: 24 }])
  // A thin All map has no location lens at all.
  assert.equal(locationLens({ ...board, all: { ...board.all, thin: true } }, sides.xwoba), null)
})

test('no hitter grid: no verdict (the page keeps the Savant line)', () => {
  assert.equal(verdict({ board, sides: { xwoba: null, whiff: null, swing: null }, names: NAMES, stance: 'R' }), null)
  assert.equal(verdict({ board, sides: {}, names: NAMES, stance: 'R' }), null)
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

test('the Zones callout: the hottest spots, by region name, and the pitcher’s busiest one', async () => {
  const { zoneCallout } = await import('../src/screens/scout/zones/callout.js')
  const parts = zoneCallout({ board, side: sides.xwoba, stance: 'R', names: NAMES })
  // 33%, not the mockup's 34%: 88 of 263 is 33.46%, the figure the map's
  // own cell prints. The mockup rounded the share to .335 first.
  assert.equal(
    textOf(parts),
    'Chourio’s three hottest spots (up · inside · 3B side; middle · inside · 3B side; heart) get 14% of Pivetta’s pitches. ' +
      'His most common spot is above the zone (33%), where Chourio is at league level.',
  )
  assert.ok(!/\b(left|right)\b/.test(textOf(parts)))
  // Not at league level in his busiest region: no last clause.
  const hotTop = { ...sides.xwoba, all: { ...sides.xwoba.all, cells: { ...sides.xwoba.all.cells, high: { tone: 'hi1' } } } }
  assert.ok(textOf(zoneCallout({ board, side: hotTop, stance: 'R', names: NAMES })).endsWith('(33%).'))
  assert.equal(zoneCallout({ board: { ...board, all: { ...board.all, thin: true } }, side: sides.xwoba, stance: 'R', names: NAMES }), null)
})

test('the Zones callout names no inside or away when the two maps draw different stances', async () => {
  const { zoneCallout } = await import('../src/screens/scout/zones/callout.js')
  // A switch hitter with the other hand picked: the pitcher board is drawn for R and the
  // hitter map for L, so "inside" would be true on one map only (regionLabel, stance null).
  const text = textOf(zoneCallout({ board, side: sides.xwoba, stance: 'R', hitterStance: 'L', names: NAMES }))
  assert.ok(!/\b(inside|away)\b/.test(text), text)
  assert.match(text, /3B side/)
  // The same stance on both maps keeps the words.
  assert.match(textOf(zoneCallout({ board, side: sides.xwoba, stance: 'R', hitterStance: 'R', names: NAMES })), /inside/)
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
