// The single definition of "is this minor-league stint a rehab cameo or a real
// demotion" — shared by the player page (person.js) and the nightly generators
// that need the same call (gen-former-teammates.mjs, gen-rehab.mjs) so they
// can't drift out of lockstep (see the bug that motivated this file: a
// ~16-appearance / ~59-out reliever stint cleared the app's games-OR-outs cap
// but was silently dropped by a generator copy that only checked outs).
//
// Pure — no fetching, no DOM. Every export here is meant to be imported, not
// re-implemented; if a caller needs its own copy, extend this file instead.

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

// Innings pitched ("104.1" = 104 ⅓) -> outs, so multi-stint lines sum right.
export function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}

// A minor-league stint clears a workload threshold in whichever unit fits the
// group and role: games played for a hitter, but EITHER innings pitched OR
// games pitched for a pitcher. Innings alone undercounts a RELIEVER, who
// racks up games far faster than innings — a starter's rehab ramps up in
// innings per outing, so an innings floor catches him fine, but a shuttling
// reliever can go 16 appearances / 19.2 IP over nine weeks (Joel Payamps,
// Gwinnett, 2026) without ever threatening an innings-only bar, even though
// nine weeks is well beyond any rehab window. So a pitcher's games count
// (its OWN threshold, not the hitter's daily-appearance number — a reliever
// pitches every 2-4 days, not every day) can also clear the bar on its own.
export function meetsWorkload(games, outs, group, threshold) {
  const t = threshold[group === 'pitching' ? 'pitching' : 'hitting']
  return group === 'pitching' ? outs >= t.outs || games >= t.games : games >= t.games
}

// The floor a MiLB stint must clear to count as real presence at all — below
// this it's a bare cameo. ~10 days for a position player (10 G, one per day);
// for a pitcher, ~20 IP (a starter's few tune-up outings) OR 5 relief outings
// (fewer than that is just a look, not a stretch of work).
export const CUP_OF_COFFEE_FLOOR = { hitting: { games: 10 }, pitching: { games: 5, outs: 60 } }

// The ceiling of a rehab-assignment window. A POST-DEBUT minor-league stint at
// or above this is too big to be rehab — a real option-down or demotion, shown
// as its own row; below it, it's rehab-or-shuttle noise that drops to a
// caption. Deliberately an ABSOLUTE cap, not "was the player MiLB-primary that
// year": an injured pitcher who threw 5 MLB innings and 14 rehab innings has
// MORE minor-league work but was never demoted (verified against Kodai
// Senga's 2024), so a relative test would wrongly promote his rehab to a
// demotion row. ~20 days ≈ 20 G for a position player; for a pitcher, ~30
// days ≈ 30 IP (a starter's several rehab starts) OR 15 relief outings — an
// MLB rehab assignment is capped at 30 days by rule, so even a reliever
// pitching every other day tops out around 15 outings before it must convert
// to a real assignment or he's recalled.
export const REHAB_CAP = { hitting: { games: 20 }, pitching: { games: 15, outs: 90 } }

export function meetsStintCap(stat, group) {
  const games = num(stat?.gamesPitched ?? stat?.gamesPlayed)
  const outs = ipToOuts(stat?.inningsPitched)
  return meetsWorkload(games, outs, group, REHAB_CAP)
}

// --- rehab transaction-scan helpers -------------------------------------------
// When a rehab stint STARTS (an "Assigned" row whose description says "rehab")
// and the move types that CLOSE ONE OUT — a return to the majors (recall,
// contract selection), a real option down, a release/retirement, a TRADE (the
// assigning org no longer controls him, so a stint tagged to the pre-trade org
// is stale even if his new club later sends him back out — that shows up as a
// fresh rehab-start row, not a continuation), any non-rehab reassignment, or
// any injured-list move (placed, transferred between ILs, or activated off
// one) — not just an activation. A setback (Rob Zastryzny, Brewers, moved
// straight from an active Nashville rehab assignment to the 60-day IL on
// 2026-07-15 with no return-to-action in between) closes the rehab the same
// way an activation does: the club has made a new roster decision, so if
// he's still — or later — rehabbing, that shows up as a fresh rehab-start
// row, not a continuation of the one already being tracked. Shared by the
// player page's single-player detector (person.js), the league-wide Rehab
// Assignments generator (gen-rehab.mjs), and gen-former-teammates.mjs so all
// three agree on when a rehab is over.
export const REHAB_END_CODES = new Set(['CU', 'OPT', 'SE', 'REL', 'RET', 'TR'])

export function txnDate(t) {
  return t.effectiveDate || t.date || ''
}

// Arrival/move rows are the one cross-level clock available to the player
// career register: Stats API returns MLB and each MiLB level separately, and
// the stat splits carry no stint date. A signing explicitly identified as a
// minor-league contract belongs to the parent organization, not to an MLB stat
// stint; the later affiliate assignment or contract selection is the playing
// stop. Exported here beside txnDate so that transaction semantics stay in one
// pure module rather than being reimplemented in a view shaper.
const ARRIVAL_TRANSACTION_TYPES = new Set([
  'ASG', 'SE', 'OUT', 'TR', 'SFA', 'SGN', 'CLW', 'ACQ', 'RTN', 'OBT',
  'LON', 'CP', 'PUR', 'CU', 'OPT', 'SC',
])

export function transactionTeamRanks(transactions, year, teamIds) {
  const wanted = new Set(teamIds)
  const ranks = new Map()
  const ordered = (transactions ?? [])
    .map((txn, index) => ({ txn, index, date: txnDate(txn) }))
    .filter(({ date }) => date?.slice(0, 4) === String(year))
    .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)

  for (const { txn } of ordered) {
    if (!ARRIVAL_TRANSACTION_TYPES.has(txn.typeCode)) continue
    if (
      (txn.typeCode === 'SFA' || txn.typeCode === 'SGN') &&
      /minor league contract/i.test(txn.description ?? '')
    ) continue
    const teamId = txn.toTeam?.id
    if (!wanted.has(teamId) || ranks.has(teamId)) continue
    ranks.set(teamId, ranks.size)
  }
  return ranks
}

export function isRehabTxn(t) {
  return t.typeCode === 'ASG' && /rehab/i.test(t.description || '')
}

export function isRehabEndingTxn(t) {
  const c = t.typeCode
  if (REHAB_END_CODES.has(c)) return true
  if (c === 'ASG' && !isRehabTxn(t)) return true
  return c === 'SC' && mentionsInjuredList(t)
}

// --- injured-list WORDING -----------------------------------------------------
// The injured list was called the DISABLED list until 2019, and statsapi never
// rewrote its history — a pre-2019 row still reads "…on the 10-day disabled
// list". The feed is not even self-consistent within one stint: Mookie Betts is
// PLACED on a 2018 "disabled list" and ACTIVATED from an "injured list" thirteen
// days later. A 2021 Framber Valdez row drops the hyphen entirely ("the 10 day
// disabled list").
//
// Testing only /injured list/ therefore made every consumer blind to the whole
// pre-2019 era: a player genuinely on the DL read as healthy, and a season lost
// to injury could not earn the career register's "Injured — missed season" note.
// The name test lives here ONCE rather than as a literal at each call site —
// person.js's IL detector and gap note, teamTransactions.js's story filter, and
// isRehabEndingTxn above all key on it, and that is exactly the drift this
// module exists to prevent (see the header). Extend here, never re-inline.
export function mentionsInjuredList(t) {
  return /(injured|disabled) list/i.test(t.description || '')
}

// The "N-day" qualifier off a placement, hyphenated or not — '7' | '10' | '15' |
// '60', or null for a plain / full-season list with no day count at all.
export function injuredListDays(t) {
  return (t.description || '').match(/(\d+)[- ]day (?:injured|disabled) list/i)?.[1] ?? null
}
