// OVR step 8 (#1722): the pure readers of a player's rating history, and the shard
// reader. fetch is stubbed; no network.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchOvrHistory } from '../../src/api/ovr/ovrData.js'
import { changeSince, seasonSeries } from '../../src/api/ovr/history.js'

const snap = (date, ovr, seeded = false) => ({ date, ovr, bars: {}, seeded })

test('changeSince is null with fewer than two snapshots', () => {
  assert.equal(changeSince([]), null)
  assert.equal(changeSince([snap('2026-10-08', 70)]), null)
})

test('changeSince is null until a snapshot at least seven days old exists', () => {
  // Newest is 10-08; the older one is only six days back.
  assert.equal(changeSince([snap('2026-10-02', 66), snap('2026-10-08', 70)]), null)
})

test('changeSince compares to the newest snapshot that is seven or more days old', () => {
  const rows = [snap('2026-09-20', 50), snap('2026-10-01', 66), snap('2026-10-05', 68), snap('2026-10-08', 70)]
  const c = changeSince(rows)
  assert.equal(c.delta, 4) // 70 - 66, from 10-01 (exactly seven days back), not 09-20
  assert.equal(c.from.date, '2026-10-01')
  assert.equal(c.to.date, '2026-10-08')
})

test('changeSince delta is negative when the rating fell, and takes an unsorted list', () => {
  const c = changeSince([snap('2026-10-08', 60), snap('2026-09-30', 64)])
  assert.equal(c.delta, -4)
})

test('changeSince honours the days argument', () => {
  const rows = [snap('2026-09-24', 60), snap('2026-10-08', 70)]
  assert.equal(changeSince(rows).delta, 10) // 14 days back counts for 7
  assert.equal(changeSince(rows, 14).delta, 10)
  assert.equal(changeSince(rows, 15), null)
})

test('changeSince is null when one end is seeded and the other is a rating', () => {
  // A seeded point is a stat percentile, not an OVR: the gap is a change of scale.
  assert.equal(changeSince([snap('2026-09-20', 90, true), snap('2026-10-08', 70)]), null)
  assert.equal(changeSince([snap('2026-09-20', 90, true), snap('2026-10-08', 80, true)]).delta, -10)
})

test('seasonSeries keeps one season, in date order, with seeded points flagged', () => {
  const rows = [snap('2026-10-08', 70), snap('2025-09-01', 55), snap('2026-04-05', 60, true), snap('2026-07-12', 64)]
  const s = seasonSeries(rows, 2026)
  assert.deepEqual(s.map((r) => r.date), ['2026-04-05', '2026-07-12', '2026-10-08'])
  assert.deepEqual(s.map((r) => r.seeded), [true, false, false])
})

const shard = { bat: { 100: [['2026-09-30', 64, { contact: 60 }], ['2026-10-08', 70, { contact: 62 }]] }, pit: { 200: [['2026-04-05', 61, null, 1]] } }
globalThis.fetch = async (url) =>
  String(url).endsWith('/ovr-history/00.json') ? { ok: true, json: async () => shard } : { ok: false, status: 404 }

test('fetchOvrHistory unpacks a player\'s rows, seeded flag included', async () => {
  const h = await fetchOvrHistory(100, 'hitting')
  assert.deepEqual(h[1], { date: '2026-10-08', ovr: 70, bars: { contact: 62 }, seeded: false })
  assert.deepEqual(await fetchOvrHistory(200, 'pitching'), [{ date: '2026-04-05', ovr: 61, bars: null, seeded: true }])
})

test('fetchOvrHistory is an empty list for a player with none, or no shard', async () => {
  assert.deepEqual(await fetchOvrHistory(100, 'pitching'), [])
  assert.deepEqual(await fetchOvrHistory(101, 'hitting'), [])
})
