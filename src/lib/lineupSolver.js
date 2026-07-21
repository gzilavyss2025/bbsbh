// Pure, dependency-free assignment solver for the Lineup Strength grade
// (metric engine L2 — see .scratch/metric-engines/lineup-strength.md). Given a
// pool of hitters, each with a runs-per-game value (`rpg`), a primary position,
// and a positional-eligibility map (`elig`), it finds the run-value-maximizing
// assignment of nine field/DH slots to distinct players (an exact Hungarian
// solve), and it values an already-posted lineup the same way. No fetching, no
// DOM, no score data — the inputs are season aggregates only, so this module is
// spoiler-free by construction and unit-testable in isolation.

// The nine lineup slots. Order is fixed so callers can rely on it.
export const SLOTS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

// FanGraphs defensive positional adjustments, runs per 162 defensive games —
// the standard, published constants (confirmed current in the July-2026 research
// pass; see the design doc's "Research findings").
//
// These are NOT applied here. A lineup always fills the same nine slots, so
// sum(POS_ADJ[slot]) is a constant that cancels out of any posted-vs-optimal
// comparison — both at the total and, since each receipt row compares two
// players at the SAME slot, at every line item. Adding a per-slot constant to
// an assignment matrix also can't change which assignment is optimal. So the
// adjustment is genuinely inert at this layer and is deliberately absent from
// `slotValue`.
//
// Where it DOES belong is one layer up: WAR already contains the adjustment for
// the position a player actually played, so `gen-lineup-values.mjs` strips it
// off his raw WAR rate to store a position-NEUTRAL bat in lineup-values.json
// (mirrored at runtime by `rpgFromWar`). Both import these constants from here
// so the model has one home. Applying it in both places was the original bug:
// see the header note on the strip's ordering in the generator.
export const POS_ADJ = {
  C: 12.5,
  SS: 7.5,
  '2B': 2.5,
  '3B': 2.5,
  CF: 2.5,
  LF: -7.5,
  RF: -7.5,
  '1B': -12.5,
  DH: -17.5,
}

// Runs/game charged for total unfamiliarity at a slot (eligibility weight 0).
// A weight-1 (fully familiar) placement costs nothing; a weight-w placement
// costs (1 - w) * this. Small on purpose — the eligibility gate already forbids
// spots a player can't cover at all; this only shades the ones he can.
export const UNFAMILIAR_PENALTY = 0.12

// Floor eligibility weight applied to an actual-lineup placement whose values
// file carries no familiarity for that slot (an unknown/fallback player, or a
// spot he's never logged an inning at yet is nonetheless starting at tonight).
// He is demonstrably playing there, so he is valued, not forbidden.
export const ELIG_FLOOR = 0.3

// Weight granted to a forced starter when a slot has no eligible candidate at
// all (the no-catcher relax path). Below the normal eligible floor (0.3) so a
// relaxed placement is visibly a stopgap, not a real option.
export const RELAX_WEIGHT = 0.1

// Runs/game penalty for placing player `p` at `slot`, given his familiarity
// weight there. Returns Infinity when he has no eligibility at the slot — the
// caller reads that as a forbidden assignment.
export function unfamiliarPenalty(p, slot) {
  const w = p.elig?.[slot]
  if (w === undefined) return Infinity
  return (1 - w) * UNFAMILIAR_PENALTY
}

// Run value (runs/game) of player `p` in `slot`: his position-neutral bat (rpg)
// minus the unfamiliarity penalty. No positional adjustment term — see the
// POS_ADJ header for why it cancels here. -Infinity when the slot is forbidden
// (no eligibility), which the solver treats as an impossible pairing.
export function slotValue(p, slot) {
  const w = p.elig?.[slot]
  if (w === undefined) return -Infinity
  return p.rpg - (1 - w) * UNFAMILIAR_PENALTY
}

// Same value, but never forbidden: a missing eligibility floors to ELIG_FLOOR.
// Used to value an actual posted placement, which is a fact, not a proposal.
export function slotValueFloored(p, slot) {
  const w = p.elig?.[slot] ?? ELIG_FLOOR
  return p.rpg - (1 - w) * UNFAMILIAR_PENALTY
}

// Exact max-weight bipartite assignment (Hungarian / Kuhn-Munkres, O(n^2 m))
// of `nRows` rows to distinct columns. `value[i][j]` may be -Infinity for a
// forbidden pairing. Returns { rowCol, total, feasible }: rowCol[i] is the
// column assigned to row i (or -1), total sums the chosen original values, and
// feasible is false when any row could only be matched to a forbidden/absent
// column. Standard min-cost formulation (e-maxx) with cost = -value and a large
// finite BIG standing in for a forbidden cell; because BIG dominates any real
// cost sum, the optimum avoids forbidden cells whenever a feasible matching of
// all rows exists, so detecting BIG in the result is a sound infeasibility test.
function solveAssignment(value, nRows, nCols) {
  const n = nRows
  const m = Math.max(nCols, nRows)
  const BIG = 1e9
  // 1-indexed cost matrix, minimization; phantom columns (j > nCols) forbidden.
  const a = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(BIG))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const v = j <= nCols ? value[i - 1][j - 1] : -Infinity
      a[i][j] = Number.isFinite(v) ? -v : BIG
    }
  }
  const INF = Infinity
  const u = new Array(n + 1).fill(0)
  const v = new Array(m + 1).fill(0)
  const p = new Array(m + 1).fill(0) // p[j] = row currently matched to column j
  const way = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(m + 1).fill(INF)
    const used = new Array(m + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = INF
      let j1 = -1
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue
        const cur = a[i0][j] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else {
          minv[j] -= delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const rowCol = new Array(n).fill(-1)
  for (let j = 1; j <= m; j++) {
    if (p[j] >= 1 && p[j] <= n) rowCol[p[j] - 1] = j - 1
  }
  let total = 0
  let feasible = true
  for (let i = 0; i < n; i++) {
    const c = rowCol[i]
    if (c < 0 || c >= nCols || !Number.isFinite(value[i][c])) {
      feasible = false
      continue
    }
    total += value[i][c]
  }
  return { rowCol, total, feasible }
}

function buildValueMatrix(players) {
  return SLOTS.map((slot) => players.map((p) => slotValue(p, slot)))
}

function attempt(players) {
  const value = buildValueMatrix(players)
  const { rowCol, total, feasible } = solveAssignment(value, SLOTS.length, players.length)
  if (!feasible) return null
  const assignments = SLOTS.map((slot, i) => ({
    slot,
    id: players[rowCol[i]].id,
    value: value[i][rowCol[i]],
  }))
  return { assignments, total }
}

// When a slot has no eligible candidate at all (classically catcher), grant the
// least-bad option a RELAX_WEIGHT floor so the solve can complete. Prefer a
// player whose primary IS that slot; else the lowest-rpg bat (a real team parks
// its least valuable stick behind the plate in an emergency). Returns a cloned
// pool so the caller's players are untouched.
function relaxEligibility(players) {
  const clone = players.map((p) => ({ ...p, elig: { ...p.elig } }))
  for (const slot of SLOTS) {
    if (slot === 'DH') continue
    if (clone.some((p) => p.elig[slot] !== undefined)) continue
    let pick = clone.filter((p) => p.primaryPos === slot)
    if (pick.length === 0) {
      const sorted = [...clone].sort((x, y) => x.rpg - y.rpg)
      pick = sorted.length ? [sorted[0]] : []
    }
    for (const p of pick) {
      if (p.elig[slot] === undefined || p.elig[slot] < RELAX_WEIGHT) p.elig[slot] = RELAX_WEIGHT
    }
  }
  return clone
}

// Optimal assignment of the nine slots over a candidate pool. Returns
// { assignments: [{slot, id, value}], total } (biggest-value assignment), or
// the same shape with `relaxed: true` when a slot had to be force-filled, or
// null if even the relaxed problem is infeasible (fewer than nine players).
export function solveOptimalLineup(players, _opts = {}) {
  if (!Array.isArray(players) || players.length < SLOTS.length) {
    // Too few candidates to fill nine distinct slots — relax can't help.
    if (!Array.isArray(players) || players.length === 0) return null
  }
  const strict = attempt(players)
  if (strict) return strict
  const relaxed = attempt(relaxEligibility(players))
  if (relaxed) return { ...relaxed, relaxed: true }
  return null
}

// Value an already-posted lineup: `actual` is [{id, slot}] (nine entries). Uses
// the floored value so a real placement is never forbidden. A player not in the
// pool is valued as replacement-level (rpg 0) at floor familiarity — never a
// crash. Returns { total, perSlot: [{slot, id, value}] }.
export function valueLineup(players, actual) {
  const byId = new Map(players.map((p) => [String(p.id), p]))
  let total = 0
  const perSlot = actual.map(({ id, slot }) => {
    const p = byId.get(String(id)) ?? { id, rpg: 0, primaryPos: slot, elig: {} }
    const value = slotValueFloored(p, slot)
    total += value
    return { slot, id, value }
  })
  return { total, perSlot }
}
