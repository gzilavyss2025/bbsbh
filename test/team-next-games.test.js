import test from 'node:test'
import assert from 'node:assert/strict'

// The Games band of the one-scroll team page (#1107, row 6b): the count tag over the grid.
const { gamesTag } = await import('../src/screens/team/next/games/gamesData.js')

const rows = (n, type = 'R') => Array.from({ length: n }, () => ({ gameType: type }))

test('gamesTag counts the decided games', () => {
  assert.equal(gamesTag(rows(162)), '162 games')
  assert.equal(gamesTag(rows(1)), '1 game')
})

test('gamesTag says when the count includes the postseason', () => {
  assert.equal(gamesTag([...rows(162), ...rows(9, 'D')]), '171 games · 9 postseason')
})
