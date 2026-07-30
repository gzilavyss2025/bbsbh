import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateGamePitchTypes } from '../scripts/gen-pitch-arsenal.mjs'
import { pitchArsenalFor, pitchFamily, MIN_ARSENAL_PITCHES } from '../src/api/pitchArsenal.js'

// --- helpers to build a tiny synthetic feed ----------------------------------
const pitch = (typeCode, description, startSpeed) => ({
  isPitch: true,
  details: { type: { code: typeCode, description } },
  pitchData: startSpeed == null ? undefined : { startSpeed },
})

const play = ({ half = 'top', pitcher, events }) => ({
  about: { halfInning: half },
  matchup: { pitcher: { id: pitcher, fullName: `Pitcher ${pitcher}` } },
  playEvents: events,
})

const feedWith = (plays) => ({
  gameData: { teams: { away: { id: 1 }, home: { id: 2 } } },
  liveData: { plays: { allPlays: plays } },
})

test('aggregateGamePitchTypes tallies pitches and velocity per pitcher/pitch type', () => {
  const agg = aggregateGamePitchTypes(
    feedWith([
      play({
        half: 'top', // home (id 2) is fielding
        pitcher: 200,
        events: [
          pitch('FF', 'Four-Seam Fastball', 95),
          pitch('FF', 'Four-Seam Fastball', 97),
          pitch('SL', 'Slider', 84),
        ],
      }),
    ]),
  )
  const p = agg.get(200)
  assert.equal(p.name, 'Pitcher 200')
  assert.equal(p.teamId, 2, 'the pitcher fields for the team batting is NOT on — home fields during the top half')
  const ff = p.types.get('FF')
  assert.equal(ff.pitches, 2)
  assert.equal(ff.velocitySum, 192)
  assert.equal(ff.velocityN, 2)
  const sl = p.types.get('SL')
  assert.equal(sl.pitches, 1)
  assert.equal(sl.description, 'Slider')
})

test('aggregateGamePitchTypes tolerates a pitch with no recorded velocity', () => {
  const agg = aggregateGamePitchTypes(
    feedWith([play({ pitcher: 200, events: [pitch('CH', 'Changeup', undefined)] })]),
  )
  const t = agg.get(200).types.get('CH')
  assert.equal(t.pitches, 1)
  assert.equal(t.velocityN, 0, 'no speed on file means it never joins the average')
})

test('aggregateGamePitchTypes skips non-pitch playEvents and plays with no pitcher', () => {
  const agg = aggregateGamePitchTypes(
    feedWith([
      play({ pitcher: 200, events: [{ isPitch: false }, pitch('FF', 'Four-Seam Fastball', 95)] }),
      { about: { halfInning: 'top' }, matchup: {}, playEvents: [pitch('FF', 'Four-Seam Fastball', 95)] },
    ]),
  )
  assert.equal(agg.get(200).types.get('FF').pitches, 1)
  assert.equal(agg.size, 1, 'the pitcher-less play never creates a bogus entry')
})

// --- reader selectors ---------------------------------------------------------
const dataWith = (personId, mlb, aaa = []) => ({ pit: { [personId]: { name: 'X', teamId: 1, mlb, aaa } } })

test('pitchArsenalFor sorts by pitches descending and computes pct', () => {
  const data = dataWith(100, [
    { code: 'SL', description: 'Slider', pitches: 20, avgVelo: 85 },
    { code: 'FF', description: 'Four-Seam Fastball', pitches: 80, avgVelo: 95 },
  ])
  const arsenal = pitchArsenalFor(data, 100, true)
  assert.equal(arsenal[0].code, 'FF')
  assert.equal(arsenal[0].pct, 80)
  assert.equal(arsenal[1].pct, 20)
})

test('pitchArsenalFor reads the AAA list when the game is not MLB', () => {
  const data = dataWith(100, [{ code: 'FF', description: 'Four-Seam Fastball', pitches: 50, avgVelo: 95 }], [
    { code: 'SI', description: 'Sinker', pitches: 30, avgVelo: 92 },
  ])
  const arsenal = pitchArsenalFor(data, 100, false)
  assert.equal(arsenal.length, 1)
  assert.equal(arsenal[0].code, 'SI')
})

test('pitchArsenalFor returns null under the qualifier floor', () => {
  const data = dataWith(100, [{ code: 'FF', description: 'Four-Seam Fastball', pitches: MIN_ARSENAL_PITCHES - 1, avgVelo: 95 }])
  assert.equal(pitchArsenalFor(data, 100, true), null)
})

test('pitchArsenalFor degrades to null for a missing personId or absent file', () => {
  assert.equal(pitchArsenalFor(dataWith(100, []), 999, true), null)
  assert.equal(pitchArsenalFor(null, 100, true), null)
})

test('pitchFamily groups known codes and falls back to other', () => {
  assert.equal(pitchFamily('FF'), 'fastball')
  assert.equal(pitchFamily('SL'), 'breaking')
  assert.equal(pitchFamily('CH'), 'offspeed')
  assert.equal(pitchFamily('KN'), 'other')
})
