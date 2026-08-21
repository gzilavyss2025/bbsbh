// Pure shapers for the Team Transactions card's data pipeline: de-dupe the raw
// statsapi transaction feed, drop noise, and pair same-day moves into
// "stories" — plus the reader half that loads the static, per-club season
// files scripts/gen-team-transactions.mjs precomputes from these same
// functions (the gen-callouts.mjs "import the app's own shaper so the two
// can't drift" convention). Full design:
// .scratch/team-transactions/data-layer-scope.md.
//
// Two halves live a tier down in transactions/, each split out when this file
// passed its size budget (ADR-0038), and each along a real seam:
// vocabulary.js answers "is this row news, and whose?" from a typeCode and a
// sentence; cutline.js turns a finished story draft into words. What is left
// here is the pipeline itself — which rows survive, and which of them belong
// in one story together. transactions/league.js is a second caller of that
// pipeline, running it once per owning club over the whole league.
//
// Spoiler note: roster moves and their dates carry no score, so nothing here
// is reveal-only — this module is as spoiler-free as rehab.js/rookies.js.

import { txnDate } from './rehab-policy.js'
import { buildCutline, resolvePosition, surnameOf } from './transactions/cutline.js'
import {
  OUTSIDE_ARRIVAL_CODES,
  isIlEndingTxn,
  isIlPlacementTxn,
  isIlTransferTxn,
  isNonIlListEnding,
  isNonIlListPlacement,
  nonIlList,
} from './transactions/vocabulary.js'

// Re-exported so this module stays the pipeline's single public surface for
// its existing callers — the generator, the team page's reader, and the
// tests, none of which should have to know where a helper moved to.
export { bucketToOrg, filterStoryworthy } from './transactions/vocabulary.js'
export { buildCutline } from './transactions/cutline.js'

// ---------------------------------------------------------------------------
// §2 De-dupe
// ---------------------------------------------------------------------------
//
// Verified live against the real feed (2026-07-15, the Brewers' 2026-06-24 to
// 07-15 window): a transaction's `id` is reliably PRESENT, but NOT reliably
// STABLE across duplicate/re-logged rows of the very same move — the Logan
// Henderson rehab assignment that logged 3× on 2026-06-28 carries three
// DIFFERENT ids, as does Coleman Crow's 2× rehab row and Carlos Rodriguez's
// 2× rehab row. An `id`-first signature (`id != null ? id : composite`) would
// therefore fail to collapse exactly the byte-identical-repeat case it's
// meant to catch. The composite signature (date/typeCode/personId/fromId/
// toId/description) collapses all three real cases correctly and — since the
// two-perspective trade mirror (same id, but swapped fromTeam/toTeam and a
// missing `person` on one copy) has a DIFFERENT composite on each side by
// construction — never over-collapses a genuine trade, leaving that case for
// Pass B below exactly as designed. So Pass A keys on the composite alone.
function compositeSig(t, date) {
  return [
    'c',
    date,
    t.typeCode,
    t.person?.id ?? '',
    t.fromTeam?.id ?? '',
    t.toTeam?.id ?? '',
    t.description ?? '',
  ].join('|')
}

// How "full" a row is — used to pick the one survivor per personId in Pass B.
// A row naming the person, with both clubs, and the longer description wins.
function fullness(t) {
  let score = 0
  if (t.person) score += 2
  if (t.fromTeam && t.toTeam) score += 1
  score += Math.min((t.description ?? '').length, 900) / 1000
  return score
}

function clubPairKey(t) {
  return [String(t.fromTeam?.id ?? ''), String(t.toTeam?.id ?? '')].sort().join('|')
}

// Two passes over one org's raw transaction rows (see §2 of the scope doc):
// Pass A collapses byte-identical repeats; Pass B collapses a trade's
// two-team-perspective mirror (same date/typeCode/clubPair, keeping one row
// per distinct real personId and dropping any person-less row once at least
// one named row exists in the group).
export function dedupeTransactions(rows) {
  const seen = new Set()
  const passA = []
  for (const t of rows ?? []) {
    const date = txnDate(t)
    const sig = compositeSig(t, date)
    if (seen.has(sig)) continue
    seen.add(sig)
    passA.push(t)
  }

  const groups = new Map()
  for (const t of passA) {
    const key = [txnDate(t), t.typeCode, clubPairKey(t)].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }

  const result = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }
    const byPerson = new Map()
    let anyNamed = false
    for (const t of group) {
      const pid = t.person?.id
      if (pid == null) continue
      anyNamed = true
      const existing = byPerson.get(pid)
      if (!existing || fullness(t) > fullness(existing)) byPerson.set(pid, t)
    }
    if (anyNamed) {
      result.push(...byPerson.values())
    } else {
      // Step 4: the whole group is person-less — keep one rather than none.
      result.push(group[0])
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// §3 Story grouping
// ---------------------------------------------------------------------------

// Direction per row (§3): `in` gains a body, `out` loses one, `transfer` is
// neutral (no active-roster body), null (SU, or a TR with no orgId context)
// doesn't participate in pairing at all.
const SIGNING_CODES = new Set(['SFA', 'SGN', 'IFA'])
const IN_CODES = new Set(['CU', 'SE', ...OUTSIDE_ARRIVAL_CODES, ...SIGNING_CODES])
const OUT_CODES = new Set(['OPT', 'DES', 'OUT', 'REL', 'URL', 'WA', 'RET', 'DFA'])
// TR and CLW are the ONLY two codes naming two different MLB clubs
// (docs/transactions-wire.md §3); every other names one club plus its own
// affiliates, so direction follows from the code alone. For these two it
// follows from WHICH SIDE this org is on — one row buckets into both clubs'
// files. CLW used to sit in IN_CODES, so on 2026-08-11 the Brewers' own card
// announced Drew Rom "claimed off waivers" over an "Up" banner, the day the
// Athletics claimed him AWAY from them.
const TWO_CLUB_CODES = new Set(['TR', 'CLW'])
// CU/SE (onto the active roster) and OPT/OUT (off it) also name a real
// affiliate on their OTHER side (docs/transactions-wire.md §3: "a player
// moving between two clubs"), unlike a signing or a release, which touch only
// the club acting. Reading direction off the code alone (`IN_CODES`/
// `OUT_CODES` below) was equivalent to asking which side `orgId` was on only
// because `orgId` was always the ACTIVE-roster side — every story-owning club
// was an MLB club. The MiLB-level wire (#847) can now own the SAME row from
// the affiliate's side, where the two answers diverge: a recalled player is
// 'in' by code alone even on the affiliate's own story, where he is the one
// being LOST — the same shape of bug CLW's own header describes above, found
// a second way.
const AFFILIATE_SWAPPABLE_CODES = new Set(['CU', 'SE', 'OPT', 'OUT'])
function rowDirection(t, orgId) {
  const code = t.typeCode
  if (TWO_CLUB_CODES.has(code)) {
    if (orgId != null && t.toTeam?.id === orgId) return 'in'
    if (orgId != null && t.fromTeam?.id === orgId) return 'out'
    return null
  }
  if (AFFILIATE_SWAPPABLE_CODES.has(code) && orgId != null) {
    if (t.toTeam?.id === orgId) return 'in'
    if (t.fromTeam?.id === orgId) return 'out'
  }
  if (IN_CODES.has(code)) return 'in'
  if (OUT_CODES.has(code)) return 'out'
  if (code === 'SC') {
    if (isIlTransferTxn(t)) return 'transfer'
    if (isIlPlacementTxn(t)) return 'out'
    if (isIlEndingTxn(t)) return 'in'
    // The paternity/bereavement/restricted lists move the same direction the
    // injured list does — off the active roster and back onto it.
    if (isNonIlListPlacement(t)) return 'out'
    if (isNonIlListEnding(t)) return 'in'
    return null
  }
  return null
}

function pickPreferred(pool, codes) {
  for (const code of codes) {
    const found = pool.find((c) => c.row.typeCode === code)
    if (found) return found
  }
  return null
}

// Which of one player's own rows leads his story, when a club-day gives him
// more than one. Ordered by how much of the two rosters the move actually
// changes (docs/transactions-wire.md §5), so the outcome leads and the
// paperwork that produced it trails: a claim ahead of the option that
// followed it, a release ahead of the designation that preceded it, an
// outright ahead of the election it drew. An activation ranks next to last
// because it is nearly always bookkeeping for the move beside it, and an
// election last because it is the player's own act, not the club's.
const NEWS_RANK = {
  TR: 0, CLW: 1, SE: 5, REL: 6, DES: 7, OUT: 8, URL: 8, OPT: 9, CU: 10,
  RET: 13, WA: 13, DFA: 14,
}
const NEWS_RANK_OUTSIDE_ARRIVAL = 2
const NEWS_RANK_SIGNING = 12
const NEWS_RANK_DEFAULT = 11
function newsRank(row) {
  if (OUTSIDE_ARRIVAL_CODES.has(row.typeCode)) return NEWS_RANK_OUTSIDE_ARRIVAL
  if (SIGNING_CODES.has(row.typeCode)) return NEWS_RANK_SIGNING
  if (row.typeCode === 'SC') {
    if (isIlPlacementTxn(row) || isNonIlListPlacement(row)) return 3
    if (isIlTransferTxn(row)) return 4
    return NEWS_RANK_DEFAULT
  }
  return NEWS_RANK[row.typeCode] ?? NEWS_RANK_DEFAULT
}
const leadFirst = (a, b) => newsRank(a.row) - newsRank(b.row)

// The three roster-move subtypes that hold more than one row about ONE
// player, and so share a rail slot and a cutline shape (cutlineSamePlayer).
const SAME_PLAYER_SUBTYPES = new Set(['double', 'departure', 'arrival'])

// A shuffle is the grouper's leftover bucket, and it had no cap: the Mets'
// 2026-08-04 clustered eight unpaired moves into one 413-character story with
// eight faces in its rail. Past about four moves the "these belong together"
// claim the bucket makes is fiction anyway, so it splits into equal parts
// instead of running on. Dealing round-robin over the arrivals and then the
// departures — cutlineShuffle's own reading order — leaves each part a mix of
// the two wherever the day has one.
//
// Measured over a 60-day live window: a cap of four holds every story under
// 250 characters and costs 32 extra stories; a cap of five still leaves a
// 351-character one, and a cap of three strands 14 parts with no mix.
// Within-day significance order: trade -> injured-list -> shuffle/roster-move
// -> signing -> suspension. (Ties within a bucket keep discovery order, which
// groupIntoStories puts in id-ascending order first — the feed itself does not
// arrive that way.) Exported because the league-wide pass has to interleave
// thirty clubs' days and wants the same order across them, rather than a second
// opinion about what matters.
export const STORY_TYPE_RANK = {
  trade: 0, 'injured-list': 1, shuffle: 2, 'roster-move': 2, signing: 3, suspension: 4,
}

// Id-ascending, with an unnumbered row last rather than first — a row with no
// id is the odd one out and should not lead a story. Ids are numeric on the
// wire (verified over 39,247 rows, docs/transactions-wire.md §2).
function byRowId(a, b) {
  if (a.id == null) return b.id == null ? 0 : 1
  if (b.id == null) return -1
  return a.id - b.id
}

const SHUFFLE_CAP = 4
function splitShuffle(churn) {
  const ordered = [
    ...churn.filter((c) => c.dir === 'in'),
    ...churn.filter((c) => c.dir === 'out'),
  ]
  const parts = Math.ceil(ordered.length / SHUFFLE_CAP)
  const chunks = Array.from({ length: parts }, () => [])
  ordered.forEach((c, i) => chunks[i % parts].push(c))
  return chunks
}

// One day's kept rows -> ordered stories, per the §3 priority order (each
// step consumes the rows it uses, so nothing is double-counted).
function buildDayStories(dayRows, ctx) {
  const pool = dayRows.slice()
  const remove = (rows) => {
    for (const r of rows) {
      const i = pool.indexOf(r)
      if (i !== -1) pool.splice(i, 1)
    }
  }
  const remaining = () => pool.map((t) => ({ row: t, dir: rowDirection(t, ctx.orgId) }))

  const drafts = []

  // Step 0: suspensions never pair with anything (no in/out/transfer
  // direction of their own) — matching person.js's treatment of SU as its own
  // move, retained as a rare solo story (§4).
  const suspensions = pool.filter((t) => t.typeCode === 'SU')
  for (const t of suspensions) {
    drafts.push({ storyType: 'suspension', rows: [{ row: t, role: 'out' }] })
  }
  remove(suspensions)

  // Step 1: one player, one story — his rows on this club-day that point the
  // SAME direction are one departure, or one arrival. A vested veteran is
  // outrighted and elects free agency; a club designates a player and
  // releases him; the Pirates sign the player they just acquired out of the
  // Atlantic League. Left apart, both rows land in the day's shuffle and
  // print his name, and his face, twice in one story.
  //
  // Measured over a 60-day live window: 40 such player-days, 31 of them the
  // outright-plus-election pair this step grew out of. The rest are why it is
  // a rule about direction rather than a list of code pairs — including
  // 2026-08-05, where the wire filed Lou Trivino III's election twice under
  // two ids AND two different clubs, which no de-duplication rule can see.
  //
  // TR rows never take part: statsapi logs every player in a multi-player
  // trade with the SAME fromTeam/toTeam (the deal's acting clubs), not that
  // player's own direction, so a trade leg must always reach Step 3, however
  // that player's own day went.
  const byPersonDir = new Map()
  for (const c of remaining()) {
    const pid = c.row.person?.id
    if (pid == null || c.row.typeCode === 'TR') continue
    if (c.dir !== 'in' && c.dir !== 'out') continue
    const key = `${pid}|${c.dir}`
    if (!byPersonDir.has(key)) byPersonDir.set(key, [])
    byPersonDir.get(key).push(c)
  }
  for (const group of byPersonDir.values()) {
    if (group.length < 2) continue
    const ordered = [...group].sort(leadFirst)
    drafts.push({
      storyType: 'roster-move',
      subtype: ordered[0].dir === 'in' ? 'arrival' : 'departure',
      rows: ordered.map((c) => ({ row: c.row, role: c.dir })),
    })
    remove(ordered.map((c) => c.row))
  }

  // Step 2: same-player double-move (Crow case) — one story when a person has
  // both an in AND an out row left today. TR rows are excluded here for the
  // same reason they are excluded above: a player traded in and immediately
  // optioned the same day (the McCullers Jr./Gordon trade — Gordon's trade-in
  // leg plus his same-day option to Nashville) would otherwise read as a
  // Crow-style double-move and get pulled out of the pool before Step 3's
  // trade grouping ever sees him.
  //
  // The two rows are ordered lead-first, which is the whole news of this
  // step: when the arrival is an injured-list activation it is bookkeeping
  // for the option that follows, and the option leads — but when the arrival
  // is a waiver claim or a contract selection, IT is the news, and leading
  // with the option buried it. Measured over 60 live days, that happened on
  // 20 player-days: 16 claims and 4 selections, each printed as nothing but
  // "Optioned X to {affiliate}."
  const byPerson = new Map()
  for (const c of remaining()) {
    const pid = c.row.person?.id
    if (pid == null) continue
    if (!byPerson.has(pid)) byPerson.set(pid, [])
    byPerson.get(pid).push(c)
  }
  for (const group of byPerson.values()) {
    const inRow = group.find((c) => c.dir === 'in' && c.row.typeCode !== 'TR')
    const outRow = group.find((c) => c.dir === 'out' && c.row.typeCode !== 'TR')
    if (inRow && outRow) {
      drafts.push({
        storyType: 'roster-move',
        subtype: 'double',
        rows: [inRow, outRow].sort(leadFirst).map((c) => ({ row: c.row, role: c.dir })),
      })
      remove([inRow.row, outRow.row])
    }
  }

  // Step 3: trades — every TR row on the day sharing the same (unordered)
  // club pair is ONE trade, however many players are on either side (a real
  // 2-for-1 stays one story, not three) — grouped by the same clubPairKey the
  // dedupe pass already uses. A net add pulls ONE clearing move, tagged
  // role:'clear' (not 'out') so the cutline can tell "a player we actually
  // traded away" from "an unrelated roster spot we cleared to make room".
  const tradeRows = remaining().filter((c) => c.row.typeCode === 'TR')
  const tradeGroups = new Map()
  for (const c of tradeRows) {
    const key = clubPairKey(c.row)
    if (!tradeGroups.has(key)) tradeGroups.set(key, [])
    tradeGroups.get(key).push(c)
  }
  for (const group of tradeGroups.values()) {
    const storyRows = group.map((c) => ({ row: c.row, role: c.dir === 'out' ? 'out' : 'in' }))
    remove(group.map((c) => c.row))
    if (group.some((c) => c.dir === 'in')) {
      // Never somebody the deal already names. Cleveland genuinely designated
      // Juan Brito and traded him on one day, and the White Sox did the same
      // with Duncan Davitt on 2026-08-03 — the clearing clause then repeated
      // a player the "for" list had just named, in his own trade's story.
      const inDeal = new Set(group.map((c) => c.row.person?.id).filter((id) => id != null))
      const pick = pickPreferred(
        remaining().filter((c) => c.dir === 'out' && !inDeal.has(c.row.person?.id)),
        ['DES', 'OUT', 'REL'],
      )
      if (pick) {
        storyRows.push({ row: pick.row, role: 'clear' })
        remove([pick.row])
      }
    }
    drafts.push({ storyType: 'trade', rows: storyRows })
  }

  // Step 4: IL placements — each seeds a story; pulls ONE replacement.
  const placements = remaining().filter((c) => isIlPlacementTxn(c.row))
  for (const pl of placements) {
    const storyRows = [{ row: pl.row, role: 'out' }]
    remove([pl.row])
    const pick = pickPreferred(remaining().filter((c) => c.dir === 'in'), ['SE', 'CU'])
    if (pick) {
      storyRows.push({ row: pick.row, role: 'in' })
      remove([pick.row])
    }
    drafts.push({ storyType: 'injured-list', rows: storyRows })
  }

  // Step 5: leftover churn — cluster into shuffles when ≥2 remain with both
  // an add and a subtract; otherwise each leftover is its own solo story.
  // Signings DO participate here (e.g. a same-day option clearing a spot for
  // an unrelated signing reads as one shuffle) — a signing that ends up alone
  // still resolves as its own "signing" story rather than a generic
  // "roster-move," it just isn't excluded from clustering up front. A busy
  // day makes more than one shuffle rather than one long one (splitShuffle).
  const churn = remaining().filter((c) => c.dir === 'in' || c.dir === 'out')
  const hasAdd = churn.some((c) => c.dir === 'in')
  const hasSubtract = churn.some((c) => c.dir === 'out')
  if (churn.length >= 2 && hasAdd && hasSubtract) {
    for (const chunk of splitShuffle(churn)) {
      drafts.push({
        storyType: 'shuffle',
        rows: chunk.map((c) => ({ row: c.row, role: c.dir })),
      })
    }
    remove(churn.map((c) => c.row))
  } else {
    for (const c of churn) {
      const isSigning = SIGNING_CODES.has(c.row.typeCode)
      drafts.push({
        storyType: isSigning ? 'signing' : 'roster-move',
        subtype: isSigning ? undefined : 'solo',
        rows: [{ row: c.row, role: c.dir }],
      })
      remove([c.row])
    }
  }

  // Step 6: leftover transfers — their own story, never folded into a
  // neighbor's cutline. Still shows a rail slot (the destination IL length as
  // its banner) — a rail-less transfer read as if the player had no photo on
  // file at all, which wasn't the intent.
  const transfers = remaining().filter((c) => c.dir === 'transfer')
  for (const t of transfers) {
    drafts.push({
      storyType: 'roster-move',
      subtype: 'transfer',
      rows: [{ row: t.row, role: 'transfer' }],
    })
    remove([t.row])
  }

  const ordered = drafts
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (STORY_TYPE_RANK[a.d.storyType] - STORY_TYPE_RANK[b.d.storyType]) || (a.i - b.i))
    .map(({ d }) => d)

  return ordered.map((draft) => shapeStory(draft, ctx))
}

const TYPE_LABELS = {
  trade: 'Trade',
  shuffle: 'Roster shuffle',
  'roster-move': 'Roster move',
  'injured-list': 'Injured list',
  signing: 'Signing',
  suspension: 'Suspension',
}

// The destination day-count for an IL placement OR an IL-to-IL transfer —
// takes the LAST "{N}-day injured list" mention in the description, which is
// the only one on a placement row ("placed … on the 10-day injured list")
// and the destination on a transfer row ("from the 15-day … to the 60-day
// injured list").
function ilBanner(row) {
  const matches = [...(row.description || '').matchAll(/(\d+)-day injured list/gi)]
  const days = matches[matches.length - 1]?.[1]
  return days ? `IL-${days}` : 'IL'
}
function bannerFor(storyType, role, row) {
  if (storyType === 'trade') return role === 'in' ? 'In' : 'Out'
  if (storyType === 'signing') return 'In'
  if (storyType === 'suspension') return 'Out'
  if (storyType === 'injured-list') return role === 'out' ? ilBanner(row) : 'Up'
  if (role === 'transfer') return ilBanner(row)
  // A non-IL list gets its own banner for the same reason the injured list
  // gets `IL-15` rather than "Down": it says WHY the player is off the active
  // roster, and none of these three is a demotion to the minors. The matching
  // activation keeps the plain "Up" an IL return already reads.
  if (isNonIlListPlacement(row)) return nonIlList(row).banner
  // A waiver claim crosses ORGS (see TWO_CLUB_CODES), and an ACQ-family row
  // comes from outside affiliated ball altogether, so both read In/Out like a
  // trade — never the Up/Down of a move on this club's own ladder.
  if (row.typeCode === 'CLW' || OUTSIDE_ARRIVAL_CODES.has(row.typeCode)) {
    return role === 'in' ? 'In' : 'Out'
  }
  return role === 'in' ? 'Up' : 'Down'
}

function railSlot(row, role, banner, ctx) {
  return {
    role,
    banner,
    playerId: row.person?.id ?? null,
    name: row.person?.fullName ?? '',
    surname: surnameOf(row.person?.fullName ?? ''),
    pos: resolvePosition(row, ctx),
    tintTeamId: ctx.orgId,
    // Drives Headshot's MiLB photo rung; `tintTeamId` can't answer it, being
    // the parent org even for a farmhand. No Set at all never claims MLB.
    isMlb: ctx.debutedIds?.has(row.person?.id) ?? false,
  }
}

function buildRail(draft, ctx) {
  if (draft.storyType === 'roster-move' && draft.subtype === 'transfer') {
    const row = draft.rows[0].row
    return [railSlot(row, 'move', ilBanner(row), ctx)]
  }
  if (SAME_PLAYER_SUBTYPES.has(draft.subtype) && draft.storyType === 'roster-move') {
    // One photo, not two: every row in these three is about one player (see
    // cutlineSamePlayer), and the leading row is the one the story is really
    // about. An IL activation paired with an option leads with the option and
    // reads "Down"; a waiver claim paired with one leads with the claim and
    // reads "In".
    const { row, role } = draft.rows[0]
    // ...except that a story ending in a release or a free-agency election
    // reads "Out" whatever led it. He has left the organisation, not been
    // sent to the minors, and the banner is the only place that shows.
    const leavesOrg = draft.rows.some((r) => r.row.typeCode === 'DFA' || r.row.typeCode === 'REL')
    const banner = leavesOrg && role === 'out' ? 'Out' : bannerFor(draft.storyType, role, row)
    return [railSlot(row, role, banner, ctx)]
  }
  // A trade's pulled 'clear' row (see step 3) renders identically to a real
  // traded-away player in the rail — the distinction only matters to the
  // cutline, which reads draft.rows directly.
  const slots = draft.rows.map(({ row, role }) =>
    railSlot(row, role === 'clear' ? 'out' : role, bannerFor(draft.storyType, role, row), ctx),
  )
  const railOrder = { in: 0, out: 1 }
  return slots.sort((a, b) => (railOrder[a.role] ?? 0) - (railOrder[b.role] ?? 0))
}

function shapeStory(draft, ctx) {
  const date = txnDate(draft.rows[0].row)
  const anchor = draft.rows.reduce(
    (min, r) => (r.row.id != null && (min == null || r.row.id < min) ? r.row.id : min),
    null,
  )
  return {
    id: `${ctx.orgId}-${date}-${draft.storyType}-${anchor ?? 'x'}`,
    type: draft.storyType,
    typeLabel: TYPE_LABELS[draft.storyType],
    rail: buildRail(draft, ctx),
    cutline: buildCutline(draft, ctx),
  }
}

// Every day's rows are put in id-ascending order before they are grouped, which
// is what STORY_TYPE_RANK's "ties keep discovery order" has always MEANT and
// never enforced. The wire does NOT hand them over that way: a day comes back
// in an arbitrary order (stable across identical queries, verified three times
// on 2026-08-19; not stable across different ones), and Step 2 pairs an arrival
// with a departure in the order it finds them. So the feed, not the pipeline,
// decided which of two recalls was told beside the Mets' 2026-08-19 injured-
// list placement — the nightly file and a live five-day pull disagreed about
// that on 3 of 30 club-days, from the identical set of rows. Both tellings were
// correct and neither was chosen.
//
// Sorting makes the grouping a function of its rows alone. That is what lets
// the club page lay a live window over the nightly file and get the same
// stories back (transactions/clubFeed.js) — measured with the sort in place,
// a season-long pull and a five-day one agree on 30 of 30 club-days.
//
// One org's already-bucketed, deduped, filtered rows -> [{ date, stories }],
// newest day first. `ctx.positions` is the generator's batched /people
// fallback; `ctx.orgId` is required (drives trade in/out + headshot tint);
// `ctx.debutedIds` flags which rail faces are confirmed major-leaguers.
export function groupIntoStories(rows, ctx = {}) {
  const byDate = new Map()
  for (const t of rows ?? []) {
    const date = txnDate(t)
    if (!date) continue
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(t)
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  return dates.map((date) => ({
    date,
    stories: buildDayStories(byDate.get(date).sort(byRowId), ctx),
  }))
}

// ---------------------------------------------------------------------------
// §5 Reader — static per-club, per-season files; lazy 45-day pagination
// ---------------------------------------------------------------------------

const PAGE_DAYS = 45
const seasonCache = new Map() // `${season}:${teamId}` -> Promise<{days} | null>

// Fetches ONE club's file for one season, session-caching successful reads and
// confirmed 404s for completed seasons. Current-season 404s, server failures,
// malformed JSON, and network errors are evicted and rethrown so the caller can
// keep a retry affordance visible. A confirmed historical 404 alone resolves
// null.
//
// One file per club per season, not one file holding all 30: the card shows one
// club, and a season's league-wide feed runs well over a megabyte by August, so
// a whole-file read spent ~97% of itself on the other 29 orgs. The generator
// writes a shard for EVERY org each season, including one with no rows at all
// (`days: []`), which is what lets a 404 here mean "no such season" rather than
// "quiet club" — the difference between paging further back and stopping.
async function loadSeasonFile(season, teamId) {
  const key = `${season}:${teamId}`
  if (seasonCache.has(key)) return seasonCache.get(key)
  const promise = Promise.resolve()
    .then(async () => {
      const res = await fetch(`/data/team-transactions/${season}/${teamId}.json`)
      if (!res.ok) {
        if (res.status === 404 && season < currentYear()) return null
        throw new Error(`team transactions ${res.status}`)
      }
      return await res.json()
    })
    .catch((error) => {
      // Only evict if this is still the active request for the season; a
      // future retry may already have installed its own promise.
      if (seasonCache.get(key) === promise) seasonCache.delete(key)
      throw error
    })
  seasonCache.set(key, promise)
  return promise
}

function currentYear() {
  return new Date().getUTCFullYear()
}

// Stateful pager: first call (cursor null) returns the most recent PAGE_DAYS
// of a team's days from the CURRENT season's file only; each subsequent call
// pages further back, crossing into the prior season's file only once the
// newer one is exhausted. `cutoff` trims to the Team Page's `asOf` (temporal
// hygiene, not spoiler defense — see the scope doc). Returns
// { days, cursor, hasMore } — hasMore is false only once a season file
// genuinely 404s (no earlier history for this team).
export async function loadMoreTeamTransactions(teamId, cursor, cutoff) {
  let season = cursor?.season ?? currentYear()
  let index = cursor?.index ?? 0
  const collected = []

  while (collected.length < PAGE_DAYS) {
    const file = await loadSeasonFile(season, teamId)
    if (!file) return { days: collected, cursor: { season, index }, hasMore: false }
    const allDays = (file.days ?? []).filter((d) => !cutoff || d.date <= cutoff)
    if (index >= allDays.length) {
      season -= 1
      index = 0
      continue
    }
    const take = Math.min(PAGE_DAYS - collected.length, allDays.length - index)
    collected.push(...allDays.slice(index, index + take))
    index += take
  }
  return { days: collected, cursor: { season, index }, hasMore: true }
}
