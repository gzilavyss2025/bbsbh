// Lineup Strength — a spoiler-free pregame grade of the starting nine a manager
// actually posted, measured against the best nine this roster could plausibly
// field tonight (metric engine L2; see .scratch/metric-engines/lineup-strength.md).
// Inputs are the posted lineup plus season aggregates only (no game score), same
// footing as savantPercentiles.js, so it renders pregame on TeamInfo with no
// SealBox. MLB only — the values file is MLB-only at source (FanGraphs WAR), so
// a null return means "hide the card" (the MiLB degrade-gracefully convention).
//
// Reads the static, same-origin public/data/lineup-values.json (built nightly by
// scripts/gen-lineup-values.mjs): per-player runs/game value + positional
// eligibility for all 30 clubs. The value-maximizing assignment can't be
// precomputed — lineups only post pregame — so the Hungarian solve runs here at
// runtime over src/lib/lineupSolver.js (pure).

import {
  solveOptimalLineup,
  valueLineup,
  unfamiliarPenalty,
  ELIG_FLOOR,
  POS_ADJ,
  SLOTS,
} from '../lib/lineupSolver.js'
import { TIER_LABELS } from '../lib/statTiers.js'
import { lineupStrengthTierFor } from '../lib/lineupStrengthTier.js'
import { fetchWarData } from './war.js'

// Runs/game gap that maps to a 0/10 score. A whole-grade point is ~0.045
// runs/game, so a lineup ~0.45 runs/game below its ceiling grades out. Tunable;
// calibrate against the league-wide nightly distribution once a season of files
// exists (the design doc flags this as the one empirical knob).
export const SCORE_GAP_FULL = 0.045

let cached = null

export async function fetchLineupValues() {
  if (cached) return cached
  try {
    const res = await fetch('/data/lineup-values.json')
    if (!res.ok) throw new Error(`lineup-values.json ${res.status}`)
    const values = await res.json()
    // Attach the season WAR file as a secondary, runtime value source. A starter
    // posted tonight can be absent from this (nightly, team-scoped) file after a
    // trade or call-up made since the last build; war.json is league-wide and
    // rebuilt on its own cron, so it usually still carries his bat. candidatePool
    // reads warFallback to value such a starter instead of dropping him to
    // replacement. Only trusted when its season matches, so a stale off-season
    // file never bleeds in.
    let warFallback = null
    try {
      const war = await fetchWarData()
      if (war && (war.season == null || war.season === values.season)) {
        warFallback = { bat: war.bat ?? {}, pa: war.pa ?? {} }
      }
    } catch {
      warFallback = null
    }
    cached = { ...values, warFallback }
  } catch {
    cached = null
  }
  return cached
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// Value a bat from season WAR the same way the nightly build does (gen-lineup-
// values.mjs computeRpg): WAR per 600 PA, `primaryPos`'s positional adjustment
// stripped off that RAW rate, then regressed toward replacement at low PA and
// converted to runs/game — strip BEFORE regress, for the reason spelled out in
// the generator's header. Result is a position-NEUTRAL bat, the same units
// lineup-values.json stores. Used only as a runtime fallback for a posted starter
// absent from the nightly values file but present in the season WAR file (war.json
// carries `pa` alongside `bat` for exactly this). Returns null when WAR or PA is
// missing so the caller can degrade to the replacement path.
export function rpgFromWar(war, pa, constants = {}, primaryPos) {
  if (!Number.isFinite(war) || !Number.isFinite(pa) || pa <= 0) return null
  const paScale = constants.paScale ?? 600
  const regressionPa = constants.regressionPa ?? 250
  const runsPerWar = constants.runsPerWar ?? 9.5
  const games = constants.games ?? 162
  const warPer600 = (war / pa) * paScale
  const neutral = warPer600 - (POS_ADJ[primaryPos] ?? 0) / runsPerWar
  const regressed = neutral * (pa / (pa + regressionPa))
  return (regressed * runsPerWar) / games
}

// Boxscore position abbreviations map straight onto the solver's SLOTS, save a
// pitcher batting (an Ohtani-style two-way DH, or an NL-quirk position player on
// the mound who never happens here pregame) → treat the slot as DH.
function normalizeSlot(position) {
  const pos = String(position || '').toUpperCase()
  if (pos === 'P' || pos === 'SP' || pos === 'DH-P') return 'DH'
  return pos
}

// Resolve a posted starter the team pool didn't cover (missing from the nightly
// values file because he moved onto this roster after the last build). Three
// tiers, best data first:
//   (a) present in the values file under ANOTHER club (a recent trade): his
//       season rpg and eligibility are team-independent, so use them as posted.
//   (b) present in the season WAR file: value his bat from WAR (same model as the
//       nightly build), eligible at the slot he's actually posted at (his de-facto
//       primary) plus DH — we don't know his other positions, so the optimal
//       shouldn't shuffle him elsewhere.
//   (c) unknown everywhere: replacement bat, but FULLY familiar at his posted slot
//       — you are never "out of position" at your own position. (The old floor
//       here double-charged an unfamiliarity penalty at a spot we'd just named his
//       primary, tanking the grade of any lineup with a just-acquired starter.)
//       Flagged `unknown` so gradeLineup excludes his slot from the gap rather
//       than inventing a weakness from a data hole.
function resolveMissingStarter(data, id, slot) {
  const key = String(id)
  const known = data?.players?.[key]
  if (known) {
    return {
      id: key,
      rpg: known.rpg ?? 0,
      elig: known.elig ?? { [slot]: 1, DH: 1 },
      primaryPos: known.primaryPos ?? slot,
    }
  }
  // His posted slot stands in for his primary position (we don't know his real
  // one), so it's also what the positional strip is anchored on.
  const rpg = rpgFromWar(
    data?.warFallback?.bat?.[key],
    data?.warFallback?.pa?.[key],
    data?.constants,
    slot,
  )
  if (rpg != null) {
    return { id: key, rpg, elig: { [slot]: 1, DH: 1 }, primaryPos: slot, resolved: 'war' }
  }
  return { id: key, rpg: 0, elig: { [slot]: 1, DH: 1 }, primaryPos: slot, unknown: true }
}

// Turn the values-file player map for one club (plus any actual starters missing
// from it, resolved via resolveMissingStarter) into the solver's candidate pool.
function candidatePool(data, teamId, actual) {
  const pool = []
  const seen = new Set()
  for (const [id, p] of Object.entries(data?.players ?? {})) {
    if (p.teamId !== teamId) continue
    pool.push({ id, rpg: p.rpg ?? 0, elig: p.elig ?? {}, primaryPos: p.primaryPos })
    seen.add(String(id))
  }
  for (const { id, slot } of actual) {
    if (seen.has(String(id))) continue
    pool.push(resolveMissingStarter(data, id, slot))
    seen.add(String(id))
  }
  return pool
}

function normalizeActual(actualLineup) {
  return (actualLineup ?? [])
    .map((e) => ({ id: String(e.personId ?? e.id), slot: normalizeSlot(e.position ?? e.slot) }))
    .filter((e) => SLOTS.includes(e.slot))
}

function tierForScore(score) {
  if (score >= 8.5) return 'elite'
  if (score >= 7) return 'good'
  if (score >= 5.5) return 'average'
  return 'below'
}

// Grade one club's posted lineup. actualLineup: [{personId, position}] (nine
// entries; position as the boxscore reports it). Returns { score, tier, gapRpg,
// optimal, actual, ungraded, relaxed } or null when the pool can't be solved.
export function gradeLineup(data, teamId, actualLineup) {
  const actual = normalizeActual(actualLineup)
  if (!data || actual.length === 0) return null
  const pool = candidatePool(data, teamId, actual)
  const optimal = solveOptimalLineup(pool)
  if (!optimal) return null
  const actualValued = valueLineup(pool, actual)

  // Slots whose posted starter we could not value from any source (in neither the
  // values nor the WAR file): excluded from the gap so a data hole never reads as
  // a manager's weakness — the degrade-gracefully convention. The card surfaces
  // these as "not yet valued" rather than a phantom deduction.
  const byId = new Map(pool.map((p) => [String(p.id), p]))
  const ungraded = actual
    .filter(({ id }) => byId.get(String(id))?.unknown)
    .map(({ id, slot }) => ({ id: String(id), slot }))
  const ungradedSlots = new Set(ungraded.map((u) => u.slot))

  // The gap decomposes exactly into per-slot (optimal − posted) deltas, so drop
  // the excluded slots by summing per slot instead of differencing the totals.
  const optBySlot = new Map(optimal.assignments.map((a) => [a.slot, a.value]))
  const actBySlot = new Map(actualValued.perSlot.map((a) => [a.slot, a.value]))
  let gap = 0
  for (const slot of SLOTS) {
    if (ungradedSlots.has(slot)) continue
    gap += (optBySlot.get(slot) ?? 0) - (actBySlot.get(slot) ?? 0)
  }
  const gapRpg = Math.max(0, gap)
  const score = Math.round(clamp(10 - gapRpg / SCORE_GAP_FULL, 0, 10) * 10) / 10
  return {
    score,
    tier: tierForScore(score),
    tierLabel: TIER_LABELS[tierForScore(score)],
    gapRpg,
    optimal,
    actual: actualValued,
    ungraded,
    relaxed: Boolean(optimal.relaxed),
  }
}

// Itemized "receipt" explaining the gap, biggest deltas first, capped at five:
//  - bench: a slot where the optimal player differs from the posted one
//    { kind:'bench', inId, outId, slot, deltaRpg } (runs/game the swap recovers)
//  - oop: a posted player at a slot he's < 0.7 familiar with
//    { kind:'oop', id, slot, weight, deltaRpg } (his unfamiliarity penalty there)
// Items under 0.02 runs/game are dropped as noise.
export function receiptFor(data, teamId, actualLineup) {
  const grade = gradeLineup(data, teamId, actualLineup)
  if (!grade) return []
  const pool = candidatePool(data, teamId, normalizeActual(actualLineup))
  const byId = new Map(pool.map((p) => [String(p.id), p]))
  const optBySlot = new Map(grade.optimal.assignments.map((a) => [a.slot, a]))
  const actBySlot = new Map(grade.actual.perSlot.map((a) => [a.slot, a]))
  // Slots excluded from the gap (unvalued posted starter) earn no receipt line —
  // we make no claim about a spot we couldn't grade.
  const ungradedSlots = new Set((grade.ungraded ?? []).map((u) => u.slot))
  const items = []
  const benchSlots = new Set()

  // (a) Per-slot personnel swaps. The per-slot value delta between the optimal
  // and posted assignment decomposes the total gap exactly, so this is the gap's
  // honest line-item breakdown.
  for (const slot of SLOTS) {
    if (ungradedSlots.has(slot)) continue
    const opt = optBySlot.get(slot)
    const act = actBySlot.get(slot)
    if (!opt || !act) continue
    if (String(opt.id) === String(act.id)) continue
    const deltaRpg = opt.value - act.value
    if (deltaRpg < 0.02) continue
    items.push({ kind: 'bench', inId: String(opt.id), outId: String(act.id), slot, deltaRpg })
    benchSlots.add(slot)
  }

  // (b) Out-of-position posted starters (familiarity < 0.7). Skip any slot that
  // already has a bench swap above: the swap's value delta ALREADY prices in the
  // posted starter's unfamiliarity there, so a separate out-of-position line for
  // the same slot double-reports it (and reads as a duplicate row in the table).
  // Only a slot whose posted starter is the OPTIMAL choice but still unfamiliar
  // (no swap) earns its own out-of-position line.
  for (const { id, slot } of normalizeActual(actualLineup)) {
    if (ungradedSlots.has(slot)) continue
    if (benchSlots.has(slot)) continue
    const p = byId.get(String(id))
    const weight = p?.elig?.[slot] ?? ELIG_FLOOR
    if (weight >= 0.7) continue
    const pen = unfamiliarPenalty(p ?? { elig: { [slot]: ELIG_FLOOR } }, slot)
    const deltaRpg = Number.isFinite(pen) ? pen : (1 - ELIG_FLOOR) * 0.12
    if (deltaRpg < 0.02) continue
    items.push({ kind: 'oop', id: String(id), slot, weight: Math.round(weight * 100) / 100, deltaRpg })
  }

  return items.sort((a, b) => b.deltaRpg - a.deltaRpg).slice(0, 5)
}

// One-call convenience: the grade plus its receipt. `names` is an optional
// {id: displayName} map (from the posted lineup) so a starter valued only from
// war.json — absent from the values file, which is where names live — still shows
// his real name in the receipt and the partial-grade note instead of a dash.
export function lineupStrengthFor(data, teamId, actualLineup, names = {}) {
  const grade = gradeLineup(data, teamId, actualLineup)
  if (!grade) return null
  const items = receiptFor(data, teamId, actualLineup)
  return {
    score: grade.score,
    tier: grade.tier,
    tierLabel: grade.tierLabel,
    // A lineup-specific, score-tracking tier word (separate from the shared
    // statTiers `tier`/`tierLabel` above, which stay for any other consumer).
    // Seeded on teamId so the within-band word is deterministic across refresh.
    strengthTier: lineupStrengthTierFor(grade.score, teamId),
    gapRpg: grade.gapRpg,
    items,
    rows: lineupStrengthRows(data, items, names),
    // Posted starters we couldn't value (excluded from the gap); the card notes
    // them as "not yet valued" so a partial grade is transparent.
    ungraded: (grade.ungraded ?? []).map((u) => ({
      slot: u.slot,
      name: playerName(data, u.id, names),
    })),
    relaxed: grade.relaxed,
  }
}

// Name lookup for a receipt line. The values file carries display names; `names`
// (the posted lineup's id→name map) backfills a starter present only in war.json.
export function playerName(data, personId, names = null) {
  return data?.players?.[String(personId)]?.name ?? names?.[String(personId)] ?? null
}

// Shape the receipt `items` into display rows for the Pos | Expected | Starting
// | R/G table (LineupStrengthCard). Pure so the two item kinds' column mapping
// is unit-testable:
//   - bench: the optimal player is displaced by the posted starter, so
//     Expected = inId (who you'd want), Starting = outId (who's in there).
//   - oop:   a posted starter is out of position; there is NO displaced
//     "expected" name, so `expected` is left null and the caller renders the
//     player's name across the Expected/Starting columns with their `usualPos`
//     (primary fielding position) as the natural-spot hint, rather than
//     fabricating an expected name. `usualPos` is null when unknown or when it
//     is the slot itself (so the caller can omit the hint).
// `deltaRpg` is the runs/game the row costs (rendered as a negative).
// Points off the 10 that a `deltaRpg` deduction costs. The score is
// 10 − gap/SCORE_GAP_FULL, so each line-item's share of the gap converts to
// grade points at the same rate — a far more legible unit for the card than raw
// runs/game (a 0.045 r/g move is one whole grade point).
export function scoreImpactOf(deltaRpg) {
  return Math.round((deltaRpg / SCORE_GAP_FULL) * 10) / 10
}

export function lineupStrengthRows(data, items, names = null) {
  return (items ?? []).map((it) => {
    if (it.kind === 'bench') {
      return {
        kind: 'bench',
        pos: it.slot,
        expected: playerName(data, it.inId, names),
        starting: playerName(data, it.outId, names),
        deltaRpg: it.deltaRpg,
        scoreImpact: scoreImpactOf(it.deltaRpg),
      }
    }
    const usual = data?.players?.[String(it.id)]?.primaryPos ?? null
    return {
      kind: 'oop',
      pos: it.slot,
      expected: null,
      starting: playerName(data, it.id, names),
      usualPos: usual && usual !== it.slot ? usual : null,
      deltaRpg: it.deltaRpg,
      scoreImpact: scoreImpactOf(it.deltaRpg),
    }
  })
}
