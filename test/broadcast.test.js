import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchGameBroadcast, fetchNationalBroadcasts } from '../src/api/broadcast.js'

const response = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
})

function withFetch(events, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => response({ events })
  return run().finally(() => {
    globalThis.fetch = originalFetch
  })
}

const HOME = { id: '158', abbreviation: 'MIL', teamName: 'Brewers' }
const AWAY = { id: '112', abbreviation: 'CHC', teamName: 'Cubs' }

// Each test uses its own officialDate so fetchEspnEvents' per-date cache
// (shared at module scope across every test in this file) can't leak one
// test's mocked broadcasts into another's.
function feedFor(home, away, officialDate) {
  return {
    gameData: {
      datetime: { officialDate, dateTime: `${officialDate}T18:10:00Z` },
      teams: { home, away },
    },
  }
}

function eventFor(home, away, broadcasts, dateIso) {
  return {
    date: dateIso,
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { abbreviation: home.abbreviation, name: home.teamName } },
          { homeAway: 'away', team: { abbreviation: away.abbreviation, name: away.teamName } },
        ],
        broadcasts,
      },
    ],
  }
}

// The league's own out-of-market streaming package rides alongside nearly
// every game's real broadcast(s) and never itself identifies who's calling
// the game (verified against 15 days of live ESPN scoreboard data, 2026-07-23
// through 2026-08-06 — every one of 185 MLB.TV-carrying games also carried at
// least one other network). It must never appear in the displayed summary.
test('fetchGameBroadcast drops MLB.TV from the summary when other networks are present', async () => {
  const officialDate = '2026-08-05'
  const events = [
    eventFor(
      HOME,
      AWAY,
      [
        { market: 'national', names: ['MLB.TV'] },
        { market: 'home', names: ['BravesVision'] },
        { market: 'away', names: ['Brewers.TV'] },
      ],
      `${officialDate}T18:10Z`,
    ),
  ]

  await withFetch(events, async () => {
    const summary = await fetchGameBroadcast(feedFor(HOME, AWAY, officialDate))
    assert.equal(summary, 'BravesVision · Brewers.TV')
    assert.ok(!summary.includes('MLB.TV'))
  })
})

test('fetchGameBroadcast keeps a real national network alongside MLB.TV', async () => {
  const officialDate = '2026-08-04'
  const events = [
    eventFor(HOME, AWAY, [{ market: 'national', names: ['MLB.TV', 'FOX'] }], `${officialDate}T18:10Z`),
  ]

  await withFetch(events, async () => {
    const summary = await fetchGameBroadcast(feedFor(HOME, AWAY, officialDate))
    assert.equal(summary, 'FOX')
  })
})

test('fetchNationalBroadcasts never reports MLB.TV as the national network', async () => {
  const officialDate = '2026-08-03'
  const events = [
    eventFor(HOME, AWAY, [{ market: 'national', names: ['MLB.TV'] }], `${officialDate}T18:10Z`),
  ]
  const games = [{ gamePk: 1, gameDate: `${officialDate}T18:10Z`, home: HOME, away: AWAY }]

  await withFetch(events, async () => {
    const out = await fetchNationalBroadcasts(officialDate, games)
    assert.deepEqual(out, {})
  })
})
