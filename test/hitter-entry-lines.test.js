import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchHitterEntryLines } from '../src/api/player/hitterEntryLines.js'

// Shapes captured from statsapi.mlb.com on 2026-10-06 (#1509): a one-club hitter
// (Chase DeLauter, whose single split carries a team) and a traded hitter
// (Nathaniel Lowe: CIN, CLE, then the combined split with no `team` key).
const split = (team, g, ab, avg, hr, rbi) => ({
  ...(team ? { team: { name: team } } : {}),
  stat: { gamesPlayed: g, atBats: ab, avg, obp: '.300', slg: '.400', ops: '.700', homeRuns: hr, rbi, stolenBases: 1 },
})
const body = {
  people: [
    { id: 800050, stats: [{ type: { displayName: 'byDateRange' }, splits: [split('Cleveland Guardians', 133, 495, '.287', 16, 67)] }] },
    {
      id: 663993,
      stats: [
        {
          type: { displayName: 'byDateRange' },
          splits: [split('Cincinnati Reds', 83, 248, '.266', 12, 37), split('Cleveland Guardians', 43, 133, '.226', 5, 27), split(null, 126, 381, '.252', 17, 64)],
        },
      ],
    },
  ],
}

async function withApi(run) {
  const urls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url))
    return { ok: true, status: 200, json: async () => body }
  })
  try {
    await run(urls)
  } finally {
    fetchMock.mock.restore()
  }
}

test('one request reads the whole lineup, regular season, ending the day before', async () => {
  await withApi(async (urls) => {
    await fetchHitterEntryLines([800050, 663993, 800050], 2026, '2026-10-05')
    assert.equal(urls.length, 1)
    const u = new URL(urls[0])
    assert.equal(u.searchParams.get('personIds'), '800050,663993')
    const hydrate = u.searchParams.get('hydrate')
    assert.match(hydrate, /startDate=2026-01-01/)
    assert.match(hydrate, /endDate=2026-10-04/)
    assert.match(hydrate, /gameType=R/)
  })
})

test('a traded hitter gets the combined split, not the first one', async () => {
  await withApi(async () => {
    const lines = await fetchHitterEntryLines([800050, 663993], 2026, '2026-10-05')
    assert.equal(lines[663993].avg, '.252')
    assert.equal(lines[663993].atBats, 381)
    assert.equal(lines[800050].avg, '.287')
    assert.equal(lines[800050].homeRuns, 16)
  })
})

test('no date, no ids, or a failed read gives an empty answer', async () => {
  assert.deepEqual(await fetchHitterEntryLines([1], 2026, null), {})
  assert.deepEqual(await fetchHitterEntryLines([], 2026, '2026-10-05'), {})
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline')
  })
  try {
    assert.deepEqual(await fetchHitterEntryLines([1], 2026, '2026-10-05'), {})
  } finally {
    fetchMock.mock.restore()
  }
})
