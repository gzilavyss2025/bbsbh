// Pay rank lives in one league file (public/data/pay-ranks.json), not in the 100
// player-contract shards: one signing re-ranks a whole pool, and with the rank
// inside each shard it rewrote all 100 of them (~120 files a night in the
// 2026-11 offseason). fetchPlayerContract joins it back for the Contract card only.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const rank = { pos: 'SP', rank: 3, of: 212, tied: false, onMinimum: false, fractionBelow: 0.99 }
const files = {
  '/data/player-contracts/00.json': { meta: { season: 2026 }, players: { 605400: { club: 'MIL' }, 100: { club: 'NYY' } } },
  '/data/pay-ranks.json': { ranks: { 605400: rank } },
}
const fetched = []
globalThis.fetch = async (url) => {
  fetched.push(url)
  return files[url] ? new Response(JSON.stringify(files[url])) : new Response('', { status: 404 })
}
const { fetchPlayerContract } = await import('../src/api/person/contracts.js')

test('without payRank: true the ranks file is not fetched and the record has no payRank', async () => {
  const c = await fetchPlayerContract(605400)
  assert.equal(c.club, 'MIL')
  assert.equal('payRank' in c, false)
  assert.equal(fetched.includes('/data/pay-ranks.json'), false)
})

test('with payRank: true a ranked player gets his rank, an unranked one null', async () => {
  assert.deepEqual((await fetchPlayerContract(605400, { payRank: true })).payRank, rank)
  assert.equal((await fetchPlayerContract(100, { payRank: true })).payRank, null)
})
