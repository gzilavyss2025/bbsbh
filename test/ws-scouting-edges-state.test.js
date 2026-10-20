// edgesState: the Matchup edges card tells "a row, but no standout" from "no row" (#2316, #2332).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edgesState } from '../src/lib/postseason/worldseries/scouting/edgesState.js'
import { scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'
import { CAREER_MATCHUPS_FALLBACK, starterMatchupsFor } from '../src/api/careerMatchups.js'

const ids = (cards) => cards.map((c) => c.id)
const side = { pitcher: { id: 1, name: 'P' }, batters: [{ id: 2, name: 'B', ab: 3, h: 0, hr: 0, bb: 0, hbp: 0, k: 1, pa: 3, levels: [] }] }

test('edges present: edges, with or without a row flag', () => {
  assert.equal(edgesState({ edges: [{ id: 2 }], hasRow: true }), 'edges')
  assert.equal(edgesState({ edges: [{ id: 2 }], hasRow: false }), 'edges')
})

test('row but no edge: none', () => {
  assert.equal(edgesState({ edges: [], hasRow: true }), 'none')
})

test('no row: absent', () => {
  assert.equal(edgesState({ edges: [], hasRow: false }), 'absent')
  assert.equal(edgesState({}), 'absent')
})

test('the file fallback has no row in either club order', () => {
  const hasRow = [158, 139].some((id) => starterMatchupsFor(CAREER_MATCHUPS_FALLBACK, 849805, id))
  assert.equal(edgesState({ edges: [], hasRow }), 'absent')
})

test('a row for either club order counts', () => {
  const data = { matchups: { 849805: { sides: { 139: side } } } }
  for (const order of [[158, 139], [139, 158]]) {
    const hasRow = order.some((id) => starterMatchupsFor(data, 849805, id))
    assert.equal(edgesState({ edges: [], hasRow }), 'none')
  }
})

test('the card list keeps the card for none and drops it for absent', () => {
  assert.deepEqual(ids(scoutingModel({ dayType: 'off', edges: [], edgesRow: true })), ['matchup-edges'])
  assert.deepEqual(ids(scoutingModel({ dayType: 'off', edges: [], edgesRow: false })), [])
})
