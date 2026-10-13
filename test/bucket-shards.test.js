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

// `post` is the postseason, beside `pit` (or `bat`) in the same bucket (ADR-0094).
const pitAndPostOf = (regular) => (shard) => [...Object.keys(shard[regular] ?? {}), ...Object.keys(shard.post ?? {})]
const pitAndPost = pitAndPostOf('pit')
for (const [name, pick] of [
  ['manager-history', (shard) => Object.keys(shard.byPersonId ?? {})],
  ['fouls', (shard) => [...Object.keys(shard.batters ?? {}), ...Object.keys(shard.pitchers ?? {})]],
  ['pitch-arsenal', pitAndPost],
  ['pitch-command', pitAndPost],
  ['spray', pitAndPostOf('bat')],
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
    // coordinates. Measured largest at 147,161 bytes for the full regular
    // season; the postseason part is below.
    // Measured 2026-10-06 after the first 17 postseason games (807 balls in play
    // across 137 batters): the largest bucket went from 147,161 to 148,190
    // bytes, about 1 KB. The whole 2026 postseason is roughly three times that,
    // so the largest lands near 151 KB and 160 still holds.
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

// The hitter-grid plate file (#1911): `NN.plate.json` beside each base bucket, the same
// `personId % 100` join, holding calledStrikes, inPlay and speedSum so the base buckets keep
// their size. Measured 2026-10-13 on a scratch copy after the full 2026 re-walk (2,458
// games): largest plate file 79,916 bytes (57), against a largest base bucket of 116,331
// (57). 78 KB plus 30% is 101 KB, rounded up to 110. Until the first re-walk lands the
// test checks nothing.
test('a hitter-grid plate file sits where its reader will ask for it and stays small', () => {
  if (!existsSync(new URL('../public/data/hitter-grid/seasons.json', import.meta.url))) return
  for (const d of dirs('hitter-grid')) {
    for (const f of readdirSync(d).filter((f) => /^\d\d\.plate\.json$/.test(f))) {
      assert.ok(statSync(new URL(f, d)).size < 110 * 1024, `hitter-grid plate: ${f} is ${Math.round(statSync(new URL(f, d)).size / 1024)} KB`)
      const shard = read('hitter-grid', f, d)
      for (const id of [...Object.keys(shard.bat ?? {}), ...Object.keys(shard.post ?? {})]) {
        assert.equal(shardKey100(id), f.slice(0, 2), `hitter-grid plate: ${id} is in ${f}`)
      }
    }
  }
})

// The postseason part of the spray store (ADR-0103) is MLB only, and the ledger
// that stops a re-sweep keys on the gamePk, so a postseason game is on it once.
test('a spray postseason entry is MLB only, and the ledger holds each game once', () => {
  for (const d of dirs('spray')) {
    for (const f of list('spray', d)) {
      for (const [id, entry] of Object.entries(read('spray', f, d).post ?? {})) {
        for (const ball of entry.p) assert.equal(ball[6], 0, `spray post: ${id} has a non-MLB ball in ${f}`)
      }
    }
  }
  const { games } = JSON.parse(readFileSync(new URL('../scripts/data/spray-ingested.json', import.meta.url), 'utf8'))
  assert.equal(new Set(games).size, games.length)
})

// The per-start pitch mix (#1915, pitch-arsenal-starts/): one season store beside the arsenal
// buckets, `personId % 100`, written with the first sweep or re-walk after this landed. Until
// its files exist the test checks nothing. Estimate, not a measurement: 43,500 pitcher-games
// at 39 bytes on the 4,708 games on file is 1.7 MB, 17 KB a bucket, and 60 KB covers a bucket
// 3.5 times the mean. Re-measure after the 2026 re-walk and set the ceiling from the largest file.
test('a pitch-arsenal-starts bucket sits where its reader will ask for it and stays small', () => {
  if (!existsSync(new URL('../public/data/pitch-arsenal-starts/seasons.json', import.meta.url))) return
  for (const season of indexOf('pitch-arsenal-starts').seasons) {
    const d = folder('pitch-arsenal-starts', season)
    for (const f of list('pitch-arsenal-starts', d)) {
      assert.ok(statSync(new URL(f, d)).size < 60 * 1024, `pitch-arsenal-starts: ${f} is ${Math.round(statSync(new URL(f, d)).size / 1024)} KB`)
      for (const id of Object.keys(read('pitch-arsenal-starts', f, d).pit)) assert.equal(shardKey100(id), f.slice(0, 2), `pitch-arsenal-starts: ${id} is in ${f}`)
    }
  }
})

// The per-game fouls (#1914, fouls/{season}/NN.games.json): a sibling of each fouls bucket,
// written by the 2026 re-read (`gen-fouls.mjs --rebuild-counts=2026`). Until those files exist
// the test checks nothing. Estimate, not a measurement: PR #1972 puts the busiest bucket's
// per-game rows near 24 KB; 40 KB leaves the postseason room. Re-measure after the re-read and
// set the ceiling from the largest file.
test('a per-game fouls file stays small enough to be worth fetching alone', () => {
  for (const d of dirs('fouls')) {
    for (const f of readdirSync(d).filter((n) => /^\d\d\.games\.json$/.test(n))) {
      const size = statSync(new URL(f, d)).size
      assert.ok(size < 40 * 1024, `fouls: ${f} is ${Math.round(size / 1024)} KB`)
    }
  }
})

// The spray contact store (#1912): `NN.contact.json` beside each spray bucket, the same
// `personId % 100` join. Not on file until the full spray rebuild, so with none the
// test checks nothing. Ceiling arithmetic, on the busiest bucket (77: 4,422 balls, 17 +
// 2 postseason batters). A synthetic file built from 1,633 real rows of 32 games
// (2026-08-10..11) came to 60.4 KB: 10.1 bytes a ball in flat triples (launch angle,
// distance, xBA), 9 bytes a game, about 1,630 games (2.72 balls a batter-game). The same
// file with nested rows is 72.6 KB. 60.4 KB plus 20% is 72.5 KB; 80 leaves room for the
// rest of the postseason. After the rebuild, set it from the largest measured file:
// the measured size plus 20%.
test('a spray contact bucket sits where its reader will ask for it and stays small', () => {
  for (const d of dirs('spray')) {
    for (const f of readdirSync(d).filter((f) => /^\d\d\.contact\.json$/.test(f))) {
      assert.ok(statSync(new URL(f, d)).size < 80 * 1024, `spray contact: ${f} is ${Math.round(statSync(new URL(f, d)).size / 1024)} KB`)
      const shard = read('spray', f, d)
      for (const id of [...Object.keys(shard.bat ?? {}), ...Object.keys(shard.post ?? {})]) {
        assert.equal(shardKey100(id), f.slice(0, 2), `spray contact: ${id} is in ${f}`)
      }
    }
  }
})
