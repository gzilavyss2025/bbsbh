import assert from 'node:assert/strict'
import test from 'node:test'
import { tallyStarterRecord, starterCgShutoutCount } from '../scripts/lib/pitcher-starts.mjs'

const start = (teamId, isHome, isWin, overrides = {}) => ({
  team: { id: teamId },
  isHome,
  isWin,
  stat: { gamesStarted: 1, inningsPitched: '6.0', strikeOuts: 4, ...overrides },
})

// Regression: a pitcher optioned/recalled/traded mid-season keeps his whole
// season in one gameLog. Brandon Sproat's Nashville Sounds debut (2026-08-09)
// showed "Nashville Sounds are 5-5 in his road starts" — a Milwaukee Brewers
// record, mislabeled under the club he'd only just joined, because the
// home/away tally summed every start regardless of which team it was for.
test('tallyStarterRecord only counts starts made for the given team', () => {
  const rows = [
    start(158, true, true), // Brewers, home win
    start(158, false, false), // Brewers, road loss
    start(556, false, true), // Sounds, road win — his one Sounds start so far
  ]
  const rec = tallyStarterRecord(rows, 556)
  assert.deepEqual(
    { homeW: rec.homeW, homeL: rec.homeL, awayW: rec.awayW, awayL: rec.awayL },
    { homeW: 0, homeL: 0, awayW: 1, awayL: 0 },
  )
})

test('tallyStarterRecord counts every start when they were all made for that team', () => {
  const rows = [start(158, true, true), start(158, false, false), start(158, false, true)]
  const rec = tallyStarterRecord(rows, 158)
  assert.deepEqual(
    { homeW: rec.homeW, homeL: rec.homeL, awayW: rec.awayW, awayL: rec.awayL },
    { homeW: 1, homeL: 0, awayW: 1, awayL: 1 },
  )
})

test('tallyStarterRecord skips relief outings regardless of team', () => {
  const rows = [start(158, true, true, { gamesStarted: 0 })]
  const rec = tallyStarterRecord(rows, 158)
  assert.deepEqual(
    { homeW: rec.homeW, homeL: rec.homeL, awayW: rec.awayW, awayL: rec.awayL },
    { homeW: 0, homeL: 0, awayW: 0, awayL: 0 },
  )
})

test('tallyStarterRecord scopes the 6+ IP record to the current team too', () => {
  const rows = [
    start(158, true, true, { inningsPitched: '7.0' }), // Brewers, qualifies, wrong team
    start(556, false, true, { inningsPitched: '6.1' }), // Sounds, qualifies
    start(556, true, false, { inningsPitched: '5.0' }), // Sounds, short start
  ]
  const rec = tallyStarterRecord(rows, 556)
  assert.equal(rec.sixIpW, 1)
  assert.equal(rec.sixIpL, 0)
})

// tenK is a personal count ("the Nth time this season he's reached double-
// digit strikeouts") — never attributed to a club by name, so it stays
// season-wide across a mid-season team change.
test('tallyStarterRecord counts double-digit-strikeout starts across every team', () => {
  const rows = [start(158, true, true, { strikeOuts: 11 }), start(556, false, true, { strikeOuts: 12 })]
  const rec = tallyStarterRecord(rows, 556)
  assert.equal(rec.tenK, 2)
})

test('tallyStarterRecord returns all zeroes for an empty or absent log', () => {
  assert.deepEqual(tallyStarterRecord([], 158), {
    homeW: 0, homeL: 0, awayW: 0, awayL: 0, sixIpW: 0, sixIpL: 0, tenK: 0,
  })
  assert.deepEqual(tallyStarterRecord(undefined, 158), {
    homeW: 0, homeL: 0, awayW: 0, awayL: 0, sixIpW: 0, sixIpL: 0, tenK: 0,
  })
})

// Regression: Jacob Misiorowski's callout showed "2 complete games/shutouts"
// with one CG on the season, because that CG was also a shutout and the two
// stats were summed. A shutout is always a complete game — never additional
// to it.
test('starterCgShutoutCount does not double-count a start that is both a CG and a shutout', () => {
  assert.equal(starterCgShutoutCount({ completeGames: 1, shutouts: 1 }), 1)
})

test('starterCgShutoutCount counts a complete game that was not a shutout', () => {
  assert.equal(starterCgShutoutCount({ completeGames: 2, shutouts: 1 }), 2)
})

test('starterCgShutoutCount is zero when stats are missing', () => {
  assert.equal(starterCgShutoutCount(undefined), 0)
  assert.equal(starterCgShutoutCount({}), 0)
})
