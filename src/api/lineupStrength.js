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
  SLOTS,
} from '../lib/lineupSolver.js'
import { TIER_LABELS } from '../lib/statTiers.js'
import { lineupStrengthTierFor } from '../lib/lineupStrengthTier.js'

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
    cached = await res.json()
  } catch {
    cached = null
  }
  return cached
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// Boxscore position abbreviations map straight onto the solver's SLOTS, save a
// pitcher batting (an Ohtani-style two-way DH, or an NL-quirk position player on
// the mound who never happens here pregame) → treat the slot as DH.
function normalizeSlot(position) {
  const pos = String(position || '').toUpperCase()
  if (pos === 'P' || pos === 'SP' || pos === 'DH-P') return 'DH'
  return pos
}

// Turn the values-file player map for one club (plus any actual starters missing
// from it, as replacement-level fallbacks) into the solver's candidate pool.
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
    // A starter the nightly build didn't have (call-up, just-acquired): value him
    // at replacement level, eligible only where he's actually starting.
    pool.push({ id: String(id), rpg: 0, elig: { [slot]: ELIG_FLOOR, DH: 1 }, primaryPos: slot })
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
// optimal, actual, relaxed } or null when the pool can't be solved.
export function gradeLineup(data, teamId, actualLineup) {
  const actual = normalizeActual(actualLineup)
  if (!data || actual.length === 0) return null
  const pool = candidatePool(data, teamId, actual)
  const optimal = solveOptimalLineup(pool)
  if (!optimal) return null
  const actualValued = valueLineup(pool, actual)
  const gapRpg = Math.max(0, optimal.total - actualValued.total)
  const score = Math.round(clamp(10 - gapRpg / SCORE_GAP_FULL, 0, 10) * 10) / 10
  return {
    score,
    tier: tierForScore(score),
    tierLabel: TIER_LABELS[tierForScore(score)],
    gapRpg,
    optimal,
    actual: actualValued,
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
  const items = []
  const benchSlots = new Set()

  // (a) Per-slot personnel swaps. The per-slot value delta between the optimal
  // and posted assignment decomposes the total gap exactly, so this is the gap's
  // honest line-item breakdown.
  for (const slot of SLOTS) {
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

// One-call convenience: the grade plus its receipt.
export function lineupStrengthFor(data, teamId, actualLineup) {
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
    rows: lineupStrengthRows(data, items),
    relaxed: grade.relaxed,
  }
}

// Name lookup for a receipt line (the values file carries display names).
export function playerName(data, personId) {
  return data?.players?.[String(personId)]?.name ?? null
}

// Shape the receipt `items` into display rows for the Pos | Expected | Starting
// | R/G table (LineupStrengthCard). Pure so the two item kinds' column mapping
// is unit-testable:
//   - bench: the optimal player is displaced by the posted starter, so
//     Expected = inId (who you'd want), Starting = outId (who's in there).
//   - oop:   a posted starter is out of position; there is NO displaced
//     "expected" name, so `expected` is left null — the caller renders an
//     em-dash rather than fabricating one. Starting = the posted player.
// `deltaRpg` is the runs/game the row costs (rendered as a negative).
export function lineupStrengthRows(data, items) {
  return (items ?? []).map((it) =>
    it.kind === 'bench'
      ? {
          kind: 'bench',
          pos: it.slot,
          expected: playerName(data, it.inId),
          starting: playerName(data, it.outId),
          deltaRpg: it.deltaRpg,
        }
      : {
          kind: 'oop',
          pos: it.slot,
          expected: null,
          starting: playerName(data, it.id),
          deltaRpg: it.deltaRpg,
        },
  )
}
