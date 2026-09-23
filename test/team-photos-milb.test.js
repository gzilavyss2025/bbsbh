// Issue #1142: MiLB games carry no photographer stills, so a MiLB club's
// photo walk fetched the whole season's content packages and drew nothing.
// The rails are gated to MLB clubs in their callers; the Full-season photos
// page is reachable by URL too, so its loader must not hand a MiLB club a
// season to walk. No schedule request, no games, nothing to fetch.
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTeamPhotos } from '../src/screens/team/data/loadTeamPhotos.js'

const TEAMS = {
  bySportId: {
    1: [{ id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers' }],
    11: [{ id: 556, name: 'Nashville Sounds', teamName: 'Sounds' }],
  },
}

function withFetchSpy(run) {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = String(url)
    calls.push(u)
    const body = u.includes('/data/teams.json') ? TEAMS : { dates: [] }
    return { ok: true, status: 200, json: async () => body }
  }
  return Promise.resolve()
    .then(() => run(calls))
    .finally(() => {
      globalThis.fetch = originalFetch
    })
}

test('a MiLB club gets no season to walk, and no schedule request', () =>
  withFetchSpy(async (calls) => {
    const data = await loadTeamPhotos(556, null)
    assert.equal(data.team.id, 556)
    assert.deepEqual(data.seasonGames, [])
    assert.deepEqual(
      calls.filter((u) => u.includes('/schedule')),
      [],
    )
  }))

test('an MLB club still reads its season schedule', () =>
  withFetchSpy(async (calls) => {
    await loadTeamPhotos(158, null)
    assert.equal(calls.filter((u) => u.includes('/schedule')).length, 1)
  }))
