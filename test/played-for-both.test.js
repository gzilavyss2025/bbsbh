// scripts/lib/open-data/played-for-both.mjs: every player with an MLB game for each of two
// clubs (#2579, slice 1). Small fixtures for the rules; the real team-seasons.json for the
// club-code map (each club has one code per season with no gap).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CLUB_CODES,
  CODE_TO_CLUB,
  buildPlayedForBoth,
  careerWarFrom,
  recency,
  scoreOf,
  seasonsByClub,
} from '../scripts/lib/open-data/played-for-both.mjs'

// players: one id each; rosters as [key, label, [index into players]]
const file = (rosters, players, throughSeason = 2025) => ({ throughSeason, players, teamSeasons: rosters.map(([k, ix]) => [k, k, ix]) })

test('the code map: BRO counts for 119, SE1 for 158, BLA for 147; a Federal League code is dropped', () => {
  assert.equal(CODE_TO_CLUB.get('BRO'), 119)
  assert.equal(CODE_TO_CLUB.get('LAN'), 119)
  assert.equal(CODE_TO_CLUB.get('SE1'), 158)
  assert.equal(CODE_TO_CLUB.get('BLA'), 147)
  for (const code of ['BLN', 'CL4', 'LS3', 'WSN', 'BLF', 'BRF', 'BUF', 'CHF', 'IND', 'KCF', 'NEW', 'PTF', 'SLF']) {
    assert.equal(CODE_TO_CLUB.has(code), false, code)
  }
  assert.equal(Object.keys(CLUB_CODES).length, 30)
  const f = file([['BUF-1914', [0]], ['BRO-1950', [0]]], [1])
  assert.deepEqual([...seasonsByClub(f).keys()], [119])
})

test('every club has exactly one code per season with no gap, in the real file', () => {
  const real = JSON.parse(readFileSync(new URL('../public/data/team-seasons.json', import.meta.url), 'utf8'))
  const codesBySeason = new Map() // club -> season -> Set(code)
  for (const [key] of real.teamSeasons) {
    const at = key.lastIndexOf('-')
    const club = CODE_TO_CLUB.get(key.slice(0, at))
    if (!club) continue
    const season = Number(key.slice(at + 1))
    const m = codesBySeason.get(club) ?? new Map()
    m.set(season, (m.get(season) ?? new Set()).add(key.slice(0, at)))
    codesBySeason.set(club, m)
  }
  assert.equal(codesBySeason.size, 30)
  for (const [club, seasons] of codesBySeason) {
    const years = [...seasons.keys()].sort((a, b) => a - b)
    for (let y = years[0]; y <= real.throughSeason; y++) {
      assert.equal(seasons.get(y)?.size, 1, `club ${club} season ${y}`)
    }
  }
})

test('a player who played for both clubs is listed, retired or not; one club only is not', () => {
  const f = file([['BRO-1950', [0, 1]], ['LAN-1960', [0]], ['SLN-1955', [0, 2]], ['SLN-2025', [1]]], [10, 11, 12])
  const shards = buildPlayedForBoth({ file: f, names: new Map([[10, 'A One'], [11, 'B Two'], [12, 'C Three']]), war: new Map() })
  const s = shards.get('119-138')
  assert.deepEqual(s.teams, [119, 138])
  assert.deepEqual(s.rows.map((r) => r[0]).sort(), [10, 11])
  const a = s.rows.find((r) => r[0] === 10)
  assert.deepEqual(a, [10, 'A One', [1950, 1960], [1955]])
})

test('a player with no WAR entry is listed with score 0', () => {
  const f = file([['BRO-1950', [0, 1]], ['SLN-1955', [0, 1]]], [10, 11])
  const shard = buildPlayedForBoth({ file: f, names: new Map([[10, 'A'], [11, 'B']]), war: new Map([[10, 5]]) }).get('119-138')
  assert.deepEqual(shard.top, [10, 11])
  assert.equal(shard.rows.length, 2)
})

test('top holds up to 12 ids, best score first; the score is career WAR times the recency factor', () => {
  const ids = Array.from({ length: 15 }, (_, i) => 100 + i)
  const idx = ids.map((_, i) => i)
  const f = file([['BRO-2000', idx], ['SLN-2001', idx]], ids)
  // war falls with the id, so 100 scores best; 114 scores worst
  const war = new Map(ids.map((id, i) => [id, 20 - i]))
  const shard = buildPlayedForBoth({ file: f, names: new Map(), war }).get('119-138')
  assert.equal(shard.top.length, 12)
  assert.deepEqual(shard.top, ids.slice(0, 12))
  assert.equal(scoreOf(20, 2025, 2001), 20 * (0.4 + 0.6 * 0.9 ** 24))
  assert.equal(recency(0), 1)
})

test('recency is measured from throughSeason, not the clock: an old star can lose to a recent regular', () => {
  const f = file([['BRO-1920', [0]], ['SLN-1921', [0]], ['BRO-2024', [1]], ['SLN-2025', [1]]], [1, 2])
  const war = new Map([[1, 10], [2, 7]])
  const shard = buildPlayedForBoth({ file: f, names: new Map(), war }).get('119-138')
  assert.equal(shard.top[0], 2) // 7 * ~1 beats 10 * ~0.4
})

test('rows run most recent first (last season with either club), then higher score, then lower id', () => {
  const f = file(
    [['BRO-2000', [0, 1, 2, 3]], ['SLN-2005', [0]], ['SLN-2010', [1, 2]], ['SLN-2001', [3]]],
    [50, 40, 30, 60],
  )
  const war = new Map([[50, 1], [40, 3], [30, 3], [60, 9]])
  const rows = buildPlayedForBoth({ file: f, names: new Map(), war }).get('119-138').rows.map((r) => r[0])
  // 40 and 30 last 2010 (same score: lower id 30 first), 50 last 2005, 60 last 2001
  assert.deepEqual(rows, [30, 40, 50, 60])
})

test('the shard is the same whatever order the rosters come in', () => {
  const rosters = [['BRO-1950', [0, 1]], ['SLN-1955', [0, 1]], ['MIL-2000', [1]], ['BRO-2001', [1]]]
  const a = buildPlayedForBoth({ file: file(rosters, [10, 11]), names: new Map(), war: new Map() })
  const b = buildPlayedForBoth({ file: file([...rosters].reverse(), [10, 11]), names: new Map(), war: new Map() })
  assert.equal(JSON.stringify([...a.entries()]), JSON.stringify([...b.entries()]))
  assert.ok(a.has('119-138') && !a.has('138-119'))
})

test('careerWarFrom adds bat and pit across every season, a two-way player both', () => {
  const war = careerWarFrom([{ bat: { 1: { 2000: 2.5, 2001: 1 }, 2: { 2000: -0.5 } }, pit: { 1: { 2001: 3 } } }, { bat: { 3: { 1999: 0.1 } } }])
  assert.equal(war.get(1), 6.5)
  assert.equal(war.get(2), -0.5)
  assert.equal(war.get(3), 0.1)
  assert.equal(war.get(4), undefined)
})
