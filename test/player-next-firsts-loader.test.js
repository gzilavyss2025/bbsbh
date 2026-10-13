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
  assert.deepEqual(Object.keys(firsts).filter((k) => firsts[k]).sort(), ['debut', 'so', 'win'])
  assert.equal(firsts.win.gamePk, 7)
  assert.equal(firsts.win.oppId, 142)
})
