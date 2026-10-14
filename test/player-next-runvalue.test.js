// The Run value module's pure view (src/screens/player/next/modules/runvalue/runValueView.js, #2013).
import test from 'node:test'
import assert from 'node:assert/strict'
import { runValueView } from '../src/screens/player/next/modules/runvalue/runValueView.js'

// Four position players ahead of Turang, and Ohtani (+47) makes five: he is 6th. Real figures for the three subjects.
const field = Array.from({ length: 4 }, (_, i) => ({ id: 900 + i, name: `Ahead ${i}`, bat: 50 - i, fld: 0, run: 0, pit: 0 }))
const turang = { id: 668930, name: 'Brice Turang', bat: 23.9, fld: 14.1, run: 0.5, pit: 0 }
const gasser = { id: 688107, name: 'Robert Gasser', bat: 0, fld: 0, run: 0, pit: 1.5 }
const ohtani = { id: 660271, name: 'Shohei Ohtani', bat: 25.7, fld: 0, run: 0.9, pit: 20.4 }
// Glovemen: four fielders ahead of Turang's 14.1, so his glove is 5th among the parts; thirteen pitchers ahead of Gasser.
const gloves = Array.from({ length: 4 }, (_, i) => ({ id: 800 + i, name: `Glove ${i}`, bat: 0, fld: 20 - i, run: 0, pit: 0 }))
const arms = Array.from({ length: 13 }, (_, i) => ({ id: 700 + i, name: `Arm ${i}`, bat: 0, fld: 0, run: 0, pit: 30 - i }))
const data = { season: 2026, players: [...field, ...gloves, ...arms, turang, gasser, ohtani] }

test('a batter: the total, the rank, three parts', () => {
  const v = runValueView(data, 668930, 2026)
  assert.equal(v.total, '+39')
  assert.deepEqual(v.rank, { place: '6th', caption: 'among position players' })
  assert.deepEqual(v.parts.map((p) => [p.key, p.label, p.value]), [
    ['bat', 'Batting', '+24'],
    ['fld', 'Defense', '+14'],
    ['run', 'Baserunning', '+1'],
  ])
  assert.equal(v.count, '2026 season')
})

test('a part inside the top 10 names its place; outside it has none', () => {
  const v = runValueView(data, 668930, 2026)
  const by = Object.fromEntries(v.parts.map((p) => [p.key, p]))
  assert.equal(by.fld.place, '5th in MLB')
  assert.equal(by.run.place, '')
})

test('outside the top 10 the rank and its strip hide', () => {
  const v = runValueView(data, 688107, 2026)
  assert.equal(v.total, '+2')
  assert.equal(v.rank, null)
  assert.equal(v.strip, null)
  assert.deepEqual(v.parts.map((p) => [p.key, p.label, p.value]), [['pit', 'Pitching', '+2']])
})

test('a two-way player gets a fourth Pitching row so the parts add up to the total', () => {
  const v = runValueView(data, 660271, 2026)
  assert.equal(v.total, '+47')
  assert.deepEqual(v.parts.map((p) => [p.key, p.value]), [['bat', '+26'], ['fld', '0'], ['run', '+1'], ['pit', '+20']])
})

test('a small pitching part under a run stays off a batter card', () => {
  const small = { id: 1, name: 'Mop Up', bat: 10, fld: 0, run: 0, pit: 0.4 }
  const v = runValueView({ season: 2026, players: [small] }, 1, 2026)
  assert.deepEqual(v.parts.map((p) => p.key), ['bat', 'fld', 'run'])
})

test('each part fills its share of the parts, in the part\'s own direction', () => {
  const v = runValueView(data, 668930, 2026)
  const bat = v.parts[0]
  assert.equal(bat.side, 'up')
  assert.equal(bat.width, +((23.9 / (23.9 + 14.1 + 0.5)) * 100).toFixed(2))
  assert.equal(runValueView(data, 688107, 2026).parts[0].width, 100)
  const neg = runValueView({ season: 2026, players: [{ id: 2, name: 'Glove Hole', bat: 5, fld: -35, run: 0, pit: 0 }] }, 2, 2026)
  assert.equal(neg.parts[1].side, 'down')
  assert.equal(neg.parts[1].width, 87.5)
  assert.equal(neg.parts[2].width, 0)
})

test('the strip places a rank along last to best', () => {
  const arm = (id, pit) => ({ id, name: `Arm ${id}`, bat: 0, fld: 0, run: 0, pit })
  const small = { season: 2026, players: [arm(1, 30), arm(2, 20), arm(3, 10)] }
  assert.equal(runValueView(small, 1, 2026).strip, 100)
  assert.equal(runValueView(small, 2, 2026).strip, 50)
  assert.equal(runValueView(small, 3, 2026).strip, 0)
})

test('a real zero prints 0 and a missing part prints a dash', () => {
  const v = runValueView({ season: 2026, players: [{ id: 3, name: 'Dh', bat: 8, fld: 0, run: 0, pit: 0 }] }, 3, 2026)
  assert.equal(v.parts[1].value, '0')
  const missing = runValueView({ season: 2026, players: [{ id: 4, name: 'Dh', bat: 8 }] }, 4, 2026)
  assert.equal(missing.parts[1].value, '—')
})

