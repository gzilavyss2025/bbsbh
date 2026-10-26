import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWorldSeriesOddsNotes } from '../../src/api/callout-notes/worldSeries/odds.js'
import { SCORE_BASE, ONCE_PER_GAME_KINDS, RECORD_KINDS } from '../../src/api/callout-notes/shared.js'
import { BETWEEN_INNINGS_ALLOWED_KINDS } from '../../src/api/between-innings.js'
import { HISTORY, bundleAfter, mk } from './ws-fixture.js'

const run = (bundle, extra = {}) =>
  buildWorldSeriesOddsNotes({ history: HISTORY, bundle, gameDate: '2001-10-20', gameType: 'W', ...extra })
const text = (bundle) => run(bundle).map((n) => n.text)

test('entering Game 2: the Game 1 winner record', () => {
  const [n] = run(bundleAfter(1, 2, [1]))
  assert.equal(n.text, 'Game 1 winners are 2-1 in the World Series.')
  assert.equal(n.kind, 'wsSeriesOdds')
  assert.equal(n.dedupeKey, 'wsSeriesOdds-game1')
  assert.ok(n.score > SCORE_BASE.wsSeriesOdds)
})

test('entering Game 3 after a 2-0 lead; not after a split', () => {
  assert.deepEqual(text(bundleAfter(1, 2, [1, 1])), ['Teams that lead 2-0 are 1-1 in the World Series.'])
  assert.deepEqual(text(bundleAfter(1, 2, [1, 2])), [])
})

test('entering Game 5 after a 3-1 lead: the comeback record', () => {
  assert.deepEqual(
    text(bundleAfter(1, 2, [1, 1, 2, 1])),
    ['Teams that trailed 3-1 have won the World Series 1 time in 1. The last was in 1991.'],
  )
  assert.deepEqual(text(bundleAfter(1, 2, [1, 2, 1, 2])), [])
})

test('entering a winner-take-all game: home and road, and the streak', () => {
  assert.deepEqual(
    text(bundleAfter(1, 2, [1, 2, 1, 2, 2, 1])),
    ['In winner-take-all World Series games the home club is 1-2. The road club has won the last 2.'],
  )
})

test('a tied game counts for nobody in the entering state', () => {
  assert.deepEqual(text(bundleAfter(1, 2, [1, null, 1, 1])), [])
})

test('entering Game 1: defending champion and last meeting', () => {
  const t = text(bundleAfter(1, 2, []))
  assert.deepEqual(t, [
    'The Club1 won the 2000 World Series.',
    'The Club1 and the Club2 last met in the World Series in 2000; the Club1 won.',
  ])
})

test('entering Game 1: a first meeting, and a long drought', () => {
  const t = run(bundleAfter(2, 9, []), { gameDate: '2020-10-20' }).map((n) => n.text)
  assert.ok(t.includes('This is the first World Series meeting between the Club2 and the Club9.'))
  assert.ok(t.includes('The Club2 last played in the World Series in 2000.'))
  assert.ok(!t.some((s) => s.includes('Club9 last played')))
})

test('no note for a non-W game, a null history, or no bundle', () => {
  const b = bundleAfter(1, 2, [1])
  assert.deepEqual(run(b, { gameType: 'R' }), [])
  assert.deepEqual(run(b, { history: null }), [])
  assert.deepEqual(run(null), [])
})

test('a bundle that carries tonight\'s score changes nothing', () => {
  const b = bundleAfter(1, 2, [1])
  assert.deepEqual(text({ ...b, linescore: { away: 9, home: 0 } }), text(b))
})

test('kind sets', () => {
  assert.ok(ONCE_PER_GAME_KINDS.has('wsSeriesOdds'))
  assert.ok(BETWEEN_INNINGS_ALLOWED_KINDS.has('wsSeriesOdds'))
  assert.ok(!RECORD_KINDS.has('wsSeriesOdds'))
  assert.equal(SCORE_BASE.wsSeriesOdds, 45)
})

test('the pre-half strip shows it on the first half of a World Series game only', async () => {
  const { buildPreHalfCallouts } = await import('../../src/api/prehalf-callouts.js')
  const feed = (type) => ({ gameData: { game: { type }, datetime: { officialDate: '2001-10-12' } }, liveData: { plays: { allPlays: [] }, linescore: { innings: [] } } })
  const args = (type, inning, half) => ({
    feed: feed(type), bundle: bundleAfter(1, 2, [1]), inning, half, revealedThrough: -1,
    workload: null, gameDate: '2001-10-12', seriesHistory: HISTORY,
  })
  const kinds = (a) => buildPreHalfCallouts(a).map((n) => n.kind)
  assert.ok(kinds(args('W', 1, 'top')).includes('wsSeriesOdds'))
  assert.ok(!kinds(args('W', 1, 'bottom')).includes('wsSeriesOdds'))
  assert.ok(!kinds(args('W', 2, 'top')).includes('wsSeriesOdds'))
  assert.ok(!kinds(args('D', 1, 'top')).includes('wsSeriesOdds'))
})

test('an old World Series game (no workload date) still gets the odds note; a non-W game does not', async () => {
  const { buildPreHalfCallouts } = await import('../../src/api/prehalf-callouts.js')
  const feed = (type) => ({ gameData: { game: { type }, datetime: { officialDate: '2001-10-12' } }, liveData: { plays: { allPlays: [] }, linescore: { innings: [] } } })
  const kinds = (type) => buildPreHalfCallouts({
    feed: feed(type), bundle: bundleAfter(1, 2, [1]), inning: 1, half: 'top', revealedThrough: -1,
    workload: null, gameDate: null, seriesHistory: HISTORY,
  }).map((n) => n.kind)
  assert.ok(kinds('W').includes('wsSeriesOdds'))
  assert.ok(!kinds('D').includes('wsSeriesOdds'))
})

// Real club ids, with the names the file stores for that season (114 was the Indians in 2016).
const REAL = { series: [
  { ...mk(2016, 4, [114, 112], [114, 114, 112, 114, 112, 112, 112]), names: { 114: 'Indians', 112: 'Cubs' } },
  { ...mk(1990, 4, [119, 141], [119, 119, 119, 119]), names: { 119: 'Dodgers', 141: 'Blue Jays' } },
] }
const real = (bundle, gameDate) => buildWorldSeriesOddsNotes({ history: REAL, bundle, gameDate, gameType: 'W' }).map((n) => n.text)

test('the comeback note names the last club to do it', () => {
  assert.deepEqual(
    real(bundleAfter(119, 141, [119, 119, 141, 119]), '2017-10-20'),
    ['Teams that trailed 3-1 have won the World Series 1 time in 1. The last was the 2016 Cubs.'],
  )
})

test('the drought note names that last Series\' opponent', () => {
  assert.ok(real(bundleAfter(141, 5, []), '2020-10-20')
    .includes('The Club141 last played in the World Series in 1990, against the Dodgers.'))
})

test('past clubs are named as they were that season, never undefined', () => {
  const named = { ...HISTORY, series: HISTORY.series.map((x) => (x.season === 1991 ? { ...x, names: { 3: 'Indians', 4: 'Expos' } } : x)) }
  const t = buildWorldSeriesOddsNotes({ history: named, bundle: bundleAfter(1, 2, [1, 1, 2, 1]), gameDate: '2001-10-20', gameType: 'W' }).map((n) => n.text)
  assert.ok(t[0].endsWith('The last was the 1991 Expos.'))
  assert.ok(!t[0].includes('undefined'))
  const d = buildWorldSeriesOddsNotes({ history: { ...named, series: named.series.map((x) => (x.season === 2000 ? { ...x, names: { 1: 'Mets', 2: 'Expos' } } : x)) }, bundle: bundleAfter(2, 9, []), gameDate: '2020-10-20', gameType: 'W' }).map((n) => n.text)
  assert.ok(d.includes('The Club2 last played in the World Series in 2000, against the Mets.'))
})

test('a past 3-1 comeback by the 1997 club says Indians, not Guardians', () => {
  const history = { series: [{ ...mk(1997, 4, [114, 146], [146, 146, 114, 146, 114, 114, 114]), names: { 114: 'Indians', 146: 'Marlins' } }] }
  const [n] = buildWorldSeriesOddsNotes({ history, bundle: bundleAfter(1, 2, [1, 1, 2, 1]), gameDate: '2001-10-20', gameType: 'W' })
  assert.ok(n.text.endsWith('The last was the 1997 Indians.'), n.text)
})

test('the last-meeting winner is named as he was that season', () => {
  const named = { ...HISTORY, series: HISTORY.series.map((x) => (x.season === 2000 ? { ...x, names: { 1: 'Old Club1', 2: 'Club2' } } : x)) }
  const t = buildWorldSeriesOddsNotes({ history: named, bundle: bundleAfter(1, 2, []), gameDate: '2001-10-20', gameType: 'W' }).map((n) => n.text)
  assert.ok(t.includes('The Club1 and the Club2 last met in the World Series in 2000; the Old Club1 won.'), t.join(' | '))
})

test('the pre-half strip never caps, ranks or trims a World Series note', async () => {
  const { buildPreHalfCallouts } = await import('../../src/api/prehalf-callouts.js')
  const feed = { gameData: { game: { type: 'W' }, datetime: { officialDate: '2001-10-12' }, probablePitchers: { away: { id: 10 }, home: { id: 20 } } }, liveData: { plays: { allPlays: [] }, linescore: { innings: [] } } }
  // Game 1: the repeat champion and the first meeting are two notes of one kind, with the
  // home starter's first Series start besides: three Series notes on a strip of two slots.
  const strip = buildPreHalfCallouts({
    feed, bundle: bundleAfter(1, 2, []), inning: 1, half: 'top', revealedThrough: -1,
    workload: null, gameDate: '2001-10-12', seriesHistory: HISTORY, wsStarts: { 10: 0, 20: 0 },
  })
  const ws = strip.filter((n) => /^ws[A-Z]/.test(n.kind)).map((n) => n.dedupeKey)
  assert.deepEqual(ws.sort(), ['wsSeriesOdds-meeting', 'wsSeriesOdds-repeat', 'wsStarterStart-20'])
})
