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

// --- the three surfaces the audit named (tab title, scorecard page, link card) ---

import { scheduleRoundLine, titleWithRound } from '../../src/lib/postseason/gameRound.js'
import { gameCardText } from '../../api/_lib/cards.js'

const row = (over = {}) => ({
  gameType: 'D',
  seriesGameNumber: 3,
  seriesDescription: 'AL Division Series',
  gameNumber: 1,
  teams: {
    away: { team: { id: 145, name: 'Chicago White Sox', abbreviation: 'CWS' }, leagueRecord: { wins: 2, losses: 1 } },
    home: { team: { id: 114, name: 'Cleveland Guardians', abbreviation: 'CLE', league: { id: 103 } } },
  },
  ...over,
})

test('a schedule row names its round from game type, home league and series game number', () => {
  assert.equal(scheduleRoundLine(row()), 'ALDS · Game 3')
  assert.equal(scheduleRoundLine(row({ seriesGameNumber: undefined })), 'ALDS')
  assert.equal(scheduleRoundLine(row({ gameType: 'R' })), '')
  assert.equal(scheduleRoundLine(null), '')
})

test('the tab title names the round after the matchup, and a regular-season title is unchanged', () => {
  assert.equal(titleWithRound('CWS @ CLE', 'Box score', 'ALDS · Game 3'), 'CWS @ CLE · ALDS · Game 3 · Box score')
  assert.equal(titleWithRound('CWS @ CLE', 'Box score', ''), 'CWS @ CLE · Box score')
})

test('the link card names the round in title and alt, with no series record', () => {
  const { title, alt } = gameCardText(row(), '2026-10-05')
  assert.match(title, /ALDS · Game 3/)
  assert.match(alt, /ALDS · Game 3/)
  for (const text of [title, alt]) assert.doesNotMatch(text, /leads|\d-\d|2-1|series/i)
})

test('a regular-season link card is unchanged, doubleheader suffix included', () => {
  const g = row({ gameType: 'R', seriesGameNumber: 3, gameNumber: 2 })
  const { title, alt } = gameCardText(g, '2026-09-05')
  assert.equal(title, 'Chicago White Sox @ Cleveland Guardians — Sep 5, 2026')
  assert.match(alt, /^CWS @ CLE — Sep 5, 2026 · Game 2$/)
})
