// The new player page's jump-bar sections (src/screens/player/next/sections.js, #1884).
import test from 'node:test'
import assert from 'node:assert/strict'
import { jumpSections } from '../src/screens/player/next/sections.js'

const keys = (list) => list.map((s) => s.key)
const hit = { group: 'hitting', seasonGames: 151 }
const pit = { group: 'pitching', seasonGames: 22 }

test('a batter gets the nine batter sections, in order', () => {
  assert.deepEqual(
    jumpSections({ isPitcher: false }, [hit]).map((s) => s.label),
    ['Overview', 'Season', 'Splits', 'Plate approach', 'Contact', 'Form trend', 'Game log', 'Career', 'History'],
  )
})

test('a pitcher gets the pitcher bar', () => {
  assert.deepEqual(
    jumpSections({ isPitcher: true }, [pit]).map((s) => s.label),
    ['Overview', 'Season', 'Pitches', 'Splits', 'On the mound', 'Form trend', 'Game log', 'Career', 'History'],
  )
})

test('a two-way player gets the batter sections, then the pitcher-only ones', () => {
  const list = keys(jumpSections({ isPitcher: true, twoWay: true }, [hit, pit]))
  assert.equal(list.length, 11)
  assert.deepEqual(list.slice(-2), ['pitches', 'on-the-mound'])
  assert.equal(new Set(list).size, list.length)
})

test('the game log shows its season game total, and hides when no block has games', () => {
  assert.equal(jumpSections({}, [hit]).find((s) => s.key === 'game-log').count, 151)
  assert.ok(!keys(jumpSections({}, [{ group: 'hitting', seasonGames: 0 }])).includes('game-log'))
  assert.ok(keys(jumpSections({}, [{ group: 'hitting', seasonGames: 0 }, pit])).includes('game-log'))
})

test('a pitcher with no stat block yet still gets the pitcher bar, with no counts', () => {
  const list = jumpSections({ isPitcher: true }, [])
  assert.ok(keys(list).includes('pitches'))
  assert.ok(list.every((s) => s.count === undefined))
})
