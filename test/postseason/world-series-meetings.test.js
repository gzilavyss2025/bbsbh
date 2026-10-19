// The World Series scouting report's regular-season meetings (#2316). The cutoff is the
// day before the slate date (ADR-0087, ADR-0088), pinned on the rows AND on the request.
// Schedule fixture: the Brewers' whole 2026 schedule (gameType R,D,L,W) recorded from
// statsapi on 2026-10-19. Detail fixture: gamePk 823775 (CLE @ MIL, 2026-06-16), pruned.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { mock } from 'node:test'
import { fetchMeetings, meetingCard, meetingsUrl } from '../../src/api/postseason/meetings.js'
import { keptGames } from '../../src/api/postseason/fetch.js'
import { selectMeetings } from '../../src/lib/postseason/worldseries/scouting/meetings.js'

const load = (name) => JSON.parse(readFileSync(new URL(`./meetings-fixtures/${name}`, import.meta.url), 'utf8'))
const rows = keptGames(load('brewers-2026-schedule.json'))
const MIL = 158
const pks = (list) => list.map((g) => g.gamePk)

test('Rays (139) vs Brewers: the three March games, oldest first', () => {
  const out = selectMeetings(rows, { clubA: MIL, clubB: 139, slateDate: '2026-10-22' })
  assert.deepEqual(pks(out), [823809, 823807, 823806])
  assert.deepEqual(out.map((g) => g.officialDate), ['2026-03-30', '2026-03-31', '2026-04-01'])
})

test('Guardians (114) vs Brewers: the three June games, either club order', () => {
  const a = selectMeetings(rows, { clubA: MIL, clubB: 114, slateDate: '2026-10-22' })
  const b = selectMeetings(rows, { clubA: 114, clubB: MIL, slateDate: '2026-10-22' })
  assert.deepEqual(pks(a), [823775, 823774, 823772])
  assert.deepEqual(pks(b), pks(a))
})

test('a row dated on the slate date, or later, never comes back', () => {
  const opts = { clubA: MIL, clubB: 114 }
  assert.deepEqual(pks(selectMeetings(rows, { ...opts, slateDate: '2026-06-18' })), [823775, 823774])
  assert.deepEqual(pks(selectMeetings(rows, { ...opts, slateDate: '2026-06-17' })), [823775])
  assert.deepEqual(selectMeetings(rows, { ...opts, slateDate: '2026-06-16' }), [])
})

test('no Series game, no other opponent, no game that is not Final', () => {
  const game = (gamePk, over) => ({
    gamePk, gameType: 'R', officialDate: '2026-05-01', status: { abstractGameState: 'Final' },
    teams: { away: { team: { id: MIL } }, home: { team: { id: 139 } } }, ...over,
  })
  const out = selectMeetings(
    [
      game(1),
      game(2, { gameType: 'W' }),
      game(3, { gameType: 'D' }),
      game(4, { status: { abstractGameState: 'Live' } }),
      game(5, { status: { abstractGameState: 'Preview' } }),
      game(6, { teams: { away: { team: { id: MIL } }, home: { team: { id: 114 } } } }),
      game(7, { officialDate: undefined }),
    ],
    { clubA: MIL, clubB: 139, slateDate: '2026-10-22' },
  )
  assert.deepEqual(pks(out), [1])
  // The whole-season fixture: the Series games (Oct 23 on) are not meetings.
  assert.equal(selectMeetings(rows, { clubA: MIL, clubB: 139, slateDate: '2026-11-30' }).length, 3)
})

test('the request ends the day before the slate date', () => {
  const p = new URLSearchParams(meetingsUrl(158, 114, '2026-10-22').split('?')[1])
  assert.equal(p.get('startDate'), '2026-01-01') // live: endDate alone answers HTTP 400
  assert.equal(p.get('endDate'), '2026-10-21')
  assert.equal(p.get('gameType'), 'R')
  assert.equal(p.get('season'), '2026')
  assert.equal(p.get('teamId'), '158')
  assert.equal(p.get('opponentId'), '114')
})

test('a recorded game becomes the card: score, decisions, plate umpire, starters', () => {
  const c = meetingCard(load('game-823775.json'), 823775)
  assert.equal(c.gamePk, 823775)
  assert.equal(c.date, '2026-06-16')
  assert.equal(c.home.abbr, 'MIL')
  assert.deepEqual([c.away.runs, c.away.hits, c.away.errors], [1, 4, 1])
  assert.deepEqual([c.home.runs, c.home.hits, c.home.errors], [2, 4, 1])
  assert.equal(c.ump.length > 0, true)
  assert.deepEqual(Object.keys(c.decisions), ['w', 'l', 's'])
  const s = c.home.starter
  assert.deepEqual(
    [s.id, s.name, s.hand, s.ip, s.h, s.er, s.bb, s.k, s.pitches],
    [688107, 'Robert Gasser', 'L', '5.2', 2, 0, 2, 5, 92],
  )
  assert.equal(Object.values(s.mix).reduce((a, b) => a + b, 0) > 0, true)
  assert.equal(c.home.lineup.length, 9)
  assert.deepEqual(Object.keys(c.home.lineup[0]), ['id', 'name', 'pos'])
  assert.equal(c.scoring.length > 0, true)
  assert.match(c.scoring[0].inning, /^[TB]\d+$/)
})

test('a feed with no lineup, no pitch mix and no umpire returns the card shape, empty', () => {
  const full = meetingCard(load('game-823775.json'), 823775)
  for (const feed of [{}, null, { gameData: {}, liveData: { boxscore: { teams: { away: {}, home: {} } } } }]) {
    const c = meetingCard(feed, 99)
    assert.deepEqual(Object.keys(c), Object.keys(full))
    assert.equal(c.gamePk, 99)
    assert.equal(c.ump, '')
    assert.deepEqual(c.home.lineup, [])
    assert.deepEqual(c.scoring, [])
    assert.deepEqual(c.home.starter.mix, {})
    assert.deepEqual(Object.keys(c.home.starter), Object.keys(full.home.starter))
    assert.equal(c.home.starter.id, null)
    assert.equal(c.home.starter.name, '')
    assert.equal(c.home.runs, null)
  }
})

test('fetchMeetings: reads the schedule, then only the meetings before the slate date', async () => {
  const calls = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    const json = String(url).includes('/schedule')
      ? load('brewers-2026-schedule.json')
      : String(url).includes('/823775/') ? load('game-823775.json') : {}
    return { ok: true, status: 200, json: async () => json }
  })
  try {
    const out = await fetchMeetings({ clubA: MIL, clubB: 114, slateDate: '2026-06-18' })
    // The stub schedule ignores the request's filters; the rows are filtered again.
    assert.deepEqual(out.map((c) => c.gamePk), [823775, 823774])
    assert.equal(calls.some((u) => u.includes('/823772/')), false)
    assert.equal(out[0].home.starter.name, 'Robert Gasser')
    assert.equal(out[1].home.lineup.length, 0)
  } finally {
    m.mock.restore()
  }
})

test('fetchMeetings: a failed schedule read is []', async () => {
  const m = mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }))
  try {
    assert.deepEqual(await fetchMeetings({ clubA: MIL, clubB: 114, slateDate: '2026-10-22' }), [])
  } finally {
    m.mock.restore()
  }
})

test('the schedule request asks for gameNumber, for a doubleheader\'s second game', () => {
  const p = new URLSearchParams(meetingsUrl(158, 114, '2026-10-22').split('?')[1])
  assert.match(p.get('fields'), /gameNumber/)
})

test('fetchMeetings: a game whose feed fails keeps its clubs and game number from the schedule', async () => {
  const m = mock.method(globalThis, 'fetch', async (url) =>
    String(url).includes('/schedule')
      ? { ok: true, status: 200, json: async () => load('brewers-2026-schedule.json') }
      : { ok: false, status: 500, json: async () => ({}) })
  try {
    const out = await fetchMeetings({ clubA: MIL, clubB: 114, slateDate: '2026-06-17' })
    assert.equal(out.length, 1)
    assert.deepEqual([out[0].away.id, out[0].away.abbr, out[0].home.id, out[0].home.abbr], [114, 'CLE', 158, 'MIL'])
    assert.equal(out[0].gameNumber >= 1, true)
  } finally {
    m.mock.restore()
  }
})
