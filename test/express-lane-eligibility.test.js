// Express Lane — can film exist for this game at all?
// (src/api/expresslane/eligibility.js)
//
// These five rules ARE this project's measured picture of MLB's clip coverage,
// and each was learned by going and looking. They decide whether the door onto
// the lineup page is drawn, so a rule that quietly stopped holding would put a
// door on a game with no film behind it — a promise the app cannot keep.
//
// They were verified in a browser against five real games. That run is not
// repeatable in CI, which is exactly why they are pinned here as well.
import assert from 'node:assert/strict'
import test from 'node:test'
import { filmCanExist, FIRST_FILM_SEASON } from '../src/api/expresslane/eligibility.js'

// NO CAPTURED FIXTURE HERE, deliberately. The repo's trimmed game feed
// (game-823035) was field-trimmed long before this feature existed and carries
// neither `gameData.game` nor a `sport` block on either team, so it cannot
// stand in for a real MLB game and a test written against it would be testing
// the trimming. The field paths below were instead checked against the LIVE
// feed for that same gamePk on 2026-09-10:
//
//   gameData.game.type            'R'
//   gameData.game.season          '2026'
//   gameData.teams.away.sport.id  1
//
// A minimal feed in the shape `gameData` really has, so each rule can be
// isolated. Built from scratch rather than by mutating the capture, because a
// mutated capture makes it unclear which field the test is actually about.
function feedOf({ sportId = 1, type = 'R', season = 2026, status = 'Final', code = 'F' } = {}) {
  return {
    gameData: {
      game: { type, season: String(season) },
      teams: { away: { sport: { id: sportId } }, home: { sport: { id: sportId } } },
      status: { abstractGameState: status, detailedState: code === 'DR' ? 'Postponed' : status, statusCode: code },
      datetime: { officialDate: '2026-07-07' },
    },
    liveData: { plays: { allPlays: [{}] } },
  }
}

test('a played MLB game in the film era can have film', () => {
  assert.equal(filmCanExist(feedOf()), true)
})

test('a feed that never names its level fails CLOSED, not open', () => {
  // The direction matters. An unknown level is not "probably MLB" — drawing a
  // door on a guess offers film for a game that may have none, and a door that
  // opens onto nothing is worse than no door. The trimmed capture in this repo
  // is exactly this shape, which is why it is not used above.
  const nameless = feedOf()
  delete nameless.gameData.teams
  assert.equal(filmCanExist(nameless), false)
})

// --- the five rules ---------------------------------------------------------

test('MiLB has no film at any level, so no door', () => {
  // sportIds 11-14 are Triple-A, Double-A, High-A and Single-A. Not thin
  // coverage — zero, verified across all four.
  for (const sportId of [11, 12, 13, 14]) {
    assert.equal(filmCanExist(feedOf({ sportId })), false, `sportId ${sportId}`)
  }
})

test('nothing before 2016 has film', () => {
  assert.equal(filmCanExist(feedOf({ season: FIRST_FILM_SEASON - 1 })), false)
  assert.equal(filmCanExist(feedOf({ season: FIRST_FILM_SEASON })), true, 'the floor itself is in')
  assert.equal(filmCanExist(feedOf({ season: 2015 })), false)
})

test('the All-Star game is not in the archive, however recent', () => {
  assert.equal(filmCanExist(feedOf({ type: 'A', season: 2026 })), false)
})

test('a game that has not started has no film yet', () => {
  assert.equal(filmCanExist(feedOf({ status: 'Preview', code: 'S' })), false)
})

test('a POSTPONED game reports Final with nothing behind it', () => {
  // The trap this rule exists for: `abstractGameState` alone says "Final" for a
  // game that was never played, so a door keyed on "is it over?" would offer
  // film for a game that does not exist.
  assert.equal(filmCanExist(feedOf({ status: 'Final', code: 'DR' })), false)
})

// --- degradation ------------------------------------------------------------

test('a missing or malformed feed answers false rather than throwing', () => {
  for (const feed of [null, undefined, {}, { gameData: {} }, { gameData: { game: {} } }]) {
    assert.equal(filmCanExist(feed), false)
  }
})

test('a season that is not a number is not a season', () => {
  assert.equal(filmCanExist(feedOf({ season: 'unknown' })), false)
})

test('the postseason is ordinary MLB film', () => {
  // gameTypes F, D, L and W are the four postseason rounds. Only "A" is out,
  // and reading them as anything else would blank the door every October.
  for (const type of ['F', 'D', 'L', 'W', 'R']) {
    assert.equal(filmCanExist(feedOf({ type })), true, `gameType ${type}`)
  }
})
