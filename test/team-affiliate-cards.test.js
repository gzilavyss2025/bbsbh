// Coverage for affiliateCardsFrom (src/screens/team/data/shared.js) — the
// Minors tab's Affiliates section card list. Issue #850: an org's Rookie/
// complex-level clubs (ACL/FCL/DSL, sportId 16) were fetched by
// loadMinors.js (via fetchComplexAffiliates) but never forwarded into the
// rendered card list, so they never showed as their own affiliate cards.
import assert from 'node:assert/strict'
import test from 'node:test'
import { affiliateCardsFrom } from '../src/screens/team/data/shared.js'

const AAA = { id: 341, name: 'Nashville Sounds', sportId: 11, city: 'Nashville', state: 'TN' }
const A_PLUS = { id: 342, name: 'Wisconsin Timber Rattlers', sportId: 13, city: 'Grand Chute', state: 'WI' }
const ACL = { id: 9001, name: 'ACL Brewers', sportId: 16, city: 'Phoenix', state: 'AZ' }
const DSL1 = { id: 9002, name: 'DSL Brewers1', sportId: 16, city: '', state: '' }
const DSL2 = { id: 9003, name: 'DSL Brewers2', sportId: 16, city: '', state: '' }

test('an MLB org\'s card list is full-season affiliates followed by its Rookie/complex clubs', () => {
  const team = { id: 158, sport: { id: 1 } }
  const cards = affiliateCardsFrom(team, false, [AAA, A_PLUS], [ACL])
  assert.deepEqual(cards.map((c) => c.id), [AAA.id, A_PLUS.id, ACL.id])
})

// The whole point of fetchComplexAffiliates being a separate fetch: an org
// can field more than one Rookie-level club at once (ACL/FCL + DSL, and
// sometimes two DSL clubs), unlike every other level's one-club shape.
test('every current Rookie/complex club renders as its own card, not just one', () => {
  const team = { id: 147, sport: { id: 1 } }
  const cards = affiliateCardsFrom(team, false, [AAA], [ACL, DSL1, DSL2])
  assert.deepEqual(cards.map((c) => c.id), [AAA.id, ACL.id, DSL1.id, DSL2.id])
})

test('an org with no full-season affiliates still shows its Rookie/complex clubs', () => {
  const team = { id: 200, sport: { id: 1 } }
  const cards = affiliateCardsFrom(team, false, [], [ACL, DSL1])
  assert.deepEqual(cards.map((c) => c.id), [ACL.id, DSL1.id])
})

// On a MiLB affiliate's own page, the parent MLB club leads the whole list —
// ahead of the full-season affiliates AND the Rookie/complex clubs.
test('a MiLB affiliate page leads with the parent MLB club, then affiliates, then Rookie/complex clubs', () => {
  const team = { id: 341, sport: { id: 11 }, parentOrgId: 158, parentOrgName: 'Milwaukee Brewers' }
  const cards = affiliateCardsFrom(team, true, [A_PLUS], [ACL])
  assert.deepEqual(cards.map((c) => c.id), [158, A_PLUS.id, ACL.id])
  assert.deepEqual(cards[0], { id: 158, sportId: 1, name: 'Milwaukee Brewers', city: '', state: '' })
})

test('a MiLB team with no parent org gets no parent card (hiddenTeamTabs hides the whole tab anyway)', () => {
  const team = { id: 999, sport: { id: 11 }, parentOrgId: null }
  const cards = affiliateCardsFrom(team, true, [], [])
  assert.deepEqual(cards, [])
})

test('an MLB org with no affiliates of any kind renders an empty list rather than throwing', () => {
  const team = { id: 999, sport: { id: 1 } }
  assert.deepEqual(affiliateCardsFrom(team, false, [], []), [])
})
