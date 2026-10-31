// #2729: when every schedule read fails (offline), fetchStampGames must reject, so
// the Game Log can say the facts failed rather than "not available".
import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchStampGames } from '../src/api/logbook.js'

test('fetchStampGames rejects when every schedule read fails', async () => {
  const real = globalThis.fetch
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  try {
    await assert.rejects(fetchStampGames([816469]))
  } finally {
    globalThis.fetch = real
  }
})
