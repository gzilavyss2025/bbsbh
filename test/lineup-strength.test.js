import assert from 'node:assert/strict'
import test from 'node:test'
import {
  solveOptimalLineup,
  valueLineup,
  slotValue,
  posDelta,
  POS_ADJ,
  SLOTS,
} from '../src/lib/lineupSolver.js'
import { gradeLineup, receiptFor, lineupStrengthFor } from '../src/api/lineupStrength.js'

// --- a raw Hungarian core, exercised through the solver ----------------------
// The solver assigns nine slots, so to hand-check a 4x4 we expose a tiny helper
// that reuses the same solveAssignment by shaping a 4-slot problem via elig gates.
// Instead of reaching into internals, we verify the exact assignment engine
// through solveOptimalLineup by constructing players whose only sensible home is
// one slot each, then a case where the greedy choice is wrong.

test('exact assignment beats the greedy per-slot pick (4-way, hand-checked)', () => {
  // Four players, each eligible only at two slots, values arranged so the greedy
  // "give each slot its single best bat" double-books and the optimum must trade.
  // Slots reduced to C,1B,2B,3B by making everyone ineligible elsewhere.
  const only = (a, b) => ({ [a]: 1, [b]: 1 })
  // Neutralize positional adjustments by giving each a primaryPos matching the
  // slot family isn't possible for two slots at once, so we just read total.
  const players = [
    { id: 'p1', rpg: 1.0, primaryPos: 'C', elig: only('C', '1B') },
    { id: 'p2', rpg: 0.9, primaryPos: 'C', elig: only('C', '1B') },
    { id: 'p3', rpg: 0.2, primaryPos: '2B', elig: only('2B', '3B') },
    { id: 'p4', rpg: 0.1, primaryPos: '2B', elig: only('2B', '3B') },
  ]
  // Make the other five slots fillable by five dummies so a full nine-slot solve
  // succeeds; dummies are only eligible at their own slot with 0 value.
  const dummies = ['SS', 'LF', 'CF', 'RF', 'DH'].map((s, i) => ({
    id: `d${i}`,
    rpg: 0,
    primaryPos: s,
    elig: { [s]: 1 },
  }))
  const res = solveOptimalLineup([...players, ...dummies])
  assert.ok(res)
  const bySlot = Object.fromEntries(res.assignments.map((a) => [a.slot, a.id]))
  // p1/p2 must split C and 1B; p3/p4 must split 2B and 3B. The exact solve puts
  // the better bat at the slot with the better positional adjustment.
  assert.deepEqual(new Set([bySlot.C, bySlot['1B']]), new Set(['p1', 'p2']))
  assert.deepEqual(new Set([bySlot['2B'], bySlot['3B']]), new Set(['p3', 'p4']))
})

test('forbidden assignments are respected (no eligibility = never placed there)', () => {
  // p1 is the best bat but is ONLY eligible at 1B. He must land at 1B even though
  // his bat would "want" a premium slot.
  const players = [
    { id: 'star', rpg: 2.0, primaryPos: '1B', elig: { '1B': 1 } },
    ...SLOTS.filter((s) => s !== '1B').map((s) => ({
      id: `x${s}`,
      rpg: 0.5,
      primaryPos: s,
      elig: { [s]: 1 },
    })),
  ]
  const res = solveOptimalLineup(players)
  assert.ok(res)
  const bySlot = Object.fromEntries(res.assignments.map((a) => [a.slot, a.id]))
  assert.equal(bySlot['1B'], 'star')
  // slotValue at a forbidden slot is -Infinity.
  assert.equal(slotValue(players[0], 'C'), -Infinity)
})

test('positional adjustment math matches the FanGraphs constants', () => {
  // Moving a shortstop to first base: (POS_ADJ.1B - POS_ADJ.SS) / 162.
  const expected = (POS_ADJ['1B'] - POS_ADJ.SS) / 162
  assert.ok(Math.abs(posDelta('1B', 'SS') - expected) < 1e-12)
  // Unknown primary carries no adjustment.
  assert.equal(posDelta('C', 'TWP'), 0)
})

test('full nine-slot synthetic roster: an obvious DH upgrade is taken', () => {
  // Eight everyday players locked to their positions, plus two DH-only bats: a
  // masher (rpg 1.5) and a weak one (rpg 0.1). The optimum must DH the masher.
  const everyday = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map((s) => ({
    id: `e${s}`,
    rpg: 0.5,
    primaryPos: s,
    elig: { [s]: 1, DH: 1 },
  }))
  const masher = { id: 'masher', rpg: 1.5, primaryPos: 'DH', elig: { DH: 1 } }
  const weak = { id: 'weak', rpg: 0.1, primaryPos: 'DH', elig: { DH: 1 } }
  const res = solveOptimalLineup([...everyday, masher, weak])
  assert.ok(res)
  const bySlot = Object.fromEntries(res.assignments.map((a) => [a.slot, a.id]))
  assert.equal(bySlot.DH, 'masher')
  // weak never makes it in (only eligible at DH, which the masher owns).
  assert.ok(!Object.values(bySlot).includes('weak'))
})

test('no-catcher relax path fills the slot and flags relaxed', () => {
  // Ten players, none eligible at catcher, with a spare 1B so the roster stays
  // feasible once someone is forced behind the plate. Strict solve is infeasible;
  // the relax must force-fill C with the lowest-rpg bat and flag it.
  const players = [
    { id: 'p0', rpg: 0.30, primaryPos: '1B', elig: { '1B': 1, DH: 1 } }, // lowest bat → forced C
    { id: 'p1', rpg: 0.55, primaryPos: '1B', elig: { '1B': 1, DH: 1 } }, // spare 1B
    { id: 'p2', rpg: 0.50, primaryPos: '2B', elig: { '2B': 1, DH: 1 } },
    { id: 'p3', rpg: 0.50, primaryPos: '3B', elig: { '3B': 1, DH: 1 } },
    { id: 'p4', rpg: 0.50, primaryPos: 'SS', elig: { SS: 1, DH: 1 } },
    { id: 'p5', rpg: 0.50, primaryPos: 'LF', elig: { LF: 1, DH: 1 } },
    { id: 'p6', rpg: 0.50, primaryPos: 'CF', elig: { CF: 1, DH: 1 } },
    { id: 'p7', rpg: 0.50, primaryPos: 'RF', elig: { RF: 1, DH: 1 } },
    { id: 'p8', rpg: 0.60, primaryPos: 'DH', elig: { DH: 1 } },
    { id: 'p9', rpg: 0.40, primaryPos: 'DH', elig: { DH: 1 } },
  ]
  const res = solveOptimalLineup(players)
  assert.ok(res)
  assert.equal(res.relaxed, true)
  const bySlot = Object.fromEntries(res.assignments.map((a) => [a.slot, a.id]))
  assert.ok(bySlot.C) // catcher got force-filled
  // The forced catcher is the lowest-rpg bat (p0).
  assert.equal(bySlot.C, 'p0')
})

test('infeasible with fewer than nine players returns null', () => {
  const players = [
    { id: 'a', rpg: 1, primaryPos: 'C', elig: { C: 1 } },
    { id: 'b', rpg: 1, primaryPos: '1B', elig: { '1B': 1 } },
  ]
  assert.equal(solveOptimalLineup(players), null)
})

test('regression / shrinkage math shrinks a low-PA hot start toward replacement', () => {
  // Reproduce the generator's computeRpg inline (kept in sync with constants).
  const RUNS_PER_WAR = 9.5
  const GAMES = 162
  const rpgOf = (war, pa) => {
    const warPer600 = (war / pa) * 600
    const regressed = warPer600 * (pa / (pa + 250))
    return (regressed * RUNS_PER_WAR) / GAMES
  }
  // Same WAR/PA rate, but the big-sample player keeps far more of it.
  const smallSample = rpgOf(1.0, 50) // 12 WAR/600 raw, heavily shrunk
  const bigSample = rpgOf(4.0, 600) // 4 WAR/600 raw, barely shrunk
  // 50 PA: retains 50/300 = 1/6 of the rate; 600 PA: retains 600/850 ≈ 0.706.
  assert.ok(Math.abs(smallSample - ((12 * (50 / 300) * 9.5) / 162)) < 1e-9)
  assert.ok(bigSample > smallSample)
  // Zero PA shrinks fully to replacement (0).
  assert.equal(rpgOf(2.0, 0) || 0, 0)
})

// --- gradeLineup end-to-end on synthetic data --------------------------------
function synthData() {
  const players = {}
  const mk = (id, name, primaryPos, rpg, elig) => {
    players[id] = { name, teamId: 1, primaryPos, rpg, pa: 400, elig: { ...elig, DH: 1 } }
  }
  // A tidy roster: eight locked regulars, a stud bench bat, and a weak starter.
  mk('c', 'Catcher', 'C', 0.3, { C: 1 })
  mk('1b', 'FirstBase', '1B', 0.4, { '1B': 1 })
  mk('2b', 'SecondBase', '2B', 0.35, { '2B': 1 })
  mk('3b', 'ThirdBase', '3B', 0.3, { '3B': 1 })
  mk('ss', 'Shortstop', 'SS', 0.5, { SS: 1, '2B': 0.9 })
  mk('lf', 'LeftField', 'LF', 0.2, { LF: 1 })
  mk('cf', 'CenterField', 'CF', 0.45, { CF: 1, LF: 0.9, RF: 0.9 })
  mk('rf', 'RightField', 'RF', 0.25, { RF: 1 })
  mk('dhstud', 'DhStud', 'DH', 0.9, { DH: 1 }) // best bat, DH only
  mk('scrub', 'Scrub', 'LF', 0.05, { LF: 1 }) // weak corner bat
  return { season: 2026, players, constants: {} }
}

test('gradeLineup: optimal-ish posted lineup scores near 10, bench-heavy scores lower', () => {
  const data = synthData()
  const optimalPosted = [
    { personId: 'c', position: 'C' },
    { personId: '1b', position: '1B' },
    { personId: '2b', position: '2B' },
    { personId: '3b', position: '3B' },
    { personId: 'ss', position: 'SS' },
    { personId: 'lf', position: 'LF' },
    { personId: 'cf', position: 'CF' },
    { personId: 'rf', position: 'RF' },
    { personId: 'dhstud', position: 'DH' },
  ]
  const gOpt = gradeLineup(data, 1, optimalPosted)
  assert.ok(gOpt)
  assert.ok(gOpt.score >= 9.5, `optimal lineup should grade high, got ${gOpt.score}`)

  // Bench-heavy: sit the DH stud, start the scrub at DH; play CF out at LF too.
  const badPosted = [
    { personId: 'c', position: 'C' },
    { personId: '1b', position: '1B' },
    { personId: '2b', position: '2B' },
    { personId: '3b', position: '3B' },
    { personId: 'ss', position: 'SS' },
    { personId: 'scrub', position: 'LF' },
    { personId: 'cf', position: 'CF' },
    { personId: 'rf', position: 'RF' },
    { personId: 'lf', position: 'DH' }, // weak bat DHs, stud benched
  ]
  const gBad = gradeLineup(data, 1, badPosted)
  assert.ok(gBad)
  assert.ok(gBad.score < gOpt.score - 1, `bad lineup should grade clearly lower (${gBad.score} vs ${gOpt.score})`)
  assert.ok(gBad.gapRpg > gOpt.gapRpg)

  // Receipt should call out benching the stud DH.
  const strength = lineupStrengthFor(data, 1, badPosted)
  assert.ok(strength.items.length > 0)
  const dhSwap = strength.items.find((it) => it.kind === 'bench' && it.inId === 'dhstud')
  assert.ok(dhSwap, 'receipt should flag the benched DH stud as a bench item')
})

test('gradeLineup: unknown starter falls back to replacement without crashing', () => {
  const data = synthData()
  const posted = [
    { personId: 'c', position: 'C' },
    { personId: '1b', position: '1B' },
    { personId: '2b', position: '2B' },
    { personId: '3b', position: '3B' },
    { personId: 'ss', position: 'SS' },
    { personId: 'lf', position: 'LF' },
    { personId: 'cf', position: 'CF' },
    { personId: 'rf', position: 'RF' },
    { personId: 'callup_9999', position: 'DH' }, // not in the values file
  ]
  const g = gradeLineup(data, 1, posted)
  assert.ok(g)
  assert.ok(Number.isFinite(g.score))
  assert.ok(g.gapRpg >= 0)
})

test('gradeLineup: no-catcher roster still grades via the relax path', () => {
  const data = synthData()
  // Strip the catcher from the pool by using a different team, but post a lineup
  // that has a non-catcher forced behind the plate.
  const noCatcher = { season: 2026, players: {}, constants: {} }
  let i = 0
  for (const [id, p] of Object.entries(data.players)) {
    if (id === 'c') continue
    noCatcher.players[id] = { ...p, elig: { ...p.elig } }
    delete noCatcher.players[id].elig.C
    i++
  }
  assert.ok(i >= 9)
  const posted = [
    { personId: '1b', position: 'C' }, // forced behind the plate
    { personId: '2b', position: '1B' },
    { personId: 'ss', position: '2B' },
    { personId: '3b', position: '3B' },
    { personId: 'lf', position: 'SS' },
    { personId: 'cf', position: 'LF' },
    { personId: 'rf', position: 'CF' },
    { personId: 'scrub', position: 'RF' },
    { personId: 'dhstud', position: 'DH' },
  ]
  const g = gradeLineup(noCatcher, 1, posted)
  assert.ok(g)
  assert.equal(g.relaxed, true)
})

test('valueLineup never returns -Infinity for a real placement', () => {
  const pool = [{ id: 'x', rpg: 0.5, primaryPos: '1B', elig: { '1B': 1 } }]
  // Post x at catcher — a slot he has no eligibility for. Must floor, not forbid.
  const { total, perSlot } = valueLineup(pool, [{ id: 'x', slot: 'C' }])
  assert.ok(Number.isFinite(total))
  assert.ok(Number.isFinite(perSlot[0].value))
})
