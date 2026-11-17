// A full club name with the short nickname (#3175): "Arizona D-backs" fits half a phone card.
import assert from 'node:assert/strict'
import test from 'node:test'
import { shortenClubName } from '../src/lib/teams.js'

test('a club with a short nickname swaps it into its full name', () => {
  assert.equal(shortenClubName(109, 'Arizona Diamondbacks'), 'Arizona D-\u2060backs')
})

test('the shortened nickname cannot wrap at its hyphen', () => {
  assert.ok(/D-\u2060backs$/.test(shortenClubName(109, 'Arizona Diamondbacks')))
})

test('other clubs, MiLB ids and missing names pass through', () => {
  assert.equal(shortenClubName(158, 'Milwaukee Brewers'), 'Milwaukee Brewers')
  assert.equal(shortenClubName(109, 'Something Else'), 'Something Else')
  assert.equal(shortenClubName(null, 'Wisconsin Timber Rattlers'), 'Wisconsin Timber Rattlers')
  assert.equal(shortenClubName(109, null), null)
})
