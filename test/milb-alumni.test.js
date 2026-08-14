import test from 'node:test'
import assert from 'node:assert/strict'
import { alumniByTeam, careerWarRanking, needsScan } from '../scripts/lib/milb-alumni.mjs'

// The pure half of gen-milb-alumni.mjs — the ranking, the incremental-scan
// decision, and the club inversion behind the "Made The Show" card.

// ---- careerWarRanking -------------------------------------------------------

test('careerWarRanking sums the live season onto every completed one', () => {
  const live = { bat: { '1': 2 }, pit: {} }
  const shards = [{ bat: { '1': { 2023: 3, 2024: 4 } }, pit: {} }]
  assert.deepEqual(careerWarRanking(live, shards), [{ id: '1', war: 9 }])
})

test('careerWarRanking adds a two-way player’s bat and arm together', () => {
  const live = { bat: { '1': 1 }, pit: { '1': 2 } }
  const shards = [{ bat: { '1': { 2024: 3 } }, pit: { '1': { 2024: 4 } } }]
  assert.deepEqual(careerWarRanking(live, shards), [{ id: '1', war: 10 }])
})

// The active filter is the live file, not a roster call. A retired great has
// history and no current line, and must not rank above the players still going.
test('careerWarRanking drops a player absent from the live season', () => {
  const live = { bat: { active: 1 }, pit: {} }
  const shards = [{ bat: { active: { 2024: 1 }, retired: { 2024: 90 } }, pit: {} }]
  assert.deepEqual(careerWarRanking(live, shards), [{ id: 'active', war: 2 }])
})

test('careerWarRanking ranks highest first and honours poolSize', () => {
  const live = { bat: { low: 1, high: 5, mid: 3 }, pit: {} }
  assert.deepEqual(
    careerWarRanking(live, [], { poolSize: 2 }).map((p) => p.id),
    ['high', 'mid'],
  )
})

// ---- needsScan --------------------------------------------------------------

test('needsScan re-walks a player the cache has never seen', () => {
  assert.equal(needsScan(undefined, 2026), true)
})

test('needsScan re-walks everyone once a season turns over', () => {
  const entry = { scanned: 2025, stints: { 556: { g: 100, first: 2015, last: 2016 } } }
  assert.equal(needsScan(entry, 2026), true)
})

test('needsScan skips a player whose bus-league career is long over', () => {
  const entry = { scanned: 2026, stints: { 556: { g: 100, first: 2015, last: 2016 } } }
  assert.equal(needsScan(entry, 2026), false)
})

// A player optioned down last year or this one can still add games, so his
// stints are not settled and the cache must not freeze them.
test('needsScan re-walks a player who was in the minors last season', () => {
  const entry = { scanned: 2026, stints: { 556: { g: 30, first: 2025, last: 2025 } } }
  assert.equal(needsScan(entry, 2026), true)
})

// A player with a cached but EMPTY stint map has no `last` to compare; the
// spread of an empty array into Math.max returns -Infinity, which would read as
// "settled forever". He may simply not have reached the minors yet.
test('needsScan re-walks a player cached with no minor-league stints at all', () => {
  assert.equal(needsScan({ scanned: 2026, stints: {} }, 2026), true)
})

// ---- alumniByTeam -----------------------------------------------------------

const AFFILIATES = new Set(['556', '5015'])

test('alumniByTeam files a player under every affiliate he cleared the floor at', () => {
  const ranked = [{ id: 'p1', war: 10 }]
  const scans = {
    p1: { stints: { 556: { g: 60, first: 2016, last: 2017 }, 5015: { g: 40, first: 2015, last: 2015 } } },
  }
  const out = alumniByTeam(ranked, scans, AFFILIATES)
  assert.deepEqual(Object.keys(out).sort(), ['5015', '556'])
  assert.equal(out['556'][0].g, 60)
})

// THE REGRESSION THIS CARD EXISTS TO AVOID. Ranking on career WAR with no games
// floor puts a rehab assignment's three-game cameo above the player who spent
// two seasons at the club. Real case: Nashville 2021.
test('alumniByTeam drops a rehab cameo that outranks a real stint on career WAR', () => {
  const ranked = [
    { id: 'rehabbing-star', war: 45.6 },
    { id: 'came-up-here', war: 36.3 },
  ]
  const scans = {
    'rehabbing-star': { stints: { 556: { g: 3, first: 2021, last: 2021 } } },
    'came-up-here': { stints: { 556: { g: 67, first: 2016, last: 2017 } } },
  }
  const out = alumniByTeam(ranked, scans, AFFILIATES, { minGames: 20 })
  assert.deepEqual(
    out['556'].map((p) => p.id),
    ['came-up-here'],
  )
})

// Games are summed across seasons before the floor applies, so a player who was
// up and down three times still counts as having been here.
test('alumniByTeam clears the floor on games summed across seasons', () => {
  const ranked = [{ id: 'shuttled', war: 8 }]
  const scans = { shuttled: { stints: { 556: { g: 21, first: 2018, last: 2020 } } } }
  assert.equal(alumniByTeam(ranked, scans, AFFILIATES, { minGames: 20 })['556'].length, 1)
})

// A player's minor-league record is full of clubs that are nobody's affiliate
// today — a relocated franchise, a complex-league team, an Arizona Fall League
// roster. Only clubs the app can route to get a card.
test('alumniByTeam ignores clubs outside the current farm system', () => {
  const ranked = [{ id: 'p1', war: 10 }]
  const scans = { p1: { stints: { 588: { g: 100, first: 2014, last: 2014 } } } }
  assert.deepEqual(alumniByTeam(ranked, scans, AFFILIATES), {})
})

test('alumniByTeam keeps each club WAR-ranked and capped at cardSize', () => {
  const ranked = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, war: 10 - n }))
  const scans = Object.fromEntries(
    ranked.map((p) => [p.id, { stints: { 556: { g: 50, first: 2020, last: 2020 } } }]),
  )
  const out = alumniByTeam(ranked, scans, AFFILIATES, { cardSize: 2 })
  assert.deepEqual(
    out['556'].map((p) => p.id),
    ['p1', 'p2'],
  )
})

test('alumniByTeam returns nothing for a player the scan never covered', () => {
  assert.deepEqual(alumniByTeam([{ id: 'ghost', war: 5 }], {}, AFFILIATES), {})
})
