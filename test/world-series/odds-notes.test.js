import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWorldSeriesOddsNotes } from '../../src/api/callout-notes/worldSeries.js'
import { SCORE_BASE, ONCE_PER_GAME_KINDS, RECORD_KINDS } from '../../src/api/callout-notes/shared.js'
import { BETWEEN_INNINGS_ALLOWED_KINDS } from '../../src/api/between-innings.js'
import { HISTORY, bundleAfter } from './ws-fixture.js'

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
    'The Club1 and the Club2 last met in the World Series in 2000.',
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
