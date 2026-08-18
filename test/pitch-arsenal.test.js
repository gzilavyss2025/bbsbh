import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateGamePitchTypes } from '../scripts/gen-pitch-arsenal.mjs'
import { pitchArsenalFor, pitchFamily, heatView, MIN_ARSENAL_PITCHES, CENTURY_MPH, CENTURY_CLUB_MIN } from '../src/api/pitchArsenal.js'

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

test('aggregateGamePitchTypes tallies century_pitches and tracks max_velo per type', () => {
  const agg = aggregateGamePitchTypes(
    feedWith([
      play({
        pitcher: 200,
        events: [
          pitch('SL', 'Slider', CENTURY_MPH + 1), // clears the bar
          pitch('SL', 'Slider', 84),
          pitch('FF', 'Four-Seam Fastball', CENTURY_MPH - 3), // never clears it
        ],
      }),
    ]),
  )
  const p = agg.get(200)
  const sl = p.types.get('SL')
  assert.equal(sl.centuryPitches, 1)
  assert.equal(sl.maxVelo, CENTURY_MPH + 1)
  const ff = p.types.get('FF')
  assert.equal(ff.centuryPitches, 0)
  assert.equal(ff.maxVelo, CENTURY_MPH - 3, 'maxVelo tracks the fastest pitch regardless of the century floor')
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

// --- heatView: the Pitches card's 100 mph band -------------------------------
// `century` and `maxVelo` per pitch type are already in the shard the mix is
// read from (gen-pitch-arsenal.mjs's sweep writes both), so the band is a sum
// over the types he threw rather than a second fetch.
const heatRow = (code, century, maxVelo, pitches = 100) => ({
  code, description: code, pitches, avgVelo: 95, century, maxVelo,
})

test('heatView sums century pitches across types and takes the hardest reading', () => {
  const data = dataWith(100, [heatRow('FF', 40, 103.4), heatRow('SL', 3, 101.1), heatRow('CH', 0, 88.2)])
  const heat = heatView(data, 100, true)
  assert.equal(heat.count, 43, 'every type contributes, including a breaking ball at triple digits')
  assert.equal(heat.maxVelo, 103.4, 'the season best is the max ACROSS types, not the fastball type alone')
})

test('heatView rounds the hardest reading to a tenth', () => {
  const heat = heatView(dataWith(100, [heatRow('FF', 20, 102.98765)]), 100, true)
  assert.equal(heat.maxVelo, 103.0)
})

test('heatView returns null under CENTURY_CLUB_MIN, so the band never reads as a row of zeroes', () => {
  assert.equal(heatView(dataWith(100, [heatRow('FF', CENTURY_CLUB_MIN - 1, 100.4)]), 100, true), null)
  assert.equal(heatView(dataWith(100, [heatRow('FF', 0, 97.2)]), 100, true), null)
  assert.notEqual(heatView(dataWith(100, [heatRow('FF', CENTURY_CLUB_MIN, 100.4)]), 100, true), null)
})

test('heatView reads the level it is asked for and never pools MLB with AAA', () => {
  const data = dataWith(100, [heatRow('FF', 40, 103.4)], [heatRow('FF', 9, 101.2)])
  assert.equal(heatView(data, 100, true).count, 40)
  assert.equal(heatView(data, 100, false).count, 9, 'the AAA season stands on its own')
})

test('heatView tolerates a type with no century field and no velocity on file', () => {
  const data = dataWith(100, [
    { code: 'FF', description: 'Four-Seam Fastball', pitches: 100, avgVelo: 99, century: 12, maxVelo: 101.5 },
    { code: 'KN', description: 'Knuckleball', pitches: 4, avgVelo: null },
  ])
  const heat = heatView(data, 100, true)
  assert.equal(heat.count, 12)
  assert.equal(heat.maxVelo, 101.5)
})

test('heatView leaves rank null until the generator writes one, and reads it when present', () => {
  const bare = heatView(dataWith(100, [heatRow('FF', 40, 103.4)]), 100, true)
  assert.equal(bare.rank, null)
  assert.equal(bare.of, null)

  const ranked = dataWith(100, [heatRow('FF', 40, 103.4)])
  ranked.pit[100].centuryRank = { rank: 2, of: 58 }
  const heat = heatView(ranked, 100, true)
  assert.equal(heat.rank, 2)
  assert.equal(heat.of, 58)
})

test('heatView degrades to null for a missing personId or absent file', () => {
  assert.equal(heatView(dataWith(100, [heatRow('FF', 40, 103.4)]), 999, true), null)
  assert.equal(heatView(null, 100, true), null)
})
