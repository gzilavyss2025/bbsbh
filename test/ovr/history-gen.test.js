// OVR step 8 (#1722): the pure half of the history file in scripts/gen-ovr.mjs.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RECENT_DAYS, mergeHistory, seedRows } from '../../scripts/lib/ovr/history.mjs'

const dates = (rows) => rows.map((r) => r[0])
const real = (ovr = 70) => [ovr, { contact: 60 }]

test('a new date is appended; the same date twice keeps one row', () => {
  const a = mergeHistory({ today: '2026-10-08', real: real(70) })
  assert.deepEqual(a, [['2026-10-08', 70, { contact: 60 }]])
  const b = mergeHistory({ prior: a, today: '2026-10-08', real: real(71) })
  assert.deepEqual(b, a) // a rerun on the same date does not rewrite the day
})

test('keeps every day of the last 60, then one row per week for the season, and drops older seasons', () => {
  const prior = []
  for (let d = Date.UTC(2025, 11, 20); d <= Date.UTC(2026, 9, 7); d += 864e5) prior.push([new Date(d).toISOString().slice(0, 10), 50, {}])
  const kept = dates(mergeHistory({ prior, today: '2026-10-08', real: real() }))
  const cutoff = '2026-08-09' // 60 days before 2026-10-08
  const recent = kept.filter((d) => d >= cutoff)
  assert.equal(recent.length, RECENT_DAYS + 1) // 60 days back through today, all kept
  const older = kept.filter((d) => d < cutoff)
  assert.ok(older.every((d) => d.startsWith('2026')), 'last season is gone')
  assert.ok(older.length >= 27 && older.length <= 33, `about one row a week, got ${older.length}`)
  assert.deepEqual(kept, [...kept].sort())
})

test('seeded rows are flagged and sit only before the first real row', () => {
  const seed = [['2026-04-05', 60, null, 1], ['2026-10-08', 99, null, 1]]
  const rows = mergeHistory({ seed, today: '2026-10-08', real: real() })
  assert.deepEqual(rows, [['2026-04-05', 60, null, 1], ['2026-10-08', 70, { contact: 60 }]])
})

test('once a player has real rows, thinning them never brings seeded rows back', () => {
  const seed = [['2026-04-05', 60, null, 1]]
  const prior = [['2026-05-01', 50, {}], ['2026-05-02', 51, {}]] // real rows, old enough to thin to one
  const rows = mergeHistory({ prior, seed, real: real(), today: '2026-10-08' })
  assert.deepEqual(dates(rows), ['2026-05-02', '2026-10-08']) // no 04-05 seed
})

test('a player with no real row today keeps a trimmed history; with nothing to keep it is empty', () => {
  assert.deepEqual(mergeHistory({ prior: [['2026-10-01', 60, {}]], today: '2026-10-08' }), [['2026-10-01', 60, {}]])
  assert.deepEqual(mergeHistory({ prior: [['2024-10-01', 60, {}]], today: '2026-10-08' }), [])
})

test('seedRows turns a prospect-trend history into flagged rows, skipping rows that are not usable', () => {
  const h = [
    { date: '2026-04-05', percentile: 55, atLevel: true },
    { date: '2026-04-12', percentile: null, atLevel: true }, // no line that week
    { date: '2026-04-19', percentile: 60, atLevel: false }, // summed over levels: another method
  ]
  assert.deepEqual(seedRows(h), [['2026-04-05', 55, null, 1]])
})
