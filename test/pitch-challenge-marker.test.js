// Regression coverage for the ABS challenge marker's wiring into the pitch
// list (src/api/playbyplay.js's pitchCardInfo → src/components/StrikeZone.jsx's
// PitchList/ChallengeMark). challenges.js's challengeForPlay itself already
// has direct unit coverage (test/challenges.test.js); this pins the piece that
// PR #344 added on top — that pitchCardInfo actually calls it and stamps the
// resolved challenge onto the ONE matching pitch's own pitchDetails row, by
// pitchNumber, leaving every other pitch (in this play and elsewhere in the
// half) with challenge: null.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

// mini-game.js's [0] top 1: Ashby (id 1) strikeout, pitches C(1) S(2) S(3) —
// the away club challenges pitch 2 and loses (upheld, isOverturned: false).
function withPitchLevelChallenge(feed) {
  const play = feed.liveData.plays.allPlays[0]
  const pitch2 = play.playEvents.find((e) => e.isPitch && e.pitchNumber === 2)
  pitch2.reviewDetails = {
    isOverturned: false,
    reviewType: 'MJ',
    challengeTeamId: feed.gameData.teams.away.id,
    player: { id: 1, fullName: 'Aaron Ashby' },
  }
  return feed
}

test('pitchCardInfo stamps a pitch-level challenge onto its exact pitch only', () => {
  const feed = withPitchLevelChallenge(buildFeed())
  const entries = computeHalfInningFeed(feed, 1, 'top', 'away')
  const ashbyCard = entries.find((e) => e.kind === 'atbat' && e.batterId === 1)
  assert.ok(ashbyCard, 'Ashby\'s own at-bat card should exist')
  assert.equal(ashbyCard.pitchDetails.length, 3)

  const [p1, p2, p3] = ashbyCard.pitchDetails
  assert.equal(p1.challenge, null)
  assert.equal(p3.challenge, null)
  assert.ok(p2.challenge, 'pitch 2 should carry the challenge')
  assert.equal(p2.challenge.outcome, 'fail')
  assert.equal(p2.challenge.pitchNumber, 2)
  assert.equal(p2.challenge.playerName, 'Aaron Ashby')
})

test('a play with no ABS review carries no challenge on any of its pitches', () => {
  const entries = computeHalfInningFeed(buildFeed(), 1, 'top', 'away')
  const ashbyCard = entries.find((e) => e.kind === 'atbat' && e.batterId === 1)
  assert.ok(ashbyCard)
  assert.ok(ashbyCard.pitchDetails.every((p) => p.challenge === null))
})
