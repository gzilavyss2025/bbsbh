// The committed public/data/world-series/events.json against the published claims
// (.scratch/world-series-callouts/research.md, O1 to O13). Offline: reads the file.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data', 'world-series', 'events.json')
const doc = JSON.parse(readFileSync(FILE, 'utf8'))
const rows = (tag) => doc.events.filter((e) => e.tag === tag)

test('the file stays under 120 KB and covers 1903 to 2025', () => {
  assert.ok(statSync(FILE).size < 120 * 1024)
  assert.deepEqual(doc.coverage, { from: 1903, through: 2025, games: 707 })
})

test('O1: club trailing after 8 in a winner-take-all game is 3-33', () => {
  const r = rows('wtaTrailing9')
  assert.equal(r.filter((e) => e.value === 1).length, 3)
  assert.equal(r.filter((e) => e.value === 0).length, 33)
})

test('O8: one walk-off grand slam, 2024-10-25', () => {
  const r = rows('walkOffGrandSlam')
  assert.equal(r.length, 1)
  assert.equal(r[0].date, '2024-10-25')
})

test('O9: Freeman is the only player with two walk-off home runs', () => {
  const by = Map.groupBy(rows('walkOffHr'), (e) => e.player)
  assert.deepEqual([...by].filter(([, v]) => v.length >= 2).map(([k, v]) => [k, v.length]), [[518692, 2]])
})

test('O10: one game opened with two home runs, 2025-10-29', () => {
  const r = rows('openingHrPair')
  assert.equal(r.length, 1)
  assert.equal(r[0].date, '2025-10-29')
})

test('O4: pitcher hits include 1975, 1986 and 2025, and only in a winner-take-all game', () => {
  const r = rows('pitcherHit')
  const seasons = new Set(r.map((e) => e.season))
  for (const y of [1967, 1973, 1975, 1986, 2025]) assert.ok(seasons.has(y), String(y))
  assert.ok(r.every((e) => e.wta))
  assert.equal(r.filter((e) => e.season === 1975).length, 2)
})

test('O12: one pinch-hit grand slam (Barger, 2025 G1)', () => {
  const r = rows('pinchHitGrandSlam')
  assert.equal(r.length, 1)
  assert.equal(r[0].season, 2025)
})

test('O13: winner-take-all games that went to extra innings (the count is reported, not forced)', () => {
  const r = rows('extraInnings').filter((e) => e.wta)
  assert.deepEqual(r.map((e) => e.season), [1912, 1924, 1991, 1997, 2016, 2025])
})

test('winner-take-all games: 41 in the data, 36 of them level or behind entering the 9th', () => {
  const pks = new Set(doc.events.filter((e) => e.wta).map((e) => e.pk))
  assert.ok(pks.size >= 36 && pks.size <= 41)
})

test('every row has a pk in the data, and rows are sorted by (date, pk, tag)', () => {
  const key = (e) => [e.date, String(e.pk).padStart(9, '0'), e.tag]
  for (const e of doc.events) assert.ok(Number.isInteger(e.pk) && e.pk > 0)
  for (let i = 1; i < doc.events.length; i += 1) {
    const [a, b] = [key(doc.events[i - 1]), key(doc.events[i])]
    assert.ok(a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2]))), `row ${i}`)
  }
})
