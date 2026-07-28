// Coverage for the player page's SPLITS VS TEAM reader (src/api/vsTeamSplits.js):
// the static-file fetch/cache wrapper plus the pure per-player view-model shaper.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchVsTeamSplits, vsTeamSplitsFor } from '../src/api/vsTeamSplits.js'

const TEAMS = [
  { id: 158, abbr: 'MIL', name: 'Brewers' },
  { id: 112, abbr: 'CHC', name: 'Cubs' },
  { id: 138, abbr: 'STL', name: 'Cardinals' },
]

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
// fetchVsTeamSplits — cached in-memory for the session; this suite is the
// only place that exercises it (module-level singleton cache).
// --------------------------------------------------------------------------
test('fetchVsTeamSplits reads the static file and caches the parsed result', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (url) => {
    calls++
    assert.equal(url, '/data/vs-team-splits.json')
    return { ok: true, status: 200, json: async () => ({ players: {}, teams: [] }) }
  }
  try {
    const first = await fetchVsTeamSplits()
    assert.deepEqual(first, { players: {}, teams: [] })
    const second = await fetchVsTeamSplits()
    assert.equal(second, first)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
