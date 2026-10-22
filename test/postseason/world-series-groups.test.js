// The live World Series page's jump-bar groups (layout C): a group with no data drops with its button.
import assert from 'node:assert/strict'
import test from 'node:test'
import { seriesGroups } from '../../src/lib/postseason/worldseries/groups.js'

const all = { now: true, series: true, scout: true, compare: true, rosters: true }

test('every group has data: the five, in order', () => {
  assert.deepEqual(seriesGroups(all).map((g) => g.key), ['now', 'series', 'scout', 'compare', 'rosters'])
  assert.deepEqual(seriesGroups(all).map((g) => g.label), ['Now', 'Series', 'Scout', 'Compare', 'Rosters'])
})

test('a group with no data drops, the rest keep their order', () => {
  assert.deepEqual(seriesGroups({ ...all, now: false, scout: false }).map((g) => g.key), ['series', 'compare', 'rosters'])
})

test('nothing known yet: no groups', () => {
  assert.deepEqual(seriesGroups({}), [])
})
