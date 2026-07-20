import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchManager } from '../src/api/game.js'

const response = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
})

function withFetch(roster, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => response({ roster })
  return run().finally(() => {
    globalThis.fetch = originalFetch
  })
}

// Reproduces the 2026 Mets bug: Carlos Mendoza was let go mid-season, but the
// coaches endpoint keeps his 'Manager' row for the season alongside the new
// 'Interim Manager' row instead of removing it. The active interim must win.
test('fetchManager prefers an interim over a permanent manager still on the roster', async () => {
  const roster = [
    {
      person: { id: 425825, fullName: 'Carlos Mendoza' },
      jerseyNumber: '64',
      job: 'Manager',
      jobId: 'MNGR',
    },
    {
      person: { id: 433477, fullName: 'Andy Green' },
      jerseyNumber: '70',
      job: 'Interim Manager',
      jobId: 'NTRM',
    },
  ]

  await withFetch(roster, async () => {
    const mgr = await fetchManager(121, 2026)
    assert.equal(mgr.name, 'Andy Green')
    assert.equal(mgr.interim, true)
    assert.equal(mgr.lastFirst, 'Green, Andy')
  })
})

test('fetchManager returns the sole permanent manager when no interim is present', async () => {
  const roster = [
    {
      person: { id: 1, fullName: 'Pat Murphy' },
      jerseyNumber: '21',
      job: 'Manager',
      jobId: 'MNGR',
    },
  ]

  await withFetch(roster, async () => {
    const mgr = await fetchManager(158, 2026)
    assert.equal(mgr.name, 'Pat Murphy')
    assert.equal(mgr.interim, false)
  })
})

test('fetchManager returns the interim when he is the only manager-job row on file', async () => {
  const roster = [
    {
      person: { id: 2, fullName: 'Don Mattingly' },
      jerseyNumber: '8',
      job: 'Interim Manager',
      jobId: 'NTRM',
    },
  ]

  await withFetch(roster, async () => {
    const mgr = await fetchManager(143, 2026)
    assert.equal(mgr.name, 'Don Mattingly')
    assert.equal(mgr.interim, true)
  })
})

test('fetchManager ignores the Associate Manager senior-advisor role', async () => {
  const roster = [
    {
      person: { id: 3, fullName: 'Someone Else' },
      jerseyNumber: '9',
      job: 'Associate Manager',
      jobId: 'ASSM',
    },
  ]

  await withFetch(roster, async () => {
    const mgr = await fetchManager(158, 2026)
    assert.equal(mgr, null)
  })
})
