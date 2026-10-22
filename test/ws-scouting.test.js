// The World Series scouting report's card list (#2316): which cards show on which day type,
// in what order, and which are dropped for want of data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clubOrder, scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'

const FULL = { nineKeys: true, edges: [{ id: 1 }], plateUmpire: { id: 9, name: 'A. Ump' } }
const ids = (m) => m.map((c) => c.id)

test('off day: Nine keys then Matchup edges, no umpire card', () => {
  assert.deepEqual(scoutingModel({ dayType: 'off', ...FULL }), [
    { id: 'nine-keys', label: 'Nine keys' },
    { id: 'matchup-edges', label: 'Matchup edges' },
  ])
})

test('game day: Matchup edges then Umpire edge, no Nine keys', () => {
  assert.deepEqual(scoutingModel({ dayType: 'game', ...FULL }), [
    { id: 'matchup-edges', label: 'Matchup edges' },
    { id: 'umpire-edge', label: 'Umpire edge' },
  ])
})

test('a card with no data is dropped', () => {
  assert.deepEqual(ids(scoutingModel({ dayType: 'off', ...FULL, nineKeys: false })), ['matchup-edges'])
  assert.deepEqual(ids(scoutingModel({ dayType: 'off', ...FULL, edges: [] })), ['nine-keys'])
  assert.deepEqual(ids(scoutingModel({ dayType: 'off', nineKeys: false, edges: undefined })), [])
})

test('the umpire card shows only once a plate umpire is posted', () => {
  assert.deepEqual(ids(scoutingModel({ dayType: 'game', ...FULL, plateUmpire: null })), ['matchup-edges'])
  assert.deepEqual(ids(scoutingModel({ dayType: 'game', ...FULL, plateUmpire: { id: 9, name: '' } })), ['matchup-edges'])
  assert.ok(ids(scoutingModel({ dayType: 'game', ...FULL })).includes('umpire-edge'))
})

test('the model has one shape whatever the opponent', () => {
  // The model takes no club id; the same inputs give the same cards for 139 and 114.
  const a = scoutingModel({ dayType: 'off', ...FULL, clubIds: [158, 139] })
  const b = scoutingModel({ dayType: 'off', ...FULL, clubIds: [158, 114] })
  assert.deepEqual(a, b)
  assert.deepEqual(Object.keys(a[0]).sort(), ['id', 'label'])
})

test('every card draws the clubs in the order of the sides (away, home)', () => {
  assert.deepEqual(clubOrder([158, 139], [139, 158]), [139, 158])
  assert.deepEqual(clubOrder([158, 139], [158, 139]), [158, 139])
})

test('sides that do not name the two Series clubs fall back to clubIds', () => {
  assert.deepEqual(clubOrder([158, 139], [158, 999]), [158, 139])
  assert.deepEqual(clubOrder([158, 139], undefined), [158, 139])
})

test('Roster follows Glove and legs: rank 3 on an off day, last (8) on a game day', () => {
  const all = { ...FULL, gloveLegs: [{}], roster: true, pitchByPitch: {}, platoon: [{}], parkFit: {}, meetings: [{}] }
  assert.deepEqual(ids(scoutingModel({ dayType: 'off', ...all })), [
    'nine-keys', 'glove-legs', 'roster', 'matchup-edges', 'pitch-by-pitch', 'platoon', 'park-fit', 'film-room',
  ])
  assert.deepEqual(ids(scoutingModel({ dayType: 'game', ...all })), [
    'matchup-edges', 'umpire-edge', 'pitch-by-pitch', 'platoon', 'film-room', 'park-fit', 'glove-legs', 'roster',
  ])
  assert.ok(!ids(scoutingModel({ dayType: 'off', ...all, roster: false })).includes('roster'))
})
