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
    // Attach the season file as a secondary, runtime value source. A starter
    // posted tonight can be absent from this (nightly, team-scoped) file after a
    // trade or call-up made since the last build; war.json is league-wide and
    // rebuilt on its own cron, so it usually still carries his line. candidatePool
    // reads warFallback to value such a starter instead of dropping him to
    // league average. Only trusted when its season matches, so a stale off-season
    // file never bleeds in.
    let warFallback = null
    try {
      const war = await fetchWarData()
      if (war && (war.season == null || war.season === values.season)) {
        warFallback = { wrc: war.wrc ?? {}, pa: war.pa ?? {} }
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

// Value a bat the same way the nightly build does (gen-lineup-values.mjs
// computeRpg): wRC+ regressed toward the 100 league average by PA, then runs/game
// above average for one lineup slot. Used only as a runtime fallback for a posted
// starter absent from the nightly values file but present in the season file
// (war.json carries `wrc` and `pa` on the same keys for exactly this). Returns
// null when wRC+ or PA is missing so the caller can degrade to the league-average
// path. Named for the file it reads, not for WAR — the grade stopped using the
// WAR total when it started reading the components (see the generator's header).
export function rpgFromWar(wrcPlus, pa, constants = {}) {
  if (!Number.isFinite(wrcPlus) || !Number.isFinite(pa) || pa <= 0) return null
  const regressionPa = constants.regressionPa ?? 250
  const leagueRPerPa = constants.leagueRPerPa ?? 0.118
  const paPerSlot = constants.paPerSlot ?? 4.2
  const regressed = 100 + (wrcPlus - 100) * (pa / (pa + regressionPa))
  return ((regressed - 100) / 100) * leagueRPerPa * paPerSlot
}

// Same, for the glove: season fielding runs regressed toward 0 by defensive
// innings, then per defensive game. Null when either input is missing, which the
// caller reads as "league average", never as a penalty.
export function fldRpgFromRuns(fldRuns, innings, constants = {}) {
  if (!Number.isFinite(fldRuns) || !Number.isFinite(innings) || innings <= 0) return null
  const regressionInn = constants.regressionInn ?? 600
  const defInnPerGame = constants.defInnPerGame ?? 9
  const regressed = fldRuns * (innings / (innings + regressionInn))
  return regressed / (innings / defInnPerGame)
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
//       season rpg/fldRpg and eligibility are team-independent, so use them as posted.
//   (b) present in the season file: value his bat from wRC+ (same model as the
//       nightly build), eligible at the slot he's actually posted at (his de-facto
//       primary) plus DH — we don't know his other positions, so the optimal
//       shouldn't shuffle him elsewhere. His glove sits at league average: war.json
//       carries season fielding runs but not the innings they span, and the values
//       file (which would have them) is exactly what he's missing from.
//   (c) unknown everywhere: league-average bat, but FULLY familiar at his posted
//       slot — you are never "out of position" at your own position. (The old floor
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
      fldRpg: known.fldRpg ?? 0,
      positions: known.positions ?? [slot, 'DH'],
      primaryPos: known.primaryPos ?? slot,
    }
  }
  const rpg = rpgFromWar(data?.warFallback?.wrc?.[key], data?.warFallback?.pa?.[key], data?.constants)
  if (rpg != null) {
    return { id: key, rpg, fldRpg: 0, positions: [slot, 'DH'], primaryPos: slot, resolved: 'war' }
  }
  return { id: key, rpg: 0, fldRpg: 0, positions: [slot, 'DH'], primaryPos: slot, unknown: true }
}

// Turn the values-file player map for one club (plus any actual starters missing
// from it, resolved via resolveMissingStarter) into the solver's candidate pool.
function candidatePool(data, teamId, actual) {
  const pool = []
  const seen = new Set()
  for (const [id, p] of Object.entries(data?.players ?? {})) {
    if (p.teamId !== teamId) continue
    pool.push({
      id,
      rpg: p.rpg ?? 0,
      fldRpg: p.fldRpg ?? 0,
      positions: p.positions ?? [],
      primaryPos: p.primaryPos,
    })
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

// A catcher posted anywhere but behind the plate is being RESTED from catching —
// the single most common reason a starting catcher appears at DH. No club catches
// one man 162 times, so proposing to put him back there is second-guessing
// workload management the model cannot see, and it is wrong nearly every time it
// fires. We therefore forbid the proposal outright rather than deduct for it.
// Safe by construction: someone else is already posted at C, so the solve stays
// feasible. See docs/lineup-strength.md ("What the model deliberately won't say").
function catcherRestForbids(pool, actual) {
  const byId = new Map(pool.map((p) => [String(p.id), p]))
  const forbid = new Map()
  for (const { id, slot } of actual) {
    if (slot === 'C') continue
    if (byId.get(String(id))?.primaryPos !== 'C') continue
    forbid.set(String(id), new Set(['C']))
  }
  return forbid
}

// Grade one club's posted lineup. actualLineup: [{personId, position}] (nine
// entries; position as the boxscore reports it). Returns { score, tier, gapRpg,
// optimal, actual, ungraded, relaxed } or null when the pool can't be solved.
export function gradeLineup(data, teamId, actualLineup) {
  const actual = normalizeActual(actualLineup)
  if (!data || actual.length === 0) return null
  const pool = candidatePool(data, teamId, actual)
  // Settle value ties toward the manager's own arrangement: with no familiarity
  // term, shuffling the same eight fielders is value-neutral, and an "optimal"
  // that reshuffles them for nothing would produce receipt rows claiming a
  // change worth zero. See PREFER_EPSILON in lineupSolver.js.
  const prefer = new Map(actual.map(({ id, slot }) => [String(id), slot]))
  const optimal = solveOptimalLineup(pool, { prefer, forbid: catcherRestForbids(pool, actual) })
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

// Itemized "receipt" explaining the gap, biggest first, capped at five.
//
// The difference between the optimal and posted lineups is a permutation with
// entries and exits, and it decomposes exactly into two shapes:
//
//   PATH  - starts at a slot whose optimal occupant is NOT in the posted lineup,
//           then follows each displaced man to where the optimum would rather
//           have him, until it reaches a posted starter the optimum has no place
//           for. Net effect: one player in, one out, everyone between shifted.
//           A plain one-for-one substitution is just a path of length 1.
//   CYCLE - every slot's occupant is already in the lineup, so nobody enters or
//           leaves; the same nine are arranged differently.
//
// Grouping matters for correctness, not only for wording. Reporting slot by slot
// used to split one rotation into several rows that each read as a benching, and
// the noise floor then dropped any leg whose delta was NEGATIVE — an optimum
// routinely accepts a loss at one slot to gain more at another. The surviving leg
// stood alone and overstated its own finding: Milwaukee's C/DH rotation showed
// -1.2 grade points against a true cost of -0.7, and the card's rows summed to
// 3.3 points against a 2.8-point gap. Grouping first, then applying the floor to
// the GROUP, restores the property the receipt claims: the rows account for the
// score.
//
// Emits one item per group:
//   { kind:'sub'|'chain'|'shuffle', inId, outId, slot, shiftSlots, deltaRpg }
// where `sub` is a length-1 path, `chain` a longer one, and `shuffle` a cycle.
// Groups under 0.02 runs/game are dropped as noise.
export function receiptFor(data, teamId, actualLineup) {
  const grade = gradeLineup(data, teamId, actualLineup)
  if (!grade) return []
  const opt = new Map(grade.optimal.assignments.map((a) => [a.slot, String(a.id)]))
  const act = new Map(grade.actual.perSlot.map((a) => [a.slot, String(a.id)]))
  const optValue = new Map(grade.optimal.assignments.map((a) => [a.slot, a.value]))
  const actValue = new Map(grade.actual.perSlot.map((a) => [a.slot, a.value]))
  const optSlotOf = new Map([...opt].map(([slot, id]) => [id, slot]))
  const inPosted = new Set(act.values())

  // Slots excluded from the gap (unvalued posted starter) earn no receipt line —
  // we make no claim about a spot we couldn't grade — so they also break a chain
  // rather than being walked through.
  const ungradedSlots = new Set((grade.ungraded ?? []).map((u) => u.slot))
  const differing = new Set(
    SLOTS.filter((s) => !ungradedSlots.has(s) && opt.has(s) && act.has(s) && opt.get(s) !== act.get(s)),
  )

  const seen = new Set()
  const walk = (start) => {
    const slots = []
    let cur = start
    while (cur && differing.has(cur) && !seen.has(cur)) {
      seen.add(cur)
      slots.push(cur)
      cur = optSlotOf.get(act.get(cur)) // where the man he displaced would go
    }
    return slots
  }

  const groups = []
  // Paths first, so a chain is never mistaken for a cycle by starting mid-chain.
  for (const slot of differing) {
    if (seen.has(slot) || inPosted.has(opt.get(slot))) continue
    groups.push({ path: true, slots: walk(slot) })
  }
  // Anything still unvisited closes on itself: a cycle.
  for (const slot of differing) {
    if (seen.has(slot)) continue
    groups.push({ path: false, slots: walk(slot) })
  }

  const items = []
  for (const { path, slots } of groups) {
    if (slots.length === 0) continue
    const deltaRpg = slots.reduce(
      (sum, s) => sum + ((optValue.get(s) ?? 0) - (actValue.get(s) ?? 0)),
      0,
    )
    if (deltaRpg < 0.02) continue
    // A path's headline is its entry point: who comes in, and who ends up out.
    // A cycle has no entry or exit, so its headline is the DH — the only slot at
    // which rearranging the same nine can change the value at all, since fielding
    // value is position-agnostic (see lineupSolver.js). A cycle that somehow
    // avoids DH can only be a zero-value tie and is already gone above.
    const head = path ? slots[0] : slots.find((s) => s === 'DH')
    if (!head) continue
    const tail = path ? slots[slots.length - 1] : head
    items.push({
      kind: path ? (slots.length === 1 ? 'sub' : 'chain') : 'shuffle',
      inId: opt.get(head),
      outId: act.get(tail),
      slot: head,
      // Where the departing player is actually posted. On a chain this is NOT
      // `slot` — the man coming in takes one position and the man going out
      // leaves from another, several shifts away. Naming it stops the row
      // reading as "we'd rather have Susac catching than Adames", when Adames
      // is the shortstop and was never a candidate to catch.
      outSlot: tail,
      // The other slots the move touches, for the "and everyone else moves up"
      // line. Never includes the headline slot, which the row already states.
      shiftSlots: slots.filter((s) => s !== head),
      deltaRpg,
    })
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
    rows: lineupStrengthRows(
      data,
      items,
      names,
      new Map(grade.optimal.assignments.map((a) => [a.slot, String(a.id)])),
    ),
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

// Shape the receipt `items` into display rows for the
// Pos | Expected | Starting | Impact table (LineupStrengthCard). Pure so the
// column mapping is unit-testable. All three item kinds share one shape —
// Expected is who the optimum wants, Starting is who the manager posted — which
// is why the table needs no second layout:
//   - sub:     a straight one-for-one. Expected/Starting are at the same slot.
//   - chain:   Expected enters at `pos`; Starting leaves from further down the
//              chain. `shifts` names the men who move between them, so the row
//              never implies Starting was playing `pos`.
//   - shuffle: the same nine, rearranged. Nobody enters or leaves; `pos` is
//              always DH, the only slot where rearranging can change the value.
//              `shifts` says where the displaced DH goes.
// `deltaRpg` is the runs/game the row costs (rendered as a negative).
// Points off the 10 that a `deltaRpg` deduction costs. The score is
// 10 − gap/SCORE_GAP_FULL, so each line-item's share of the gap converts to
// grade points at the same rate — a far more legible unit for the card than raw
// runs/game (a 0.045 r/g move is one whole grade point).
export function scoreImpactOf(deltaRpg) {
  return Math.round((deltaRpg / SCORE_GAP_FULL) * 10) / 10
}

export function lineupStrengthRows(data, items, names = null, optimalBySlot = null) {
  return (items ?? []).map((it) => ({
    kind: it.kind,
    pos: it.slot,
    expected: playerName(data, it.inId, names),
    starting: playerName(data, it.outId, names),
    // The departing player's own position, when it differs from `pos` — null on
    // a straight substitution, where both men are at the same slot and repeating
    // it would be noise.
    startingPos: it.outSlot && it.outSlot !== it.slot ? it.outSlot : null,
    // Human-readable "who else moves", e.g. ["Ben Malgeri to DH"]. Empty for a
    // plain substitution. Needs the optimal assignment to name the man who ends
    // up at each touched slot, so it degrades to [] when that isn't supplied.
    shifts: (it.shiftSlots ?? [])
      .map((slot) => {
        const who = optimalBySlot?.get(slot)
        const name = who ? playerName(data, who, names) : null
        return name ? `${name} to ${slot}` : null
      })
      .filter(Boolean),
    deltaRpg: it.deltaRpg,
    scoreImpact: scoreImpactOf(it.deltaRpg),
  }))
}
