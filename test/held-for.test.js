// heldFor: UI state held for one list reads as fresh against any other (issue #2934's review).
// The long at-bats card holds its club filter and its picked row this way, so a new census
// (a season change, new data) starts with no club and the first row picked. A club held from the
// old file, absent from the new one, filtered the list to nothing and the card threw on its top row.
import assert from 'node:assert/strict'
import test from 'node:test'
import { heldFor } from '../src/lib/react/heldFor.js'
import { atBatsForClub } from '../src/api/notebook.js'

// The card's own reading: the held club and pick, or none and the first row.
const read = (held, list) => (heldFor(held, list) ? held : { club: null, pick: 0 })
const row = (batter, pitcher) => ({ batter: { teamId: batter }, pitcher: { teamId: pitcher } })

test('a selection held for this list is kept', () => {
  const list = [row(158, 112)]
  assert.equal(heldFor({ list, club: 158, pick: 3 }, list), true)
})

test('a selection held for another list reads as fresh, so a new census never filters to nothing', () => {
  const old = [row(158, 112), row(145, 114)]
  const next = [row(145, 114), row(114, 145)]
  const held = { list: old, club: 158, pick: 1 }
  assert.equal(heldFor(held, next), false)
  const { club, pick } = read(held, next)
  assert.equal(club, null)
  assert.equal(pick, 0)
  assert.equal(atBatsForClub(next, club).length, 2)
  // the same file arriving again (a new array) is a new list too: the old filter does not come back
  assert.equal(heldFor(held, [...old]), false)
  assert.equal(heldFor({ list: null }, old), false) // nothing held yet
})
