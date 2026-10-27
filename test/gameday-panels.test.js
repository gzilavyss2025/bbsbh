// Gameday's panel data (#2661 review): the cut each panel reads at the reader's cursor.
// Pinned on 824716 SEA@BOS (test/fixtures/game-824716.gameday.json). Top 7: entries 0 and 1 are
// the home club's defensive changes, 2 the first at-bat (see gameday-defense.test.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chipCode, cutAt, orderAt } from '../src/screens/gameday/next/panels/panelData.js'

const feed = JSON.parse(readFileSync(new URL('./fixtures/game-824716.gameday.json', import.meta.url), 'utf8'))

test('a called third strike reads K, never blank', () => {
  assert.equal(chipCode({ code: '', calledLooking: true }), 'K')
  assert.equal(chipCode({ code: '6-3' }), '6-3')
})

test('a half whose first entry is a note still shows its first at-bat at step 1', () => {
  const cut = cutAt(feed, 7, 'top', 1)
  assert.equal(cut.cards.length, 1)
})

test('the sealed chip: only while a stepped half has plays left', () => {
  assert.equal(cutAt(feed, 2, 'top', 2).more, true)
  assert.equal(cutAt(feed, 2, 'top', null).more, false)
})

test('the order keeps every at-bat, a substitute with his slot', () => {
  const cut = cutAt(feed, 9, 'bottom', null)
  const rows = orderAt(feed, 'home', 9, 'bottom', 17, cut.cards)
  assert.equal(rows.length, 9)
  assert.equal(rows.flatMap((r) => r.codes).length, cut.cards.length)
})

test('the order names no one before the half is reachable', () => {
  assert.deepEqual(orderAt(feed, 'home', 9, 'bottom', 0, []), [])
})
