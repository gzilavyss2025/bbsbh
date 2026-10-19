// Contact replay phase B: the /gf parser keeps five fields and drops the rest of
// a recorded body (test/fixtures/contact-replay/gf-849810.trimmed.json).
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fetchSavantBatTracking } from '../src/api/savant/gameFeed.js'

const body = JSON.parse(
  readFileSync(new URL('./fixtures/contact-replay/gf-849810.trimmed.json', import.meta.url), 'utf8'),
)
const rows = [...body.team_home, ...body.team_away]
const stub = (fn) => {
  const real = globalThis.fetch
  globalThis.fetch = fn
  return () => { globalThis.fetch = real }
}
const run = async () => {
  const restore = stub(async () => ({ ok: true, json: async () => structuredClone(body) }))
  try { return await fetchSavantBatTracking(849810, 1) } finally { restore() }
}

test('keeps only the five fields; at-bat 16 home run reads xba .96, barrel, 30 parks', async () => {
  const out = await run()
  assert.equal(out.size, rows.length)
  for (const v of out.values()) assert.deepEqual(Object.keys(v), ['batSpeed', 'xba', 'barrel', 'hrParks'])
  const hr = rows.find((r) => r.ab_number === 16 && r.xba)
  const v = out.get(hr.play_id)
  assert.equal(v.xba, 0.96)
  assert.equal(v.barrel, true)
  assert.equal(v.hrParks, 30)
})

test('the output carries no scoreboard, boxscore or play text', async () => {
  const s = JSON.stringify([...(await run())])
  assert.doesNotMatch(s, /scoreboard|boxscore|linescore/)
  const texts = rows.flatMap((r) => [r.des, r.events, r.result]).filter(Boolean)
  assert.ok(texts.length > 0)
  for (const t of texts) assert.ok(!s.includes(t), t)
})

test('a MiLB game makes no fetch', async () => {
  let calls = 0
  const restore = stub(async () => { calls++ })
  try {
    const out = await fetchSavantBatTracking(849810, 11)
    assert.equal(out.size, 0)
    assert.equal(calls, 0)
  } finally { restore() }
})
