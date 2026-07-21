import assert from 'node:assert/strict'
import test from 'node:test'
import {
  solveOptimalLineup,
  valueLineup,
  slotValue,
  fieldingCredit,
  SLOTS,
} from '../src/lib/lineupSolver.js'
import {
  gradeLineup,
  receiptFor,
  lineupStrengthFor,
  lineupStrengthRows,
  rpgFromWar,
  fldRpgFromRuns,
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
  const only = (a, b) => [a, b, 'DH']
  // Neutralize positional adjustments by giving each a primaryPos matching the
  // slot family isn't possible for two slots at once, so we just read total.
  const players = [
    { id: 'p1', rpg: 1.0, primaryPos: 'C', positions: only('C', '1B') },
    { id: 'p2', rpg: 0.9, primaryPos: 'C', positions: only('C', '1B') },
    { id: 'p3', rpg: 0.2, primaryPos: '2B', positions: only('2B', '3B') },
    { id: 'p4', rpg: 0.1, primaryPos: '2B', positions: only('2B', '3B') },
  ]
  // Make the other five slots fillable by five dummies so a full nine-slot solve
  // succeeds; dummies are only eligible at their own slot with 0 value.
  const dummies = ['SS', 'LF', 'CF', 'RF', 'DH'].map((s, i) => ({
    id: `d${i}`,
    rpg: 0,
    primaryPos: s,
    positions: [s],
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
    { id: 'star', rpg: 2.0, primaryPos: '1B', positions: ['1B'] },
    ...SLOTS.filter((s) => s !== '1B').map((s) => ({
      id: `x${s}`,
      rpg: 0.5,
      primaryPos: s,
      positions: [s],
    })),
  ]
  const res = solveOptimalLineup(players)
  assert.ok(res)
  const bySlot = Object.fromEntries(res.assignments.map((a) => [a.slot, a.id]))
  assert.equal(bySlot['1B'], 'star')
  // slotValue at a forbidden slot is -Infinity.
  assert.equal(slotValue(players[0], 'C'), -Infinity)
})

test('no positional adjustment anywhere: a bat is worth the same at every slot', () => {
  // The adjustment used to be applied here as POS_ADJ[slot] - POS_ADJ[primary].
  // It cancels across nine fixed slots, and with fielding now carried explicitly
  // there is nothing left for it to proxy. A player with no glove figure must be
  // worth exactly his bat, wherever he is posted.
  const bat = { id: 'x', rpg: 0.2, primaryPos: 'C', positions: ['C', '1B', 'DH'] }
  assert.equal(slotValue(bat, 'C'), 0.2)
  assert.equal(slotValue(bat, 'DH'), 0.2)
  assert.equal(slotValue(bat, '1B'), 0.2)
})

test('a glove counts at every fielding slot and is worth nothing at DH', () => {
  // The rule the whole model turns on: a designated hitter does not field.
  const glove = { id: 'g', rpg: 0.05, fldRpg: 0.04, primaryPos: 'SS', positions: ['SS', 'DH'] }
  assert.ok(Math.abs(slotValue(glove, 'SS') - 0.09) < 1e-12, 'bat + glove in the field')
  assert.ok(Math.abs(slotValue(glove, 'DH') - 0.05) < 1e-12, 'bat alone at DH')
  assert.equal(fieldingCredit(glove, 'DH'), 0)
  assert.equal(fieldingCredit(glove, 'SS'), 0.04)

  // A liability's glove likewise costs nothing once he is hidden at DH, which is
  // what makes DHing a bad defender free rather than penalised.
  const liability = { id: 'l', rpg: 0.05, fldRpg: -0.06, primaryPos: '1B', positions: ['1B', 'DH'] }
  assert.ok(slotValue(liability, 'DH') > slotValue(liability, '1B'))
  assert.equal(slotValue(liability, 'DH'), 0.05)

  // A missing fielding figure reads as league average, never as a penalty.
  assert.equal(fieldingCredit({ rpg: 0.1, positions: [] }, 'CF'), 0)
})

test('a glove-first regular is not benched over his bat alone', () => {
  // The case that motivated splitting bat from glove: a 75 wRC+ third baseman
  // with the best fielding runs on the roster. Offense-only, the model swaps him
  // out; with the glove counted, he holds the spot.
  const gloveFirst = { id: 'ortiz', rpg: -0.07, fldRpg: 0.06, primaryPos: '3B', positions: ['3B', 'DH'] }
  const batFirst = { id: 'masher', rpg: -0.02, fldRpg: -0.05, primaryPos: '3B', positions: ['3B', 'DH'] }
  assert.ok(gloveFirst.rpg < batFirst.rpg, 'the glove-first player IS the weaker bat')
  assert.ok(
    slotValue(gloveFirst, '3B') > slotValue(batFirst, '3B'),
    'but he is the more valuable third baseman',
  )
  // Move the same pair to DH and the ranking flips back to pure offense.
  assert.ok(slotValue(gloveFirst, 'DH') < slotValue(batFirst, 'DH'))
})

test('rpgFromWar: wRC+ regresses toward league average, not toward replacement', () => {
  // A thin sample means "probably average", NOT "probably terrible" — regressing
  // toward 0 is what let a 27-PA callup read as a lineup weakness.
  const thinGood = rpgFromWar(150, 27, {})
  const fullGood = rpgFromWar(150, 600, {})
  assert.ok(thinGood > 0 && thinGood < fullGood, 'a thin hot start pulls back toward average')
  const thinBad = rpgFromWar(50, 27, {})
  const fullBad = rpgFromWar(50, 600, {})
  assert.ok(thinBad < 0 && thinBad > fullBad, 'a thin cold start pulls UP toward average')
  // Exactly average is exactly zero, at any sample size.
  assert.equal(rpgFromWar(100, 27, {}), 0)
  assert.equal(rpgFromWar(100, 600, {}), 0)
  // A 105 wRC+ catcher must out-rate a 97 wRC+ DH on similar samples — the
  // inversion that surfaced this whole rework.
  assert.ok(rpgFromWar(104.6, 400, {}) > rpgFromWar(96.8, 295, {}))
})

test('fldRpgFromRuns: fielding runs regress toward average on a long innings scale', () => {
  const c = { regressionInn: 600, defInnPerGame: 9 }
  // Regression governs the RATE, so hold the rate fixed and vary the sample:
  // +6.4 runs over 1200 innings is the same per-inning rate as +0.53 over 100.
  // The big sample keeps far more of it.
  const full = fldRpgFromRuns(6.4, 1200, c)
  const thin = fldRpgFromRuns(0.53, 100, c)
  assert.ok(full > 0 && thin > 0 && full > thin, `full ${full} should exceed thin ${thin}`)
  // A negative rate shrinks toward 0 from below, never past it.
  const badFull = fldRpgFromRuns(-6.0, 1200, c)
  const badThin = fldRpgFromRuns(-0.5, 100, c)
  assert.ok(badFull < 0 && badThin < 0 && badThin > badFull, 'thin cold sample pulls up toward average')
  // Missing inputs read as league average (null → caller uses 0), never a penalty.
  assert.equal(fldRpgFromRuns(5, 0, c), null)
  assert.equal(fldRpgFromRuns(undefined, 500, c), null)
})

test('full nine-slot synthetic roster: an obvious DH upgrade is taken', () => {
  // Eight everyday players locked to their positions, plus two DH-only bats: a
  // masher (rpg 1.5) and a weak one (rpg 0.1). The optimum must DH the masher.
  const everyday = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map((s) => ({
    id: `e${s}`,
    rpg: 0.5,
    primaryPos: s,
    positions: [s, 'DH'],
  }))
  const masher = { id: 'masher', rpg: 1.5, primaryPos: 'DH', positions: ['DH'] }
  const weak = { id: 'weak', rpg: 0.1, primaryPos: 'DH', positions: ['DH'] }
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
    { id: 'p0', rpg: 0.30, primaryPos: '1B', positions: ['1B', 'DH'] }, // lowest bat → forced C
    { id: 'p1', rpg: 0.55, primaryPos: '1B', positions: ['1B', 'DH'] }, // spare 1B
    { id: 'p2', rpg: 0.50, primaryPos: '2B', positions: ['2B', 'DH'] },
    { id: 'p3', rpg: 0.50, primaryPos: '3B', positions: ['3B', 'DH'] },
    { id: 'p4', rpg: 0.50, primaryPos: 'SS', positions: ['SS', 'DH'] },
    { id: 'p5', rpg: 0.50, primaryPos: 'LF', positions: ['LF', 'DH'] },
    { id: 'p6', rpg: 0.50, primaryPos: 'CF', positions: ['CF', 'DH'] },
    { id: 'p7', rpg: 0.50, primaryPos: 'RF', positions: ['RF', 'DH'] },
    { id: 'p8', rpg: 0.60, primaryPos: 'DH', positions: ['DH'] },
    { id: 'p9', rpg: 0.40, primaryPos: 'DH', positions: ['DH'] },
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
    { id: 'a', rpg: 1, primaryPos: 'C', positions: ['C'] },
    { id: 'b', rpg: 1, primaryPos: '1B', positions: ['1B'] },
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
  const mk = (id, name, primaryPos, rpg, positions, fldRpg = 0) => {
    players[id] = { name, teamId: 1, primaryPos, rpg, fldRpg, pa: 400, positions: [...positions, 'DH'] }
  }
  // A tidy roster: eight locked regulars, a stud bench bat, and a weak starter.
  mk('c', 'Catcher', 'C', 0.3, ['C'])
  mk('1b', 'FirstBase', '1B', 0.4, ['1B'])
  mk('2b', 'SecondBase', '2B', 0.35, ['2B'])
  mk('3b', 'ThirdBase', '3B', 0.3, ['3B'])
  mk('ss', 'Shortstop', 'SS', 0.5, ['SS', '2B'])
  mk('lf', 'LeftField', 'LF', 0.2, ['LF'])
  mk('cf', 'CenterField', 'CF', 0.45, ['CF', 'LF', 'RF'])
  mk('rf', 'RightField', 'RF', 0.25, ['RF'])
  mk('dhstud', 'DhStud', 'DH', 0.9, []) // best bat, DH only
  mk('scrub', 'Scrub', 'LF', 0.05, ['LF']) // weak corner bat
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
  const dhSwap = strength.items.find((it) => it.inId === 'dhstud')
  assert.ok(dhSwap, 'receipt should flag the benched DH stud as a personnel item')
  assert.ok(['sub', 'chain'].includes(dhSwap.kind), `expected a personnel kind, got ${dhSwap.kind}`)
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
  const constants = { regressionPa: 250, leagueRPerPa: 0.118, paPerSlot: 4.2 }
  data.constants = constants
  // A genuine masher: big sample, high wRC+ → a strong rpg.
  data.warFallback = { wrc: { traded_7: 180 }, pa: { traded_7: 600 } }
  const g = gradeLineup(data, 1, postedWithDh('traded_7'))
  assert.ok(g)
  assert.equal(g.ungraded.length, 0, 'a file-resolved starter is graded, not excluded')
  // His DH value is the wRC+ conversion — and at DH it is his bat alone, with no
  // fielding figure to add (we have no innings for a player missing from the file).
  const dh = g.actual.perSlot.find((s) => s.slot === 'DH')
  const expectedRpg = rpgFromWar(180, 600, constants)
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
  const c = { regressionPa: 250, leagueRPerPa: 0.118, paPerSlot: 4.2 }
  const expected = (wrcPlus, pa) => {
    const reg = 100 + (wrcPlus - 100) * (pa / (pa + 250))
    return ((reg - 100) / 100) * 0.118 * 4.2
  }
  assert.ok(Math.abs(rpgFromWar(115, 98, c) - expected(115, 98)) < 1e-12)
  assert.ok(Math.abs(rpgFromWar(180, 600, c) - expected(180, 600)) < 1e-12)
  assert.ok(Math.abs(rpgFromWar(75, 256, c) - expected(75, 256)) < 1e-12)
  // Constants default to the generator's when the file omits them.
  assert.ok(Math.abs(rpgFromWar(115, 98) - expected(115, 98)) < 1e-12)
  // Missing/zero inputs → null so the caller can fall back to exclude-the-slot.
  assert.equal(rpgFromWar(120, 0, c), null)
  assert.equal(rpgFromWar(undefined, 400, c), null)
  assert.equal(rpgFromWar(120, NaN, c), null)
})

test('gradeLineup: no-catcher roster still grades via the relax path', () => {
  const data = synthData()
  // Strip the catcher from the pool by using a different team, but post a lineup
  // that has a non-catcher forced behind the plate.
  const noCatcher = { season: 2026, players: {}, constants: {} }
  let i = 0
  for (const [id, p] of Object.entries(data.players)) {
    if (id === 'c') continue
    noCatcher.players[id] = { ...p, positions: p.positions.filter((x) => x !== 'C') }
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

test('lineupStrengthRows: every kind maps to the same Expected/Starting columns', () => {
  const data = synthData()
  const optimalBySlot = new Map([['DH', 'dhstud'], ['LF', 'cf'], ['C', 'c']])
  const rows = lineupStrengthRows(
    data,
    [
      { kind: 'sub', inId: 'dhstud', outId: 'scrub', slot: 'DH', shiftSlots: [], deltaRpg: 0.5 },
      { kind: 'chain', inId: 'dhstud', outId: 'c', slot: 'DH', outSlot: 'C', shiftSlots: ['LF'], deltaRpg: 0.1 },
      { kind: 'shuffle', inId: 'cf', outId: 'lf', slot: 'DH', outSlot: 'DH', shiftSlots: ['LF'], deltaRpg: 0.09 },
    ],
    null,
    optimalBySlot,
  )
  // sub: a straight one-for-one, no shifts to explain.
  assert.deepEqual(rows[0], {
    kind: 'sub', pos: 'DH', expected: 'DhStud', starting: 'Scrub', startingPos: null,
    shifts: [], deltaRpg: 0.5, scoreImpact: 11.1,
  })
  // chain: Starting leaves from further down, so the shifted man is named.
  assert.deepEqual(rows[1].shifts, ['CenterField to LF'])
  assert.equal(rows[1].expected, 'DhStud')
  assert.equal(rows[1].starting, 'Catcher')
  assert.equal(rows[1].startingPos, 'C', 'a chain names where the departing man actually plays')
  // shuffle: same shape again — no second layout needed for a rearrangement.
  assert.equal(rows[2].kind, 'shuffle')
  assert.equal(rows[2].pos, 'DH')
  assert.deepEqual(rows[2].shifts, ['CenterField to LF'])
})

test('lineupStrengthRows: shifts degrade to empty without the optimal assignment', () => {
  const data = synthData()
  const [row] = lineupStrengthRows(data, [
    { kind: 'chain', inId: 'dhstud', outId: 'c', slot: 'DH', shiftSlots: ['LF'], deltaRpg: 0.1 },
  ])
  assert.deepEqual(row.shifts, [], 'no optimal map supplied -> no fabricated shift text')
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
  const pool = [{ id: 'x', rpg: 0.5, primaryPos: '1B', positions: ['1B'] }]
  // Post x at catcher — a slot he has no eligibility for. Must floor, not forbid.
  const { total, perSlot } = valueLineup(pool, [{ id: 'x', slot: 'C' }])
  assert.ok(Number.isFinite(total))
  assert.ok(Number.isFinite(perSlot[0].value))
})

// --- receipt grouping: one row per FINDING, not per slot ----------------------
// The difference between optimal and posted is a permutation with entries and
// exits. Reporting it slot by slot split one move into several rows that each
// read as a benching, and let the noise floor drop a NEGATIVE leg so the
// survivor overstated itself. These pin the grouped behaviour.

// Locked regulars, so only the slots under test can move.
function regulars(mk, skip = []) {
  for (const s of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']) {
    if (skip.includes(s)) continue
    mk(`x${s}`, `Reg${s}`, s, 0.2, 0, [s])
  }
}
function rosterOf(build) {
  const players = {}
  const mk = (id, name, primaryPos, rpg, fldRpg, positions) => {
    players[id] = { name, teamId: 1, primaryPos, rpg, fldRpg, pa: 400, positions: [...positions, 'DH'] }
  }
  build(mk)
  return { season: 2026, players, constants: {} }
}

// A roster where the optimum must ROTATE two men rather than substitute: a
// glove-first shortstop and a bat-first man who can also cover short. The optimum
// wants the glove at short and the bat at DH. Neither is a catcher, so the
// catcher-rest rule below deliberately does not apply.
const rotationData = () =>
  rosterOf((mk) => {
    mk('goodGlove', 'GoodGlove', 'SS', 0.1, 0.05, ['SS'])
    mk('goodBat', 'GoodBat', '3B', 0.3, -0.06, ['SS'])
    regulars(mk, ['SS'])
  })

// Posted: the bat plays short and the glove DHs — exactly backwards.
const rotationPosted = [
  { personId: 'goodBat', position: 'SS' },
  { personId: 'xC', position: 'C' },
  { personId: 'x1B', position: '1B' },
  { personId: 'x2B', position: '2B' },
  { personId: 'x3B', position: '3B' },
  { personId: 'xLF', position: 'LF' },
  { personId: 'xCF', position: 'CF' },
  { personId: 'xRF', position: 'RF' },
  { personId: 'goodGlove', position: 'DH' },
]

test('receipt: a rotation is ONE row, not one per slot', () => {
  const data = rotationData()
  const items = receiptFor(data, 1, rotationPosted)
  // Both men are already playing, so nobody is benched: this must not read as
  // two separate "bench X for Y" findings.
  assert.equal(items.length, 1, `expected one grouped finding, got ${JSON.stringify(items)}`)
  assert.equal(items[0].kind, 'shuffle')
  assert.equal(items[0].slot, 'DH', 'a rearrangement is headlined at DH')
  assert.notEqual(items[0].inId, items[0].outId)
})

test('receipt: rows account for the gap, including negative legs', () => {
  // The regression this pins: the optimum accepts a LOSS at one slot to gain more
  // at another. Filtering per slot dropped the losing leg and left the winning one
  // standing alone, so the card's rows summed to MORE than the score they explain.
  const data = rotationData()
  const grade = gradeLineup(data, 1, rotationPosted)
  const items = receiptFor(data, 1, rotationPosted)
  const summed = items.reduce((a, it) => a + it.deltaRpg, 0)
  assert.ok(
    summed <= grade.gapRpg + 1e-9,
    `rows (${summed}) must never exceed the gap they explain (${grade.gapRpg})`,
  )
  assert.ok(Math.abs(summed - grade.gapRpg) < 1e-9, 'and here they should account for it exactly')
  // Sanity: one of the two legs really is negative, or this proves nothing.
  const legs = SLOTS.map((slot) => {
    const o = grade.optimal.assignments.find((a) => a.slot === slot)
    const a = grade.actual.perSlot.find((x) => x.slot === slot)
    return o && a ? o.value - a.value : 0
  })
  assert.ok(Math.min(...legs) < -1e-9, 'fixture must contain a losing leg to be meaningful')
})

test('receipt: a chain reports one entry and one exit, naming who shifts between', () => {
  // A masher on the bench can only play third. Bringing him in pushes the posted
  // third baseman across to short, which pushes the weak shortstop out — three
  // slots touched, but still ONE personnel finding.
  const data = rosterOf((mk) => {
    mk('masher', 'Masher', '3B', 0.9, 0, ['3B'])
    mk('flex', 'Flex', '3B', 0.4, 0, ['3B', 'SS'])
    mk('weakSS', 'WeakSS', 'SS', -0.2, 0, ['SS'])
    mk('filler', 'Filler', 'DH', 0.1, 0, [])
    regulars(mk, ['3B', 'SS'])
  })
  const posted = [
    { personId: 'flex', position: '3B' },
    { personId: 'weakSS', position: 'SS' },
    { personId: 'xC', position: 'C' },
    { personId: 'x1B', position: '1B' },
    { personId: 'x2B', position: '2B' },
    { personId: 'xLF', position: 'LF' },
    { personId: 'xCF', position: 'CF' },
    { personId: 'xRF', position: 'RF' },
    { personId: 'filler', position: 'DH' },
  ]
  const items = receiptFor(data, 1, posted)
  const personnel = items.filter((it) => it.kind === 'sub' || it.kind === 'chain')
  assert.equal(personnel.length, 1, `expected one personnel finding, got ${JSON.stringify(items)}`)
  assert.equal(personnel[0].kind, 'chain', 'a multi-slot move is a chain, not a plain sub')
  assert.equal(personnel[0].inId, 'masher', 'the man who comes IN is the one off the bench')
  // Whoever goes out must actually leave the lineup, never someone still playing.
  const optimalIds = new Set(gradeLineup(data, 1, posted).optimal.assignments.map((a) => String(a.id)))
  assert.ok(!optimalIds.has(personnel[0].outId), 'the man who goes OUT is not in the optimal nine')
  // And the men who merely shift are named, so the row can't imply the man going
  // out was playing the slot the man coming in takes.
  assert.ok(personnel[0].shiftSlots.length > 0, 'a chain names the slots it moves through')
})

test('solver: value ties do not produce a gratuitously rearranged optimal', () => {
  // With no familiarity term, swapping two interchangeable fielders is worth
  // exactly nothing. Without a tie-break the solver could return either, and the
  // receipt would claim a change worth zero. `prefer` settles it toward the
  // manager's own arrangement.
  const data = rosterOf((mk) => {
    mk('cornerA', 'CornerA', 'LF', 0.2, 0.01, ['LF', 'RF'])
    mk('cornerB', 'CornerB', 'RF', 0.2, 0.01, ['LF', 'RF'])
    mk('dh', 'DhGuy', 'DH', 0.2, 0, [])
    regulars(mk, ['LF', 'RF'])
  })
  const posted = [
    { personId: 'cornerB', position: 'LF' }, // "wrong" way round, but worth the same
    { personId: 'cornerA', position: 'RF' },
    { personId: 'xC', position: 'C' },
    { personId: 'x1B', position: '1B' },
    { personId: 'x2B', position: '2B' },
    { personId: 'x3B', position: '3B' },
    { personId: 'xSS', position: 'SS' },
    { personId: 'xCF', position: 'CF' },
    { personId: 'dh', position: 'DH' },
  ]
  const grade = gradeLineup(data, 1, posted)
  const optBySlot = new Map(grade.optimal.assignments.map((a) => [a.slot, String(a.id)]))
  assert.equal(optBySlot.get('LF'), 'cornerB', 'a tie leaves the posted man where he is')
  assert.equal(optBySlot.get('RF'), 'cornerA')
  assert.equal(receiptFor(data, 1, posted).length, 0, 'a zero-value tie earns no receipt row')
})

test('catcher rest: the model never proposes putting a rested catcher back behind the plate', () => {
  // A starting catcher at DH is being rested from catching — no club catches one
  // man 162 times. Proposing to put him back is second-guessing workload the
  // model cannot see, so it is forbidden outright rather than deducted for.
  // Deliberately the SAME shape as the rotation fixture above, which does fire:
  // the only difference is that these two men are catchers.
  const data = rosterOf((mk) => {
    mk('starterC', 'StarterC', 'C', 0.1, 0.05, ['C'])
    mk('backupC', 'BackupC', 'C', 0.3, -0.06, ['C'])
    regulars(mk, ['C'])
  })
  const posted = [
    { personId: 'backupC', position: 'C' },
    { personId: 'x1B', position: '1B' },
    { personId: 'x2B', position: '2B' },
    { personId: 'x3B', position: '3B' },
    { personId: 'xSS', position: 'SS' },
    { personId: 'xLF', position: 'LF' },
    { personId: 'xCF', position: 'CF' },
    { personId: 'xRF', position: 'RF' },
    { personId: 'starterC', position: 'DH' },
  ]
  const grade = gradeLineup(data, 1, posted)
  const atCatcher = grade.optimal.assignments.find((a) => a.slot === 'C')
  assert.equal(String(atCatcher.id), 'backupC', 'a rested catcher is not proposed back at C')
  assert.equal(receiptFor(data, 1, posted).length, 0, 'and it costs the club nothing')
  assert.equal(grade.score, 10)
})

test('catcher rest: the relaxed force-fill never falls back to the man it forbids', () => {
  // Thin catching depth: nobody in the pool is eligible at C except the resting
  // starter, whom catcherRestForbids rules out. Without a forbid-aware relax,
  // the only "fallback" candidate for the force-fill would be the very player
  // the rule exists to keep out, and the whole grade would go infeasible —
  // silently hiding the card — rather than degrading gracefully like every
  // other data hole in this model.
  const data = rosterOf((mk) => {
    mk('starterC', 'StarterC', 'C', 0.6, 0, ['C']) // best bat on the roster, forbidden at C tonight
    mk('emergencyC', 'EmergencyC', 'RF', -0.1, 0, []) // posted at C, not eligible anywhere yet
    regulars(mk, ['C'])
  })
  const posted = [
    { personId: 'starterC', position: 'DH' },
    { personId: 'emergencyC', position: 'C' },
    { personId: 'x1B', position: '1B' },
    { personId: 'x2B', position: '2B' },
    { personId: 'x3B', position: '3B' },
    { personId: 'xSS', position: 'SS' },
    { personId: 'xLF', position: 'LF' },
    { personId: 'xCF', position: 'CF' },
    { personId: 'xRF', position: 'RF' },
  ]
  const grade = gradeLineup(data, 1, posted)
  assert.ok(grade, 'a thin-catching roster must still grade, not go infeasible')
  assert.ok(grade.relaxed, 'C had no eligible candidate before the relax, so this must take that path')
  const atCatcher = grade.optimal.assignments.find((a) => a.slot === 'C')
  assert.notEqual(String(atCatcher.id), 'starterC', 'the rested catcher is never the fallback either')
  assert.equal(String(atCatcher.id), 'emergencyC', 'falls back to the lowest-rpg allowed bat instead')
})
