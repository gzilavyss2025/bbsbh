import test from 'node:test'
import assert from 'node:assert/strict'
import { gameLogDoorLabel } from '../src/screens/player/overviewPreview.js'

test('the door counts the season, not the 3 rows the preview shows', () => {
  assert.equal(gameLogDoorLabel(42), 'Game log, splits & career · 42 games')
})

test('one game is singular', () => {
  assert.equal(gameLogDoorLabel(1), 'Game log, splits & career · 1 game')
})

test('a missing/zero count reads as zero rather than "NaN games"', () => {
  assert.equal(gameLogDoorLabel(0), 'Game log, splits & career · 0 games')
  assert.equal(gameLogDoorLabel(null), 'Game log, splits & career · 0 games')
  assert.equal(gameLogDoorLabel(undefined), 'Game log, splits & career · 0 games')
})
