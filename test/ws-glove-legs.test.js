// The "Glove and legs" card's model (#2316): six measures, who leads each, and the
// 4-of-6 rule that drops the card.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gloveLegsModel } from '../src/lib/postseason/worldseries/scouting/gloveLegs.js'
import { scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'

const club = (o = {}) => ({ oaa: 10, framingRuns: 2, sprintSpeed: 27, stolenBases: 100, stolenBaseSuccess: 78, extraBasesTaken: 40, ...o })
const data = (a, b, c = club()) => ({ clubs: { 158: a, 139: b, 114: c } })
const lead = (m) => Object.fromEntries(m.map((r) => [r.key, r.lead]))

test('six measures in order, Defense then Running, with the leader of each', () => {
  const m = gloveLegsModel(data(club({ oaa: 20, stolenBases: 90 }), club({ framingRuns: 5 })), { clubA: 158, clubB: 139 })
  assert.deepEqual(m.map((r) => r.key), ['oaa', 'framingRuns', 'sprintSpeed', 'stolenBases', 'stolenBaseSuccess', 'extraBasesTaken'])
  assert.deepEqual(m.map((r) => r.group), ['Defense', 'Defense', 'Running', 'Running', 'Running', 'Running'])
  assert.equal(m[0].a, 20)
  assert.equal(m[0].b, 10)
  assert.deepEqual(lead(m), { oaa: 'a', framingRuns: 'b', sprintSpeed: null, stolenBases: 'b', stolenBaseSuccess: null, extraBasesTaken: null })
})

test('a tie leads for nobody', () => {
  assert.equal(gloveLegsModel(data(club(), club()), { clubA: 158, clubB: 139 })[0].lead, null)
})

test('a null on one side leads for nobody and keeps the other value', () => {
  const m = gloveLegsModel(data(club({ oaa: null }), club()), { clubA: 158, clubB: 139 })
  assert.equal(m[0].a, null)
  assert.equal(m[0].b, 10)
  assert.equal(m[0].lead, null)
})

test('three real measures give no card, four give it', () => {
  const nulls = (n) => club(Object.fromEntries(['oaa', 'framingRuns', 'sprintSpeed'].slice(0, n).map((k) => [k, null])))
  assert.equal(gloveLegsModel(data(nulls(3), club()), { clubA: 158, clubB: 139 }), null)
  assert.equal(gloveLegsModel(data(club(), nulls(3)), { clubA: 158, clubB: 139 }), null)
  assert.equal(gloveLegsModel(data(nulls(2), club()), { clubA: 158, clubB: 139 }).length, 6)
})

test('no file or a missing club gives no card', () => {
  assert.equal(gloveLegsModel(null, { clubA: 158, clubB: 139 }), null)
  assert.equal(gloveLegsModel({ clubs: {} }, { clubA: 158, clubB: 139 }), null)
})

test('same shape whatever the opponent', () => {
  const a = gloveLegsModel(data(club(), club()), { clubA: 158, clubB: 139 })
  const b = gloveLegsModel(data(club(), club(), club()), { clubA: 158, clubB: 114 })
  assert.deepEqual(a.map((r) => Object.keys(r)), b.map((r) => Object.keys(r)))
})

test('scoutingModel shows Glove and legs on an off day only when the data is there', () => {
  const ids = (i) => scoutingModel(i).map((c) => c.id)
  assert.deepEqual(ids({ dayType: 'off', nineKeys: true, edges: [{}], gloveLegs: [{}] }), ['nine-keys', 'glove-legs', 'matchup-edges'])
  assert.deepEqual(scoutingModel({ dayType: 'off', gloveLegs: [{}] }), [{ id: 'glove-legs', label: 'Glove and legs' }])
  assert.deepEqual(ids({ dayType: 'off', nineKeys: true, edges: [{}], gloveLegs: null }), ['nine-keys', 'matchup-edges'])
  assert.deepEqual(ids({ dayType: 'game', gloveLegs: [{}] }), [])
})
