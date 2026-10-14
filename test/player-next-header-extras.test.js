// The hero's OVR extras (#2009): the stamp, the tier word and the ratings strip, as data.
// Ratings are the public/data/ovr shard rows of four real players, read 2026-10-14.
import test from 'node:test'
import assert from 'node:assert/strict'
import { headerExtras, tierLine } from '../src/screens/player/next/heroData.js'

const bio = { id: 1 }
const TURANG = { ovr: 67, bars: { contact: 63, power: 55, speed: 74, fielding: 65 }, seasons: [2026, 2025, 2024, 2023] }
const GASSER = { ovr: 60, bars: { stuff: 59, results: 57, control: 65 }, seasons: [2026, 2025, 2024] }
const MADE = { ovr: 40, seasons: [2026, 2025], level: 12, pot: 98 }
const OHTANI_BAT = { ovr: 81, bars: { contact: 73, power: 84, speed: 64, fielding: 60 }, seasons: [2026, 2025, 2024, 2023] }
const OHTANI_PIT = { ovr: 74, bars: { stuff: 73, results: 72, control: 59 }, seasons: [2026, 2025, 2023] }

const bar = (g, key) => g.rows.find((r) => r.key === key)

test('a batter: the stamp, his tier and four bars, read by key', () => {
  const [g] = headerExtras({ bio }, { hitting: TURANG }).ratings
  assert.equal(g.group, 'hitting')
  assert.equal(g.ovr, 67)
  assert.equal(g.tier.name, 'Regular')
  assert.deepEqual(['power', 'contact', 'speed', 'fielding'].map((k) => bar(g, k).value), [55, 63, 74, 65])
  assert.equal(bar(g, 'speed').tier.name, 'All-Star')
  assert.equal(g.seasons, 'Based on 2023-2026')
  assert.equal(g.minor, null)
})

test('a pitcher: three bars', () => {
  const [g] = headerExtras({ bio }, { pitching: GASSER }).ratings
  assert.equal(g.ovr, 60)
  assert.deepEqual(['stuff', 'results', 'control'].map((k) => bar(g, k).value), [59, 57, 65])
})

test('a missing bar is not a row, never a zero', () => {
  const [g] = headerExtras({ bio }, { hitting: { ovr: 50, bars: { contact: 50, power: 48 } } }).ratings
  assert.equal(bar(g, 'speed'), undefined)
  assert.equal(g.rows.length, 2)
})

test('a two-way player: hitting first, then pitching', () => {
  const x = headerExtras({ bio }, { pitching: OHTANI_PIT, hitting: OHTANI_BAT })
  assert.deepEqual(x.ratings.map((g) => [g.group, g.ovr]), [['hitting', 81], ['pitching', 74]])
})

test('a player with only a pitching rating stamps pitching', () => {
  assert.equal(headerExtras({ bio }, { pitching: GASSER }).ratings[0].group, 'pitching')
})

test('no rating: no stamp, no strip', () => {
  assert.deepEqual(headerExtras({ bio: { ...bio, education: 'Rice' } }, null).ratings, [])
})

test('a minor leaguer: the stamp, a POT tag and a level meter, no bars', () => {
  const [g] = headerExtras({ bio }, { hitting: MADE }).ratings
  assert.equal(g.ovr, 40)
  assert.deepEqual(g.rows, [])
  assert.equal(g.minor.pot, 98)
  assert.equal(g.minor.levelLabel, 'AA')
  assert.equal(g.minor.marks.cap.value, 55)
})

test('a minor leaguer off the Top 100 has no POT', () => {
  const [g] = headerExtras({ bio }, { hitting: { ovr: 38, level: 13 } }).ratings
  assert.equal(g.minor.pot, null)
  assert.equal(g.minor.marks.pot, null)
})

test('a tapped bar reads its own tier, found by key', () => {
  const [g] = headerExtras({ bio }, { hitting: TURANG }).ratings
  assert.equal(tierLine(g.rows, 'speed'), 'Speed 74 is All-Star level on its own.')
  assert.equal(tierLine(g.rows, 'power'), 'Power 55 is Starter level on its own.')
  assert.equal(tierLine(g.rows, 'stuff'), null)
  assert.equal(tierLine(g.rows, null), null)
})
