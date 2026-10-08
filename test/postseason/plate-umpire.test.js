import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchPlateUmpires, plateUmpireUrl, shapePlateUmpires } from '../../src/api/postseason/plateUmpire.js'

test('the read asks for officials by date and for no result field at all', () => {
  const url = plateUmpireUrl('2025-10-17')
  assert.match(url, /^\/api\/v1\/schedule\?sportId=1&date=2025-10-17&hydrate=officials&fields=/)
  const fields = new URL(`https://x${url}`).searchParams.get('fields').split(',')
  assert.deepEqual(fields, ['dates', 'games', 'gamePk', 'officials', 'officialType', 'official', 'id', 'fullName'])
  for (const banned of ['status', 'abstractGameState', 'score', 'isWinner', 'linescore', 'seriesStatus', 'leagueRecord', 'teams']) {
    assert.equal(fields.includes(banned), false, `${banned} must not be requested`)
  }
})

// Trimmed from a live response (2025-10-17, gamePks 813039 and 813031).
const live = {
  dates: [
    {
      games: [
        {
          gamePk: 813039,
          officials: [
            { official: { id: 511890, fullName: 'Quinn Wolcott' }, officialType: 'First Base' },
            { official: { id: 427243, fullName: 'Marvin Hudson' }, officialType: 'Home Plate' },
          ],
        },
        { gamePk: 813031, officials: [{ official: { id: 644760, fullName: 'Adam Beck' }, officialType: 'Home Plate' }] },
        { gamePk: 813040, officials: [{ official: { id: 1, fullName: 'Base Only' }, officialType: 'First Base' }] },
        { gamePk: 813041 },
      ],
    },
  ],
}

test('the home plate umpire of each game, by gamePk; a game with none is left out', () => {
  assert.deepEqual(shapePlateUmpires(live), {
    813039: { id: 427243, name: 'Marvin Hudson' },
    813031: { id: 644760, name: 'Adam Beck' },
  })
})

test('an empty or failed body shapes to nothing', () => {
  assert.deepEqual(shapePlateUmpires(null), {})
  assert.deepEqual(shapePlateUmpires({ dates: [] }), {})
})

// The fetch itself, with the network replaced.
async function withFetch(stub, run) {
  const real = globalThis.fetch
  globalThis.fetch = stub
  try {
    return await run()
  } finally {
    globalThis.fetch = real
  }
}

test('fetchPlateUmpires makes one read for the date and shapes it', async () => {
  const urls = []
  const stub = async (url) => (urls.push(url), new Response(JSON.stringify(live)))
  const out = await withFetch(stub, () => fetchPlateUmpires('2025-10-17'))
  assert.equal(urls.length, 1)
  assert.ok(urls[0].endsWith(plateUmpireUrl('2025-10-17')))
  assert.equal(out[813039].name, 'Marvin Hudson')
})

test('fetchPlateUmpires gives {} on a failed read', async () => {
  const down = async () => new Response('', { status: 404 })
  assert.deepEqual(await withFetch(down, () => fetchPlateUmpires('2025-10-17')), {})
})
