import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { shardKey100 } from '../src/lib/shardKey.js'
import { rookieShardKey } from '../src/api/rookies.js'
import { warShardKey } from '../src/api/war.js'
import { MIN_SIMILARITY_PITCHES } from '../src/lib/pitcherSimilarity.js'

// Six datasets are now bucketed on `personId % 100`. The bucket is a JOIN: the
// generator files a record under a name the reader recomputes from an id alone,
// so a record in the wrong bucket is a record that exists and can never be
// found — and nothing fails loudly when that happens. These tests are that
// join, checked against the committed files.

// A season store (ADR-0086) keeps one folder per season, beside a
// seasons.json that names them and the one the app reads (`current`). The join
// and the size ceiling hold in EVERY season folder; the floors count the
// season the app serves.
const SEASON_STORES = new Set(['spray', 'fouls', 'pitch-arsenal', 'pitch-arsenal-pool', 'pitch-command', 'hitter-grid'])
const indexOf = (name) =>
  JSON.parse(readFileSync(new URL(`../public/data/${name}/seasons.json`, import.meta.url), 'utf8'))
const folder = (name, season) => new URL(`../public/data/${name}/${season == null ? '' : `${season}/`}`, import.meta.url)
const dir = (name) => folder(name, SEASON_STORES.has(name) ? indexOf(name).current : null)
const dirs = (name) => (SEASON_STORES.has(name) ? indexOf(name).seasons.map((s) => folder(name, s)) : [dir(name)])
// Buckets only: a season folder also holds its league file (fouls.json).
const list = (name, d = dir(name)) => readdirSync(d).filter((f) => /^\d\d\.json$/.test(f))
const read = (name, f, d = dir(name)) => JSON.parse(readFileSync(new URL(f, d), 'utf8'))

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

// `post` is the postseason, beside `pit` in the same bucket (ADR-0094).
const pitAndPost = (shard) => [...Object.keys(shard.pit ?? {}), ...Object.keys(shard.post ?? {})]
for (const [name, pick] of [
  ['manager-history', (shard) => Object.keys(shard.byPersonId ?? {})],
  ['fouls', (shard) => [...Object.keys(shard.batters ?? {}), ...Object.keys(shard.pitchers ?? {})]],
  ['pitch-arsenal', pitAndPost],
  ['pitch-command', pitAndPost],
  ['spray', (shard) => Object.keys(shard.bat ?? {})],
]) {
  test(`every ${name} record sits in the bucket its reader will ask for`, () => {
    assert.ok(list(name).length > 50, `${name}: only ${list(name).length} buckets`)
    let records = 0
    for (const d of dirs(name)) {
      for (const f of list(name, d)) {
        const bucket = f.replace('.json', '')
        for (const id of pick(read(name, f, d))) {
          assert.equal(shardKey100(id), bucket, `${name}: ${id} is in ${f}`)
          if (d.href === dir(name).href) records++
        }
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
    // 30 -> 45 for the batter-side split: every pitch type now carries a `vs`
    // row per side, each with its own look pairs, which is close to twice the
    // bytes a type used to weigh. Already encoded as positional pairs rather
    // than objects (see exportPitchArsenal's ttoPairs on why), so the only
    // remaining trims would drop a side or drop the looks inside one — which
    // is the feature. Measured largest at 33 KB; this leaves the season's
    // remaining weeks room without letting the shape quietly double again.
    // The postseason part (ADR-0094) adds about 0.7 KB per postseason arm to
    // his bucket. Measured 2026-10-02 after the first 9 postseason games: the
    // largest bucket went from 36,114 to 36,846 bytes, so 45 still holds.
    ['pitch-arsenal', 45],
    // Twenty-five-value arrays per pitch type, per side, per counter. Measured
    // largest 102,797 bytes on the regular season alone, and 104,099 with the
    // first 9 postseason games (about 1.4 KB per postseason arm). This leaves
    // the rest of the postseason room without letting the shape quietly grow.
    ['pitch-command', 125],
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
    const largest = Math.max(...dirs(name).flatMap((d) => list(name, d).map((f) => statSync(new URL(f, d)).size)))
    assert.ok(largest < ceiling * 1024, `${name}: largest bucket is ${Math.round(largest / 1024)} KB`)
  }
})

// The hitter grid (ADR-0096). Its files are not on file until the first 2026
// re-walk (#1411), so until then the dump must hold no hitter row either: a
// grid in the dump with no files is a run that never wrote them.
test('a hitter-grid bucket stays small enough to be worth fetching alone', () => {
  if (!existsSync(new URL('../public/data/hitter-grid/seasons.json', import.meta.url))) {
    const dump = readFileSync(new URL('../scripts/data/pitch-arsenal.sql', import.meta.url), 'utf8')
    assert.doesNotMatch(dump, /^INSERT INTO pitch_hitter_cells /m)
    return
  }
  // Measured 2026-10-02 on a copy (the regular season and the first 9
  // postseason games, MLB only): largest 79,573 bytes. Room for the rest of
  // the postseason without letting the shape quietly grow.
  // ADR-0097 added xwobaBip and bipUntracked. Measured 2026-10-02 on a copy
  // after the re-walk with the 2026 table: largest 100,703 bytes (xwobaBip
  // 20,717 of them, bipUntracked 402). Gary accepted 120 KB: it keeps the
  // 20 KB of postseason room that Part B left.
  const ceiling = 120
  const largest = Math.max(...dirs('hitter-grid').flatMap((d) => list('hitter-grid', d).map((f) => statSync(new URL(f, d)).size)))
  assert.ok(largest < ceiling * 1024, `hitter-grid: largest bucket is ${Math.round(largest / 1024)} KB`)
  for (const d of dirs('hitter-grid')) {
    for (const f of list('hitter-grid', d)) {
      const shard = read('hitter-grid', f, d)
      for (const id of [...Object.keys(shard.bat), ...Object.keys(shard.post ?? {})]) assert.equal(shardKey100(id), f.slice(0, 2))
    }
  }
})
