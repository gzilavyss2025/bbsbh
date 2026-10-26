// wsLastTime: the play card's "last time" note. Only on the revealed play, and only from
// history dated before the game (ADR-0087).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCallouts } from '../../src/api/callout-notes/liveAtBat.js'
import { wsPlayCtx } from '../../src/api/callout-notes/worldSeries/events.js'
import { pl, feedOf, playsOf, BUNDLE } from './ws-fixture.js'

const row = (tag, date, extra = {}) => ({ tag, pk: 1, date, season: Number(date.slice(0, 4)), n: 1, club: 1, player: 5, value: null, wta: false, ...extra })
const SLAM = [pl(0), pl(1, { ev: 'home_run', rbi: 4, inning: 3, away: 4 }), pl(2, { away: 4 })]
const notesFor = (plays, i, { rows = [], date = '2024-10-26', final = true, bundle = BUNDLE } = {}) => {
  const ws = wsPlayCtx(feedOf(plays, { date, final }), bundle, { events: rows })
  return buildCallouts({ atBatIndex: i, eventType: plays[i].result.eventType, batterId: plays[i].matchup.batter.id }, { bundle, battingSide: 'away', ws })
    .filter((n) => n.kind === 'wsLastTime')
}

test('a revealed grand slam notes the date of the last one', () => {
  const [n] = notesFor(SLAM, 1, { rows: [row('grandSlam', '2020-10-25'), row('grandSlam', '2010-10-25')] })
  assert.equal(n.text, 'The last World Series grand slam came on Oct. 25, 2020.')
  assert.equal(n.dedupeKey, 'wsLastTime-grandSlam-1')
})

test('the same slam on another card, or the neighbouring play, gets no note', () => {
  const rows = [row('grandSlam', '2020-10-25')]
  assert.deepEqual(notesFor(SLAM, 0, { rows }), [])
  assert.deepEqual(notesFor(SLAM, 2, { rows }), [])
})

test('there is no gap floor: a slam two years ago, last year or two days ago still notes it', () => {
  for (const last of ['2022-10-25', '2023-10-25', '2024-10-24']) {
    assert.equal(notesFor(SLAM, 1, { rows: [row('grandSlam', last)] }).length, 1, last)
  }
})

test('no earlier row: the first in World Series history; no history loaded: silence', () => {
  assert.equal(notesFor(SLAM, 1)[0].text, 'The first grand slam in World Series history.')
  assert.equal(wsPlayCtx(feedOf(SLAM), BUNDLE, null), null)
})

test('an old game never sees a later row', () => {
  const rows = [row('grandSlam', '2005-10-20'), row('grandSlam', '2025-10-24')]
  assert.equal(notesFor(SLAM, 1, { rows, date: '2012-10-20' })[0].text, 'The last World Series grand slam came on Oct. 20, 2005.')
})

test('the current Series comes from the bundle, older shards without the key still work', () => {
  const rows = [row('grandSlam', '2010-10-25')]
  const withKey = { ...BUNDLE, wsEvents: { events: [row('grandSlam', '2024-10-24')], wta: false } }
  assert.equal(notesFor(SLAM, 1, { rows, bundle: withKey })[0].text, 'The last World Series grand slam came on Oct. 24, 2024.')
  assert.equal(notesFor(SLAM, 1, { rows }).length, 1)
})

test('a game that is not a World Series game costs and shows nothing', () => {
  const feed = feedOf(SLAM)
  feed.gameData.game.type = 'R'
  assert.equal(wsPlayCtx(feed, BUNDLE, { events: [] }), null)
})

test('the walk-off grand slam note replaces the grand slam and walk-off notes', () => {
  const plays = playsOf(775300) // 2024 G1: Freeman, bottom of the 10th
  const i = plays.length - 1
  const rows = [row('grandSlam', '2010-10-25'), row('walkOffHr', '2010-10-25')]
  const out = notesFor(plays, plays[i].about.atBatIndex, { rows, date: '2024-10-25' })
  assert.deepEqual(out.map((n) => n.text), ['The first walk-off grand slam in World Series history.'])
})

test('a walk-off needs a Final game: the same last play in a live feed is only a grand slam', () => {
  const plays = playsOf(775300)
  const out = notesFor(plays, plays.at(-1).about.atBatIndex, { rows: [row('grandSlam', '2010-10-25')], date: '2024-10-25', final: false })
  assert.deepEqual(out.map((n) => n.text), ['The last World Series grand slam came on Oct. 25, 2010.'])
})

test('the opening pair, a pinch-hit slam and a triple play each pick their own tag', () => {
  const pair = playsOf(813022)
  assert.equal(notesFor(pair, 1, { date: '2025-10-29', rows: [] })[0].text, 'The first game to open with two home runs in World Series history.')
  assert.equal(notesFor(pair, 0, { date: '2025-10-29', rows: [] }).length, 0, 'the first homer alone is not the pair')
  const ph = [pl(0), pl(1, { ev: 'home_run', rbi: 4, bat: 77, away: 4, events: [{ details: { eventType: 'offensive_substitution', description: 'Offensive Substitution: Pinch-hitter X replaces Y.' }, player: { id: 77 } }] })]
  assert.equal(notesFor(ph, 1)[0].text, 'The first pinch-hit grand slam in World Series history.')
  const tp = [pl(0), pl(1, { ev: 'triple_play' })]
  assert.equal(notesFor(tp, 1)[0].text, 'The first triple play in World Series history.')
})
