import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'

const path = new URL('../../public/data/world-series/series.json', import.meta.url)
const { coverage, series } = JSON.parse(readFileSync(path, 'utf8'))
const games = series.flatMap((s) => s.games)

test('the committed file holds 121 series, 707 games, 3 ties, under 100 KB', () => {
  assert.deepEqual(coverage, { from: 1903, through: 2025, seasons: 121, games: 707, ties: 3 })
  assert.equal(series.length, 121)
  assert.equal(games.length, 707)
  assert.equal(games.filter((g) => g.tie).length, 3)
  assert.equal(new Set(games.map((g) => g.pk)).size, 707)
  assert.ok(statSync(path).size < 100 * 1024)
  assert.equal(series.find((s) => s.season === 1903).winsNeeded, 5)
})

// Winner-take-all: the decided game where both clubs had winsNeeded - 1 wins before it.
function wtaGames() {
  const out = []
  for (const s of series) {
    const wins = {}
    for (const g of s.games) {
      if (g.tie) continue
      const w = g.awayRuns > g.homeRuns ? g.away : g.home
      if (s.clubs.every((c) => (wins[c] ?? 0) === s.winsNeeded - 1)) out.push({ s, g, homeWon: w === g.home })
      wins[w] = (wins[w] ?? 0) + 1
    }
  }
  return out
}

test('O2: 41 winner-take-all games, the home club won 19', () => {
  const wta = wtaGames()
  assert.equal(wta.length, 41)
  assert.equal(wta.filter((x) => x.homeWon).length, 19)
})

test('O3: road clubs won the last five winner-take-all games', () => {
  const last = wtaGames().slice(-6)
  assert.deepEqual(last.map((x) => x.homeWon), [true, false, false, false, false, false])
  assert.deepEqual(last.map((x) => x.s.season), [2011, 2014, 2016, 2017, 2019, 2025])
})

test('O11: the 2025 champion is the first repeat since 2000', () => {
  const bySeason = new Map(series.map((s) => [s.season, s.winner]))
  const repeats = series.filter((s) => bySeason.get(s.season - 1) === s.winner).map((s) => s.season)
  assert.deepEqual(repeats.slice(-2), [2000, 2025])
})

test('corrected figures: Game 1 winner 76 of 120, 2-0 leader 46 of 57, 3-1 comeback 7 of 51', () => {
  const winnerOf = (g) => (g.awayRuns > g.homeRuns ? g.away : g.home)
  const tally = (s, k) => {
    const w = {}
    s.games.filter((g) => !g.tie).slice(0, k).forEach((g) => { w[winnerOf(g)] = (w[winnerOf(g)] ?? 0) + 1 })
    return Object.entries(w).map(([c, n]) => [Number(c), n])
  }
  const g1 = series.filter((s) => !s.games[0].tie)
  assert.deepEqual([g1.filter((s) => winnerOf(s.games[0]) === s.winner).length, g1.length], [76, 120])
  const lead2 = series.map((s) => [s, tally(s, 2).find(([, n]) => n === 2)]).filter(([, l]) => l)
  assert.deepEqual([lead2.filter(([s, [c]]) => c === s.winner).length, lead2.length], [46, 57])
  const lead3 = series.map((s) => [s, tally(s, 4)]).filter(([, t]) => t.some(([, n]) => n === 3) && t.some(([, n]) => n === 1))
  const back = lead3.filter(([s, t]) => t.find(([, n]) => n === 1)[0] === s.winner).map(([s]) => s.season)
  assert.deepEqual([back, lead3.length], [[1903, 1925, 1958, 1968, 1979, 1985, 2016], 51])
})

test('names: every series names both clubs; 1997 Cleveland is the Indians, none after 2021 is', () => {
  for (const s of series) {
    assert.deepEqual(Object.keys(s.names).map(Number).sort(), [...s.clubs].sort(), `${s.season}`)
    for (const n of Object.values(s.names)) assert.ok(n && n !== 'undefined', `${s.season}`)
  }
  assert.equal(series.find((s) => s.season === 1997).names[114], 'Indians')
  assert.ok(!series.filter((s) => s.season >= 2022).some((s) => Object.values(s.names).includes('Indians')))
})
