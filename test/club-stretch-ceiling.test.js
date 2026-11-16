// Club Stretch's fetch pruning (issue 3133): a ceiling from season lines never undercuts the
// exact best run, so skipping a player whose ceiling loses keeps the boards exact.
import assert from 'node:assert/strict'
import test from 'node:test'
import { measuresFor, toGame } from '../src/api/streaks/bestStretch.js'
import { LENGTHS, MLB, playerRows } from '../scripts/lib/franchise/club-stretch.mjs'
import { ceilings, nextFetches } from '../scripts/lib/franchise/club-stretch-ceiling.mjs'

// A small seeded random, so a failure reproduces.
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const pick = (r, n) => Math.floor(r() * n)

// A career: seasons of random length, each game a random line, a few trades.
function career(seed, group) {
  const r = rng(seed)
  const games = []
  let team = 158
  for (let y = 1950; y < 1950 + 2 + pick(r, 5); y++) {
    const len = 20 + pick(r, 150)
    // A season of only starts, only relief, or both: only a one-kind season sets an ERA floor.
    const role = pick(r, 3)
    for (let g = 0; g < len; g++) {
      if (r() < 0.004) team = team === 158 ? 147 : 158
      const date = `${y}-04-01`.replace('01', String(1 + Math.floor(g / 6)).padStart(2, '0')).slice(0, 8) + String(1 + (g % 28)).padStart(2, '0')
      const stat = group === 'pitching'
        ? { gamesStarted: role === 0 ? 1 : role === 1 ? 0 : Number(r() < 0.5), outs: pick(r, 25), earnedRuns: pick(r, 5), hits: pick(r, 9), baseOnBalls: pick(r, 4), strikeOuts: pick(r, 10) }
        : (() => { const ab = pick(r, 6), h = Math.min(ab, pick(r, 3)); return { atBats: ab, plateAppearances: ab + pick(r, 2), hits: h, homeRuns: pick(r, 2) * (h > 0), rbi: pick(r, 3), stolenBases: pick(r, 2), baseOnBalls: pick(r, 2), totalBases: h + pick(r, 3) * (h > 0) } })()
      games.push(toGame({ date, game: { gameNumber: 1 + (g % 2) }, team: { id: team, name: `Club ${team}` }, stat }, group))
    }
  }
  return games
}

// Season lines as pass 1 reads them: per season, for one club or all of MLB.
function seasonLines(games, scope) {
  const by = new Map()
  for (const g of games) {
    if (scope !== MLB && g.teamId !== scope) continue
    const y = Number(g.date.slice(0, 4))
    if (!by.has(y)) by.set(y, { season: y, gamesPlayed: 0, gamesStarted: 0, sacBunts: 0, sacFlies: 0, hitByPitch: 0 })
    const s = by.get(y)
    s.gamesPlayed++
    for (const k of ['gamesStarted', 'outs', 'earnedRuns', 'hits', 'baseOnBalls', 'strikeOuts', 'homeRuns', 'rbi', 'stolenBases', 'plateAppearances', 'atBats', 'totalBases']) s[k] = (s[k] ?? 0) + (g[k] ?? 0)
  }
  return [...by.values()]
}

for (const group of ['hitting', 'pitching']) {
  test(`${group}: the ceiling is never worse than the exact best run, for a club and for MLB`, () => {
    let checked = 0
    for (let seed = 1; seed <= 150; seed++) {
      const games = career(seed, group)
      for (const scope of [158, MLB]) {
        const rows = playerRows({ id: seed, name: 'P', games }, scope, group)
        const ceil = ceilings(seasonLines(games, scope), LENGTHS[group], group)
        for (const [key, row] of Object.entries(rows)) {
          const m = measuresFor(group).find((x) => x.key === key.split(':')[1])
          assert.ok(key in ceil, `${key} has a run but no ceiling`)
          assert.ok(m.lower ? ceil[key] <= row.raw + 1e-9 : ceil[key] >= row.raw - 1e-9, `seed ${seed} ${scope} ${key}: ceiling ${ceil[key]} vs exact ${row.raw}`)
          checked++
        }
      }
    }
    assert.ok(checked > 100)
  })
}

test('the MLB board crosses a trade; the club board does not', () => {
  const g = (i, teamId) => toGame({ date: `1950-${String(4 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, game: { gameNumber: 1 }, team: { id: teamId, name: `Club ${teamId}` }, stat: { atBats: 4, plateAppearances: 4, homeRuns: 1 } })
  const games = [...Array.from({ length: 100 }, (_, i) => g(i, 158)), ...Array.from({ length: 80 }, (_, i) => g(100 + i, 147))]
  assert.equal(playerRows({ id: 1, name: 'P', games }, 158)['154:hr'], undefined)
  const row = playerRows({ id: 1, name: 'P', games }, MLB)['162:hr']
  assert.equal(row.value, '162')
  assert.equal(row.team, 'Club 158 / Club 147')
})

test('nextFetches: fetches while a ceiling can reach the 10th row, ties included, then stops', () => {
  const measure = measuresFor('hitting').find((m) => m.key === 'hr')
  const cands = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, ceiling: 100 - i }))
  const board = { scope: 158, n: 162, measure, cands }
  const exact = new Map(cands.slice(0, 10).map((c) => [c.id, c.ceiling - 9])) // 10th exact = 82
  const done = (id) => exact.has(id)
  const rowOf = (id) => ({ raw: exact.get(id) })
  // The 10th exact row is 82; the unfetched ceilings 90..86 can all still reach it.
  assert.deepEqual([...nextFetches([board], done, rowOf)], [11, 12, 13, 14, 15])
  assert.deepEqual([...nextFetches([board], done, rowOf, { per: 2 })], [11, 12])
  // Once they are in and none beats the bar, nothing more is fetched.
  const all = new Map(cands.map((c) => [c.id, c.ceiling]))
  const longer = { ...board, cands: [...cands, { id: 50, ceiling: 85 }] } // 10th exact is 91
  assert.equal(nextFetches([longer], (id) => all.has(id), (id) => ({ raw: all.get(id) })).size, 0)
  assert.equal(nextFetches([board], (id) => all.has(id), (id) => ({ raw: all.get(id) })).size, 0)
  // A ceiling that only ties the 10th row is still fetched.
  const tie = { ...board, cands: [...cands.slice(0, 10), { id: 99, ceiling: 82 }] }
  assert.deepEqual([...nextFetches([tie], done, rowOf)], [99])
})

// Club Stretch's MLB rows link to Best Stretch with club=mlb: the card must find the same run.
test("Best Stretch's MLB search keeps the board's rules: relief outings only, and the AVG floor", async () => {
  const { searchBest } = await import('../src/api/streaks/bestStretch.js')
  // A starter (40 starts) with 70 relief outings: his 65-relief run is the board's, not 65 starts.
  const games = Array.from({ length: 110 }, (_, i) => toGame({ date: `1950-${String(4 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, game: { gameNumber: 1 }, team: { id: i < 60 ? 158 : 147, name: 'C' }, stat: i % 11 < 4 ? { gamesStarted: 1, outs: 18, earnedRuns: 3 } : { outs: 3, earnedRuns: 0 } }, 'pitching'))
  const era = measuresFor('pitching').find((m) => m.key === 'era')
  const starts = games.filter((g) => g.gamesStarted > 0)
  const best = searchBest(games, starts, 65, era, 'pitching', MLB)
  assert.equal(best.value, playerRows({ id: 1, name: 'P', games }, MLB, 'pitching')['65:era'].raw)
  // A hitter short of 3.1 PA a game has no MLB AVG run, as the board has none.
  const avg = measuresFor('hitting').find((m) => m.key === 'avg')
  const thin = Array.from({ length: 162 }, (_, i) => toGame({ date: `1950-${String(4 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, game: { gameNumber: 1 }, team: { id: 158, name: 'C' }, stat: { atBats: 3, plateAppearances: 3, hits: 2 } }))
  assert.equal(searchBest(thin, thin, 162, avg, 'hitting', MLB), null)
  assert.equal(playerRows({ id: 1, name: 'P', games: thin }, MLB)['162:avg'], undefined)
})
