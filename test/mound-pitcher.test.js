// The Gameday Pitcher rail between innings of a live game (Gary, 2026-10-28): the half on screen
// has no play yet, so its first play's matchup.pitcher (selectHalfStartingPitcher) is null and the
// rail drew blank. selectMoundPitcher names who takes the mound before that first pitch: the
// club's last pitcher from its previous half, or the probable starter before the game's first.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { selectMoundPitcher } from '../src/api/select.js'

// The live feed between the 2nd's halves: bottom 2 has not thrown a pitch.
const between = () => {
  const feed = buildFeed()
  feed.liveData.plays.allPlays = feed.liveData.plays.allPlays.filter((p) => !(p.about.inning === 2 && p.about.halfInning === 'bottom'))
  return feed
}

test('between innings, the rail names the club\'s pitcher from its previous half', () => {
  // bottom 2 is half index 3; the reader has finished top 2 (index 2).
  assert.equal(selectMoundPitcher(between(), 2, 'bottom', 2)?.id, 300)
})

test('once the half has a play, its own first pitcher wins', () => {
  assert.equal(selectMoundPitcher(buildFeed(), 2, 'top', 1)?.id, 201, 'the reliever who opened top 2')
})

test('before the game\'s first pitch, the probable starter', () => {
  const feed = buildFeed()
  feed.liveData.plays.allPlays = []
  feed.gameData.probablePitchers = { home: { id: 200 }, away: { id: 300 } }
  assert.equal(selectMoundPitcher(feed, 1, 'top', -1)?.id, 200, 'the home club pitches the top')
  assert.equal(selectMoundPitcher(feed, 1, 'bottom', 0)?.id, 300)
})

test('a half past the reader\'s reach names nobody', () => {
  assert.equal(selectMoundPitcher(between(), 2, 'bottom', 1), null)
})
