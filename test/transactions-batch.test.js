// One club's run of same-kind, one-player moves on one day reads as one card
// (src/components/transactions/combineMoves.js). Rows are the shape the wire's stories carry.
import assert from 'node:assert/strict'
import test from 'node:test'
import { combineBatches } from '../src/components/transactions/combineMoves.js'

const solo = (id, teamId, verb, pos, name, playerId, tail) => ({
  id,
  type: 'roster-move',
  typeLabel: 'Roster move',
  teamId,
  codes: ['SE'],
  moves: [{ id }],
  rail: [{ role: 'in', banner: 'In', playerId, name, pos }],
  cutline: [{ text: `${verb}${pos} ` }, { text: name, emphasis: 'primary', playerId }, ...tail],
})
const from = (club, clubId) => [{ text: ' from ' }, { text: club, teamId: clubId }, { text: '.' }]
const SEL = 'Selected the contract of '
const text = (story) => story.cutline.map((s) => s.text).join('')

test('a club-day of selections from two affiliates becomes one story, one clause per affiliate', () => {
  const out = combineBatches([
    solo('a', 109, SEL, 'LHP', 'Spencer Giesting', 1, from('Reno Aces', 2310)),
    solo('b', 109, SEL, 'RHP', 'Ashton Izzi', 2, from('Reno Aces', 2310)),
    solo('c', 109, SEL, 'CF', 'Druw Jones', 3, from('Amarillo Sod Poodles', 5368)),
    solo('d', 109, SEL, '2B', 'Cristofer Torin', 4, from('Amarillo Sod Poodles', 5368)),
  ])
  assert.equal(out.length, 1)
  assert.equal(
    text(out[0]),
    'Selected the contracts of LHP Spencer Giesting and RHP Ashton Izzi from Reno Aces; selected the contracts of CF Druw Jones and 2B Cristofer Torin from Amarillo Sod Poodles.',
  )
  assert.deepEqual(out[0].rail.map((r) => r.playerId), [1, 2, 3, 4])
  assert.deepEqual(out[0].moves.map((m) => m.id), ['a', 'b', 'c', 'd'])
  // Every name and club keeps its link.
  assert.equal(out[0].cutline.filter((s) => s.playerId).length, 4)
  assert.equal(out[0].cutline.filter((s) => s.teamId).length, 2)
})

test('different clubs, different actions and lone moves are left alone, in order', () => {
  const stories = [
    solo('a', 108, SEL, 'CF', 'Nelson Rada', 1, from('Salt Lake Bees', 561)),
    solo('b', 109, SEL, 'LHP', 'Spencer Giesting', 2, from('Reno Aces', 2310)),
    solo('c', 109, 'Optioned ', 'RHP', 'Ashton Izzi', 3, [{ text: ' to ' }, { text: 'Reno Aces', teamId: 2310 }, { text: '.' }]),
  ]
  assert.deepEqual(combineBatches(stories), stories)
})

test('the combined card sits where its first move was', () => {
  const out = combineBatches([
    solo('x', 108, SEL, 'CF', 'Nelson Rada', 9, from('Salt Lake Bees', 561)),
    solo('a', 109, SEL, 'LHP', 'Spencer Giesting', 1, from('Reno Aces', 2310)),
    solo('y', 147, 'Released ', 'RHP', 'Some One', 8, [{ text: '.' }]),
    solo('b', 109, SEL, 'RHP', 'Ashton Izzi', 2, from('Reno Aces', 2310)),
  ])
  assert.deepEqual(out.map((s) => s.teamId), [108, 109, 147])
  assert.equal(text(out[1]), 'Selected the contracts of LHP Spencer Giesting and RHP Ashton Izzi from Reno Aces.')
})

test('three names take commas and a final "and"; a multi-player story is never folded in', () => {
  const two = { ...solo('t', 109, 'Traded ', 'RHP', 'A B', 7, [{ text: '.' }]), rail: [{ playerId: 7 }, { playerId: 6 }] }
  const out = combineBatches([
    solo('a', 109, 'Released ', 'LHP', 'One', 1, [{ text: '.' }]),
    solo('b', 109, 'Released ', 'RHP', 'Two', 2, [{ text: '.' }]),
    two,
    solo('c', 109, 'Released ', 'C', 'Three', 3, [{ text: '.' }]),
  ])
  assert.equal(out.length, 2)
  assert.equal(text(out[0]), 'Released LHP One, RHP Two and C Three.')
  assert.equal(out[1], two)
})

test('November selections read as Rule 5 protection: one lead naming them all', () => {
  // The Brewers' adds, Nov. 17, 2026, from two affiliates.
  const day = [
    solo('a', 158, SEL, 'C', 'Matthew Wood', 1, from('Biloxi Shuckers', 5015)),
    solo('b', 158, SEL, '2B', "Dylan O'Rae", 2, from('Biloxi Shuckers', 5015)),
    solo('c', 158, SEL, 'LHP', 'Tate Kuehner', 3, from('Nashville Sounds', 556)),
  ]
  const [story] = combineBatches(day, '2026-11-17')
  assert.equal(text(story), "Added three to the 40-man roster ahead of the Rule 5 draft: C Matthew Wood, 2B Dylan O'Rae and LHP Tate Kuehner.")
  assert.equal(story.typeLabel, 'Rule 5 protection')
  assert.deepEqual(story.rail.map((r) => r.playerId), [1, 2, 3])
  // One add alone gets the same treatment.
  const [one] = combineBatches([day[0]], '2026-11-17')
  assert.equal(text(one), 'Added C Matthew Wood to the 40-man roster ahead of the Rule 5 draft.')
  // In-season, the same rows stay selections.
  assert.match(text(combineBatches(day, '2026-09-01')[0]), /^Selected the contracts of/)
})
