import test from 'node:test'
import assert from 'node:assert/strict'
import { rankCount } from '../src/screens/team/next/ranks/ranksData.js'

// The Ranks band's jump-bar count is the number of rank cells it shows (#1107, row 6a).
test('rankCount is the rank cells on screen', () => {
  assert.equal(rankCount({ batting: new Array(9), pitching: new Array(13) }), 22)
  assert.equal(rankCount({ batting: null, pitching: null }), 0)
  assert.equal(rankCount(null), 0)
})
