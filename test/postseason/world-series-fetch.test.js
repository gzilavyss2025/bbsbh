// The World Series home reads (#1906, slice 3). The cutoff is pinned on the
// request URLs and again on the rows that come back.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import {
  clubGamesUrl,
  fetchClubGames,
  fetchPostseasonOutings,
  fetchReelGames,
  fetchSeriesRuns,
  hotBatsUrl,
  meetingsUrl,
  standingsUrl,
} from '../../src/api/postseason/worldSeriesHome.js'

const q = (url) => new URLSearchParams(url.split('?')[1])
const SLATE = '2026-10-27'

function stubFetch(handler) {
  const calls = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => handler(String(url)) }
  })
  return { calls, restore: () => m.mock.restore() }
}

test('hot bats: endDate is the day before the slate date', () => {
  const p = q(hotBatsUrl(2026, 119, SLATE))
  assert.equal(p.get('endDate'), '2026-10-26')
  assert.equal(p.get('startDate'), '2026-01-01')
  assert.equal(p.get('stats'), 'byDateRange')
  assert.equal(p.get('gameType'), 'P')
  assert.equal(p.get('teamId'), '119')
  assert.equal(p.get('playerPool'), 'ALL')
})

test('club games and meetings stop the day before; none asks for a score', () => {
  for (const url of [clubGamesUrl(2026, 119, SLATE), meetingsUrl(2026, 119, 141, SLATE), standingsUrl(2026)]) {
    const p = q(url)
    if (!url.includes('standings')) assert.equal(p.get('endDate'), '2026-10-26', url)
    assert.ok(!/score|runs|linescore|seriesstatus|leaguerecord/i.test(p.get('fields').replace('runDifferential', '')), url)
  }
  assert.equal(q(clubGamesUrl(2026, 119, SLATE, { live: true })).get('endDate'), SLATE)
})

test('standings carry no date: a postseason date answers with no records', () => {
  const p = q(standingsUrl(2026))
  assert.equal(p.get('date'), null)
  assert.equal(p.get('standingsTypes'), 'regularSeason')
})

const sched = (games) => ({ dates: games.map((g) => ({ date: g.officialDate, games: [g] })) })
const game = (gamePk, officialDate, winner = 119) => ({
  gamePk,
  gameType: 'W',
  officialDate,
  seriesGameNumber: gamePk,
  status: { abstractGameState: 'Final' },
  teams: { away: { team: { id: 119 }, isWinner: winner === 119 }, home: { team: { id: 141 }, isWinner: winner === 141 } },
})

test('cutoff: a club game on the slate date is dropped from the rows even if the feed returns it', async () => {
  const stub = stubFetch(() => sched([game(1, '2026-10-24'), game(2, SLATE)]))
  try {
    const rows = await fetchClubGames(2026, 119, SLATE)
    assert.deepEqual(rows.map((r) => r.gamePk), [1])
    assert.deepEqual(rows[0], { gamePk: 1, date: '2026-10-24', gameType: 'W', gameNumber: 1, final: true, homeId: 141, awayId: 119, winnerId: 119 })
    const live = await fetchClubGames(2026, 119, SLATE, { live: true })
    assert.deepEqual(live.map((r) => r.gamePk), [1, 2])
  } finally {
    stub.restore()
  }
})

const box = (away, home) => ({ teams: { away: { team: { id: 119 }, teamStats: { batting: { runs: away } } }, home: { team: { id: 141 }, teamStats: { batting: { runs: home } } } } })

test('cutoff: ledger runs are never requested for a game on the slate date, except under live', async () => {
  const stub = stubFetch(() => box(5, 3))
  try {
    const games = [{ gamePk: 1, date: '2026-10-24' }, { gamePk: 2, date: SLATE }]
    const runs = await fetchSeriesRuns(games, SLATE)
    assert.deepEqual(Object.keys(runs), ['1'])
    assert.equal(stub.calls.length, 1)
    assert.ok(stub.calls[0].includes('/game/1/boxscore'))
    const live = await fetchSeriesRuns(games, SLATE, { live: true })
    assert.deepEqual(Object.keys(live), ['1', '2'])
  } finally {
    stub.restore()
  }
})

test('cutoff: the reel never requests content for a game on or after the slate date', async () => {
  const stub = stubFetch(() => ({}))
  try {
    const out = await fetchReelGames(
      [{ gamePk: 1, date: '2026-10-24' }, { gamePk: 2, date: SLATE }, { gamePk: 3, date: '2026-10-28' }],
      SLATE,
    )
    assert.deepEqual(out.map((g) => g.gamePk), [1])
    assert.ok(stub.calls.length > 0)
    assert.ok(stub.calls.every((c) => c.includes('/game/1/')), stub.calls.join())
  } finally {
    stub.restore()
  }
})

test('cutoff: a pitcher\'s outings stop the day before the slate date, and a leaked row is dropped', async () => {
  const split = (date, id) => ({ date, opponent: { id }, stat: { numberOfPitches: 90 } })
  const stub = stubFetch(() => ({ stats: [{ splits: [split('2026-10-20', 114), split(SLATE, 135)] }] }))
  try {
    const rows = await fetchPostseasonOutings(660271, 2026, SLATE)
    const p = q(stub.calls[0])
    assert.equal(p.get('endDate'), '2026-10-26')
    assert.equal(p.get('gameType'), 'F,D,L,W')
    assert.deepEqual(rows.map((r) => [r.date, r.opponent.abbreviation]), [['2026-10-20', 'CLE']])
  } finally {
    stub.restore()
  }
})

test('the reel makes one /content read per game', async () => {
  const stub = stubFetch(() => ({}))
  try {
    await fetchReelGames([{ gamePk: 1, date: '2026-10-24' }], SLATE)
    assert.equal(stub.calls.filter((c) => c.includes('/game/1/content')).length, 1)
  } finally {
    stub.restore()
  }
})
