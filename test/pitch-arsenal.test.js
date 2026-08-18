import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateGamePitchTypes, centuryRankMap } from '../scripts/gen-pitch-arsenal.mjs'
import { pitchArsenalFor, pitchFamily, heatView, arsenalTtoView, MIN_ARSENAL_PITCHES, MIN_LOOK_SHIFT, CENTURY_MPH, CENTURY_CLUB_MIN } from '../src/api/pitchArsenal.js'

// --- helpers to build a tiny synthetic feed ----------------------------------
const pitch = (typeCode, description, startSpeed) => ({
  isPitch: true,
  details: { type: { code: typeCode, description } },
  pitchData: startSpeed == null ? undefined : { startSpeed },
})

const play = ({ half = 'top', pitcher, batter, events }) => ({
  about: { halfInning: half },
  matchup: {
    pitcher: { id: pitcher, fullName: `Pitcher ${pitcher}` },
    ...(batter == null ? {} : { batter: { id: batter } }),
  },
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
  ranked.pit[100].centuryRank = { mlb: { rank: 2, of: 58 }, aaa: { rank: 1, of: 4 } }
  const heat = heatView(ranked, 100, true)
  assert.equal(heat.rank, 2)
  assert.equal(heat.of, 58)
  // The AAA season is ranked against AAA, never against the majors.
  ranked.pit[100].aaa = ranked.pit[100].mlb
  assert.equal(heatView(ranked, 100, false).of, 4)
})

test('heatView degrades to null for a missing personId or absent file', () => {
  assert.equal(heatView(dataWith(100, [heatRow('FF', 40, 103.4)]), 999, true), null)
  assert.equal(heatView(null, 100, true), null)
})

// --- times through the order -------------------------------------------------
test('aggregateGamePitchTypes buckets pitches by how many times that batter has been faced', () => {
  const agg = aggregateGamePitchTypes(
    feedWith([
      play({ pitcher: 200, batter: 10, events: [pitch('FF', 'Four-Seam Fastball', 95)] }),
      play({ pitcher: 200, batter: 11, events: [pitch('FF', 'Four-Seam Fastball', 96)] }),
      play({ pitcher: 200, batter: 10, events: [pitch('FF', 'Four-Seam Fastball', 94)] }),
      play({ pitcher: 200, batter: 10, events: [pitch('FF', 'Four-Seam Fastball', 93)] }),
      // A fourth look folds into the third bucket rather than opening its own.
      play({ pitcher: 200, batter: 10, events: [pitch('FF', 'Four-Seam Fastball', 92)] }),
    ]),
  )
  const t = agg.get(200).types.get('FF')
  assert.equal(t.pitches, 5)
  assert.deepEqual(t.tto.map((b) => b.pitches), [2, 1, 2], 'two firsts (one each batter), one second, two thirds')
  assert.equal(t.tto[0].velocitySum, 95 + 96)
  assert.equal(t.tto[2].velocitySum, 93 + 92)
})

test('aggregateGamePitchTypes counts a look per PITCHER, so a reliever starts fresh on a batter', () => {
  const agg = aggregateGamePitchTypes(
    feedWith([
      play({ pitcher: 200, batter: 10, events: [pitch('FF', 'Four-Seam Fastball', 95)] }),
      play({ pitcher: 200, batter: 10, events: [pitch('FF', 'Four-Seam Fastball', 95)] }),
      play({ pitcher: 201, batter: 10, events: [pitch('SL', 'Slider', 85)] }),
    ]),
  )
  assert.deepEqual(agg.get(200).types.get('FF').tto.map((b) => b.pitches), [1, 1, 0])
  assert.deepEqual(
    agg.get(201).types.get('SL').tto.map((b) => b.pitches),
    [1, 0, 0],
    'the arm that just came in is seeing this hitter for the FIRST time',
  )
})

test('aggregateGamePitchTypes still counts a pitch whose play carries no batter, in no bucket', () => {
  const agg = aggregateGamePitchTypes(
    feedWith([play({ pitcher: 200, events: [pitch('FF', 'Four-Seam Fastball', 95)] })]),
  )
  const t = agg.get(200).types.get('FF')
  assert.equal(t.pitches, 1, 'the season total still has it')
  assert.deepEqual(t.tto.map((b) => b.pitches), [0, 0, 0], 'but it joins no look')
})

// `tto` is [pitches, avgVelo] pairs, trailing empty looks trimmed — see
// exportPitchArsenal on why the file spells it this way.
const ttoRow = (code, pitches, buckets) => ({
  code, description: code, pitches, avgVelo: 95, century: 0, maxVelo: 99, tto: buckets,
})

test('arsenalTtoView gives each look its OWN denominator', () => {
  const data = dataWith(100, [
    ttoRow('FF', 100, [[60, 101.3], [30, 100.1], [10, 100.0]]),
    ttoRow('SL', 40, [[10, 88], [20, 87], [10, 86]]),
  ])
  const looks = arsenalTtoView(data, 100, true)
  assert.deepEqual(looks.map((l) => l.look), [1, 2, 3])
  assert.equal(looks[0].total, 70)
  assert.equal(looks[0].rows[0].code, 'FF')
  assert.equal(Math.round(looks[0].rows[0].usage * 1000) / 10, 85.7, '60 of 70 on the first look, not 60 of 140')
  assert.equal(looks[1].total, 50)
  assert.equal(Math.round(looks[1].rows[0].usage * 1000) / 10, 60, '30 of 50 the second time through')
})

test('arsenalTtoView sorts each look by its own usage, not the season order', () => {
  const data = dataWith(100, [
    ttoRow('FF', 100, [[60, 101], [5, 100], [5, 100]]),
    ttoRow('SL', 40, [[10, 88], [40, 87], [40, 87]]),
  ])
  const looks = arsenalTtoView(data, 100, true)
  assert.equal(looks[0].rows[0].code, 'FF', 'first time through he is a fastball pitcher')
  assert.equal(looks[1].rows[0].code, 'SL', 'by the second he is a slider pitcher, and the order says so')
})

test('arsenalTtoView drops a look under the qualifier floor and returns null when none qualify', () => {
  const thin = dataWith(100, [ttoRow('FF', 100, [[60, 101], [30, 100], [MIN_ARSENAL_PITCHES - 1, 99]])])
  const looks = arsenalTtoView(thin, 100, true)
  assert.deepEqual(looks.map((l) => l.look), [1, 2], 'a third look he has barely reached is not offered')

  const reliever = dataWith(100, [ttoRow('FF', 10, [[10, 99]])])
  assert.equal(arsenalTtoView(reliever, 100, true), null, 'nobody qualifies, so no filter renders')

  // A closer clears the floor on his first look and never on a second. One
  // look is no split — "All" beside "1st" is not a choice to offer.
  const closer = dataWith(100, [ttoRow('FC', 400, [[380, 94], [8, 93]])])
  assert.equal(arsenalTtoView(closer, 100, true), null)
})

test('arsenalTtoView returns null when the file carries no split at all', () => {
  const old = dataWith(100, [{ code: 'FF', description: 'FF', pitches: 500, avgVelo: 95, century: 0, maxVelo: 99 }])
  assert.equal(arsenalTtoView(old, 100, true), null, 'rows ingested before the sweep counted looks read as unknown, not zero')
  assert.equal(arsenalTtoView(null, 100, true), null)
  assert.equal(arsenalTtoView(dataWith(100, []), 999, true), null)
})

test('arsenalTtoView reads a trimmed tto array — a look he never reached is simply absent', () => {
  const data = dataWith(100, [ttoRow('FF', 100, [[60, 101.3], [40, 100.1]])])
  const looks = arsenalTtoView(data, 100, true)
  assert.deepEqual(looks.map((l) => l.look), [1, 2], 'no third look, and none invented')
  assert.equal(looks[1].rows[0].velo, 100.1, 'the pair reads [pitches, avgVelo] in that order')
})

test('arsenalTtoView carries the move each pitch made from the look before it', () => {
  const data = dataWith(100, [
    ttoRow('FF', 100, [[70, 97], [50, 96], [30, 96]]),
    ttoRow('SL', 100, [[30, 88], [50, 88], [70, 87]]),
  ])
  const looks = arsenalTtoView(data, 100, true)
  assert.equal(looks[0].rows[0].delta, null, 'the first look has nothing to be a change from')
  assert.equal(looks[0].rows[1].delta, null)

  const second = new Map(looks[1].rows.map((r) => [r.code, r.delta]))
  assert.equal(Math.round(second.get('FF') * 1000) / 10, -20, '70% of the first look down to 50% of the second')
  assert.equal(Math.round(second.get('SL') * 1000) / 10, 20)

  const third = new Map(looks[2].rows.map((r) => [r.code, r.delta]))
  assert.equal(Math.round(third.get('FF') * 1000) / 10, -20, 'measured against the SECOND look, not the first')
  assert.equal(Math.round(third.get('SL') * 1000) / 10, 20)
})

test('arsenalTtoView leaves delta null for a pitch the previous look never saw', () => {
  const data = dataWith(100, [
    ttoRow('FF', 100, [[60, 97], [40, 96], [40, 96]]),
    ttoRow('CH', 40, [[0, null], [20, 86], [20, 86]]),
  ])
  const looks = arsenalTtoView(data, 100, true)
  const ch = looks[1].rows.find((r) => r.code === 'CH')
  assert.equal(ch.delta, null, 'a pitch first thrown on this look is not "up from zero"')
  assert.equal(looks[2].rows.find((r) => r.code === 'CH').delta, 0, 'once both looks have it, the move is real and can be flat')
})

test('arsenalTtoView measures a move against the previous QUALIFYING look', () => {
  // The middle look falls under the floor and is dropped, so the third look's
  // neighbour in the array is the first — and that is what it is compared to.
  const data = dataWith(100, [
    ttoRow('FF', 100, [[60, 97], [MIN_ARSENAL_PITCHES - 1, 96], [30, 96]]),
    ttoRow('SL', 100, [[40, 88], [0, null], [70, 87]]),
  ])
  const looks = arsenalTtoView(data, 100, true)
  assert.deepEqual(looks.map((l) => l.look), [1, 3])
  const third = new Map(looks[1].rows.map((r) => [r.code, r.delta]))
  assert.equal(Math.round(third.get('FF') * 1000) / 10, -30, '60 of 100 on the first look, 30 of 100 on the third')
})

test('MIN_LOOK_SHIFT is a share, not a percentage', () => {
  assert.ok(MIN_LOOK_SHIFT > 0 && MIN_LOOK_SHIFT < 1, 'the arrow floor is compared against a usage share')
})

// --- century-club league ranking --------------------------------------------
test('centuryRankMap ranks most pitches first and shares a place on a tie', () => {
  const ranks = centuryRankMap([['a', 40], ['b', 120], ['c', 40], ['d', 5]])
  assert.deepEqual(ranks.get('b'), { rank: 1, of: 4 })
  assert.deepEqual(ranks.get('a'), { rank: 2, of: 4 })
  assert.deepEqual(ranks.get('c'), { rank: 2, of: 4 }, 'a tie shares the place')
  assert.deepEqual(ranks.get('d'), { rank: 4, of: 4 }, 'and the next man skips one')
})

test('centuryRankMap reports the COHORT size, not the league size', () => {
  const ranks = centuryRankMap([['a', 10], ['b', 9]])
  assert.equal(ranks.get('a').of, 2, 'of counts who was handed in, which is the century club')
})

test('centuryRankMap handles an empty cohort', () => {
  assert.equal(centuryRankMap([]).size, 0)
})
