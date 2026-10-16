import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSeries, finalScore, gamesOf } from '../../scripts/lib/world-series/series.mjs'

const fx = (name) => JSON.parse(readFileSync(new URL(`../fixtures/world-series/${name}`, import.meta.url), 'utf8'))
const schedule = (year) => gamesOf(fx(`schedule-${year}.json`))

// A play list that holds only the final score, for games with no play-by-play fixture.
const stub = (g) => ({ allPlays: [{ about: { atBatIndex: 0 }, result: { awayScore: g.teams.away.score, homeScore: g.teams.home.score } }] })
const playsFor = (rows) => {
  const out = {}
  for (const g of rows) out[g.gamePk] = stub(g)
  return out
}

test('finalScore reads the highest atBatIndex, whatever the order', () => {
  const plays = { allPlays: [
    { about: { atBatIndex: 1 }, result: { awayScore: 3, homeScore: 2 } },
    { about: { atBatIndex: 0 }, result: { awayScore: 0, homeScore: 0 } },
  ] }
  assert.deepEqual(finalScore(plays), { away: 3, home: 2 })
})

test('2022: the duplicated gamePk keeps its played date and counts once', () => {
  const rows = schedule(2022)
  assert.equal(rows.length, 7)
  const s = buildSeries(2022, rows, playsFor(rows))
  assert.equal(s.games.length, 6)
  const g3 = s.games.find((g) => g.pk === 715722)
  assert.equal(g3.date, '2022-11-01')
  assert.deepEqual(s.games.map((g) => g.n), [1, 2, 3, 4, 5, 6])
  assert.equal(s.winsNeeded, 4)
})

test('1912: the tie has tie true, no winner, and takes game number 2', () => {
  const rows = schedule(1912)
  const plays = { ...playsFor(rows), 67266: fx('67266-plays.json') }
  const s = buildSeries(1912, rows, plays)
  const tie = s.games.find((g) => g.pk === 67266)
  assert.equal(tie.tie, true)
  assert.equal(tie.n, 2)
  assert.equal(tie.awayRuns, tie.homeRuns)
  assert.equal(s.games.find((g) => g.pk === 67272).n, 8)
  assert.equal(s.games.filter((g) => g.tie).length, 1)
  assert.equal(s.winsNeeded, 4)
})

test('2006: a game with no seriesGameNumber still gets the right n', () => {
  const rows = schedule(2006)
  const s = buildSeries(2006, rows, playsFor(rows))
  assert.equal(s.games.find((g) => g.pk === 57780).n, 5)
  assert.deepEqual(s.clubs, [138, 116])
  assert.equal(s.winner, 138)
})

test('a best-of-nine has winsNeeded 5 (read from the data, not a constant)', () => {
  const row = (pk, winner) => ({
    gamePk: pk, officialDate: `1903-10-${String(pk).padStart(2, '0')}`, venue: { id: 1 },
    teams: { away: { team: { id: 111 }, score: winner === 'away' ? 3 : 1 }, home: { team: { id: 134 }, score: winner === 'away' ? 1 : 3 } },
    linescore: { innings: new Array(9) },
  })
  // Boston wins five of eight; the home club (Pittsburgh) wins the other three.
  const rows = ['away', 'home', 'home', 'away', 'away', 'away', 'home', 'away'].map((w, i) => row(i + 1, w))
  const s = buildSeries(1903, rows, playsFor(rows))
  assert.equal(s.winsNeeded, 5)
  assert.equal(s.winner, 111)
})
