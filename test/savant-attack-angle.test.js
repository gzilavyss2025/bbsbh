// Contact replay phase C: the Statcast CSV parser keeps five fields, fetches only for a Final MLB game,
// and joins on at-bat number + pitch number (test/fixtures/contact-replay/statcast-849810.trimmed.csv).
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fetchAttackAngles, parseAttack, statcastUrl } from '../src/api/savant/attackAngle.js'
import { swingScene } from '../src/lib/pitcherCard/contactDraw.js'

const csv = readFileSync(new URL('./fixtures/contact-replay/statcast-849810.trimmed.csv', import.meta.url), 'utf8')
const stub = (fn) => {
  const real = globalThis.fetch
  globalThis.fetch = fn
  return () => { globalThis.fetch = real }
}
const run = async (pk, sportId, state, text) => {
  let calls = 0
  const restore = stub(async () => { calls++; return { ok: true, text: async () => text } })
  try { return { out: await fetchAttackAngles(pk, sportId, state, '2026-10-15'), calls } } finally { restore() }
}

test('the parser keeps five fields and drops bat_score, post_bat_score and the rest', () => {
  assert.ok(/bat_score/.test(csv), 'the fixture really carries the score')
  const rows = parseAttack(csv)
  assert.ok(rows.length > 0)
  for (const r of rows) assert.deepEqual(Object.keys(r), ['game_pk', 'at_bat_number', 'pitch_number', 'attack_angle', 'attack_direction'])
  const s = JSON.stringify(rows)
  assert.doesNotMatch(s, /bat_score|post_bat_score|events|des/)
})

test('the url carries the game_pk and the game date', () => {
  const u = statcastUrl(849810, '2026-10-15')
  assert.match(u, /game_pk=849810/)
  assert.match(u, /game_date_gt=2026-10-15/)
  assert.match(u, /game_date_lt=2026-10-15/)
})

test('the join picks at-bat 16, pitch 3: the home run', async () => {
  const { out, calls } = await run(900001, 1, 'Final', csv)
  assert.equal(calls, 1)
  const hr = out.get('16-3')
  assert.ok(Math.abs(hr.attackDeg - 17.18) < 0.01)
  assert.notEqual(out.get('16-2').attackDeg, hr.attackDeg)
  assert.equal(out.has('16-1'), false) // a taken pitch: no attack angle
})

test('a non-Final game and a MiLB game make no fetch', async () => {
  for (const [pk, sport, state] of [[900002, 1, 'Live'], [900003, 1, 'Preview'], [900004, 11, 'Final']]) {
    const { out, calls } = await run(pk, sport, state, csv)
    assert.equal(calls, 0)
    assert.equal(out.size, 0)
  }
})

test('one fetch per gamePk per page load', async () => {
  const a = await run(900005, 1, 'Final', csv)
  const b = await run(900005, 1, 'Final', csv)
  assert.equal(a.calls + b.calls, 1)
  assert.equal(b.out.size, a.out.size)
})

test('an empty CSV leaves every bat pencil', async () => {
  const { out } = await run(900006, 1, 'Final', '')
  assert.equal(out.size, 0)
  const p = { swing: 'inplay', batSide: 'L', contact: { K: [0, 2.2, 2.5] }, mph: '95', hit: null }
  assert.equal(swingScene(p, { contactMs: 1 }, undefined).measured, false)
  assert.equal(swingScene(p, { contactMs: 1 }, { batSpeed: 70, attackDeg: null }).measured, false)
  assert.equal(swingScene(p, { contactMs: 1 }, { attackDeg: 17.2 }).measured, true)
})
