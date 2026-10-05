import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { mock } from 'node:test'
import { fetchPitcherLastGame, fetchPitcherSeasonLine } from '../src/api/game.js'
import { fetchPitcherPostseasonCareer } from '../src/api/postseason/pitcherCareer.js'

// The Now Pitching card's two fetchers, run against responses captured from
// statsapi.mlb.com on 2026-10-01 (test/fixtures/pitcher-card/, trimmed to the
// fields the fetchers read). The games are the two Wild Card games of #1344:
// PHI @ ATL, Gm 1 = 849845 (2026-09-29), Gm 2 = 849841 (2026-09-30).
const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/pitcher-card/${name}.json`, import.meta.url), 'utf8'))

const EMPTY = { stats: [{ splits: [] }] }

// A fetch stand-in that routes on the URL and records every request, so a test
// can assert on WHAT was asked as well as on what came back.
function withApi(route, run) {
  const urls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url))
    const body = route(String(url)) ?? EMPTY
    return { ok: true, status: 200, json: async () => body }
  })
  return run(urls).finally(() => {
    fetchMock.mock.restore()
  })
}

// ---- Season and postseason lines ------------------------------------------

test('the season line asks byDateRange, ending the day before the game', async () => {
  await withApi(
    () => fixture('lee-669276-bydaterange-R-thru-2026-09-29'),
    async (urls) => {
      await fetchPitcherSeasonLine(669276, 2026, 1, '2026-09-30')
      assert.equal(urls.length, 1)
      const q = new URL(urls[0]).searchParams
      assert.equal(q.get('stats'), 'byDateRange')
      assert.equal(q.get('startDate'), '2026-01-01')
      assert.equal(q.get('endDate'), '2026-09-29')
      assert.equal(q.get('gameType'), 'R')
      assert.equal(q.get('group'), 'pitching')
    },
  )
})

test('the day before the first of a month is the last of the month before', async () => {
  await withApi(
    () => EMPTY,
    async (urls) => {
      await fetchPitcherSeasonLine(669276, 2026, 1, '2026-10-01')
      assert.equal(new URL(urls[0]).searchParams.get('endDate'), '2026-09-30')
    },
  )
})

test('the postseason line asks for the four postseason game types', async () => {
  await withApi(
    () => fixture('lee-669276-bydaterange-post-thru-2026-09-29'),
    async (urls) => {
      const post = await fetchPitcherSeasonLine(669276, 2026, 1, '2026-09-30', { postseason: true })
      assert.equal(new URL(urls[0]).searchParams.get('gameType'), 'F,D,L,W')
      assert.equal(post.games, 1)
      assert.equal(post.inningsPitched, '1.0')
      assert.equal(post.era, '0.00')
      assert.equal(post.whip, '0.00')
    },
  )
})

test('a MiLB arm passes his sportId', async () => {
  await withApi(
    () => EMPTY,
    async (urls) => {
      await fetchPitcherSeasonLine(669276, 2026, 11, '2026-07-01')
      assert.equal(new URL(urls[0]).searchParams.get('sportId'), '11')
    },
  )
})

test('no game date, no line (the fetch cannot know where to stop)', async () => {
  await withApi(
    () => fixture('lee-669276-bydaterange-R-thru-2026-09-29'),
    async (urls) => {
      assert.equal(await fetchPitcherSeasonLine(669276, 2026, 1, null), null)
      assert.equal(urls.length, 0)
    },
  )
})

// The splits come ATL, SF, then the combined line with no `team` key. The
// first split is his Braves line only (9 GS, 4-1, 1.99).
test('a traded pitcher gets the combined line, not the first split', async () => {
  const line = await withApi(
    () => fixture('mahle-641816-bydaterange-R-thru-2026-09-29'),
    () => fetchPitcherSeasonLine(641816, 2026, 1, '2026-09-30'),
  )
  assert.equal(line.gamesStarted, 27)
  assert.equal(line.wins, 7)
  assert.equal(line.losses, 10)
  assert.equal(line.era, '3.99')
  assert.equal(line.inningsPitched, '149.0')
  assert.equal(line.strikeOuts, 137)
  assert.equal(line.baseOnBalls, 46)
  assert.equal(line.whip, '1.23')
})

test('the season line carries every column the card can show', async () => {
  const line = await withApi(
    () => fixture('lee-669276-bydaterange-R-thru-2026-09-29'),
    () => fetchPitcherSeasonLine(669276, 2026, 1, '2026-09-30'),
  )
  assert.deepEqual(
    {
      games: line.games,
      gamesStarted: line.gamesStarted,
      saves: line.saves,
      holds: line.holds,
      era: line.era,
      inningsPitched: line.inningsPitched,
      strikeOuts: line.strikeOuts,
      baseOnBalls: line.baseOnBalls,
      whip: line.whip,
    },
    {
      games: 71,
      gamesStarted: 0,
      saves: 0,
      holds: 31,
      era: '3.09',
      inningsPitched: '67.0',
      strikeOuts: 77,
      baseOnBalls: 17,
      whip: '0.97',
    },
  )
})

// ---- All-time postseason line ----------------------------------------------

// Peralta, captured 2026-10-05: seven postseason splits across six Octobers
// (2025 comes as two, one per round, neither keyless), no 2026 games yet.
// Hand sums: 9 G, 6 GS, 100 outs, 16 ER, 21 H, 13 BB, 41 K.
test('the all-time postseason line sums every earlier October and rebuilds the rates', async () => {
  const line = await withApi(
    () => fixture('peralta-642547-yearbyyear-post'),
    () => fetchPitcherPostseasonCareer(642547, 2026, null),
  )
  assert.equal(line.games, 9)
  assert.equal(line.gamesStarted, 6)
  assert.equal(line.inningsPitched, '33.1')
  assert.equal(line.era, '4.32')
  assert.equal(line.whip, '1.02')
  assert.equal(line.strikeOuts, 41)
  assert.equal(line.baseOnBalls, 13)
})

test('this season joins the all-time line only through the cutoff-gated line it is handed', async () => {
  const urls = []
  const thisSeason = { games: 1, gamesStarted: 1, wins: 0, losses: 0, saves: 0, holds: 0, inningsPitched: '2.0', strikeOuts: 3, baseOnBalls: 0, hits: 1, earnedRuns: 1 }
  const line = await withApi(
    (url) => (urls.push(url), fixture('peralta-642547-yearbyyear-post')),
    () => fetchPitcherPostseasonCareer(642547, 2026, thisSeason),
  )
  assert.equal(line.games, 10)
  assert.equal(line.inningsPitched, '35.1')
  assert.equal(line.earnedRuns, 17)
  assert.equal(new URL(urls[0]).searchParams.get('stats'), 'yearByYear')
})

test('a season at or after the cutoff year is never read from yearByYear', async () => {
  const line = await withApi(
    () => fixture('peralta-642547-yearbyyear-post'),
    () => fetchPitcherPostseasonCareer(642547, 2025, null),
  )
  assert.equal(line.games, 6) // 2018-2024 only; both 2025 splits are left out
})

test('no postseason games, ever, is no all-time line', async () => {
  assert.equal(await withApi(() => EMPTY, () => fetchPitcherPostseasonCareer(1, 2026, null)), null)
})

test('no split (a debut) is no line', async () => {
  const line = await withApi(() => EMPTY, () => fetchPitcherSeasonLine(1, 2026, 1, '2026-09-30'))
  assert.equal(line, null)
})

// ---- Last appearance --------------------------------------------------------

const leeRoute = (url) => {
  if (url.includes('/schedule')) return fixture('schedule-849845')
  // Only the MLB log has his games; every MiLB level answers empty.
  if (url.includes('stats=gameLog') && !url.includes('sportId=') && url.includes('season=2026')) {
    return fixture('lee-669276-gamelog-2026')
  }
  return EMPTY
}

test('the game log asks for the regular season AND the postseason', async () => {
  await withApi(leeRoute, async (urls) => {
    await fetchPitcherLastGame(669276, 2026, '2026-09-30')
    const logs = urls.filter((u) => u.includes('stats=gameLog'))
    assert.ok(logs.length > 0)
    for (const u of logs) assert.equal(new URL(u).searchParams.get('gameType'), 'R,F,D,L,W')
  })
})

// WC Gm 2: Lee's last appearance is Gm 1 (a postseason game), and never Gm 2
// itself, though the log already holds it.
test('a postseason game counts, and this game never does', async () => {
  const last = await withApi(leeRoute, () => fetchPitcherLastGame(669276, 2026, '2026-09-30'))
  assert.equal(last.gamePk, 849845)
  assert.equal(last.date, '2026-09-29')
  assert.equal(last.gameType, 'F')
  assert.equal(last.gameNumber, 1)
  assert.equal(last.seriesGameNumber, 1)
  assert.equal(last.home, true)
  assert.equal(last.team, 'ATL')
  assert.equal(last.opponent, 'PHI')
  assert.deepEqual(
    [
      last.inningsPitched,
      last.pitches,
      last.battersFaced,
      last.hits,
      last.runs,
      last.earnedRuns,
      last.baseOnBalls,
      last.strikeOuts,
    ],
    ['1.0', 16, 3, 0, 0, 0, 0, 1],
  )
})

// He got the win in Gm 1; nothing the fetcher returns may carry it.
test('the last appearance carries no decision', async () => {
  const last = await withApi(leeRoute, () => fetchPitcherLastGame(669276, 2026, '2026-09-30'))
  for (const key of ['wins', 'losses', 'saves', 'holds', 'isWin', 'decision']) {
    assert.equal(key in last, false, key)
  }
})

test('a regular-season game skips the schedule lookup', async () => {
  await withApi(leeRoute, async (urls) => {
    const last = await fetchPitcherLastGame(669276, 2026, '2026-09-29')
    assert.equal(last.gamePk, 823813)
    assert.equal(last.seriesGameNumber, null)
    assert.equal(
      urls.some((u) => u.includes('/schedule')),
      false,
    )
  })
})

// A doubleheader: game 1 and game 2 share a date.
const dhSplit = (gamePk, gameNumber) => ({
  date: '2026-07-04',
  gameType: 'R',
  isHome: true,
  team: { id: 158 },
  opponent: { id: 112 },
  sport: { id: 1 },
  game: { gamePk, gameNumber },
  stat: { inningsPitched: '1.0', numberOfPitches: 12 },
})
const dhRoute = (url) =>
  url.includes('stats=gameLog') && !url.includes('sportId=') && url.includes('season=2026')
    ? { stats: [{ splits: [dhSplit(1001, 1), dhSplit(1002, 2)] }] }
    : EMPTY

test('in game 2 of a doubleheader, game 1 is the last appearance', async () => {
  const last = await withApi(dhRoute, () => fetchPitcherLastGame(1, 2026, '2026-07-04', 2))
  assert.equal(last.gamePk, 1001)
})

test('in game 1 of a doubleheader, neither game of that day counts', async () => {
  const last = await withApi(dhRoute, () => fetchPitcherLastGame(1, 2026, '2026-07-04', 1))
  assert.equal(last, null)
})

// ---- One request per arm (#1429) -------------------------------------------

test('a second ask for the same pitcher, game and date makes no new request', async () => {
  await withApi(
    () => fixture('lee-669276-bydaterange-R-thru-2026-09-29'),
    async (urls) => {
      // An id no other test uses, so this test owns its cache entries.
      const [line1, last1] = await Promise.all([
        fetchPitcherSeasonLine(900001, 2026, 1, '2026-09-30'),
        fetchPitcherLastGame(900001, 2026, '2026-09-30', 1),
      ])
      const asked = urls.length
      assert.ok(asked > 0)
      const [line2, last2] = await Promise.all([
        fetchPitcherSeasonLine(900001, 2026, 1, '2026-09-30'),
        fetchPitcherLastGame(900001, 2026, '2026-09-30', 1),
      ])
      assert.equal(urls.length, asked)
      assert.deepEqual(line2, line1)
      assert.deepEqual(last2, last1)
      // A different game date is a different question.
      await fetchPitcherSeasonLine(900001, 2026, 1, '2026-10-01')
      assert.equal(urls.length, asked + 1)
    },
  )
})
