// THE CLASSIC CARD'S FACTS (issue #1525, slice 2) — one reason line, and the
// proof that the request for it cannot carry a score.
import assert from 'node:assert/strict'
import test from 'node:test'
import { CLASSIC_FIELDS, classicFactsUrl, classicFacts, fetchClassicFacts } from '../src/api/classics/reason.js'

// A real response, fetched 2026-10-21 with CLASSIC_FIELDS for gamePk 180442
// (MIL @ CAL, 1980-10-01), trimmed to two names a side. Copied, not typed.
const RESPONSE = {"dates":[{"games":[{"gamePk":180442,"teams":{"away":{"team":{"id":158,"name":"Milwaukee Brewers"}},"home":{"team":{"id":108,"name":"California Angels"}}},"venue":{"id":1,"name":"Anaheim Stadium"},"lineups":{"homePlayers":[{"id":119109,"fullName":"Rick Miller"},{"id":123309,"fullName":"Dickie Thon"}],"awayPlayers":[{"id":119236,"fullName":"Paul Molitor"},{"id":124721,"fullName":"Robin Yount"}]}}]}]}
const row = () => structuredClone(RESPONSE).dates[0].games[0]

test('the card reads clubs, park and a leadoff line from the starting lineups', () => {
  const f = classicFacts(row())
  assert.deepEqual(f.away, { id: 158, name: 'Milwaukee Brewers' })
  assert.deepEqual(f.home, { id: 108, name: 'California Angels' })
  assert.equal(f.venue, 'Anaheim Stadium')
  assert.equal(f.reason, 'Paul Molitor leads off for the Milwaukee Brewers.')
})

test('no lineup in the record gives no reason line, not an invented one', () => {
  const g = row()
  delete g.lineups
  assert.equal(classicFacts(g).reason, null)
  assert.equal(classicFacts(null), null)
})

test('the reason names a lineup fact and no word of the game itself', () => {
  const { reason } = classicFacts(row())
  assert.doesNotMatch(reason, /\b(won|lost|beat|homer|score|run|inning|final|hit)\b/i)
})

test('the request names a field list and no score key can come back', async () => {
  const url = classicFactsUrl(180442)
  assert.ok(url.includes(`fields=${CLASSIC_FIELDS}`), url)
  assert.match(url, /gamePks=180442/)
  assert.match(url, /hydrate=lineups(&|$)/)
  assert.ok(!/linescore|decisions|score/.test(url.replace(CLASSIC_FIELDS, '')), url)
  assert.ok(!/score|isWinner|leagueRecord|decisions/.test(CLASSIC_FIELDS))
  let asked
  const f = await fetchClassicFacts(180442, async (u) => ((asked = u), RESPONSE))
  assert.equal(asked, url)
  assert.equal(f.venue, 'Anaheim Stadium')
})
