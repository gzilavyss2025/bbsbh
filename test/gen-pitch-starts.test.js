import assert from 'node:assert/strict'
import test from 'node:test'
import { openDb } from '../scripts/lib/db.js'
import { mphBuckets, startsBuckets, foldStarts } from '../scripts/lib/pitch/arsenal-starts.mjs'
import { aggregateGamePitchTypes } from '../scripts/gen-pitch-arsenal.mjs'
import {
  addGame, boxVerdict, codesVerdict, coverageVerdict, pendingGames, rowsOfFeed, shardsOf,
} from '../scripts/lib/pitch/starts-sweep.mjs'

const pitch = (code, speed) => ({ isPitch: true, details: { type: { code, description: code } }, pitchData: speed == null ? undefined : { startSpeed: speed } })
const play = (pitcher, stand, events) => ({
  about: { halfInning: 'top' },
  matchup: { pitcher: { id: pitcher, fullName: `P${pitcher}` }, batSide: { code: stand } },
  playEvents: events,
})
const feed = (plays) => ({ gameData: { teams: { away: { id: 1 }, home: { id: 2 } } }, liveData: { plays: { allPlays: plays } } })
// FF on both stands (speeds 95, 96, 96 -> 95.67 -> 957 tenths), a CH with no speed, a second pitcher.
const fixture = () => feed([
  play(200, 'L', [pitch('FF', 95), pitch('CH', undefined)]),
  play(200, 'R', [pitch('FF', 96), pitch('FF', 96)]),
  play(300, 'R', [pitch('SL', 84)]),
])

test('stands merge into one count per code; speed averages over both stands in tenths', () => {
  const { pit, mph } = rowsOfFeed(fixture())
  assert.deepEqual(pit, { 200: { CH: 1, FF: 3 }, 300: { SL: 1 } })
  assert.deepEqual(mph, { 200: { FF: 957 }, 300: { SL: 840 } }, 'CH has no speed, so no entry')
})

test('two feeds add up under one pitcher', () => {
  const store = { pit: {}, mph: {} }
  addGame(store, 11, rowsOfFeed(fixture()))
  addGame(store, 12, rowsOfFeed(feed([play(200, 'R', [pitch('FF', 90)])])))
  assert.deepEqual(store.pit[200], { 11: { CH: 1, FF: 3 }, 12: { FF: 1 } })
  assert.deepEqual(store.mph[200], { 11: { FF: 957 }, 12: { FF: 900 } })
})

test('resume skips every game already in the store', () => {
  const store = { pit: {}, mph: {} }
  addGame(store, 11, rowsOfFeed(fixture()))
  assert.deepEqual(pendingGames([10, 11, 12], store), [10, 12])
})

test('the same fixture through foldStarts and through rowsOfFeed gives the same shards', async () => {
  const db = await openDb()
  foldStarts(db, { gamePk: 11, level: 'mlb', season: 2020 }, aggregateGamePitchTypes(fixture()))
  const dbShards = [...startsBuckets(db, 2020), ...mphBuckets(db, 2020).map(([k, b]) => [`${k}.mph`, b])]
  const store = { pit: {}, mph: {} }
  addGame(store, 11, rowsOfFeed(fixture()))
  assert.equal(JSON.stringify(shardsOf(2020, store)), JSON.stringify(dbShards))
})

test('coverage passes at exactly 99% and fails below; lists at most 20 missing', () => {
  const pks = Array.from({ length: 100 }, (_, i) => i + 1)
  const have = (n) => ({ pit: { 1: Object.fromEntries(pks.slice(0, n).map((p) => [p, { FF: 1 }])) } })
  assert.equal(coverageVerdict(pks, have(99)).ok, true)
  const bad = coverageVerdict(pks, have(98))
  assert.equal(bad.ok, false)
  assert.deepEqual(bad.missing, [99, 100])
  assert.equal(coverageVerdict(Array.from({ length: 500 }, (_, i) => i), { pit: {} }).missing.length, 20)
})

test('box check: 95% of pairs within 3 pitches, grand total within 1%', () => {
  // n pairs of 1000 pitches; `bad` of them are 4 off, the rest 3 off. Totals stay near 0.4% off.
  const pairs = (n, bad) => Array.from({ length: n }, (_, i) => ({ stored: 1000, box: 1000 + (i < bad ? 4 : 3) }))
  assert.equal(boxVerdict(pairs(100, 5)).ok, true, '95 of 100 is the edge and passes')
  assert.equal(boxVerdict(pairs(100, 6)).ok, false)
  // 95 exact pairs and 5 far ones: the pair rule passes at its edge, so the total rule decides.
  const total = (d) => Array.from({ length: 100 }, (_, i) => ({ stored: 1000, box: 1000 + (i < 5 ? d : 0) }))
  assert.equal(boxVerdict(total(202)).ok, true, 'off by 1010 of 101010: inside 1%')
  assert.equal(boxVerdict(total(203)).ok, false, 'off by 1015 of 101015: past 1%')
})

test('codes: unknown codes fail only above 2% of all pitches', () => {
  assert.equal(codesVerdict({ FF: 98, IN: 2 }).ok, true)
  assert.equal(codesVerdict({ FF: 97, IN: 3 }).ok, false)
  assert.deepEqual(codesVerdict({ FF: 98, IN: 2 }).unknown, { IN: 2 })
})
