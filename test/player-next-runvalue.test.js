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

test('a batter: the total, the rank tile, three parts with their places', () => {
  const v = runValueView(data, 668930, 2026)
  assert.equal(v.total, '+39')
  assert.deepEqual(v.rank, { place: '6th', caption: 'position players' })
  assert.deepEqual(v.parts.map((p) => [p.key, p.label, p.value]), [
    ['bat', 'Batting', '+24'],
    ['fld', 'Defense', '+14'],
    ['run', 'Baserunning', '+1'],
  ])
  assert.equal(v.door, `${v.of} position players`)
  assert.equal(v.foot, '2026 · Baseball Savant · context neutral')
  assert.equal(v.count, '2026 season')
})

test('a part inside the top 10 names its place; outside it has none, and says why', () => {
  const v = runValueView(data, 668930, 2026)
  const by = Object.fromEntries(v.parts.map((p) => [p.key, p]))
  assert.equal(by.fld.line, '5th in MLB in defense runs.')
  assert.match(by.run.line, /^No top-10 place in baserunning/)
})

test('outside the top 10 the rank tile hides', () => {
  const v = runValueView(data, 688107, 2026)
  assert.equal(v.total, '+2')
  assert.equal(v.rank, null)
  assert.deepEqual(v.parts.map((p) => [p.key, p.label, p.value]), [['pit', 'Pitching', '+2']])
  assert.equal(v.door, `${v.of} pitchers`)
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

test('bars run from a zero line on a fixed scale that grows only when a part needs it', () => {
  const v = runValueView(data, 668930, 2026)
  assert.equal(v.scale, 30)
  assert.equal(runValueView(data, 688107, 2026).scale, 10)
  assert.equal(runValueView(data, 660271, 2026).scale, 30)
  const bat = v.parts[0]
  assert.equal(bat.side, 'up')
  assert.equal(bat.width, +((23.9 / 30) * 100).toFixed(2))
  const neg = runValueView({ season: 2026, players: [{ id: 2, name: 'Glove Hole', bat: 5, fld: -34, run: 0, pit: 0 }] }, 2, 2026)
  assert.equal(neg.scale, 40)
  assert.equal(neg.parts[1].side, 'down')
})

test('a real zero prints 0 and a missing part prints a dash', () => {
  const v = runValueView({ season: 2026, players: [{ id: 3, name: 'Dh', bat: 8, fld: 0, run: 0, pit: 0 }] }, 3, 2026)
  assert.equal(v.parts[1].value, '0')
  const missing = runValueView({ season: 2026, players: [{ id: 4, name: 'Dh', bat: 8 }] }, 4, 2026)
  assert.equal(missing.parts[1].value, '—')
})

test('the sentence names the biggest part, from counts', () => {
  assert.equal(runValueView(data, 668930, 2026).sentence, 'Most of it is batting: 24 of the 39 runs came at the plate.')
  assert.equal(runValueView(data, 660271, 2026).sentence, 'Most of it is batting: 26 of the 47 runs came at the plate.')
  const flat = runValueView({ season: 2026, players: [{ id: 5, name: 'Even', bat: 0.4, fld: 0.2, run: 0, pit: 0 }] }, 5, 2026)
  assert.equal(runValueView(data, 688107, 2026).sentence, 'All of it is pitching: 2 runs came on the mound.')
  assert.equal(flat.sentence, 'A season within a run of average overall.')
})

test('no view when he is not in the file, or the file is another season', () => {
  assert.equal(runValueView(data, 1234567, 2026), null)
  assert.equal(runValueView(data, 668930, 2025), null)
  assert.equal(runValueView(null, 668930, 2026), null)
})
