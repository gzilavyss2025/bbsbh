// The player page's Pitches and Command scope (#1503): Regular, Postseason, All.
// All is the sum of the two parts (ADR-0094), and nothing is written over.
import test from 'node:test'
import assert from 'node:assert/strict'
import { combineCommandEntries } from '../src/lib/seasons/combine.js'
import { commandView } from '../src/api/command/map.js'
import { absChallengesPath, parseRoute } from '../src/lib/route.js'

const cells = (n) => Array.from({ length: 25 }, (_, i) => (i === 12 ? n : 0))

test('command: two buckets add cell by cell, a missing field adds zeros', () => {
  const reg = { throws: 'R', mlb: { FF: { R: { cells: cells(5), whiffs: cells(1) } } }, aaa: {} }
  const post = { throws: 'R', mlb: { FF: { R: { cells: cells(3) } }, SL: { L: { cells: cells(2) } } }, aaa: {} }
  const all = combineCommandEntries([reg, post])
  assert.equal(all.mlb.FF.R.cells[12], 8)
  assert.equal(all.mlb.FF.R.whiffs[12], 1)
  assert.equal(all.mlb.SL.L.cells[12], 2)
  assert.equal(commandView(reg).pitches + commandView(post).pitches, commandView(all).pitches)
  // The inputs are untouched.
  assert.equal(reg.mlb.FF.R.cells[12], 5)
  assert.equal(combineCommandEntries([null, null]), null)
})

test('the scope rides the address: absent is Regular, a bad value is dropped', () => {
  // /abs-challenges keeps the pitch scope; the player tab that also took it is gone (#1898).
  const at = (qs) => parseRoute(`/abs-challenges${qs}`)
  assert.equal('scope' in at(''), false)
  assert.equal(at('?scope=post').scope, 'post')
  assert.equal(at('?scope=all').scope, 'all')
  assert.equal('scope' in at('?scope=bogus'), false)
  assert.match(absChallengesPath({ scope: 'post' }), /\?scope=post$/)
  assert.doesNotMatch(absChallengesPath({ scope: 'reg' }), /scope/)
})
