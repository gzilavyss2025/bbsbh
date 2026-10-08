// The series primer's pure rules (ADR-0087, 2026-10-08 addendum): which series
// the home page primes, its status head and chip, the ribbon's one node per
// game, and the leaders ledger's rows. Real 2025 series, heading into a cutoff:
//   2025-10-13  ALCS SEA leads 1–0 (Game 2), NLCS 0–0 (Game 1)
//   2025-10-17  ALCS tied 2–2 (Game 5), NLCS LAD leads 3–0 (Game 4)
//   2025-10-31  World Series TOR leads 3–2 (Game 6)
//   2025-11-01  World Series tied 3–3 (Game 7)
import assert from 'node:assert/strict'
import test from 'node:test'
import { bracket2025, results, seriesWith, skeleton } from './fixtures.js'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { defaultPrimerSeries, primerSeriesFor } from '../../src/lib/postseason/primer/primerSeries.js'
import { seriesStatus } from '../../src/lib/postseason/primer/seriesStatus.js'
import { ribbonNodes } from '../../src/lib/postseason/primer/ribbonNodes.js'
import { leaderRows } from '../../src/lib/postseason/primer/leaderRows.js'

const ALCS_G5 = 813039
const NLCS_G4 = 813031

test('an LCS day with one game per series primes both series', () => {
  const b = bracket2025('2025-10-17')
  const list = primerSeriesFor(b, '2025-10-17', [ALCS_G5, NLCS_G4])
  assert.deepEqual(list.map((s) => s.round + (s.league ?? '')).sort(), ['lcsAL', 'lcsNL'])
})

test('a World Series day primes the one series', () => {
  const b = bracket2025('2025-10-24')
  assert.deepEqual(primerSeriesFor(b, '2025-10-24', [813027]).map((s) => s.round), ['worldseries'])
})

test('any slate game outside an LCS or the World Series keeps the usual page', () => {
  const b = bracket2025('2025-10-17')
  assert.deepEqual(primerSeriesFor(b, '2025-10-17', [ALCS_G5, NLCS_G4, 999999]), [])
})

test('a series with two games on the slate (doubleheader, resumed game) keeps the usual page', () => {
  const b = bracket2025('2025-10-17')
  assert.deepEqual(primerSeriesFor(b, '2025-10-17', [ALCS_G5, ALCS_G5, NLCS_G4]), [])
})

test('a Division Series day, an empty slate and a day past the cutoff prime nothing', () => {
  const ds = bracket2025('2025-10-08')
  const dsPks = ds.series.filter((s) => s.playsOnCutoff).map((s) => s.cutoffGame.gamePk)
  assert.ok(dsPks.length > 0)
  assert.deepEqual(primerSeriesFor(ds, '2025-10-08', dsPks), [])
  assert.deepEqual(primerSeriesFor(bracket2025('2025-10-17'), '2025-10-17', []), [])
  assert.deepEqual(primerSeriesFor(bracket2025('2025-10-17'), '2025-10-18', [ALCS_G5, NLCS_G4]), [])
  assert.deepEqual(primerSeriesFor(null, '2025-10-17', [ALCS_G5]), [])
})

// With Scores Unlocked on, the home page's bracket counts today's Final games
// (ADR-0087, 2026-09-30 addendum). The primer must never show that state: a
// live bracket whose cutoff game is already counted primes nothing, so every
// primer part (head, chip, ribbon) stays heading into the cutoff.
test('sentinel: a live bracket that counts today\u2019s Final game primes nothing', () => {
  const live = deriveBracket(skeleton(2025), results(2025), '2025-10-17', { live: true })
  assert.ok(seriesWith(live, 'NL', 'lcs', 'LAD').games.some((g) => g.gamePk === NLCS_G4))
  assert.deepEqual(primerSeriesFor(live, '2025-10-17', [ALCS_G5, NLCS_G4]), [])
  // Before today's games go Final, the live bracket equals the usual one.
  const morning = deriveBracket(skeleton(2025), results(2025).filter((r) => r.officialDate < '2025-10-17'), '2025-10-17', { live: true })
  assert.equal(primerSeriesFor(morning, '2025-10-17', [ALCS_G5, NLCS_G4]).length, 2)
})

test('the default tab: the favourite club, else the earlier first pitch, else the NL series', () => {
  const list = primerSeriesFor(bracket2025('2025-10-17'), '2025-10-17', [ALCS_G5, NLCS_G4])
  const pick = (opts) => defaultPrimerSeries(list, opts).league
  assert.equal(pick({ favoriteTeamId: 158 }), 'NL') // MIL
  assert.equal(pick({ favoriteTeamId: 141 }), 'AL') // TOR
  const firstPitchByPk = { [ALCS_G5]: '2025-10-17T20:08:00Z', [NLCS_G4]: '2025-10-18T00:38:00Z' }
  assert.equal(pick({ favoriteTeamId: 147, firstPitchByPk }), 'AL')
  assert.equal(pick({ firstPitchByPk: { ...firstPitchByPk, [NLCS_G4]: '2025-10-17T18:00:00Z' } }), 'NL')
  assert.equal(pick({}), 'NL')
  assert.equal(pick({ firstPitchByPk: { [ALCS_G5]: 'x', [NLCS_G4]: 'x' } }), 'NL')
  assert.equal(defaultPrimerSeries([list[0]], {}), list[0])
  assert.equal(defaultPrimerSeries([], {}), null)
})

test('the status head and the elimination chip', () => {
  const status = (cutoff, league, round, abbr) => seriesStatus(seriesWith(bracket2025(cutoff), league, round, abbr))
  assert.deepEqual(status('2025-10-13', 'NL', 'lcs', 'LAD'), { head: 'Best of 7', chip: null })
  assert.deepEqual(status('2025-10-13', 'AL', 'lcs', 'SEA'), { head: 'SEA leads 1–0', chip: null })
  assert.deepEqual(status('2025-10-17', 'AL', 'lcs', 'SEA'), { head: 'Series tied 2–2', chip: null })
  assert.deepEqual(status('2025-10-17', 'NL', 'lcs', 'LAD'), { head: 'LAD leads 3–0', chip: 'MIL facing elimination' })
  assert.deepEqual(status('2025-10-31', null, 'worldseries', 'LAD'), { head: 'TOR leads 3–2', chip: 'LAD facing elimination' })
  assert.deepEqual(status('2025-11-01', null, 'worldseries', 'LAD'), { head: 'Winner take all', chip: null })
})

// One finished game in the shared shape (ribbonNodes.js header). Runs are made
// up: the ribbon must take them from here, and the winner from the bracket.
const score = (gamePk, n, awayId, homeId, away, home) => ({
  gamePk, n, date: 'x', awayId, homeId, venueId: 1, venueName: 'Park', runs: { away, home }, wp: [50],
})

test('the ribbon: played, today and if-necessary nodes, one per game', () => {
  const nlcs = seriesWith(bracket2025('2025-10-17'), 'NL', 'lcs', 'LAD') // slots MIL, LAD
  const scoresByPk = { 813036: score(813036, 1, 119, 158, 2, 1) } // LAD at MIL
  const nodes = ribbonNodes(nlcs, { scoresByPk })
  assert.deepEqual(nodes.map((n) => n.kind), ['played', 'played', 'played', 'today', 'ifNecessary', 'ifNecessary', 'ifNecessary'])
  assert.deepEqual(nodes.map((n) => n.n), [1, 2, 3, 4, 5, 6, 7])
  const [g1, g2] = nodes
  assert.deepEqual(g1.runs, [1, 2]) // slot order: MIL, LAD
  assert.equal(g1.winnerId, 119)
  assert.equal(g1.record, 'LAD leads 1–0')
  assert.equal(g1.score.venueName, 'Park')
  assert.equal(g2.runs, null) // no score loaded yet
  assert.equal(nodes[2].record, 'LAD leads 3–0')
})

test('the ribbon before Game 1: today, then dated games ahead, then if necessary', () => {
  const nlcs = seriesWith(bracket2025('2025-10-13'), 'NL', 'lcs', 'LAD')
  const nodes = ribbonNodes(nlcs, { scoresByPk: {} })
  assert.deepEqual(nodes.map((n) => n.kind), ['today', 'ahead', 'ahead', 'ahead', 'ifNecessary', 'ifNecessary', 'ifNecessary'])
  assert.deepEqual(nodes[1], { kind: 'ahead', n: 2, gamePk: 813034, date: '2025-10-14' })
})

test('the ribbon after a tied game reads the tie', () => {
  const alcs = seriesWith(bracket2025('2025-10-17'), 'AL', 'lcs', 'SEA')
  assert.deepEqual(ribbonNodes(alcs, {}).slice(0, 4).map((n) => n.record), [
    'SEA leads 1–0', 'SEA leads 2–0', 'SEA leads 2–1', 'Series tied 2–2',
  ])
})

// Sentinels: scores for EVERY game of the series, today's and later ones
// included, as a careless loader could supply them.
test('sentinel: a game on or after the cutoff never becomes played, and today carries no score', () => {
  const b = bracket2025('2025-10-17')
  const nlcs = seriesWith(b, 'NL', 'lcs', 'LAD')
  const everyPk = Object.keys(bracket2025('2025-12-31').gameIndex)
  const scoresByPk = Object.fromEntries(everyPk.map((pk) => [pk, score(Number(pk), 0, 119, 158, 9, 9)]))
  const nodes = ribbonNodes(nlcs, { scoresByPk })
  for (const node of nodes.filter((n) => n.kind === 'played')) assert.ok(node.date < b.cutoff, `G${node.n}`)
  assert.equal(nodes.filter((n) => n.kind === 'played').length, 3)
  assert.deepEqual(nodes[3], { kind: 'today', n: 4, gamePk: NLCS_G4 })
})

test('sentinel: an if-necessary node carries no date, gamePk or park', () => {
  const nlcs = seriesWith(bracket2025('2025-10-17'), 'NL', 'lcs', 'LAD')
  for (const node of ribbonNodes(nlcs, {}).filter((n) => n.kind === 'ifNecessary')) {
    assert.deepEqual(Object.keys(node).sort(), ['kind', 'n'])
  }
})

test('leader rows: three or fewer all show high to low, more show the leader only', () => {
  const e = (name, value) => ({ id: name, name, teamId: 1, display: String(value), value })
  assert.deepEqual(leaderRows([]), [])
  assert.deepEqual(leaderRows(undefined), [])
  assert.deepEqual(leaderRows([e('a', 1), e('b', 3)]).map((r) => r.name), ['b', 'a'])
  assert.deepEqual(leaderRows([e('a', 1), e('b', 3), e('c', 2)]).map((r) => r.name), ['b', 'c', 'a'])
  assert.deepEqual(leaderRows([e('a', 5), e('b', 4), e('c', 3), e('d', 2)]).map((r) => r.name), ['a'])
})
