import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { shardKey100 } from '../src/lib/shardKey.js'
import { rookieShardKey } from '../src/api/rookies.js'
import { warShardKey } from '../src/api/war.js'
import { MIN_SIMILARITY_PITCHES } from '../src/lib/pitcherSimilarity.js'

// Six datasets are now bucketed on `personId % 100`. The bucket is a JOIN: the
// generator files a record under a name the reader recomputes from an id alone,
// so a record in the wrong bucket is a record that exists and can never be
// found — and nothing fails loudly when that happens. These tests are that
// join, checked against the committed files.

const dir = (name) => new URL(`../public/data/${name}/`, import.meta.url)
const list = (name) => readdirSync(dir(name)).filter((f) => f.endsWith('.json'))
const read = (name, f) => JSON.parse(readFileSync(new URL(f, dir(name)), 'utf8'))

test('every reader computes the same bucket', () => {
  // The three exported names are one function; if they ever diverge, records
  // written by one and read by another go missing.
  for (const id of [0, 9, 100, 543037, 660271, 999999]) {
    assert.equal(rookieShardKey(id), shardKey100(id))
    assert.equal(warShardKey(id), shardKey100(id))
  }
  assert.equal(shardKey100(660271), '71')
  assert.equal(shardKey100(9), '09')
  assert.equal(shardKey100(null), '00')
})

for (const [name, pick] of [
  ['manager-history', (shard) => Object.keys(shard.byPersonId ?? {})],
  ['fouls', (shard) => [...Object.keys(shard.batters ?? {}), ...Object.keys(shard.pitchers ?? {})]],
  ['pitch-arsenal', (shard) => Object.keys(shard.pit ?? {})],
  ['spray', (shard) => Object.keys(shard.bat ?? {})],
]) {
  test(`every ${name} record sits in the bucket its reader will ask for`, () => {
    const files = list(name)
    assert.ok(files.length > 50, `${name}: only ${files.length} buckets`)
    let records = 0
    for (const f of files) {
      const bucket = f.replace('.json', '')
      for (const id of pick(read(name, f))) {
        assert.equal(shardKey100(id), bucket, `${name}: ${id} is in ${f}`)
        records++
      }
    }
    assert.ok(records > 100, `${name}: only ${records} records across all buckets`)
  })
}

test('the arsenal pools are one level each, floor-filtered, and description-free', () => {
  for (const level of ['mlb', 'aaa']) {
    const pool = read('pitch-arsenal-pool', `${level}.json`)
    assert.equal(pool.level, level)
    const arms = Object.entries(pool.pit)
    assert.ok(arms.length > 100, `${level}: only ${arms.length} arms`)
    for (const [id, arm] of arms) {
      const total = arm.types.reduce((n, t) => n + t.pitches, 0)
      // An arm under the floor is dropped by the ranker anyway (see
      // arsenalVector), so shipping him is weight the card can never use.
      assert.ok(total >= MIN_SIMILARITY_PITCHES, `${level}: ${id} is under the floor`)
      // The ranking reads `code`; the long human labels belong to the mix bar,
      // which reads a bucket instead. They are 233 KB across the league.
      for (const t of arm.types) assert.equal(t.description, undefined, `${level}: ${id} carries labels`)
      assert.ok(arm.name, `${level}: ${id} has no name to render`)
    }
  }
})

test('a bucket stays small enough to be worth fetching alone', () => {
  for (const [name, ceiling] of [
    ['manager-history', 30],
    ['fouls', 30],
    ['pitch-arsenal', 30],
    // Four times its neighbours' ceiling, and deliberately: a spray bucket
    // carries one ROW PER BALL IN PLAY rather than a handful of season totals,
    // which is ~2,000 rows in the busiest bucket. The eight columns are already
    // positional integers (see src/api/spray.js's header on why), so the only
    // remaining trims would be dropping the stored pitcher id — which a
    // pitcher-side card is meant to read — or losing a decimal off the
    // coordinates. Measured largest at 122 KB; this ceiling leaves a season's
    // remaining weeks room without letting the shape quietly double.
    ['spray', 160],
  ]) {
    const largest = Math.max(...list(name).map((f) => statSync(new URL(f, dir(name))).size))
    assert.ok(largest < ceiling * 1024, `${name}: largest bucket is ${Math.round(largest / 1024)} KB`)
  }
})
