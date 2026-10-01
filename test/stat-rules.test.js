// ONE OPS RULE AND ONE ZERO-OUTS ERA RULE (#1275, #1276; rows A1 and A2 of
// docs/duplicate-derivations.md).
//
// OPS. MLB does not add OBP and SLG at full precision. It rounds each to three
// places, then adds. Aaron Judge, 2025: AB 541, H 179, BB 124, HBP 7, SF 7,
// TB 372. OBP .4565 and SLG .6876 add to 1.1442 (prints 1.144); the rounded
// halves .457 and .688 add to 1.145, and 1.145 is what statsapi sends. Checked
// against every 2025 MLB hitter in #1275: the rounded way matched 673 of 673,
// the full-precision way missed 162.
//
// ERA. A pitcher who recorded no out has no ERA. `0.00` says he was perfect.
// Each surface keeps its own "no value" (`-.--`, null, the dash); only the
// decision "no outs, so no ERA" is shared.
//
// The generators under scripts/ run on import (top-level await on statsapi), so
// a test cannot call them. Their two formulas are checked by reading the source
// for the shared helper, and the helper itself is checked here.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { aggregateSplits, splitsView } from '../src/api/person.js'
import { foldLine, foldStats } from '../src/api/boxlines/fold.js'
import { mergeCareerSplits } from '../src/api/boxlines/careerSplits.js'
import { sumHitting, sumPitching } from '../src/api/statsLevels.js'
import { eraOf, mlbOps, rate3, whipOf } from '../src/api/person/shared.js'
import { PITCHING_CATEGORIES, computeLeaders } from '../src/api/teamLeaders.js'

// Judge's 2025 line, whole.
const JUDGE = { atBats: 541, hits: 179, baseOnBalls: 124, hitByPitch: 7, sacFlies: 7, totalBases: 372 }
// The same line cut in two, as a traded player's two stints (or vs-L and vs-R).
const HALF_A = { atBats: 300, hits: 100, baseOnBalls: 60, hitByPitch: 4, sacFlies: 3, totalBases: 200 }
const HALF_B = { atBats: 241, hits: 79, baseOnBalls: 64, hitByPitch: 3, sacFlies: 4, totalBases: 172 }
const stint = (teamId, stat) => ({ season: 2025, sport: { id: 1 }, team: { id: teamId }, stat })
// A script's source with its `//` comments cut, so a match means CODE and not a
// comment that mentions the helper.
const rawSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')

// ---------------------------------------------------------------------------
// The shared rules
// ---------------------------------------------------------------------------

test('mlbOps adds the rounded halves: Judge is 1.145, not 1.144', () => {
  const obp = (JUDGE.hits + JUDGE.baseOnBalls + JUDGE.hitByPitch) / (JUDGE.atBats + JUDGE.baseOnBalls + JUDGE.hitByPitch + JUDGE.sacFlies)
  const slg = JUDGE.totalBases / JUDGE.atBats
  assert.equal(rate3(obp + slg), '1.144') // the full-precision sum: what four homes printed
  assert.equal(rate3(mlbOps(obp, slg)), '1.145')
})

test('mlbOps rounds each half the way rate3 prints it, so OPS = printed OBP + printed SLG', () => {
  // 0.2345 is stored a hair under .2345, so rate3 prints '.234'. Math.round(v * 1000)
  // made it .235, and the OPS no longer added up from the printed halves.
  assert.equal(rate3(0.2345), '.234')
  assert.equal(rate3(mlbOps(0.2345, 0.4)), '.634')
  // OBP .0375 prints .037 and SLG .051375 prints .051: OPS must print .088, not .089.
  assert.equal(rate3(0.0375), '.037')
  assert.equal(rate3(0.051375), '.051')
  assert.equal(rate3(mlbOps(0.0375, 0.051375)), '.088')
})

test('a real line at the boundary: 3 for 80 with 4 total bases prints OBP .037, SLG .050, OPS .087', () => {
  // Two stints (one stint passes through untouched): 40 AB, 2 H, 3 TB and 40 AB, 1 H, 1 TB.
  const stat = aggregateSplits(
    [
      stint(158, { atBats: 40, hits: 2, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, totalBases: 3 }),
      stint(147, { atBats: 40, hits: 1, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, totalBases: 1 }),
    ],
    'hitting',
  )
  assert.equal(stat.obp, '.037')
  assert.equal(stat.slg, '.050')
  assert.equal(stat.ops, '.087')
})

test('eraOf and whipOf give null at zero outs and the usual figure otherwise', () => {
  assert.equal(eraOf(2, 0), null)
  assert.equal(whipOf(1, 3, 0), null)
  assert.equal(eraOf(2, 27), 2) // 2 ER over 9 innings
  assert.equal(whipOf(9, 9, 27), 2) // 18 runners over 9 innings
  assert.equal(eraOf(0, 3), 0) // a pitcher who got an out and allowed nothing HAS a 0.00
})

// ---------------------------------------------------------------------------
// OPS: every home prints 1.145 for Judge
// ---------------------------------------------------------------------------

test('aggregateSplits (a traded season) prints MLB\'s OPS, rounded halves added', () => {
  const stat = aggregateSplits([stint(147, HALF_A), stint(111, HALF_B)], 'hitting')
  assert.equal(stat.obp, '.457')
  assert.equal(stat.slg, '.688')
  assert.equal(stat.ops, '1.145')
})

test('the vs-L / vs-R "all" row (overallSide) prints the same 1.145', () => {
  const view = splitsView(
    [
      { split: { code: 'vl' }, stat: HALF_A },
      { split: { code: 'vr' }, stat: HALF_B },
    ],
    'hitting',
  )
  assert.equal(view.all.ops, '1.145')
})

test('sumHitting sums OBP and SLG after rounding each', () => {
  const t = sumHitting([{ stat: HALF_A }, { stat: HALF_B }])
  assert.equal(t.ops.toFixed(3), '1.145')
})

test('foldStats (the Box Lines fold) prints 1.145', () => {
  // The fold builds total bases from hits, doubles, triples and home runs (372
  // here: 179 hits + 34 doubles + 53 home runs x 3), so the rows carry those.
  const rows = [
    { gamePk: 1, date: '2025-04-01', counts: { atBats: 300, hits: 100, doubles: 20, homeRuns: 25, baseOnBalls: 60, hitByPitch: 4, sacFlies: 3 } },
    { gamePk: 2, date: '2025-04-02', counts: { atBats: 241, hits: 79, doubles: 14, homeRuns: 28, baseOnBalls: 64, hitByPitch: 3, sacFlies: 4 } },
  ]
  assert.equal(foldStats(rows, 'hitting').find((c) => c.k === 'OPS').v, '1.145')
})

test('mergeCareerSplits prints 1.145', () => {
  const merged = mergeCareerSplits({ ...HALF_A, gamesPlayed: 80 }, { ...HALF_B, gamesPlayed: 70 }, 'hitting')
  assert.equal(merged.ops, '1.145')
})

test('the two generators take OPS from the shared rule, not their own sum', () => {
  for (const path of ['../scripts/gen-vs-team-splits.mjs', '../scripts/gen-callouts.mjs']) {
    const src = rawSource(path)
    assert.match(src, /import \{[^}]*\bmlbOps\b[^}]*\} from '\.\.\/src\/api\/person\/shared\.js'/, path)
    assert.match(src, /\bmlbOps\(/, path)
  }
  // The old full-precision sums are gone.
  assert.doesNotMatch(rawSource('../scripts/gen-vs-team-splits.mjs'), /\(obp \+ slg\)/)
  assert.doesNotMatch(rawSource('../scripts/gen-callouts.mjs'), /obpDen \+ t\.tb \/ t\.ab/)
})

// ---------------------------------------------------------------------------
// ERA and WHIP: no outs, no value
// ---------------------------------------------------------------------------

// Two earned runs, nobody out: Joe Rock against Tampa Bay, 2026-09-17.
const NO_OUTS = { outs: 0, earnedRuns: 2, hits: 3, baseOnBalls: 1, strikeOuts: 0, atBats: 4 }

test('sumPitching gives no ERA and no WHIP at zero outs, never 0', () => {
  const t = sumPitching([{ stat: NO_OUTS }])
  assert.equal(t.era, null)
  assert.equal(t.whip, null)
})

test('sumPitching still divides when there are outs', () => {
  const t = sumPitching([{ stat: { ...NO_OUTS, outs: 27 } }])
  assert.equal(t.era, 2)
  assert.equal(t.whip, 4 / 9)
})

test('foldLine gives a null rate at zero outs', () => {
  const rows = [{ gamePk: 1, date: '2025-04-01', counts: { outs: 0, earnedRuns: 2 } }]
  assert.equal(foldLine(rows, 'pitching').rate, null)
})

test('mergeCareerSplits prints -.-- at zero outs', () => {
  const merged = mergeCareerSplits({ outs: 0, earnedRuns: 1 }, { outs: 0, earnedRuns: 1 }, 'pitching')
  assert.equal(merged.era, '-.--')
})

test('aggregateSplits prints the dash for ERA and WHIP at zero outs', () => {
  const pitch = (teamId, er) =>
    stint(teamId, { inningsPitched: '0.0', earnedRuns: er, hits: er, baseOnBalls: 1, strikeOuts: 0, gamesPlayed: er })
  const stat = aggregateSplits([pitch(147, 1), pitch(111, 2)], 'pitching')
  assert.equal(stat.era, '—')
  assert.equal(stat.whip, '—')
})

test('the two generators take ERA from the shared rule', () => {
  for (const path of ['../scripts/gen-vs-team-splits.mjs', '../scripts/gen-callouts.mjs']) {
    const src = rawSource(path)
    assert.match(src, /import \{[^}]*\beraOf\b[^}]*\} from '\.\.\/src\/api\/person\/shared\.js'/, path)
  }
  assert.doesNotMatch(rawSource('../scripts/gen-vs-team-splits.mjs'), /'0\.00'/)
})

// A pitcher with no value must not rank. computeLeaders drops a null value, and
// used to be handed a 0, which is the best ERA there is.
test('a pitcher with no outs does not lead the team in ERA or WHIP', () => {
  const pool = [
    { id: 1, name: 'Joe Rock', teamId: 139, teamAbbr: 'TB', hitting: null, pitching: sumPitching([{ stat: NO_OUTS }]) },
    { id: 2, name: 'Starter', teamId: 139, teamAbbr: 'TB', hitting: null, pitching: sumPitching([{ stat: { ...NO_OUTS, outs: 27 } }]) },
  ]
  for (const key of ['era', 'whip']) {
    const category = PITCHING_CATEGORIES.find((c) => c.key === key)
    const ranked = computeLeaders(pool, category)
    assert.deepEqual(ranked.map((r) => r.id), [2], key)
  }
})
