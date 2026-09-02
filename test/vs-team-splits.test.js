// Coverage for the player page's SPLITS VS TEAM reader (src/api/vsTeamSplits.js):
// the static-file fetch/cache wrapper plus the pure per-player view-model shaper.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchVsTeamSplitsForPlayer,
  fetchVsTeamSplitsForTeams,
  vsTeamDoorLabel,
  vsTeamSplitsFor,
} from '../src/api/vsTeamSplits.js'

const TEAMS = [
  { id: 158, abbr: 'MIL', name: 'Brewers' },
  { id: 112, abbr: 'CHC', name: 'Cubs' },
  { id: 138, abbr: 'STL', name: 'Cardinals' },
]

// --------------------------------------------------------------------------
// vsTeamDoorLabel — the one wording, shared by both doors into the game lines
// sheet (ADR-0069). The sheet quotes the door's label verbatim as its
// headline, so these two strings are a contract, not a preference: the lineup
// page's Starting pitcher card and the player page's Splits vs team card must
// word the same career the same way.
// --------------------------------------------------------------------------
test('vsTeamDoorLabel words a pitcher career as G, IP, ERA, K, BB', () => {
  const car = { g: 7, ip: '34.0', era: '3.44', k: 28, bb: 17 }
  assert.equal(
    vsTeamDoorLabel(car, 'pitching', 'MIL'),
    'Career vs MIL: 7 G, 34.0 IP, 3.44 ERA, 28 K, 17 BB',
  )
})

test('vsTeamDoorLabel words a hitter career as G, PA, AVG, HR, OPS', () => {
  const car = { g: 96, pa: 412, avg: '.284', hr: 14, ops: '.812' }
  assert.equal(
    vsTeamDoorLabel(car, 'hitting', 'CHC'),
    'Career vs CHC: 96 G, 412 PA, .284, 14 HR, .812 OPS',
  )
})

test('vsTeamDoorLabel counts games, never starts — a relief outing is in the total', () => {
  // The generator sums gamesPlayed; "7 GS" was the bug the rows behind the
  // line exposed (ADR-0069). The label says G, and nothing here may print GS.
  const label = vsTeamDoorLabel({ g: 7, ip: '34.0', era: '3.44', k: 28, bb: 17 }, 'pitching', 'MIL')
  assert.ok(label.includes('7 G,'))
  assert.doesNotMatch(label, /GS/)
})

// --------------------------------------------------------------------------
// vsTeamSplitsFor — pure
// --------------------------------------------------------------------------
test('vsTeamSplitsFor is null for a player absent from the file', () => {
  assert.equal(vsTeamSplitsFor({ players: {} }, 660271), null)
  assert.equal(vsTeamSplitsFor(null, 660271), null)
})

test('vsTeamSplitsFor is null for a player carrying no vs-team data', () => {
  const data = { players: { 660271: { group: 'hitting', teamId: 158 } }, teams: TEAMS }
  assert.equal(vsTeamSplitsFor(data, 660271), null)
})

test('vsTeamSplitsFor builds the selectable strip, dropping the player\'s own club', () => {
  const data = {
    players: {
      660271: {
        group: 'hitting',
        teamId: 158,
        vs: { 112: { car: { g: 10 } } },
      },
    },
    teams: TEAMS,
    nextOpponent: { 158: 138 },
  }
  const view = vsTeamSplitsFor(data, 660271)
  assert.deepEqual(
    view.teams.map((t) => t.id),
    [112, 138],
  )
  assert.equal(view.teams.find((t) => t.id === 112).has, true)
  assert.equal(view.teams.find((t) => t.id === 138).has, false)
})

test('vsTeamSplitsFor preselects the club\'s next opponent when he has faced them', () => {
  const data = {
    players: { 1: { group: 'hitting', teamId: 158, vs: { 138: { car: { g: 3 } } } } },
    teams: TEAMS,
    nextOpponent: { 158: 138 },
  }
  assert.equal(vsTeamSplitsFor(data, 1).preselectId, 138)
})

test('vsTeamSplitsFor falls back to the most-faced club when the next opponent is unfaced or unknown', () => {
  const data = {
    players: {
      1: {
        group: 'hitting',
        teamId: 158,
        vs: { 112: { car: { g: 4 } }, 138: { car: { g: 9 } } },
      },
    },
    teams: TEAMS,
    nextOpponent: { 158: null },
  }
  assert.equal(vsTeamSplitsFor(data, 1).preselectId, 138) // more career games than 112
})

test('vsTeamSplitsFor falls back to the first strip entry when the player has an empty vs map', () => {
  // An empty (but present) `vs` object still counts as "in the file" — only
  // a wholly absent `vs` key means "not in the file" (tested above).
  const data = {
    players: { 1: { group: 'hitting', teamId: 158, vs: {} } },
    teams: TEAMS,
    nextOpponent: {},
  }
  const view = vsTeamSplitsFor(data, 1)
  assert.equal(view.preselectId, 112) // strip[0], since nobody's `has` is true
})

// --------------------------------------------------------------------------
// The sharded fetch — one index plus one file per club. Cached in-memory for
// the session, so this suite exercises it in ONE test (module-level singleton
// caches; a second test would see the first one's cache).
// --------------------------------------------------------------------------
const SHARDS = {
  '/data/vs-team-splits/index.json': {
    generatedAt: '2026-08-07',
    season: 2026,
    teams: TEAMS,
    nextOpponent: { 158: 112 },
    owner: { 1: 158, 2: 112 },
  },
  '/data/vs-team-splits/158.json': {
    players: { 1: { teamId: 158, group: 'hitting', vs: { 112: { car: { g: 3 } } } } },
  },
  '/data/vs-team-splits/112.json': {
    players: { 2: { teamId: 112, group: 'pitching', vs: { 158: { car: { g: 5 } } } } },
  },
}

test('the club shards merge back into the whole-file shape, and are fetched once', async () => {
  const originalFetch = globalThis.fetch
  const urls = []
  globalThis.fetch = async (url) => {
    urls.push(url)
    const body = SHARDS[url]
    if (!body) throw new Error(`unexpected fetch ${url}`)
    return { ok: true, status: 200, json: async () => body }
  }
  try {
    // A game reads exactly the two clubs playing — never the other 28.
    const merged = await fetchVsTeamSplitsForTeams([158, 112])
    assert.deepEqual(urls.sort(), [
      '/data/vs-team-splits/112.json',
      '/data/vs-team-splits/158.json',
      '/data/vs-team-splits/index.json',
    ])
    assert.deepEqual(Object.keys(merged.players).sort(), ['1', '2'])
    assert.equal(merged.season, 2026)
    // The header from the index is merged in, so the pure view model that used
    // to read the single file is unchanged.
    assert.equal(vsTeamSplitsFor(merged, 1).preselectId, 112)

    // A player page resolves his club through the index's `owner` map — and
    // here both are already cached, so it costs no further request.
    const calls = urls.length
    const one = await fetchVsTeamSplitsForPlayer(1)
    assert.equal(urls.length, calls)
    assert.equal(one.players[1].teamId, 158)
  } finally {
    globalThis.fetch = originalFetch
  }
})
