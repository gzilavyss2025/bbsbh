import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameSectionTabs } from '../src/screens/lineup/gameSections.js'

const game = { away: { abbreviation: 'MIL' }, home: { abbreviation: 'LAD' } }

test('the stops run away, home, innings, box, scorecard', () => {
  const tabs = gameSectionTabs(game, 0, 'top1')
  assert.deepEqual(tabs.map((t) => t.label), ['MIL', 'LAD', 'Innings', 'Box', 'Scorecard'])
  assert.deepEqual(tabs.map((t) => t.section), ['lineup1', 'lineup2', 'top1', 'boxscore', 'scorecard'])
})

test('only the stop for the current step is active', () => {
  assert.deepEqual(gameSectionTabs(game, 1, 'top1').filter((t) => t.active).map((t) => t.key), ['home'])
  assert.deepEqual(gameSectionTabs(game, 6, 'top1').filter((t) => t.active).map((t) => t.key), ['scorecard'])
})

test('Innings returns to the last half-inning seen', () => {
  assert.equal(gameSectionTabs(game, 3, 'bot4').find((t) => t.key === 'innings').section, 'bot4')
})
