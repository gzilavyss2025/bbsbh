// The league-wide grouping pass — one feed of roster moves across all thirty
// clubs, for the home page's last-48-hours card (issue #772).
//
// It is NOT a merge of the thirty per-club story files, and it cannot be. The
// study measured 193 rows landing in two clubs' stories; de-duplicating on a
// story's own identity caught 169 of them and **24 escaped**, because the two
// clubs had grouped one move differently — one filed a claim as a solo move,
// the other folded it into a three-player shuffle, and the two stories shared
// no key (.scratch/home-transactions/findings.md).
//
// What works instead is upstream of all that. Only TWO type codes name two
// different major-league clubs — `TR` and `CLW` (docs/transactions-wire.md §7,
// re-verified over a 60-day live window: 253 trade rows, 40 claim rows, and
// nothing else in 16,211). So every raw row can be given exactly ONE owning
// club before any grouping happens, and then the existing club-scoped
// pipeline runs once per owner. A row is never grouped twice, so there is
// nothing to de-duplicate afterwards. Measured over that window: the merge
// told 81 events twice; this tells 0 twice, and names exactly the same 2,163
// player-days — it loses no coverage at all.
//
// Owning the row also settles the thing the study left open — whose voice an
// event is told in (product decision 1, "one voice, from the acquiring club's
// side"). The owner IS the acquiring club, so `filterStoryworthy` and
// `rowClause` both get a real `orgId` and behave exactly as their own
// comments require: the direct-touch gate applies, its `DFA` exemption stays
// safe, and the waiver-claim rebuild for the losing side is never reached,
// because a claim always belongs to the club that made it.
//
// Freshness: this reads the wire live rather than the nightly per-club files
// (product decision 4). A "last 48 hours" card fed from a nightly precompute
// is up to a day behind.
//
// Spoiler note: roster moves and their dates carry no score, so nothing here
// is reveal-only — as spoiler-free as the pipeline it calls.

import { txnDate } from '../rehab-policy.js'
import {
  STORY_TYPE_RANK,
  dedupeTransactions,
  filterStoryworthy,
  groupIntoStories,
} from '../teamTransactions.js'

// The same unordered from/to key the grouper's own trade step uses, so a deal
// is owned as one unit by exactly the rows that will later be grouped as one
// story.
function clubPairKey(t) {
  return [String(t.fromTeam?.id ?? ''), String(t.toTeam?.id ?? '')].sort().join('|')
}

// The club the wire's own sentence names as the RECIPIENT — which is the club
// acquiring, because the wire always writes "{sender} traded X to {recipient}
// for Y".
//
// This is measured, not assumed. Over a 60-day live window: 253 of 253 trade
// rows lead with one of that row's own two clubs; in 92 of 92 deals the
// leading club sends at least one named player; in 0 of 92 does it only
// receive. Note that the sentence, not the row, is what says so — every row
// in a deal carries the SAME sentence, whichever way that particular player
// went, so `fromTeam` on any one row answers a different question.
//
// The obvious alternative — whoever took more players — is wrong, and wrong
// often: it disagrees on 26 of the 60 deals it can decide, and loses all 26,
// because the wire names the headline player first and the return second. It
// would have headed the deadline's biggest cards with the prospects going the
// other way: Seattle rather than the club that got Luis Castillo, Baltimore
// rather than the club that got Adley Rutschman.
function tradeOwner(group, orgOf) {
  const clubs = new Map()
  for (const t of group) {
    for (const side of [t.fromTeam, t.toTeam]) {
      if (side?.id != null && side.name) clubs.set(side.id, side.name)
    }
  }
  const senders = new Set()
  for (const t of group) {
    for (const [id, name] of clubs) {
      if ((t.description || '').startsWith(`${name} `)) senders.add(orgOf(id))
    }
  }
  const orgs = [...new Set(group.flatMap((t) => orgsOn(t, orgOf)))]
  if (senders.size === 1) {
    const acquirer = orgs.find((id) => id !== [...senders][0])
    if (acquirer != null) return acquirer
  }
  // Two separate deals between one club pair on one day — one group of 92 in
  // the window, when the Cubs and the Blue Jays traded twice on 2026-08-02.
  // There are then two sentences, two senders and no acquiring side, so the
  // headcount decides after all. The grouper already merges the two deals
  // into one story (it keys a trade on date and club pair), so this only
  // picks whose story it is.
  const takenBy = new Map()
  for (const t of group) {
    if (t.person?.id == null) continue
    const org = orgOf(t.toTeam?.id)
    if (org != null) takenBy.set(org, (takenBy.get(org) ?? 0) + 1)
  }
  const ranked = [...takenBy.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  return ranked[0]?.[0] ?? orgs.slice().sort((a, b) => a - b)[0] ?? null
}

function orgsOn(t, orgOf) {
  return [...new Set([orgOf(t.fromTeam?.id), orgOf(t.toTeam?.id)].filter((id) => id != null))]
}

// Every row that belongs to a major-league organisation, mapped to the ONE
// club whose story it is. A row belonging to no org is simply absent — most
// of the wire is minor-league housekeeping (3,883 of 16,211 rows in the
// window name no major-league org on either side).
//
// `ctx.mlbTeamIds` is the thirty major-league club ids; `ctx.affilToOrg` maps
// an affiliate's id to its parent org, which is what lets a move logged only
// against a Triple-A club still find its owner. Both are what
// gen-team-transactions.mjs already fetches.
export function assignRowOwners(rows, ctx = {}) {
  const mlbIds = new Set(ctx.mlbTeamIds ?? [])
  const orgOf = (id) => {
    if (id == null) return null
    if (mlbIds.has(id)) return id
    return ctx.affilToOrg?.get(id) ?? null
  }

  const owner = new Map()
  const trades = new Map()
  for (const t of rows ?? []) {
    const orgs = orgsOn(t, orgOf)
    if (orgs.length === 0) continue
    if (orgs.length === 1) {
      owner.set(t, orgs[0])
      continue
    }
    if (t.typeCode === 'TR') {
      const key = `${txnDate(t)}|${clubPairKey(t)}`
      if (!trades.has(key)) trades.set(key, [])
      trades.get(key).push(t)
      continue
    }
    // A waiver claim — the only other code naming two orgs. It belongs to the
    // club that made it, which is the side the wire's sentence is already
    // written from, so nothing has to be rewritten to tell it once.
    owner.set(t, orgOf(t.toTeam?.id) ?? orgs[0])
  }
  for (const group of trades.values()) {
    const pick = tradeOwner(group, orgOf)
    if (pick == null) continue
    for (const t of group) owner.set(t, pick)
  }
  return owner
}

// The whole pass: raw wire rows in, `[{ date, stories }]` newest day first
// out, each story carrying the `teamId` whose story it is. `ctx` also takes
// the `positions` and `debutedIds` the club-scoped pipeline wants — the
// second is not optional in practice, since without it the feed is 45%
// anonymous minor-league signings (measured; the suppression is documented in
// vocabulary.js).
export function groupLeagueWide(rows, ctx = {}) {
  const byOrg = new Map()
  for (const [row, orgId] of assignRowOwners(rows, ctx)) {
    if (!byOrg.has(orgId)) byOrg.set(orgId, [])
    byOrg.get(orgId).push(row)
  }

  const byDate = new Map()
  for (const [orgId, orgRows] of byOrg) {
    const kept = filterStoryworthy(dedupeTransactions(orgRows), { orgId, debutedIds: ctx.debutedIds })
    const days = groupIntoStories(kept, { positions: ctx.positions, orgId, debutedIds: ctx.debutedIds })
    for (const day of days) {
      if (!byDate.has(day.date)) byDate.set(day.date, [])
      for (const story of day.stories) byDate.get(day.date).push({ ...story, teamId: orgId })
    }
  }

  // Within a day, the same significance order the club-scoped grouper uses,
  // then the club id — a stable tie-break, not a claim that one club's trade
  // mattered more than another's. Sorting is stable, so two stories from one
  // club keep the order that club's own grouper put them in.
  return [...byDate.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((date) => ({
      date,
      stories: byDate.get(date).sort(
        (a, b) => rankOf(a) - rankOf(b) || a.teamId - b.teamId,
      ),
    }))
}

const UNRANKED = 9
function rankOf(story) {
  return STORY_TYPE_RANK[story.type] ?? UNRANKED
}
