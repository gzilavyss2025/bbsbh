import test from 'node:test'
import assert from 'node:assert/strict'

// A hitter-primary two-way player (bio.isPitcher false) asked for his pitching firsts (#1895).
test('firstsFor builds the pitching firsts for a player whose primary role is hitting', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url)
    const body = u.includes('/schedule')
      ? { dates: [{ games: [{ gamePk: 7, officialDate: '2026-05-17', gameNumber: 1, teams: { away: { team: { id: 142 } }, home: { team: { id: 158 } } } }] }] }
      : { liveData: { plays: { allPlays: [] } } }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  const { firstsFor } = await import('../src/api/player/history.js')
  const ctx = { bio: { id: 660271, debut: '2026-05-17', isPitcher: false }, cutoff: null, currentYear: 2026, debutYear: 2026 }
  const log = [{ date: '2026-05-17', isHome: true, game: { gamePk: 7 }, stat: { gamesStarted: 1, wins: 1, strikeOuts: 5 } }]
  const firsts = await firstsFor(ctx, 'pitching', [{ season: '2026', stat: { gamesStarted: 1, wins: 1, strikeOuts: 5 } }], log)
  assert.deepEqual(Object.keys(firsts).filter((k) => firsts[k]).sort(), ['so', 'start', 'win'])
  assert.equal(firsts.win.gamePk, 7)
  assert.equal(firsts.win.oppId, 142)
})

const jsonRes = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
const stubFetch = (t, urls) =>
  t.mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url)
    urls.push(u)
    return jsonRes(
      u.includes('/schedule')
        ? { dates: [{ games: [{ gamePk: 7, officialDate: '2026-05-17', gameNumber: 1, teams: { away: { team: { id: 142 } }, home: { team: { id: 158 } } } }] }] }
        : { liveData: { plays: { allPlays: [] } } },
    )
  })

test('a debut on or after the cutoff is not a first', async (t) => {
  stubFetch(t, [])
  const { firstsFor, loadFirsts } = await import('../src/api/player/history.js')
  const ctx = { bio: { id: 1, debut: '2024-05-10', isPitcher: false }, cutoff: '2024-04-01', currentYear: 2024, debutYear: 2024 }
  const log = [{ date: '2024-05-10', isHome: true, game: { gamePk: 7 }, stat: { hits: 1 } }]
  assert.equal(await firstsFor(ctx, 'hitting', [], log), null)
  assert.equal(typeof loadFirsts, 'function')
})

test('the role that is not his primary one has no debut row', async (t) => {
  stubFetch(t, [])
  const { firstsFor } = await import('../src/api/player/history.js')
  // Two-way hitter: debuted 2018-03-29 as a hitter; his pitching log starts 2018-04-01.
  const ctx = { bio: { id: 660271, debut: '2018-03-29', isPitcher: false }, cutoff: null, currentYear: 2018, debutYear: 2018 }
  const log = [{ date: '2018-04-01', isHome: true, game: { gamePk: 7 }, stat: { gamesStarted: 1, strikeOuts: 6 } }]
  const firsts = await firstsFor(ctx, 'pitching', [{ season: '2018', stat: { gamesStarted: 1, strikeOuts: 6 } }], log)
  assert.equal(firsts.debut, undefined)
  assert.equal(firsts.start.date, '2018-04-01')
})

test('people: false skips the play-by-play lookups', async (t) => {
  const urls = []
  stubFetch(t, urls)
  const { firstsFor } = await import('../src/api/player/history.js')
  const ctx = { bio: { id: 5, debut: '2026-05-17', isPitcher: true }, cutoff: null, currentYear: 2026, debutYear: 2026 }
  const log = [{ date: '2026-05-17', isHome: true, game: { gamePk: 7 }, stat: { gamesStarted: 1, strikeOuts: 5 } }]
  const ybys = [{ season: '2026', stat: { gamesStarted: 1, strikeOuts: 5 } }]
  await firstsFor(ctx, 'pitching', ybys, log, { people: false })
  assert.equal(urls.filter((u) => u.includes('feed/live')).length, 0)
  await firstsFor(ctx, 'pitching', ybys, log)
  assert.equal(urls.filter((u) => u.includes('feed/live')).length, 1)
})
