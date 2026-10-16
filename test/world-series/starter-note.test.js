import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorldSeriesStarterNote } from '../../src/api/callout-notes/worldSeries/odds.js'
import { SCORE_BASE, ONCE_PER_GAME_KINDS, RECORD_KINDS } from '../../src/api/callout-notes/shared.js'
import { buildPreHalfCallouts } from '../../src/api/prehalf-callouts.js'
import { bundleAfter } from './ws-fixture.js'

// `starts` holds each starter's EARLIER World Series starts, by person id.
const run = (earlier, gameType = 'W', side = 'away') =>
  buildWorldSeriesStarterNote({ starts: earlier == null ? null : { 10: earlier }, pid: 10, side, gameType })

test('no earlier start: the first World Series start', () => {
  const n = run(0)
  assert.equal(n.text, 'His first World Series start.')
  assert.equal(n.kind, 'wsStarterStart')
  assert.equal(n.personId, 10)
  assert.equal(n.side, 'away')
  assert.equal(n.dedupeKey, 'wsStarterStart-10')
  assert.equal(n.score, SCORE_BASE.wsStarterStart)
})

test('four earlier starts: the 5th; nine earlier: the 10th', () => {
  assert.equal(run(4, 'W', 'home').text, 'His 5th World Series start.')
  assert.equal(run(4, 'W', 'home').side, 'home')
  assert.equal(run(9).text, 'His 10th World Series start.')
})

test('an ordinary start fires nothing, nor does an unknown count', () => {
  for (const earlier of [1, 2, 5, 10, null]) assert.equal(run(earlier), null)
  assert.equal(buildWorldSeriesStarterNote({ starts: {}, pid: 10, side: 'away', gameType: 'W' }), null)
})

test('a game that is not a World Series game fires nothing', () => {
  assert.equal(run(0, 'L'), null)
})

test('kind sets', () => {
  assert.equal(SCORE_BASE.wsStarterStart, 40)
  assert.ok(ONCE_PER_GAME_KINDS.has('wsStarterStart'))
  assert.ok(!RECORD_KINDS.has('wsStarterStart'))
})

test('the pre-half strip stages each starter in inning 1, in a World Series game only', () => {
  const feed = (type) => ({
    gameData: { game: { type }, datetime: { officialDate: '2001-10-12' }, probablePitchers: { away: { id: 10 }, home: { id: 20 } } },
    liveData: { plays: { allPlays: [] }, linescore: { innings: [] } },
  })
  const args = (type, inning, half) => ({
    feed: feed(type), bundle: bundleAfter(1, 2, [1]), inning, half, revealedThrough: -1,
    workload: null, gameDate: '2001-10-12', wsStarts: { 10: 0, 20: 4 },
  })
  const texts = (a) => buildPreHalfCallouts(a).filter((n) => n.kind === 'wsStarterStart').map((n) => n.text)
  assert.deepEqual(texts(args('W', 1, 'top')), ['His 5th World Series start.']) // the home starter takes the mound
  assert.deepEqual(texts(args('W', 1, 'bottom')), ['His first World Series start.'])
  assert.deepEqual(texts(args('W', 2, 'top')), [])
  assert.deepEqual(texts(args('D', 1, 'top')), [])
})
