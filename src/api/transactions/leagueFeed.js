// The home slate's 48-hour roster-move card reads the wire LIVE (issue #772,
// product decision 4). This module is the reader: it owns the window
// arithmetic and the fetch chain, and hands the rows straight to
// `groupLeagueWide` — there is no second grouping path here, and there must
// not be one.
//
// Why not the nightly precompute the team page reads? A card headed "the last
// 48 hours" fed from a file built at 3 a.m. is up to a day behind, which is
// the one thing this surface cannot be.
//
// Spoiler note: a roster move and its date carry no score, so nothing here is
// reveal-only — as spoiler-free as the pass it calls (see league.js).
//
// THE WINDOW IS NOT THE FETCH. Everything below turns on that:
//
//   • `/api/v1/transactions?startDate=&endDate=` filters on a row's **`date`**
//     — when the wire filed it.
//   • `groupIntoStories` buckets by **`txnDate`** (`effectiveDate || date`) —
//     when the move took effect.
//
// Those disagree on 108 of 8,184 rows over a 30-day pull, in both directions.
// So the fetch reaches further back than the window and the result is trimmed
// afterwards. Backtested over 22 consecutive 48-hour windows against an
// unbounded-back reference, a 4-day fetch is the narrowest that misses
// nothing: 3 days misses one story, 2 days misses twelve
// (.scratch/home-transactions/probe-card-shape.mjs, Q6).
//
// One thing the trim knowingly leaves out, measured rather than assumed: a
// move FILED inside the window but backdated outside it — "placed C Hunter
// Goodman on the 10-day injured list retroactive to August 15" — belongs to
// the day it took effect and so does not appear. About 4.6 rows per 48 hours
// carry that shape and 78 of 101 over a month say "retroactive"; nearly all
// are injured-list placements, and every one of them is still on its own
// club's Transactions card. The alternative was worse: selecting on the filed
// date would print a three-day-old dateline inside a card headed "Last 48
// hours" (probe-retro-il.mjs).
import { getJson } from '../statsapi.js'
import { addDays, toApiDate } from '../../lib/dates.js'
import { groupLeagueWide, leagueCandidateIds } from './league.js'
// The thirty club ids, bundled rather than fetched — this is the same table
// every logo and colour in the app already reads, and its `identity/overlay.js`
// registration restyles a club, never adds or removes one. Reading the keys
// here costs no request and cannot fail, which is what lets the affiliate map
// below degrade to nothing without taking the card with it.
import MLB_TEAM_COLORS_JSON from '../../lib/data/mlb-team-colors.json' with { type: 'json' }

// "The last 48 hours" can only ever mean today and yesterday: a transaction
// carries dates, never a time (docs/transactions-wire.md §1).
export const WINDOW_DAYS = 2
export const FETCH_DAYS = 4

const MLB_TEAM_IDS = Object.keys(MLB_TEAM_COLORS_JSON).map(Number)

// Same manual y/m/d parse and local-midnight normalisation the rest of
// lib/dates.js uses, so a window can't drift by a day across a DST edge the
// way subtracting raw Date objects with a time still attached can.
function shiftApiDate(apiDate, n) {
  const [y, m, d] = apiDate.split('-').map(Number)
  return toApiDate(addDays(new Date(y, m - 1, d), n))
}

// `{ fetchStart, windowStart, endDate }` — what to ask the endpoint for, and
// what to keep once it answers. Exported so the trim and the request can be
// tested without a network.
export function feedWindow(endDate) {
  return {
    endDate,
    windowStart: shiftApiDate(endDate, -(WINDOW_DAYS - 1)),
    fetchStart: shiftApiDate(endDate, -(FETCH_DAYS - 1)),
  }
}

// Raw rows -> the card's `[{ date, stories }]`, newest day first. Pure: the
// whole pass is `groupLeagueWide` plus the trim the wider fetch made
// necessary.
export function shapeLeagueFeed(rows, ctx, window) {
  return groupLeagueWide(rows, ctx).filter(
    (day) => day.date >= window.windowStart && day.date <= window.endDate,
  )
}

// Affiliate id -> parent org id, from the static file gen-affiliates.mjs
// already writes weekly for the team page (public/data/affiliates.json). It
// covers the four full-season levels rather than the generator's live
// 291-club pull, and over a 30-day window the two produce **the same 694
// stories** — the complex-league and DSL clubs it leaves out never own a
// storyworthy row (probe-card-fetch.mjs, Q4).
//
// Degrades to an empty map, which costs 7 of those 694 stories (−1%): an
// option or a call-up logged only against the Triple-A club stops finding its
// parent. Worth failing soft for — the card is still a card without it.
let affiliateMap = null
async function fetchAffiliateParentMap() {
  if (affiliateMap) return affiliateMap
  affiliateMap = (async () => {
    const map = new Map()
    try {
      const res = await fetch('/data/affiliates.json')
      if (!res.ok) throw new Error(`affiliates.json ${res.status}`)
      const data = await res.json()
      for (const [orgId, clubs] of Object.entries(data.byOrgId ?? {})) {
        for (const club of clubs ?? []) {
          if (club?.id != null) map.set(club.id, Number(orgId))
        }
      }
    } catch {
      // Left empty on purpose — see above.
    }
    return map
  })()
  return affiliateMap
}

// One batched `/people` pass covering the two things the pipeline reads off a
// person: the position fallback for a description that doesn't carry one, and
// `mlbDebutDate`, which rides along on the same response and is what
// suppresses an anonymous minor-league signing. Without that set the feed is
// 45% larger and nearly all of the growth is signing spam (measured, twice).
const PEOPLE_BATCH = 100
async function fetchPeople(ids, signal) {
  const positions = {}
  const debutedIds = new Set()
  for (let i = 0; i < ids.length; i += PEOPLE_BATCH) {
    const batch = ids.slice(i, i + PEOPLE_BATCH)
    if (!batch.length) continue
    const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}`, { signal })
    for (const p of data.people ?? []) {
      positions[p.id] = p.primaryPosition?.abbreviation || ''
      if (p.mlbDebutDate) debutedIds.add(p.id)
    }
  }
  return { positions, debutedIds }
}

// The card's whole load. Two round trips deep, because the `/people` call
// cannot name its ids until the transactions call has answered — measured at
// 52 ms + 106 ms for a four-day window (640 rows, 114 ids, two batches).
//
// `leagueCandidateIds` is what keeps that second leg short: asking only about
// rows that survive the storyworthy filter takes the id list to about a third
// of a naive prefilter's, and builds exactly the same stories (see its own
// header for why that is safe rather than merely lucky).
export async function fetchLeagueMoves(endDate, { signal } = {}) {
  const window = feedWindow(endDate)
  const [rows, affilToOrg] = await Promise.all([
    getJson(
      `/api/v1/transactions?startDate=${window.fetchStart}&endDate=${window.endDate}`,
      { signal },
    ).then((data) => data.transactions ?? []),
    fetchAffiliateParentMap(),
  ])

  const scope = { mlbTeamIds: MLB_TEAM_IDS, affilToOrg }
  const people = await fetchPeople([...leagueCandidateIds(rows, scope)], signal)
  return shapeLeagueFeed(rows, { ...scope, ...people }, window)
}
