// The wire's trade grade line (src/lib/trade/wireGrade.js): who went which way,
// and the editor's wording.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tradeParties, gradeLine } from '../src/lib/trade/wireGrade.js'
import { gradeOf } from '../src/lib/trade/value.js'

// The Royce Lewis trade as the wire's cutline segments carried it (2026-11-20).
const lewis = {
  teamId: 119,
  cutline: [
    { text: 'Acquired ' }, { text: '1B ' }, { text: 'Royce Lewis', playerId: 668904 }, { text: ' from the ' },
    { text: 'Minnesota Twins', teamId: 142 }, { text: ' for ' }, { text: 'C ' },
    { text: 'Francisco Espinoza', playerId: 821689 }, { text: ' and ' }, { text: 'RHP ' },
    { text: 'Bobby Miller', playerId: 676272 }, { text: '.' },
  ],
}

test('the players before "for" came to the story\'s club; those after went to the other', () => {
  assert.deepEqual(tradeParties(lewis), { clubId: 119, otherId: 142, got: [668904], gave: [821689, 676272], cash: false, toBeNamed: false })
})

test('a cash deal and a player to be named are read off the sentence', () => {
  const cash = { teamId: 115, cutline: [{ text: 'Acquired RHP ' }, { text: 'Chase Lee', playerId: 1 }, { text: ' from the ' }, { text: 'Toronto Blue Jays', teamId: 141 }, { text: ' for cash.' }] }
  const p = tradeParties(cash)
  assert.deepEqual([p.got, p.gave, p.cash, p.toBeNamed], [[1], [], true, false])
  const ptbnl = { ...cash, cutline: [...cash.cutline.slice(0, 4), { text: ' for a player to be named later.' }] }
  assert.equal(tradeParties(ptbnl).toBeNamed, true)
})

test('a sentence with no other club is not a trade', () => {
  assert.equal(tradeParties({ teamId: 119, cutline: [{ text: 'Signed ' }, { text: 'X', playerId: 1 }, { text: '.' }] }), null)
})

test('the line leads with the winner and puts a caveat after a semicolon', () => {
  // +$40M is a B+; the other side's -$40M a C (value.js gradeOf).
  assert.equal(gradeLine({ club: 'Dodgers', other: 'Twins', valueUsd: 40e6 }, gradeOf), 'Dodgers B+, Twins C.')
  // The other club came out ahead: it leads.
  assert.equal(gradeLine({ club: 'Dodgers', other: 'Twins', valueUsd: -40e6 }, gradeOf), 'Twins B+, Dodgers C.')
  assert.equal(gradeLine({ club: 'Rockies', other: 'Blue Jays', valueUsd: 5e6, cash: true }, gradeOf), "Rockies B, Blue Jays B; the cash wasn't reported.")
  assert.equal(gradeLine({ club: 'Rays', other: 'Giants', valueUsd: 0, toBeNamed: true }, gradeOf), 'Rays B, Giants B; a player is still to be named.')
})
