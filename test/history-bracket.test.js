import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { historyBracket } from '../src/components/bracket/historyBracket.js'

const history = JSON.parse(fs.readFileSync(new URL('../public/data/postseason-history.json', import.meta.url), 'utf8'))
const season = (year) => history.seasons.find((s) => s.year === year)

test('a twelve-club season reads in the live bracket shape, every series decided', () => {
  const b = historyBracket(season(2025))
  assert.equal(b.season, 2025)
  assert.equal(b.champion.id, 119)
  for (const league of ['AL', 'NL']) {
    assert.equal(b.leagues[league].wildcard.length, 2)
    assert.equal(b.leagues[league].division.length, 2)
    assert.equal(b.leagues[league].byes.length, 2)
  }
  assert.ok(b.series.every((s) => s.decided && s.winner && s.eliminated && !s.playsOnCutoff))
  assert.equal(b.series.length, 11) // 4 Wild Card, 4 Division, 2 LCS, the World Series
})

test('each Division Series names the Wild Card winner it came from and its bye; each round feeds the next', () => {
  const b = historyBracket(season(2025))
  const nl = b.leagues.NL
  for (const ds of nl.division) {
    assert.equal(ds.slots.filter((s) => s.bye).length, 1)
    const from = ds.slots.find((s) => s.from)
    assert.equal(nl.wildcard.find((w) => w.key === from.from).feeds, ds.key)
  }
  assert.deepEqual(nl.lcs.slots.map((s) => s.from), nl.division.map((d) => d.key))
  assert.deepEqual(b.worldSeries.slots.map((s) => s.from), [b.leagues.AL.lcs.key, b.leagues.NL.lcs.key])
})

test('a game is won by the side that scored more, and the cutoff is the day after the last game', () => {
  const b = historyBracket(season(2025))
  const last = b.worldSeries.games.at(-1)
  assert.equal(last.winnerId, 119)
  assert.ok(b.cutoff > last.date)
})

test('the one-game Wild Card years feed one Division Series each and leave the other two clubs a bye', () => {
  const b = historyBracket(season(2021))
  for (const league of ['AL', 'NL']) {
    const { wildcard, division } = b.leagues[league]
    assert.equal(wildcard.length, 1)
    assert.equal(wildcard[0].bestOf, 1)
    assert.equal(division.flatMap((d) => d.slots).filter((s) => s.bye).length, 3)
    assert.ok(division.some((d) => d.key === wildcard[0].feeds))
  }
})

test('2020 sends two Wild Card series into each Division Series, one per slot', () => {
  const b = historyBracket(season(2020))
  for (const league of ['AL', 'NL']) {
    const { wildcard, division } = b.leagues[league]
    assert.equal(wildcard.length, 4)
    assert.equal(wildcard[0].bestOf, 3)
    for (const ds of division) assert.ok(ds.slots.every((s) => s.from && !s.bye))
  }
})

test('a season with no Wild Card round draws Division Series fed by no one, and no season shape answers null', () => {
  const b = historyBracket(season(2010))
  assert.equal(b.leagues.AL.wildcard.length, 0)
  assert.ok(b.leagues.AL.division.every((d) => d.slots.every((s) => !s.from && !s.bye)))
  assert.equal(historyBracket(null), null)
})
