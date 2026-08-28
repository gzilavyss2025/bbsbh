import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_CARRIED_RATIO, fetchTeamSplits, teamWarSplits } from '../scripts/lib/war-splits.mjs'

// Regression for a real production incident (2026-08-28): the first nightly
// run after per-team WAR splits shipped (PR #934) died on
// `statsapi sabermetrics hitting team splits for person 622761: HTTP 500`.
// The same URL returned 200 three times a minute later — a flake, not a
// broken player. But fetchTeamSplits threw on any non-2xx and teamWarSplits
// looped serially over ~180 traded players, so one flake aborted the whole
// generator: war.json was never rewritten, and both of its consumers
// (gen-milb-alumni.mjs, gen-former-teammates.mjs) silently used the previous
// day's numbers.
//
// `sleepImpl: noSleep` everywhere so the backoff doesn't slow the suite.
const noSleep = () => Promise.resolve()

const ok = (splits) => ({ ok: true, status: 200, json: async () => ({ stats: [{ splits }] }) })
const boom = { ok: false, status: 500, json: async () => ({}) }

const split = (teamId, war) => ({ team: { id: teamId }, stat: { war } })

test('a player whose first attempts 500 still resolves on a retry', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return calls < 3 ? boom : ok([split(158, 1.4)])
  }
  const rows = await fetchTeamSplits(622761, 'hitting', 2026, { fetchImpl, sleepImpl: noSleep })
  assert.equal(calls, 3)
  assert.deepEqual(rows, [split(158, 1.4)])
})

test('fetchTeamSplits gives up once its attempts are spent', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return boom
  }
  await assert.rejects(
    () => fetchTeamSplits(622761, 'hitting', 2026, { fetchImpl, sleepImpl: noSleep }),
    /HTTP 500/,
  )
  assert.equal(calls, 3)
})

// THE INCIDENT. Without the fix this whole call throws and the caller writes
// no war.json at all; every other player's split is lost to one bad response.
test('one player failing does not cost every other player his splits', async () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const fetchImpl = async (url) => (url.includes('/people/7/') ? boom : ok([split(158, 2.1)]))
  const { byTeam, carried } = await teamWarSplits(ids, 'hitting', 2026, {
    fetchImpl,
    sleepImpl: noSleep,
  })
  assert.deepEqual(carried, [7])
  assert.equal(Object.keys(byTeam).length, 9)
  assert.deepEqual(byTeam[1], [{ teamId: 158, war: 2.1 }])
  assert.ok(!(7 in byTeam), 'no previous value to carry, so 7 stays absent')
})

test('a failed player carries his previous value forward rather than vanishing', async () => {
  const previous = { 7: [{ teamId: 121, war: 0.8 }, { teamId: 158, war: 1.1 }] }
  const fetchImpl = async (url) => (url.includes('/people/7/') ? boom : ok([split(158, 2.1)]))
  const { byTeam, carried } = await teamWarSplits([1, 2, 3, 4, 5, 6, 7, 8], 'hitting', 2026, {
    previous,
    fetchImpl,
    sleepImpl: noSleep,
  })
  assert.deepEqual(carried, [7])
  assert.deepEqual(byTeam[7], previous[7], 'a deadline acquisition must not silently disappear')
})

test('a real outage throws instead of carrying most of the file forward', async () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8]
  // Over MAX_CARRIED_RATIO of the field failing is an outage, not a flake.
  const failing = new Set([1, 2, 3])
  assert.ok(failing.size / ids.length > MAX_CARRIED_RATIO)
  const fetchImpl = async (url) => {
    const id = Number(url.match(/\/people\/(\d+)\//)[1])
    return failing.has(id) ? boom : ok([split(158, 2.1)])
  }
  await assert.rejects(
    () => teamWarSplits(ids, 'hitting', 2026, { fetchImpl, sleepImpl: noSleep }),
    /treating as an outage/,
  )
})

test('a clean run reports nothing carried', async () => {
  const fetchImpl = async () => ok([split(158, 1.9), split(121, 0.4)])
  const { byTeam, carried } = await teamWarSplits([1, 2], 'pitching', 2026, {
    fetchImpl,
    sleepImpl: noSleep,
  })
  assert.deepEqual(carried, [])
  assert.deepEqual(byTeam[1], [
    { teamId: 158, war: 1.9 },
    { teamId: 121, war: 0.4 },
  ])
})

// statsapi omits `war` entirely for a stint it can't compute — it does not
// send null — so an absent field is the case worth pinning. (`null` would
// coerce to 0 through Number(); that is long-standing gen-war.mjs behavior,
// unchanged here, and not what this module is about.)
test('a stint with no war field is dropped rather than stored as zero', async () => {
  const fetchImpl = async () => ok([{ team: { id: 158 }, stat: {} }, split(121, 0.4)])
  const { byTeam } = await teamWarSplits([1], 'hitting', 2026, { fetchImpl, sleepImpl: noSleep })
  assert.deepEqual(byTeam[1], [{ teamId: 121, war: 0.4 }])
})
