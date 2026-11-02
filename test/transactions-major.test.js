// Unit coverage for the wire's major/minor rule (src/api/transactions/major.js):
// which moves are a full card and which are one line. The thresholds behind
// the two id lists live in scripts/wire/gen-notable-players.mjs; this pins how the
// lists, the move type and the favorite team combine.
import assert from 'node:assert/strict'
import test from 'node:test'
import { isMajorMove, notableLists } from '../src/api/transactions/major.js'

const lists = notableLists({ star: [1], notable: [2] })
const story = (over = {}) => ({
  teamId: 110,
  codes: ['SC'],
  rail: [{ playerId: 3 }],
  cutline: [{ text: 'Placed RHP ' }, { text: 'Nobody', playerId: 3 }, { text: ' on the 15-day injured list.' }],
  ...over,
})

test('a nobody on the injured list is a line', () => {
  assert.equal(isMajorMove(story(), { lists, favoriteTeamId: 158 }), false)
})

test("a star's move is a card whatever it is", () => {
  assert.equal(isMajorMove(story({ rail: [{ playerId: 1 }] }), { lists, favoriteTeamId: 158 }), true)
})

test("the favorite team's routine move is a card", () => {
  assert.equal(isMajorMove(story({ teamId: 158 }), { lists, favoriteTeamId: 158 }), true)
})

test('the favorite team as the other club in a trade is a card', () => {
  const trade = story({
    codes: ['TR'],
    cutline: [{ text: 'Acquired ' }, { text: 'Nobody', playerId: 3 }, { text: ' from the ' }, { text: 'Brewers', teamId: 158 }],
  })
  assert.equal(isMajorMove(trade, { lists, favoriteTeamId: 158 }), true)
})

test("a notable player's routine move is a line", () => {
  assert.equal(isMajorMove(story({ rail: [{ playerId: 2 }] }), { lists, favoriteTeamId: 158 }), false)
})

test("a notable player's newsworthy move is a card", () => {
  for (const code of ['TR', 'SFA', 'SGN', 'CLW', 'REL', 'DES', 'RET']) {
    assert.equal(isMajorMove(story({ codes: [code], rail: [{ playerId: 2 }] }), { lists, favoriteTeamId: 158 }), true, code)
  }
})

test('a minor-league contract is never news on its own', () => {
  const deal = story({
    codes: ['SFA'],
    rail: [{ playerId: 2 }],
    cutline: [{ text: 'Signed free agent RHP ' }, { text: 'Vet', playerId: 2 }, { text: ' to a minor league contract.' }],
  })
  assert.equal(isMajorMove(deal, { lists, favoriteTeamId: 158 }), false)
})

test('a player named only in the cutline still counts', () => {
  const s = story({ rail: [], cutline: [{ text: 'Released ' }, { text: 'Star', playerId: 1 }] })
  assert.equal(isMajorMove(s, { lists, favoriteTeamId: 158 }), true)
})

test('with no lists loaded every move is a line, except the favorite team', () => {
  const none = notableLists(null)
  assert.equal(isMajorMove(story({ rail: [{ playerId: 1 }] }), { lists: none, favoriteTeamId: 158 }), false)
  assert.equal(isMajorMove(story({ teamId: 158 }), { lists: none, favoriteTeamId: 158 }), true)
})
