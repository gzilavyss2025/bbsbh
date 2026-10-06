// The old-game selectors (prompt 2a, `.scratch/old-games/survey-2a.md`): is the
// game played, is its record closed, and does an old played game have no
// play-by-play. All three read structural status and a play COUNT, never a
// score, so they are spoiler-free (ADR-0101).
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectIsPlayed, selectRecordIsClosed, selectHasNoPlayByPlay } from '../src/api/gamerecord/played.js'

const game = ({ detailed, abstract = 'Final', season = '1927', plays = 0 }) => ({
  gameData: { status: { detailedState: detailed, abstractGameState: abstract }, game: { season } },
  liveData: { plays: { allPlays: Array.from({ length: plays }, (_, i) => ({ atBatIndex: i })) } },
})

test('played: Final and Completed Early are true', () => {
  assert.equal(selectIsPlayed(game({ detailed: 'Final' })), true)
  assert.equal(selectIsPlayed(game({ detailed: 'Completed Early' })), true)
  assert.equal(selectIsPlayed(game({ detailed: 'Completed Early: Rain' })), true)
})

test('played: Postponed is false even when abstractGameState says Final', () => {
  assert.equal(selectIsPlayed(game({ detailed: 'Postponed', abstract: 'Final' })), false)
})

test('played: Forfeit and a game not started are false', () => {
  assert.equal(selectIsPlayed(game({ detailed: 'Forfeit' })), false)
  assert.equal(selectIsPlayed(game({ detailed: 'Forfeit: Unplayable' })), false)
  assert.equal(selectIsPlayed(game({ detailed: 'Scheduled', abstract: 'Preview' })), false)
  assert.equal(selectIsPlayed(null), false)
})

test('record closed: played and forfeit are true, postponed and not started are false', () => {
  assert.equal(selectRecordIsClosed(game({ detailed: 'Final' })), true)
  assert.equal(selectRecordIsClosed(game({ detailed: 'Forfeit' })), true)
  assert.equal(selectRecordIsClosed(game({ detailed: 'Forfeit: Unplayable' })), true)
  assert.equal(selectRecordIsClosed(game({ detailed: 'Postponed', abstract: 'Final' })), false)
  assert.equal(selectRecordIsClosed(game({ detailed: 'Scheduled', abstract: 'Preview' })), false)
})

test('no play-by-play: a 1927 played game with 0 plays is true', () => {
  assert.equal(selectHasNoPlayByPlay(game({ detailed: 'Final', season: '1927', plays: 0 })), true)
})

test('no play-by-play: a 1979 forfeit is false (not played)', () => {
  assert.equal(selectHasNoPlayByPlay(game({ detailed: 'Forfeit', season: '1979', plays: 0 })), false)
})

test('no play-by-play: a 1975 played game with 0 plays is false (the 1960 rule)', () => {
  assert.equal(selectHasNoPlayByPlay(game({ detailed: 'Final', season: '1975', plays: 0 })), false)
})

test('no play-by-play: a 1956 game with plays is false', () => {
  assert.equal(selectHasNoPlayByPlay(game({ detailed: 'Final', season: '1956', plays: 56 })), false)
})

test('no play-by-play: a game not started and a game with no season are false', () => {
  assert.equal(selectHasNoPlayByPlay(game({ detailed: 'Scheduled', abstract: 'Preview', season: '1927' })), false)
  assert.equal(selectHasNoPlayByPlay(game({ detailed: 'Final', season: null })), false)
})
