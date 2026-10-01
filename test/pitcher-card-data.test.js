import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fetchPitcherLastGame, fetchPitcherSeasonLine } from '../src/api/game.js'

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
  const originalFetch = globalThis.fetch
  const urls = []
  globalThis.fetch = async (url) => {
    urls.push(String(url))
    const body = route(String(url)) ?? EMPTY
    return { ok: true, status: 200, json: async () => body }
  }
  return run(urls).finally(() => {
    globalThis.fetch = originalFetch
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
