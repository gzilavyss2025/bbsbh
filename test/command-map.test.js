// The Command card's league block (#2004): the MLB middle of each rate and his
// place among pitchers with 500+ pitches, written once a season beside the
// pitch-command buckets so the page never reads all 100 of them.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { COMMAND_LEAGUE_MIN, commandLeague, commandRank, commandView, fetchCommandLeague } from '../src/api/commandMap.js'

// One pitcher: `inZone` of `n` pitches in the heart cell (12), the rest off the plate (0).
const arm = (n, inZone) => {
  const cells = Array(25).fill(0)
  cells[12] = inZone
  cells[0] = n - inZone
  return { mlb: { FF: { R: { cells, swings: cells, whiffs: Array(25).fill(0), firstPitch: cells } } } }
}

test('the league block counts only pitchers at the floor, and a pitcher under it gets no rank', () => {
  const pit = { 1: arm(500, 200), 2: arm(600, 300), 3: arm(700, 350), 4: arm(499, 499) }
  const league = commandLeague(pit, 2026)
  assert.equal(league.minPitches, COMMAND_LEAGUE_MIN)
  assert.deepEqual(league.zonePct.rates, [40, 50, 50]) // pitcher 4 (100%, 499 pitches) is not in the pool
  assert.equal(league.zonePct.median, 50)
  // Mid-rank percentile: below him, plus half of his ties, over the pool.
  assert.deepEqual(commandRank(league, commandView(pit[1]), 'zonePct'), { median: 50, n: 3, pct: 17 }) // half of his own tie
  assert.deepEqual(commandRank(league, commandView(pit[2]), 'zonePct'), { median: 50, n: 3, pct: 67 })
  assert.equal(commandRank(league, commandView(pit[4]), 'zonePct').pct, null) // never a rank among a smaller pool
  assert.equal(commandRank(null, commandView(pit[1]), 'zonePct'), null)
})

test("the league block is one season's: 'all' reads null", async () => {
  assert.equal(await fetchCommandLeague({ seasonYear: 'all' }), null)
})

const dir = new URL('../public/data/pitch-command/2026/', import.meta.url)
const league = JSON.parse(readFileSync(new URL('league.json', dir), 'utf8'))

test('the committed league block is the one its buckets give', () => {
  const pit = {}
  for (const f of readdirSync(dir).filter((f) => /^\d\d\.json$/.test(f))) Object.assign(pit, JSON.parse(readFileSync(new URL(f, dir), 'utf8')).pit)
  assert.ok(isDeepStrictEqual(league, commandLeague(pit, 2026)), 'league.json is stale: rebuild it from the buckets')
})

test("Gasser 2026 matches draft C: zone 44%, 95th among 469, MLB middle 40%", () => {
  const shard = JSON.parse(readFileSync(new URL('07.json', dir), 'utf8'))
  const view = commandView(shard.pit[688107])
  assert.equal(view.zonePct, 44)
  assert.deepEqual(commandRank(league, view, 'zonePct'), { median: 40, n: 469, pct: 95 })
  // The other three tiles of the draft.
  assert.deepEqual(['heartPct', 'firstZonePct', 'whiffPct'].map((k) => commandRank(league, view, k).pct), [64, 81, 25])
})
