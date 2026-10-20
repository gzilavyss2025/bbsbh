// The "Glove and legs" card's model (#2316): six measures, who leads each, and the
// 4-of-6 rule that drops the card.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gloveFigure, gloveLegsModel } from '../src/lib/postseason/worldseries/scouting/gloveLegs.js'
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

test('the club order follows clubA and clubB', () => {
  const d = data(club({ oaa: 20 }), club({ oaa: 5 }))
  const ab = gloveLegsModel(d, { clubA: 158, clubB: 139 })[0]
  const ba = gloveLegsModel(d, { clubA: 139, clubB: 158 })[0]
  assert.deepEqual([ab.a, ab.b, ab.lead], [20, 5, 'a'])
  assert.deepEqual([ba.a, ba.b, ba.lead], [5, 20, 'b'])
})

test('figures round to one place only when they have a tail, and carry sign and unit', () => {
  const [oaa, , speed, sb, pct] = gloveLegsModel(data(club(), club()), { clubA: 158, clubB: 139 })
  assert.equal(gloveFigure(oaa, 12), '+12')
  assert.equal(gloveFigure(oaa, -3), '-3')
  assert.equal(gloveFigure(oaa, 3.4500000000000004), '+3.5')
  assert.equal(gloveFigure(speed, 27.300000000000004), '27.3')
  assert.equal(gloveFigure(sb, 148), '148')
  assert.equal(gloveFigure(pct, 79.10000000000001), '79.1%')
  assert.equal(gloveFigure(pct, 78), '78%')
})

test('the leader is picked on the figures as printed: a tie on screen has no leader', () => {
  const m = gloveLegsModel(data(club({ sprintSpeed: 27.31, oaa: 0.04 }), club({ sprintSpeed: 27.34, oaa: -0.04 })), { clubA: 158, clubB: 139 })
  assert.equal(m[2].lead, null)
  assert.equal(m[0].lead, null)
  assert.equal(m[0].a, 0)
  assert.equal(m[0].b, 0) // not -0: it must not print a sign
  assert.equal(gloveFigure(m[0], m[0].b), '0')
  assert.equal(gloveLegsModel(data(club({ sprintSpeed: 27.31 }), club({ sprintSpeed: 27.36 })), { clubA: 158, clubB: 139 })[2].lead, 'b')
})

test('same shape whatever the opponent', () => {
  const a = gloveLegsModel(data(club(), club()), { clubA: 158, clubB: 139 })
  const b = gloveLegsModel(data(club(), club(), club()), { clubA: 158, clubB: 114 })
  assert.deepEqual(a.map((r) => Object.keys(r)), b.map((r) => Object.keys(r)))
})

test('scoutingModel shows Glove and legs on both day types when the data is there', () => {
  const ids = (i) => scoutingModel(i).map((c) => c.id)
  assert.deepEqual(ids({ dayType: 'off', nineKeys: true, edges: [{}], gloveLegs: [{}] }), ['nine-keys', 'glove-legs', 'matchup-edges'])
  assert.deepEqual(scoutingModel({ dayType: 'off', gloveLegs: [{}] }), [{ id: 'glove-legs', label: 'Glove and legs' }])
  assert.deepEqual(ids({ dayType: 'off', nineKeys: true, edges: [{}], gloveLegs: null }), ['nine-keys', 'matchup-edges'])
  assert.deepEqual(ids({ dayType: 'game', edges: [{}], meetings: [{}], gloveLegs: [{}] }), ['matchup-edges', 'film-room', 'glove-legs'])
  assert.deepEqual(ids({ dayType: 'game', gloveLegs: null }), [])
})

test('a file from another season than the slate year gives no card', () => {
  const d = { season: 2026, ...data(club(), club()) }
  assert.equal(gloveLegsModel(d, { clubA: 158, clubB: 139, season: 2025 }), null)
  assert.equal(gloveLegsModel(d, { clubA: 158, clubB: 139, season: 2026 }).length, 6)
})

test('without a slate season the file season is not checked', () => {
  const d = { season: 2026, ...data(club(), club()) }
  assert.equal(gloveLegsModel(d, { clubA: 158, clubB: 139 }).length, 6)
})
