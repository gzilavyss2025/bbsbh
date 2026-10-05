// The round a postseason game belongs to, as words: "ALDS", "NLCS", "World Series",
// "AL Wild Card", plus "Game 3" once the schedule's series game number is in hand.
// The print sheet and the preview poster print it. Both are pregame facts: the feed
// names the round and the home club's league (checked live, gamePk 849829: type 'D',
// home league 103), and the schedule names the game number. Never a series record,
// which is a result (ADR-0087).
import assert from 'node:assert/strict'
import test from 'node:test'
import { feedRoundName, roundLine } from '../../src/lib/postseason/gameRound.js'

const feed = (type, leagueId) => ({
  gameData: { game: { type }, teams: { home: { league: leagueId ? { id: leagueId } : undefined } } },
})

test('each postseason round is named from the game type and the home club’s league', () => {
  assert.equal(feedRoundName(feed('F', 103)), 'AL Wild Card')
  assert.equal(feedRoundName(feed('F', 104)), 'NL Wild Card')
  assert.equal(feedRoundName(feed('D', 103)), 'ALDS')
  assert.equal(feedRoundName(feed('D', 104)), 'NLDS')
  assert.equal(feedRoundName(feed('L', 103)), 'ALCS')
  assert.equal(feedRoundName(feed('L', 104)), 'NLCS')
  assert.equal(feedRoundName(feed('W', 103)), 'World Series')
})

test('a regular-season, spring, All-Star or missing game has no round', () => {
  for (const type of ['R', 'S', 'A', 'E', undefined]) assert.equal(feedRoundName(feed(type, 103)), '')
  assert.equal(feedRoundName(null), '')
  assert.equal(feedRoundName({}), '')
})

test('a round with no league on file falls back to the plain round name, never "undefined"', () => {
  assert.equal(feedRoundName(feed('D', null)), 'Division Series')
  assert.equal(feedRoundName(feed('F', null)), 'Wild Card')
  assert.equal(feedRoundName(feed('L', null)), 'League Championship Series')
  assert.equal(feedRoundName(feed('W', null)), 'World Series')
})

test('the line adds the game number when it is known, and nothing when there is no round', () => {
  assert.equal(roundLine('ALDS', 3), 'ALDS · Game 3')
  assert.equal(roundLine('ALDS', null), 'ALDS')
  assert.equal(roundLine('World Series', 7), 'World Series · Game 7')
  assert.equal(roundLine('', 3), '')
})
