import test from 'node:test'
import assert from 'node:assert/strict'
import { findChain } from '../src/lib/teammates/chain.js'

// Same shape as loadTeamSeasons(): `teamSeasons` rows hold indexes into `players`.
// Players 1-2 share Cubs 1998; 2-3 share Reds 2001; 3-4 share Mets 2005;
// player 9 sits alone on Padres 2010.
const data = {
  players: [1, 2, 3, 4, 9],
  teamSeasons: [
    ['CHN-1998', 'Cubs 1998', [0, 1]],
    ['CIN-2001', 'Reds 2001', [1, 2]],
    ['NYN-2005', 'Mets 2005', [2, 3]],
    ['SDN-2010', 'Padres 2010', [4]],
  ],
}

test('a direct pair is one link', () => {
  assert.deepEqual(findChain(data, 1, 2), [1, 'Cubs 1998', 2])
})

test('a three-link chain lists every player and team-season in order', () => {
  assert.deepEqual(findChain(data, 1, 4), [1, 'Cubs 1998', 2, 'Reds 2001', 3, 'Mets 2005', 4])
})

test('two players with no path give null', () => {
  assert.equal(findChain(data, 1, 9), null)
})

test('the same player twice is zero links', () => {
  assert.deepEqual(findChain(data, 2, 2), [2])
})

test('a player missing from the graph gives null', () => {
  assert.equal(findChain(data, 1, 777), null)
})

test('a chain longer than the limit gives null', () => {
  assert.equal(findChain(data, 1, 4, 2), null)
  assert.notEqual(findChain(data, 1, 4, 3), null)
})
