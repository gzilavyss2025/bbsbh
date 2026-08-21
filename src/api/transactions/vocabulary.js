// What the transaction wire's vocabulary MEANS — the scoping and noise-filter
// half of the Team Transactions pipeline, split out of teamTransactions.js
// (ADR-0038) once that file passed its size budget.
//
// The split is along a real seam, not an arbitrary line. Everything here
// answers "is this row news, and whose?" from a row's typeCode and sentence
// alone. Nothing here groups rows into stories or writes prose — that stays in
// teamTransactions.js, which imports this. The league-wide home-page feed
// (issue #772) needs exactly this half and none of the other: its own grouping
// pass runs without an `orgId`, over the same vocabulary.
//
// The full field and code dictionary this encodes is docs/transactions-wire.md;
// the measurements cited below regenerate from
// .scratch/home-transactions/probe-coverage.mjs and probe-bare-activation.mjs.
//
// Spoiler note: roster moves and their dates carry no score, so nothing here
// is reveal-only — as spoiler-free as its parent module.

import { mentionsInjuredList } from '../rehab-policy.js'

// ---------------------------------------------------------------------------
// The injured list, and the three lists that are not it
// ---------------------------------------------------------------------------

// Mirrors person.js's isIlPlacementTxn/isIlEndingTxn keyword logic, split into
// THREE disjoint categories (placement / activation / IL-to-IL transfer)
// rather than person.js's two — the story grouper needs to tell a transfer
// apart from a fresh placement, which person.js's own player-timeline use case
// never had to. Deliberately a small, self-contained copy rather than an
// export added to person.js (this pass doesn't touch person.js — same
// convention as gen-rehab.mjs mirroring detectRehabAssignment).
//
// The one thing NOT copied is the list-NAME test: that's mentionsInjuredList
// (rehab-policy.js), shared with person.js so the pre-2019 "disabled list"
// wording can't be repaired in one consumer and left broken in the other.
// Only the verb frames below stay local. Today's generated files start at
// 2026, so the disabled-list era is out of range in practice — this keeps the
// two copies honest rather than changing live output.
export function isIlTransferTxn(t) {
  return (
    t.typeCode === 'SC' &&
    /transferred/i.test(t.description || '') &&
    mentionsInjuredList(t)
  )
}
export function isIlPlacementTxn(t) {
  return (
    t.typeCode === 'SC' &&
    /placed/i.test(t.description || '') &&
    mentionsInjuredList(t) &&
    !isIlTransferTxn(t)
  )
}
export function isIlEndingTxn(t) {
  return (
    t.typeCode === 'SC' &&
    /activat/i.test(t.description || '') &&
    mentionsInjuredList(t) &&
    !/all-stars? activated/i.test(t.description || '')
  )
}

// The three lists that are NOT the injured list. Each takes a player off the
// ACTIVE roster exactly as an IL placement does, and each is reversed by an
// activation the same way — but `mentionsInjuredList` (rehab-policy.js, the
// shared pre-2019 "disabled list" test) matches none of them, so the SC gate
// in filterStoryworthy dropped all three in BOTH directions. 47 MLB-touching
// rows over a 60-day live window, split almost evenly between placements and
// activations.
//
// The deliberate contrast is the BARE activation — "Chicago White Sox
// activated RHP Luis Castillo." — which names no list at all. Measured over
// the same window, 95 of those 110 MLB rows are an ECHO of a move the feed
// already tells: 70 of a trade, 12 of a waiver claim, 13 of a recall,
// selection or signing. Only two rows in sixty days had no arrival anywhere
// near them. So a row that NAMES its list is news, and a row that names none
// is a duplicate — which is why this is a list whitelist and not a relaxation
// of the `/activat/i` test.
const NON_IL_LISTS = [
  { re: /paternity list/i, banner: 'PAT' },
  { re: /bereavement list/i, banner: 'BRV' },
  { re: /restricted list/i, banner: 'RES' },
]
// The matched list's rail banner, or null when the row names no such list.
export function nonIlList(t) {
  const desc = t.description || ''
  return NON_IL_LISTS.find((l) => l.re.test(desc)) ?? null
}
export function isNonIlListPlacement(t) {
  return t.typeCode === 'SC' && /placed/i.test(t.description || '') && nonIlList(t) != null
}
export function isNonIlListEnding(t) {
  return t.typeCode === 'SC' && /activat/i.test(t.description || '') && nonIlList(t) != null
}

// ---------------------------------------------------------------------------
// The typeCode whitelist
// ---------------------------------------------------------------------------

// `ACQ`, `OBT`, `PUR` and `CP` are ONE concept in four codes (docs/
// transactions-wire.md §3): a player arriving from outside affiliated ball —
// an independent league. Verified over a 60-day live window, every one of the
// 31 rows is shaped `fromTeam` a non-MLB club, `toTeam` the major-league club,
// so unlike `TR`/`CLW` these name a single MLB club and carry no direction to
// get backwards. Only `PUR` was already whitelisted, which left the other
// three wordings of the same event silently dropped.
export const OUTSIDE_ARRIVAL_CODES = new Set(['ACQ', 'OBT', 'PUR', 'CP'])

// The typeCode whitelist (§4 bullet 1). ASG is deliberately absent — every ASG
// row (a real rehab assignment OR a plain affiliate-to-affiliate promotion)
// touches only the minors, never the MLB club's active/40-man roster, so none
// of them are a team-transactions story; bullet 2's specific callout of rehab
// ASGs is the motivating case, not a second filter on top of this whitelist.
const STORY_WORTHY_CODES = new Set([
  'TR', 'SFA', 'SGN', 'IFA', 'SE', 'CU', 'OPT', 'OUT', 'DES', 'REL', 'URL',
  'CLW', 'WA', 'RET', 'SU', 'DFA', ...OUTSIDE_ARRIVAL_CODES,
])

// ---------------------------------------------------------------------------
// Scoping: which org a row belongs to, and whether it is news at all
// ---------------------------------------------------------------------------

// `ctx.orgId`, when given, requires a row to touch the MLB club DIRECTLY
// (fromTeam.id or toTeam.id === orgId), not merely an affiliate bucketToOrg
// mapped up to this org. Verified against the live feed: a release or
// suspension can be logged entirely at a single affiliate (e.g. "Wilson
// Warbirds released RHP Melvin Hernandez," toTeam the Single-A club, no
// fromTeam, never touching the MLB roster at all) — REL/SU/SFA/SGN/IFA are
// NOT inherently MLB-anchored the way a trade or a call-up/option is (those
// always name the MLB club on one side, confirmed against the live feed —
// see teamTransactions.js's module header). Rather than special-case which
// codes can leak, every row must clear this gate.
// A signing (SFA/SGN/IFA) is the one whitelisted family with no other signal
// separating a real roster move from anonymous org-filler — a mass minor-
// league-camp signing spree reads identically to a notable NRI in the raw
// feed, and (unlike REL/SU) it legitimately carries the MLB club as `toTeam`
// even when the player is purely organizational depth. `ctx.debutedIds`, when
// given (a Set of personIds who've appeared in an MLB game — see
// gen-team-transactions.mjs), is the 80/20 proxy: a signing is suppressed
// unless its personId is IN the set — a genuinely undebuted signee and a
// personId this generator run simply couldn't resolve land the same way
// (suppressed), since there's no way to tell those two apart from a plain Set.
const SIGNING_CODE_SET = new Set(['SFA', 'SGN', 'IFA'])
function isUndebutedSigning(t, debutedIds) {
  if (!debutedIds || !SIGNING_CODE_SET.has(t.typeCode)) return false
  const pid = t.person?.id
  return pid != null && !debutedIds.has(pid)
}

// `DFA` ("elected free agency") is exempt from the direct-touch gate below:
// verified live across 40 league-wide rows, it's logged with `toTeam` the
// outrighted/released player's MINOR-LEAGUE club (rarely, if ever, the MLB
// parent) — the transaction only exists because his MLB-level roster spot
// is already gone. Treating an affiliate-only DFA row as org-irrelevant
// noise the way a REL/SU/signing sometimes is would silently drop nearly
// every real election; a player only reaches free agency via a prior
// outright/release from the org's own 40-man, so an affiliate-level DFA row
// IS the MLB-relevant event. `bucketToOrg` (already run before this
// function — see the generator) is the only org-touch gate this code needs.
// This exemption is only safe as long as that holds — so every caller of
// `filterStoryworthy` must put a row through an org-touch gate FIRST. All three
// do: gen-team-transactions.mjs and transactions/clubFeed.js run bucketToOrg,
// and transactions/league.js runs assignRowOwners, which reaches an org the
// same way (either club, mapped up through the affiliate table) and then keeps
// only one of them. A future caller MUST do the same, or re-add a direct-touch
// check scoped to just that caller — don't loosen this gate itself.
const DIRECT_TOUCH_EXEMPT_CODES = new Set(['DFA'])

export function filterStoryworthy(rows, ctx = {}) {
  return (rows ?? []).filter((t) => {
    if (
      ctx.orgId != null &&
      !DIRECT_TOUCH_EXEMPT_CODES.has(t.typeCode) &&
      t.fromTeam?.id !== ctx.orgId &&
      t.toTeam?.id !== ctx.orgId
    ) return false
    if (isUndebutedSigning(t, ctx.debutedIds)) return false
    if (t.typeCode === 'SC') {
      return (
        isIlPlacementTxn(t) || isIlEndingTxn(t) || isIlTransferTxn(t) ||
        isNonIlListPlacement(t) || isNonIlListEnding(t)
      )
    }
    return STORY_WORTHY_CODES.has(t.typeCode)
  })
}

// Keep a row only if it touches this org's own MLB club or one of its
// affiliates (§4 bullet 3) — drops a pure affiliate-to-affiliate lateral that
// never involves the parent org. Runs BEFORE dedupe/filter in the generator
// (a league-wide fetch has to be bucketed to one org first — see §5).
export function bucketToOrg(rows, orgId, affilToOrg) {
  const ownsTeam = (id) => id != null && (id === orgId || affilToOrg?.get(id) === orgId)
  return (rows ?? []).filter((t) => ownsTeam(t.fromTeam?.id) || ownsTeam(t.toTeam?.id))
}
