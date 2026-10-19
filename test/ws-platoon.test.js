// The "Platoon" card's model (#2316): each club's lineup OPS against right- and left-handers, the
// leader of each block (on the rounded figure), and the hand each club faces in the next game.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { facedHands, platoonModel } from '../src/lib/postseason/worldseries/scouting/platoon.js'
import { scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'

// Game 3: Rays (139) away, Brewers (158) home. The Rays' probable throws left, the Brewers' right.
// So the Rays face a right-hander and the Brewers face a left-hander.
const game = { awayId: 139, homeId: 158, away: { id: 1, hand: 'L' }, home: { id: 2, hand: 'R' } }
const ops = { 158: { R: 0.706, L: 0.828 }, 139: { R: 0.72, L: 0.7 } }
const input = (o = {}) => ({ clubA: 139, clubB: 158, game, gameNumber: 3, ...o })
const cell = (m, hand, club) => m.find((b) => b.hand === hand).cells.find((c) => c.clubId === club)

test('facedHands: a club faces the other club probable hand', () => {
  assert.deepEqual(facedHands(game), { 139: 'R', 158: 'L' })
})

test('facedHands: no probable, no hand, no game', () => {
  assert.deepEqual(facedHands({ ...game, home: null }), { 139: '', 158: 'L' })
  assert.deepEqual(facedHands({ ...game, away: { id: 1, hand: '' } }), { 139: 'R', 158: '' })
  assert.deepEqual(facedHands(null), {})
})

test('two blocks, right-handers then left-handers, one cell per club in the given order', () => {
  const m = platoonModel(ops, input())
  assert.deepEqual(m.map((b) => b.hand), ['R', 'L'])
  assert.deepEqual(m.map((b) => b.title), ['vs right-handers', 'vs left-handers'])
  assert.deepEqual(m[0].cells.map((c) => c.clubId), [139, 158])
  assert.equal(cell(m, 'R', 158).ops, 0.706)
})

test('the leader is the higher OPS; a tie leads for nobody', () => {
  const m = platoonModel(ops, input())
  assert.equal(cell(m, 'R', 139).lead, true)
  assert.equal(cell(m, 'R', 158).lead, false)
  assert.equal(cell(m, 'L', 158).lead, true)
  const tie = platoonModel({ 158: { R: 0.7, L: 0.8 }, 139: { R: 0.7, L: 0.8 } }, input())
  assert.ok(tie.flatMap((b) => b.cells).every((c) => !c.lead))
})

test('the leader is picked on the rounded value', () => {
  const m = platoonModel({ 158: { R: 0.7004, L: 0.8 }, 139: { R: 0.6996, L: 0.7 } }, input())
  assert.ok(m[0].cells.every((c) => !c.lead))
})

test('the hand a club faces marks its cell and says which game', () => {
  const m = platoonModel(ops, input())
  assert.equal(cell(m, 'R', 139).faces, true)
  assert.equal(cell(m, 'R', 158).faces, false)
  assert.equal(cell(m, 'L', 158).faces, true)
  assert.equal(cell(m, 'R', 139).caption, 'Faces a right-hander in Game 3')
  assert.equal(cell(m, 'L', 158).caption, 'Faces a left-hander in Game 3')
  assert.equal(cell(m, 'R', 158).caption, 'Regular season')
})

test('with no probable hand no cell is marked', () => {
  const m = platoonModel(ops, input({ game: null }))
  assert.ok(m.flatMap((b) => b.cells).every((c) => !c.faces))
})

test('no data for a club, or for a hand, drops the card or the block', () => {
  assert.equal(platoonModel(null, input()), null)
  assert.equal(platoonModel({ 158: ops[158] }, input()), null)
  assert.equal(platoonModel({ 158: { R: 0.7, L: null }, 139: { R: 0.7, L: null } }, input()).length, 1)
  assert.equal(platoonModel({ 158: { R: 0.7, L: 0.8 }, 139: { R: null, L: null } }, input()), null)
})

test('the card is on both day types, rank 5 off day and 4 on a game day', () => {
  const all = { nineKeys: true, gloveLegs: [1], edges: [1], pitchByPitch: {}, plateUmpire: { name: 'A' }, meetings: [1], platoon: [1] }
  const off = scoutingModel({ dayType: 'off', ...all }).map((c) => c.id)
  const gameDay = scoutingModel({ dayType: 'game', ...all }).map((c) => c.id)
  assert.equal(off.indexOf('platoon'), off.indexOf('pitch-by-pitch') + 1)
  assert.equal(gameDay.indexOf('platoon'), gameDay.indexOf('pitch-by-pitch') + 1)
  assert.ok(!scoutingModel({ dayType: 'off', ...all, platoon: null }).some((c) => c.id === 'platoon'))
})

// The Stats API team split read (checked live 2026-10-19, /teams/158/stats?stats=statSplits&sitCodes=vl,vr):
// stats[0].splits[] = { split: { code: 'vl' | 'vr' }, stat: { ops: '.828' } }.
test('shapePlatoon reads OPS by the split code, as a number', async () => {
  const { shapePlatoon, platoonUrl } = await import('../src/api/scout/seriesFit.js')
  const data = { stats: [{ splits: [{ split: { code: 'vl' }, stat: { ops: '.828' } }, { split: { code: 'vr' }, stat: { ops: '.706' } }] }] }
  assert.deepEqual(shapePlatoon(data), { L: 0.828, R: 0.706 })
  assert.deepEqual(shapePlatoon({ stats: [{ splits: [{ split: { code: 'vr' }, stat: { ops: '.---' } }] }] }), { L: null, R: null })
  assert.deepEqual(shapePlatoon(null), { L: null, R: null })
  assert.match(platoonUrl(158, 2026), /teams\/158\/stats\?.*sitCodes=vl,vr.*gameType=R/)
})
