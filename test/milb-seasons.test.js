// Coverage for the pure parse behind gen-milb-seasons.mjs and the shard reader:
// the total-row choice, the odd-season skip, the dotted-string parse, the null
// rules and the playing-time floor. The fixtures are real statsapi rows
// (`/people?hydrate=stats(type=[yearByYear],sportId=N)`, pulled 2026-10-08).
import assert from 'node:assert/strict'
import test from 'node:test'
import { SEASONS, parseRate, totalSplits, rowsFor, populationKeyOf, uniqueIds } from '../scripts/lib/milb/seasons.mjs'
import {
  FULL_WEIGHT_OUTS,
  FULL_WEIGHT_PA,
  LEVEL_WEIGHT,
  fetchMilbSeasons,
  milbShardKey,
  packRow,
  unpackRow,
} from '../src/api/milbSeasons.js'

const hit = (season, ops, plateAppearances, teamId) => ({
  season,
  stat: { ops, plateAppearances },
  ...(teamId ? { team: { id: teamId } } : {}),
})
const person = (id, group, splits) => ({ id, stats: [{ group: { displayName: group }, splits }] })

// Jesus Made (815908), 2025: one line at each of three levels, so three rows.
const MADE = {
  12: [hit('2025', '.640', 24, 5015)],
  13: [hit('2025', '.915', 123, 572)],
  14: [hit('2025', '.761', 378, 249)],
}

test('a player who moved up in one year has one row per level (Made, 2025)', () => {
  const rows = [12, 13, 14].flatMap((sid) => rowsFor(person(815908, 'hitting', MADE[sid]), sid, new Map()))
  assert.deepEqual(
    rows.map((r) => [r.season, r.sport, r.group, r.n, r.v]),
    [
      [2025, 12, 'hitting', 24, 0.64],
      [2025, 13, 'hitting', 123, 0.915],
      [2025, 14, 'hitting', 378, 0.761],
    ],
  )
})

test('a two-club season keeps the total row, the one with no team (467793, 2026 sample)', () => {
  const splits = [hit('2026', '.362', 41, 2310), hit('2026', '.767', 104, 431), hit('2026', '.651', 145)]
  const kept = totalSplits(splits, [2026])
  assert.equal(kept.length, 1)
  assert.equal(kept[0].stat.plateAppearances, 145)
})

test('a one-club season keeps its only row, which carries a team', () => {
  assert.equal(totalSplits([hit('2025', '.640', 24, 5015)]).length, 1)
})

test('a season that is not four digits, 2020 and a year off the window are skipped', () => {
  const splits = [hit('2018.2', '.700', 100), hit('2020', '.700', 100), hit('2026', '.700', 100), hit('2019', '.700', 100)]
  assert.deepEqual(totalSplits(splits), [])
  assert.ok(SEASONS.includes(2021) && SEASONS.includes(2025) && !SEASONS.includes(2020))
})

test('parseRate reads a leading-dot string and turns dashes and gaps into null', () => {
  assert.equal(parseRate('.640'), 0.64)
  assert.equal(parseRate('3.45'), 3.45)
  assert.equal(parseRate('.---'), null)
  assert.equal(parseRate('-.--'), null)
  assert.equal(parseRate(undefined), null)
  assert.equal(parseRate(null), null)
  assert.equal(parseRate(''), null)
})

test('a row under the floor gets no percentile; one over it is ranked in its level pool', () => {
  const pools = new Map([[populationKeyOf(14, 2025, 'hitting'), [0.6, 0.7, 0.8, 0.9]]])
  const [a] = rowsFor(person(1, 'hitting', [hit('2025', '.950', 39, 249)]), 14, pools)
  assert.equal(a.pct, null)
  const [b] = rowsFor(person(1, 'hitting', [hit('2025', '.850', 40, 249)]), 14, pools)
  assert.equal(b.pct, 75) // beats three of four
})

test('a pitcher is ranked on ERA, lower is better, with outs as playing time', () => {
  const pools = new Map([[populationKeyOf(11, 2024, 'pitching'), [2.0, 3.0, 4.0, 5.0]]])
  const p = person(2, 'pitching', [{ season: '2024', stat: { era: '2.50', outs: 30 } }])
  const [row] = rowsFor(p, 11, pools)
  assert.deepEqual([row.group, row.n, row.v, row.pct], ['pitching', 30, 2.5, 75])
})

test('a dash metric is null and unranked; a row with no playing time is dropped', () => {
  const pools = new Map([[populationKeyOf(11, 2024, 'hitting'), [0.7, 0.8]]])
  const [row] = rowsFor(person(3, 'hitting', [hit('2024', '.---', 200)]), 11, pools)
  assert.deepEqual([row.v, row.pct], [null, null])
  assert.deepEqual(rowsFor(person(3, 'hitting', [hit('2024', '.700', 0)]), 11, pools), [])
})

test('a person with no stats at the level gives no rows', () => {
  assert.deepEqual(rowsFor({ id: 4 }, 11, new Map()), [])
})

test('a row survives pack and unpack, and the shard key is personId % 100', () => {
  const row = { season: 2025, sport: 13, group: 'pitching', n: 450, v: 3.21, pct: 64 }
  assert.deepEqual(unpackRow(packRow(row)), row)
  assert.equal(milbShardKey(815908), '08')
})

test('the level weights and full-weight playing time are start values for step 5', () => {
  assert.deepEqual(LEVEL_WEIGHT, { 11: 0.6, 12: 0.5, 13: 0.35, 14: 0.25, 16: 0.1 })
  assert.equal(FULL_WEIGHT_PA, 400)
  assert.equal(FULL_WEIGHT_OUTS, 450) // 150 IP
})

test('the reader unpacks its shard, and gives [] for a player the shard lacks or a missing shard', async () => {
  const real = globalThis.fetch
  globalThis.fetch = async (url) =>
    String(url).endsWith('/data/milb-seasons/08.json')
      ? { ok: true, json: async () => ({ players: { 815908: [[2025, 13, 'h', 123, 0.915, 96]] } }) }
      : { ok: false, status: 404 }
  try {
    assert.deepEqual(await fetchMilbSeasons(815908), [
      { season: 2025, sport: 13, group: 'hitting', n: 123, v: 0.915, pct: 96 },
    ])
    assert.deepEqual(await fetchMilbSeasons(108), []) // shard 08, player not in it
    assert.deepEqual(await fetchMilbSeasons(5), []) // no shard 05
  } finally {
    globalThis.fetch = real
  }
})

test('a player in both id lists (war.json keys are strings, top-prospects ids are numbers) is listed once', () => {
  assert.deepEqual(uniqueIds(['805805', '1'], [805805, 2]), ['805805', '1', '2'])
})
