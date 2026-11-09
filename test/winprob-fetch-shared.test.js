// fetchWinProbability shares one request per game (api/winprob/feed.js): the Gameday meter,
// the Win % sheet and the game page's loader each used to fetch the same feed.
import test from 'node:test'
import assert from 'node:assert/strict'

let calls = 0
let fail = false
const answers = []
globalThis.fetch = async (url) => {
  calls += 1
  if (fail) return { ok: false, status: 500, json: async () => ({}) }
  const gamePk = Number(/game\/(\d+)\/winProbability/.exec(String(url))[1])
  const body = [{ homeTeamWinProbability: 50 + calls, gamePk }]
  answers.push(body)
  return { ok: true, status: 200, json: async () => body }
}
// Each case uses its own gamePk, so no case sees another's cached answer.
const { fetchWinProbability } = await import('../src/api/winprob/feed.js')

test.beforeEach(() => { calls = 0; fail = false })

test('callers at the same moment share one request', async () => {
  const [a, b, c] = await Promise.all([fetchWinProbability(1), fetchWinProbability(1), fetchWinProbability(1)])
  assert.equal(calls, 1)
  assert.equal(a, b)
  assert.equal(b, c)
})

test('a recent answer is reused; maxAgeMs 0 asks again and the new answer is shared', async () => {
  const first = await fetchWinProbability(2)
  assert.equal(await fetchWinProbability(2), first)
  assert.equal(calls, 1)
  const fresh = await fetchWinProbability(2, { maxAgeMs: 0 })
  assert.equal(calls, 2)
  assert.notEqual(fresh, first)
  assert.equal(await fetchWinProbability(2), fresh)
  assert.equal(calls, 2)
})

test('a final game is reused however old the answer is', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 })
  const first = await fetchWinProbability(3, { final: true })
  t.mock.timers.setTime(60 * 60 * 1000)
  assert.equal(await fetchWinProbability(3, { final: true }), first)
  assert.equal(calls, 1)
  // A live caller after the same hour asks again.
  await fetchWinProbability(3)
  assert.equal(calls, 2)
})

test('a failed read resolves null and is not kept, so the next caller tries again', async () => {
  fail = true
  assert.equal(await fetchWinProbability(4, { final: true }), null)
  fail = false
  const again = await fetchWinProbability(4, { final: true })
  assert.ok(Array.isArray(again))
})

test('different games never share', async () => {
  const [a, b] = await Promise.all([fetchWinProbability(5), fetchWinProbability(6)])
  assert.notEqual(a, b)
  assert.equal(calls, 2)
})

test('a read from before the game ended is not reused as the final answer', async () => {
  const live = await fetchWinProbability(7, { maxAgeMs: 0 }) // the meter, bottom of the 9th
  const final = await fetchWinProbability(7, { final: true }) // the sheet, after the walk-off
  assert.notEqual(final, live)
  assert.equal(calls, 2)
  assert.equal(await fetchWinProbability(7, { final: true }), final) // that one is kept
  assert.equal(calls, 2)
})
