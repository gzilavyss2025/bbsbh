import assert from 'node:assert/strict'
import test from 'node:test'
import { solveOptimalLineup, valueLineup, slotValue, POS_ADJ, SLOTS } from '../src/lib/lineupSolver.js'
import {
  gradeLineup,
  receiptFor,
  lineupStrengthFor,
  lineupStrengthRows,
  rpgFromWar,
} from '../src/api/lineupStrength.js'
import { lineupStrengthTierFor } from '../src/lib/lineupStrengthTier.js'

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

test('a slot carries no positional adjustment of its own (it cancels across nine slots)', () => {
  // Every valid lineup fills the same nine slots, so the sum of the slots' own
  // positional adjustments is a constant that cancels out of any posted-vs-optimal
  // comparison. The adjustment is instead stripped ONCE, off each player's WAR
  // rate, when lineup-values.json is built — see the module header. So a player's
  // value must depend only on his bat and his familiarity at the slot, never on
  // which slot it is.
  const bat = { id: 'x', rpg: 0.2, primaryPos: 'C', elig: { C: 1, DH: 1, '1B': 1 } }
  assert.equal(slotValue(bat, 'C'), 0.2)
  assert.equal(slotValue(bat, 'DH'), 0.2)
  assert.equal(slotValue(bat, '1B'), 0.2)
  // The FanGraphs constants themselves are still the generator's strip input.
  assert.equal(POS_ADJ.C, 12.5)
  assert.equal(POS_ADJ.DH, -17.5)
})

test('the positional adjustment is stripped BEFORE the PA regression, not after', () => {
  // The bug this pins: WAR already contains the positional adjustment for the
  // spot a player actually played, so shrinking WAR toward replacement shrinks
  // that adjustment too. Removing 100% of it afterwards leaves a phantom
  // (1 - shrink) * POS_ADJ[primary] — a penalty at premium positions and a BONUS
  // at DH/1B/corner, growing as the sample gets thinner.
  //
  // Compose the value the way the pipeline does: stored rate -> slot value.
  const value = (war, pa, pos) =>
    slotValue({ id: pos, rpg: rpgFromWar(war, pa, {}, pos), primaryPos: pos, elig: { DH: 1 } }, 'DH')
  // What it must equal: the position-neutral rate, shrunk by the SAME factor.
  const want = (war, pa, pos) => {
    const neutral = (war / pa) * 600 - POS_ADJ[pos] / 9.5
    return ((neutral * (pa / (pa + 250))) * 9.5) / 162
  }
  // The shrink factor must apply to the whole position-neutral rate, at every
  // position and every sample size — no residual that varies with either.
  for (const pos of ['C', 'SS', '2B', '1B', 'DH']) {
    for (const [war, pa] of [[2.55, 600], [0.85, 200], [1.7, 400], [0.1, 27]]) {
      const got = value(war, pa, pos)
      assert.ok(
        Math.abs(got - want(war, pa, pos)) < 1e-12,
        `${pos} @ ${pa} PA: got ${got}, want ${want(war, pa, pos)}`,
      )
    }
  }
  // Concretely: a good catcher stays above replacement no matter how thin the
  // sample. Under the old order his value went NEGATIVE, which is what let a
  // replacement-level DH out-rank him.
  assert.ok(value(2.55, 600, 'C') > 0, `good catcher, full sample: ${value(2.55, 600, 'C')}`)
  assert.ok(value(0.85, 200, 'C') > 0, `same rate, thin sample: ${value(0.85, 200, 'C')}`)
  assert.ok(value(2.55, 600, 'C') > value(0.85, 200, 'C'), 'the bigger sample keeps more of the rate')
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
  // primaryPos omitted, so the positional strip is zero and this isolates the
  // shrinkage term; the strip's ordering is pinned by its own test above.
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

test('receiptFor: a slot with a bench swap does not also emit a redundant oop line', () => {
  // Post a weak, out-of-position bat at a slot the optimum would give to someone
  // else: the slot must show as ONE bench swap, never a bench row AND an
  // out-of-position row for the same slot (which read as a duplicate in the table).
  const data = synthData()
  const posted = [
    { personId: 'c', position: 'C' },
    { personId: '1b', position: '1B' },
    { personId: '2b', position: '2B' },
    { personId: 'scrub', position: '3B' }, // weak corner bat, unfamiliar at 3B
    { personId: 'ss', position: 'SS' },
    { personId: 'lf', position: 'LF' },
    { personId: 'cf', position: 'CF' },
    { personId: 'rf', position: 'RF' },
    { personId: 'dhstud', position: 'DH' },
  ]
  const items = receiptFor(data, 1, posted)
  const bySlot = new Map()
  for (const it of items) {
    const key = it.slot
    assert.ok(
      !(bySlot.has(key) && (bySlot.get(key) === 'bench' || it.kind === 'bench')),
      `slot ${key} has both a bench and an out-of-position line`,
    )
    bySlot.set(key, it.kind)
  }
  // No slot appears more than once at all.
  const slots = items.map((it) => it.slot)
  assert.equal(slots.length, new Set(slots).size, 'a slot appears in more than one receipt row')
})

// A lineup that's optimal for the eight players we CAN value, plus one starter
// swapped in at DH. Used by the missing-starter tests below.
function postedWithDh(dhId) {
  return [
    { personId: 'c', position: 'C' },
    { personId: '1b', position: '1B' },
    { personId: '2b', position: '2B' },
    { personId: '3b', position: '3B' },
    { personId: 'ss', position: 'SS' },
    { personId: 'lf', position: 'LF' },
    { personId: 'cf', position: 'CF' },
    { personId: 'rf', position: 'RF' },
    { personId: dhId, position: 'DH' },
  ]
}

test('gradeLineup: a starter in no data file is excluded from the gap, not charged a penalty', () => {
  // Regression: a just-acquired starter used to be valued at replacement AND
  // docked an unfamiliarity penalty at the very slot we'd named his primary —
  // an internal contradiction that tanked the grade of any lineup with him.
  // Now his slot is left out of the gap entirely and surfaced as unvalued.
  const data = synthData() // no warFallback → callup resolves nowhere
  const g = gradeLineup(data, 1, postedWithDh('callup_9999'))
  assert.ok(g)
  assert.deepEqual(g.ungraded, [{ id: 'callup_9999', slot: 'DH' }])
  // The excluded DH slot contributes nothing: the other eight are posted at their
  // optimal spots, so the gap is ~zero and the score is near the top.
  assert.ok(g.gapRpg < 1e-9, `unvalued slot must not create a gap, got ${g.gapRpg}`)
  assert.equal(g.score, 10)
  // And no receipt line is fabricated for the slot we couldn't grade.
  const items = receiptFor(data, 1, postedWithDh('callup_9999'))
  assert.ok(!items.some((it) => it.slot === 'DH'))
})

test('gradeLineup: a starter absent from the values file but present in WAR is valued from it', () => {
  // The "recent trade" case: not in the (nightly, team-scoped) values file, but
  // his bat is in the league-wide WAR file. He must be valued from WAR — a real
  // number, graded normally — not excluded and not dropped to replacement.
  const data = synthData()
  delete data.players['dhstud'] // vacate the DH-stud slot in the file
  const constants = { paScale: 600, regressionPa: 250, runsPerWar: 9.5, games: 162 }
  data.constants = constants
  // A genuine masher by WAR: big sample, high WAR → a strong rpg.
  data.warFallback = { bat: { traded_7: 5.0 }, pa: { traded_7: 600 } }
  const g = gradeLineup(data, 1, postedWithDh('traded_7'))
  assert.ok(g)
  assert.equal(g.ungraded.length, 0, 'a WAR-resolved starter is graded, not excluded')
  // His DH value is the WAR conversion, anchored on his posted slot (we have no
  // other read on his primary position) — a real bat well above replacement 0.
  const dh = g.actual.perSlot.find((s) => s.slot === 'DH')
  const expectedRpg = rpgFromWar(5.0, 600, constants, 'DH')
  assert.ok(Number.isFinite(expectedRpg) && expectedRpg > 0.15)
  assert.ok(Math.abs(dh.value - expectedRpg) < 1e-9, `expected ${expectedRpg}, got ${dh.value}`)
})

test('gradeLineup: a starter in the file under another club (a trade) keeps his real value', () => {
  // Present in data.players but tagged to a different teamId (his old club). His
  // season value is team-independent, so grading the NEW club must reuse it
  // rather than treating him as an unknown.
  const data = synthData()
  data.players['dhstud'].teamId = 999 // "traded away" in the file's eyes
  const g = gradeLineup(data, 1, postedWithDh('dhstud'))
  assert.ok(g)
  assert.equal(g.ungraded.length, 0, 'a cross-team file entry is not treated as unknown')
  const dh = g.actual.perSlot.find((s) => s.slot === 'DH')
  assert.ok(dh.value > 0.8, `cross-team stud keeps his ~0.9 rpg, got ${dh.value}`)
})

test('lineupStrengthFor: an unvalued starter surfaces by name via the posted-lineup map', () => {
  const data = synthData()
  const strength = lineupStrengthFor(data, 1, postedWithDh('callup_9999'), {
    callup_9999: 'Rookie Callup',
  })
  assert.deepEqual(strength.ungraded, [{ slot: 'DH', name: 'Rookie Callup' }])
})

test('rpgFromWar reproduces the nightly build model and degrades on missing inputs', () => {
  const c = { paScale: 600, regressionPa: 250, runsPerWar: 9.5, games: 162 }
  const expected = (war, pa, pos) => {
    const per600 = (war / pa) * 600
    const neutral = per600 - (POS_ADJ[pos] ?? 0) / 9.5
    const reg = neutral * (pa / (pa + 250))
    return (reg * 9.5) / 162
  }
  assert.ok(Math.abs(rpgFromWar(0.1, 98, c) - expected(0.1, 98)) < 1e-12)
  assert.ok(Math.abs(rpgFromWar(5.0, 600, c) - expected(5.0, 600)) < 1e-12)
  // Same call with a primary position strips that position's adjustment first.
  assert.ok(Math.abs(rpgFromWar(1.7, 400, c, 'C') - expected(1.7, 400, 'C')) < 1e-12)
  assert.ok(Math.abs(rpgFromWar(0.2, 295, c, 'DH') - expected(0.2, 295, 'DH')) < 1e-12)
  // Missing/zero inputs → null so the caller can fall back to exclude-the-slot.
  assert.equal(rpgFromWar(1.0, 0, c), null)
  assert.equal(rpgFromWar(undefined, 400, c), null)
  assert.equal(rpgFromWar(2.0, NaN, c), null)
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

// --- lineup-strength tier ladder (lib/lineupStrengthTier.js) -----------------

test('tier ladder: each score band maps to the right colour family', () => {
  // Six word-bands collapse onto three colours: strong (≥6), mid (4.5–6), weak.
  const c = (score) => lineupStrengthTierFor(score).colorTier
  assert.equal(c(9.5), 'strong') // Best nine
  assert.equal(c(8.0), 'strong') // Near best
  assert.equal(c(6.5), 'mid') // Mostly intact
  assert.equal(c(5.0), 'mid') // Reshuffled
  assert.equal(c(3.5), 'weak') // Short-handed
  assert.equal(c(1.0), 'weak') // Bare bones
  // Band edges are inclusive of their floor.
  assert.equal(lineupStrengthTierFor(9.0).band, 0)
  assert.equal(lineupStrengthTierFor(7.5).band, 1)
  assert.equal(lineupStrengthTierFor(6.0).band, 2)
  assert.equal(lineupStrengthTierFor(4.5).band, 3)
  assert.equal(lineupStrengthTierFor(3.0).band, 4)
  assert.equal(lineupStrengthTierFor(0).band, 5)
})

test('tier ladder: within-band word is deterministic on the seed', () => {
  // Same score + same seed → identical word every call (no refresh flicker).
  const a = lineupStrengthTierFor(4.0, 158)
  const b = lineupStrengthTierFor(4.0, 158)
  assert.equal(a.label, b.label)
  // The label is one of that band's alternatives.
  const bandWords = ['Short-handed', 'Depleted', 'Thinned out']
  assert.ok(bandWords.includes(a.label))
  // No seed → the first word of the band, deterministically.
  assert.equal(lineupStrengthTierFor(4.0).label, 'Short-handed')
})

test('tier ladder: different seeds spread across a band (not all identical)', () => {
  // The whole point of a per-lineup ladder — a slate of similar teams shouldn't
  // all read the same. Over many seeds, more than one alternative must appear.
  const labels = new Set()
  for (let seed = 100; seed < 140; seed++) labels.add(lineupStrengthTierFor(6.5, seed).label)
  assert.ok(labels.size > 1, `expected varied words within a band, got ${[...labels]}`)
})

// --- row shaping for the Expected/Starting/R/G table -------------------------

test('lineupStrengthRows: bench and out-of-position rows map to the right columns', () => {
  const data = synthData()
  const rows = lineupStrengthRows(data, [
    { kind: 'bench', inId: 'dhstud', outId: 'scrub', slot: 'DH', deltaRpg: 0.5 },
    { kind: 'oop', id: 'ss', slot: '3B', weight: 0.4, deltaRpg: 0.1 },
  ])
  // bench: Expected = the optimal player (inId), Starting = posted starter (outId).
  // scoreImpact = deltaRpg / SCORE_GAP_FULL (0.045), rounded to a tenth of a grade.
  assert.deepEqual(rows[0], {
    kind: 'bench',
    pos: 'DH',
    expected: 'DhStud',
    starting: 'Scrub',
    deltaRpg: 0.5,
    scoreImpact: 11.1,
  })
  // oop: no displaced expected name (never fabricated); carries the player's
  // usual (primary) position for the natural-spot hint.
  assert.deepEqual(rows[1], {
    kind: 'oop',
    pos: '3B',
    expected: null,
    starting: 'Shortstop',
    usualPos: 'SS',
    deltaRpg: 0.1,
    scoreImpact: 2.2,
  })
})

test('lineupStrengthRows: oop usualPos is omitted when it equals the slot', () => {
  const data = synthData()
  // 'ss' posted at his own primary SS → no meaningful "usually" hint.
  const [row] = lineupStrengthRows(data, [{ kind: 'oop', id: 'ss', slot: 'SS', weight: 0.5, deltaRpg: 0.1 }])
  assert.equal(row.usualPos, null)
})

test('lineupStrengthFor exposes strengthTier + rows on its result', () => {
  const data = synthData()
  const posted = [
    { personId: 'c', position: 'C' },
    { personId: '1b', position: '1B' },
    { personId: '2b', position: '2B' },
    { personId: '3b', position: '3B' },
    { personId: 'ss', position: 'SS' },
    { personId: 'scrub', position: 'LF' },
    { personId: 'cf', position: 'CF' },
    { personId: 'rf', position: 'RF' },
    { personId: 'lf', position: 'DH' },
  ]
  const strength = lineupStrengthFor(data, 1, posted)
  assert.ok(strength.strengthTier)
  assert.ok(['strong', 'mid', 'weak'].includes(strength.strengthTier.colorTier))
  assert.equal(strength.rows.length, strength.items.length)
})

test('valueLineup never returns -Infinity for a real placement', () => {
  const pool = [{ id: 'x', rpg: 0.5, primaryPos: '1B', elig: { '1B': 1 } }]
  // Post x at catcher — a slot he has no eligibility for. Must floor, not forbid.
  const { total, perSlot } = valueLineup(pool, [{ id: 'x', slot: 'C' }])
  assert.ok(Number.isFinite(total))
  assert.ok(Number.isFinite(perSlot[0].value))
})
