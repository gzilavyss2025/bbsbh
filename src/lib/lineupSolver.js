// Pure, dependency-free assignment solver for the Lineup Strength grade
// (metric engine L2 — see docs/lineup-strength.md for the full design rationale,
// which you should read before changing anything in this file). Given a pool of
// hitters, each with a bat (`rpg`), a glove (`fldRpg`) and the set of positions
// he can currently cover (`positions`), it finds the value-maximizing assignment
// of nine field/DH slots to distinct players (an exact Hungarian solve), and it
// values an already-posted lineup the same way. No fetching, no DOM, no score
// data — the inputs are season aggregates only, so this module is spoiler-free
// by construction and unit-testable in isolation.
//
// The whole objective, in one line:
//
//     total = sum(bat + glove) over the nine  -  glove(DH)
//
// because a designated hitter does not field. Everything below is that, plus
// feasibility.

// The nine lineup slots. Order is fixed so callers can rely on it.
export const SLOTS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

// THE POSITIONAL ADJUSTMENT IS DELIBERATELY ABSENT FROM THIS MODULE. The
// FanGraphs constants (C +12.5 … DH -17.5 runs per 162 defensive games) used to
// be applied here, as POS_ADJ[slot] - POS_ADJ[primary]. Do not reintroduce them.
//
// Two reasons, either one sufficient:
//
//  1. It cancels. A lineup always fills the same nine slots, so the sum of the
//     slots' own adjustments is a constant — out of the total, and out of every
//     receipt row too, since a row compares two players at the SAME slot. Adding
//     a per-slot constant to an assignment matrix also cannot change which
//     assignment is optimal.
//  2. Nothing is left for it to proxy. It existed to make bats at different
//     positions comparable when the only input was WAR, which bundles bat and
//     glove together. `lineup-values.json` now carries those SEPARATELY — `rpg`
//     from wRC+ (offense only) and `fldRpg` from season fielding runs — so the
//     defensive spectrum is priced directly, by measurement rather than by
//     positional average.
//
// Trying to recover a bat from a WAR total is what broke the grade: FanGraphs'
// `Positional` is prorated by actual playing time, so subtracting a full-season
// constant overcharged a part-season catcher and overpaid a part-season DH. See
// the value-model header in scripts/gen-lineup-values.mjs.

// THERE IS NO FAMILIARITY DISCOUNT. Eligibility is a hard yes/no, never a
// weight that shades a player's value at a spot. This is deliberate and is the
// second thing (after the positional adjustment) that must not come back.
//
// `fldRpg` is a season TOTAL across every position a player manned — FanGraphs
// publishes one fielding figure per player, not one per position — so it
// contributes identically at every fielding slot. That left the familiarity
// weight as the ONLY term that varied by arrangement, which meant every lineup
// rearrangement the model ever proposed was driven by it. And familiarity is
// innings data: evidence a player CAN cover a spot, not that he is good there.
// Pricing feasibility as if it were quality produced answers like "start Yordan
// Alvarez in left field" — he had more career LF innings than the man posted
// there, so the model moved him out of the DH slot he belongs in.
//
// Consequence worth knowing: any two arrangements of the same eight fielders now
// have exactly equal value. Only WHO is in the nine, and WHICH ONE DHs, can move
// the number. See `PREFER_EPSILON` for how ties are settled.

// Tie-break nudge, in runs/game. With no familiarity term, rearranging the same
// eight fielders is value-neutral, so the solver would otherwise be free to
// return a gratuitously shuffled "optimal" that differs from the posted lineup
// for no reason. This epsilon makes it prefer leaving a player where his manager
// put him whenever the choice is a genuine tie. It is orders of magnitude below
// the smallest real difference the values file can express (rpg/fldRpg are
// rounded to 1e-3), so it can never override an actual preference.
export const PREFER_EPSILON = 1e-9

// True when `p` can currently cover `slot`. `positions` is a plain array of slot
// names built by gen-lineup-values.mjs from RECENT fielding innings — a career
// total is not enough (see docs/lineup-strength.md on the Ryan Braun problem).
export function isEligible(p, slot) {
  return Array.isArray(p?.positions) && p.positions.includes(slot)
}

// A designated hitter does not field, so his glove is worth exactly nothing in
// that slot — the one place the two halves of a player's value come apart. This
// is what makes hiding a poor defender at DH correctly free, what stops the model
// from benching a glove-first regular over his bat alone, and what makes the
// optimal DH simply "the worst glove among the nine, subject to someone being
// able to cover the spot he vacates".
export function fieldingCredit(p, slot) {
  if (slot === 'DH') return 0
  return p.fldRpg ?? 0
}

// Run value (runs/game) of player `p` in `slot`: his bat, plus his glove at a
// fielding slot. -Infinity when he cannot cover the slot, which the solver reads
// as an impossible pairing. Used to score PROPOSALS, so the gate applies.
export function slotValue(p, slot) {
  if (!isEligible(p, slot)) return -Infinity
  return p.rpg + fieldingCredit(p, slot)
}

// Same value, but never forbidden. Used to value an already-posted placement,
// which is a FACT, not a proposal: the manager has this defense on the field, and
// second-guessing whether he can on our thin innings data is exactly the
// presumption the eligibility gate exists to avoid on the other side.
export function slotValueFloored(p, slot) {
  return p.rpg + fieldingCredit(p, slot)
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

// `prefer` is an optional Map of playerId -> the slot he is POSTED at tonight.
// Matching it earns PREFER_EPSILON, which settles value ties (see its comment)
// in favour of leaving the manager's arrangement alone. `forbid` is an optional
// Map of playerId -> Set of slots he must not be PROPOSED at, used for the
// catcher-rest rule in lineupStrength.js.
function buildValueMatrix(players, prefer, forbid) {
  return SLOTS.map((slot) =>
    players.map((p) => {
      if (forbid?.get(String(p.id))?.has(slot)) return -Infinity
      const v = slotValue(p, slot)
      if (!Number.isFinite(v)) return v
      return prefer?.get(String(p.id)) === slot ? v + PREFER_EPSILON : v
    }),
  )
}

function attempt(players, prefer, forbid) {
  const value = buildValueMatrix(players, prefer, forbid)
  const { rowCol, feasible } = solveAssignment(value, SLOTS.length, players.length)
  if (!feasible) return null
  // Report the TRUE value, without the tie-break nudge, so a caller differencing
  // optimal against posted never sees an epsilon leak into the gap.
  const assignments = SLOTS.map((slot, i) => ({
    slot,
    id: players[rowCol[i]].id,
    value: slotValueFloored(players[rowCol[i]], slot),
  }))
  return { assignments, total: assignments.reduce((a, x) => a + x.value, 0) }
}

// When a slot has no eligible candidate at all (classically catcher), force-fill
// it so the solve can complete. Prefer a player whose primary IS that slot; else
// the lowest-rpg bat (a real team parks its least valuable stick behind the plate
// in an emergency) — skipping anyone `forbid` rules out at this slot (the
// catcher-rest rule in lineupStrength.js), so a relaxed fill can never hand the
// slot right back to the one player it exists to keep out of it. Returns a
// cloned pool so the caller's players are untouched.
function relaxEligibility(players, forbid) {
  const clone = players.map((p) => ({ ...p, positions: [...(p.positions ?? [])] }))
  const allowedAt = (p, slot) => !forbid?.get(String(p.id))?.has(slot)
  for (const slot of SLOTS) {
    if (slot === 'DH') continue
    if (clone.some((p) => p.positions.includes(slot) && allowedAt(p, slot))) continue
    let pick = clone.filter((p) => p.primaryPos === slot && allowedAt(p, slot))
    if (pick.length === 0) {
      const sorted = clone.filter((p) => allowedAt(p, slot)).sort((x, y) => x.rpg - y.rpg)
      pick = sorted.length ? [sorted[0]] : []
    }
    for (const p of pick) if (!p.positions.includes(slot)) p.positions.push(slot)
  }
  return clone
}

// Optimal assignment of the nine slots over a candidate pool. Returns
// { assignments: [{slot, id, value}], total } (biggest-value assignment), or
// the same shape with `relaxed: true` when a slot had to be force-filled, or
// null if even the relaxed problem is infeasible (fewer than nine players).
// `opts.prefer` / `opts.forbid` are documented on buildValueMatrix.
export function solveOptimalLineup(players, opts = {}) {
  if (!Array.isArray(players) || players.length < SLOTS.length) {
    // Too few candidates to fill nine distinct slots — relax can't help.
    if (!Array.isArray(players) || players.length === 0) return null
  }
  const { prefer, forbid } = opts
  const strict = attempt(players, prefer, forbid)
  if (strict) return strict
  const relaxed = attempt(relaxEligibility(players, forbid), prefer, forbid)
  if (relaxed) return { ...relaxed, relaxed: true }
  return null
}

// Value an already-posted lineup: `actual` is [{id, slot}] (nine entries). Uses
// the floored value so a real placement is never forbidden. A player not in the
// pool is valued as a league-average bat and glove (rpg/fldRpg 0) — never a
// crash. Returns { total, perSlot: [{slot, id, value}] }.
export function valueLineup(players, actual) {
  const byId = new Map(players.map((p) => [String(p.id), p]))
  let total = 0
  const perSlot = actual.map(({ id, slot }) => {
    const p = byId.get(String(id)) ?? { id, rpg: 0, fldRpg: 0, primaryPos: slot, positions: [] }
    const value = slotValueFloored(p, slot)
    total += value
    return { slot, id, value }
  })
  return { total, perSlot }
}
