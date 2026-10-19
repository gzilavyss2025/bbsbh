// The roll-ups behind public/data/club-defense-running.json
// (scripts/lib/club-defense-running.mjs) and the loader's pure picker
// (src/api/clubDefenseRunning.js). Small fixtures, no network.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildClubs,
  pct,
  sprintByClub,
  sumByClub,
} from '../scripts/lib/club/defense-running.mjs'
import { clubsFor } from '../src/api/clubDefenseRunning.js'

test('pct is part over whole in percent, one decimal, null on an empty whole', () => {
  assert.equal(pct(162, 162 + 54), 75)
  assert.equal(pct(1, 3), 33.3)
  assert.equal(pct(0, 10), 0)
  assert.equal(pct(5, 0), null)
  assert.equal(pct(null, 10), null)
})

test('sumByClub adds a column per club and skips blank values', () => {
  const rows = [
    { playerId: '1', teamId: 158, v: '2.5' },
    { playerId: '2', teamId: 158, v: '-1' },
    { playerId: '3', teamId: 112, v: '' },
    { playerId: '4', teamId: 112, v: '4' },
  ]
  assert.deepEqual(sumByClub(rows, 'v'), { 158: 1.5, 112: 4 })
})

test('sumByClub gives a traded player one share per club, and counts a repeated row once', () => {
  const rows = [
    { playerId: '9', teamId: 120, v: 3 }, // traded: 3 with WSH...
    { playerId: '9', teamId: 147, v: 1 }, // ...and 1 with NYY
    { playerId: '9', teamId: 147, v: 1 }, // the same stint listed twice
  ]
  assert.deepEqual(sumByClub(rows, 'v'), { 120: 3, 147: 1 })
})

test('sumByClub leaves out a club with no usable row (null, never 0)', () => {
  const out = sumByClub([{ playerId: '1', teamId: 158, v: '' }], 'v')
  assert.equal(158 in out, false)
})

test('sprintByClub is a competitive-run weighted mean, one row per player', () => {
  const rows = [
    { player_id: '1', team_id: '158', sprint_speed: '30', competitive_runs: '10' },
    { player_id: '2', team_id: '158', sprint_speed: '27', competitive_runs: '30' },
    // a traded player: listed twice, counted once (first row wins)
    { player_id: '3', team_id: '147', sprint_speed: '26', competitive_runs: '100' },
    { player_id: '3', team_id: '120', sprint_speed: '26', competitive_runs: '100' },
    // no speed, or no runs: no weight
    { player_id: '4', team_id: '147', sprint_speed: '', competitive_runs: '50' },
    { player_id: '5', team_id: '147', sprint_speed: '29', competitive_runs: '0' },
  ]
  assert.deepEqual(sprintByClub(rows), { 158: 27.8, 147: 26 })
})

test('buildClubs fills each club and nulls a measure with no source', () => {
  const clubs = buildClubs({
    teamIds: [158, 112],
    oaa: [{ team_id: '158', outs_above_average: '20' }],
    framing: [{ playerId: '1', teamId: 158, rv_tot: '-6.5' }], // 112: no catcher rows
    sprint: [{ player_id: '1', team_id: '158', sprint_speed: '28', competitive_runs: '10' }],
    stats: [
      { teamId: 158, stolenBases: 162, caughtStealing: 54 },
      { teamId: 112, stolenBases: 90, caughtStealing: 10 },
    ],
    baserunning: [{ playerId: '1', teamId: 158, n_safe: '40', n_opp_xb: '100' }],
  })
  assert.deepEqual(clubs[158], {
    oaa: 20,
    framingRuns: -6.5,
    sprintSpeed: 28,
    stolenBases: 162,
    stolenBaseSuccess: 75,
    extraBasesTaken: 40,
  })
  assert.deepEqual(clubs[112], {
    oaa: null,
    framingRuns: null,
    sprintSpeed: null,
    stolenBases: 90,
    stolenBaseSuccess: 90,
    extraBasesTaken: null,
  })
})

test('clubsFor returns both clubs, in the order asked, or null', () => {
  const data = { clubs: { 158: { oaa: 1 }, 112: { oaa: 2 } } }
  assert.deepEqual(clubsFor(data, 112, '158'), [{ oaa: 2 }, { oaa: 1 }])
  assert.equal(clubsFor(data, 158, 999), null)
  assert.equal(clubsFor({ clubs: {} }, 158, 112), null)
  assert.equal(clubsFor(null, 158, 112), null)
})
