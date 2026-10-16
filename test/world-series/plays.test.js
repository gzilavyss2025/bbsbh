// fetchPlays (scripts/lib/world-series/plays.mjs): a play-by-play read that fails (after getJson's own
// retries) is logged with its gamePk; the block still drops (wsEventsBlock.js) when a counted game has none.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bracket2025 } from '../postseason/fixtures.js'
import { wsEventsBlock } from '../../src/lib/postseason/primer/wsEventsBlock.js'
import { fetchPlays } from '../../scripts/lib/world-series/plays.mjs'

const WS_2025 = [813027, 813026, 813032, 813023, 813022, 813025, 813024]
const box = { teams: { away: { team: { id: 119 } }, home: { team: { id: 141 } } } }
const boxes = Object.fromEntries(WS_2025.map((pk) => [pk, { box }]))
const body = { allPlays: [] }
const block = (pbp) => wsEventsBlock(bracket2025('2025-10-29'), 813022, boxes, pbp)

// A fetcher that fails the first `fails` times for gamePk `bad`, and always succeeds elsewhere.
const fetcher = (bad, fails) => {
  let n = 0
  return async (path) => {
    if (path.includes(`/game/${bad}/`) && n++ < fails) throw new Error('socket closed')
    return body
  }
}

test('a read that fails is logged with its gamePk and the block drops', async () => {
  const logs = []
  const pbp = await fetchPlays(WS_2025, { get: fetcher(813027, 1), log: (m) => logs.push(m) })
  assert.equal(pbp[813027], null)
  assert.equal(logs.length, 1)
  assert.match(logs[0], /813027/)
  assert.equal(block(pbp), null)
})

test('no failures: every game read, nothing logged', async () => {
  const logs = []
  const pbp = await fetchPlays(WS_2025, { get: fetcher(0, 0), log: (m) => logs.push(m) })
  assert.deepEqual(Object.keys(pbp).map(Number).sort(), [...WS_2025].sort())
  assert.ok(Object.values(pbp).every((p) => p === body))
  assert.deepEqual(logs, [])
})
