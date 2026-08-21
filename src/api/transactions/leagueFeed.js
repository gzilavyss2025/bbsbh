// The home slate's roster-move wire is read LIVE (issue #772,
// product decision 4). This module is the reader: it owns the window
// arithmetic and the fetch chain, and hands the rows straight to
// `groupLeagueWide` — there is no second grouping path here, and there must
// not be one.
//
// Why not the nightly precompute the team page reads? A card headed "the last
// three days" fed from a file built at 3 a.m. is up to a day behind, which is
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
// afterwards. Backtested against an unbounded-back (14-day) reference over 12
// consecutive windows, a **5-day** fetch is the narrowest that misses nothing
// for the 3-day window: 4 days and 3 days each miss one story. The same
// backtest under the old 2-day window put the floor at 4 days, so widening the
// window by a day moved the fetch by a day — re-run it before changing
// WINDOW_DAYS again rather than assuming the margin holds.
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
import { fetchTeams } from '../schedule.js'
import { SPORT_IDS } from '../../lib/teams.js'
import { groupLeagueWide, leagueCandidateIds } from './league.js'
// The thirty club ids, bundled rather than fetched — this is the same table
// every logo and colour in the app already reads, and its `identity/overlay.js`
// registration restyles a club, never adds or removes one. Reading the keys
// here costs no request and cannot fail, which is what lets the affiliate map
// below degrade to nothing without taking the card with it.
import MLB_TEAM_COLORS_JSON from '../../lib/data/mlb-team-colors.json' with { type: 'json' }

// A transaction carries dates, never a time (docs/transactions-wire.md §1), so
// the window can only ever be counted in whole days — which is why it is three
// and not two.
//
// Two days means today and yesterday, and that is "the last 48 hours" only for
// a reader who opens the app late in the evening. At 10am it is about 34 hours,
// and just after midnight it is barely 24. Measured on a Friday morning it
// showed 10 stories while Wednesday's 31 sat one day outside the window —
// three times as much news, excluded for being on the wrong side of a calendar
// boundary rather than for being old.
//
// Three days is the narrowest window that is AT LEAST 48 hours at every hour of
// the day (it runs 48 to 72), which is the promise the surface makes. It costs
// the rail nothing: it fits itself to the games column beside it and puts the
// rest behind one control (WireRail.jsx), so a fuller window fills the space
// that exists instead of lengthening the page.
//
// Expect 41 to 65 stories over 12 consecutive measured windows, median ~55 —
// against 30 to 54 for two days. FETCH_DAYS is backtested, not derived; see
// THE WINDOW IS NOT THE FETCH above before touching either.
export const WINDOW_DAYS = 3
export const FETCH_DAYS = 5

// A MiLB level has the same thirty clubs an MLB level does, but far fewer of
// its rows clear `filterStoryworthy` — an undebuted signing isn't suppressed
// there (see `windowConfigFor` below), yet AA/A+/A still run a fifth of MLB's
// volume: `.scratch/milb-wire/backtest.md` replays a live 25-day pull through
// this module's own `groupLeagueWide` and finds AAA already close to MLB's
// three-day range (37 vs. 43 stories) but AA/A+/A well short of it (13-16).
// Widening only those three levels to 7/9 pulls them within reach (45/34/31)
// without lengthening AAA past what it needs. Re-run that backtest before
// changing either level's window, same rule `WINDOW_DAYS`'s own header sets.
const MILB_WINDOW_DAYS = 7
const MILB_FETCH_DAYS = 9
const WIDE_WINDOW_SPORT_IDS = new Set([SPORT_IDS.AA, SPORT_IDS['A+'], SPORT_IDS.A])

function windowConfigFor(sportId) {
  return WIDE_WINDOW_SPORT_IDS.has(sportId)
    ? { windowDays: MILB_WINDOW_DAYS, fetchDays: MILB_FETCH_DAYS }
    : { windowDays: WINDOW_DAYS, fetchDays: FETCH_DAYS }
}

// The number the two presentations' copy reads off — "Last N days" — so
// neither hardcodes MLB's 3 and both stay correct on the wider AA/A+/A window.
export function windowDaysFor(sportId) {
  return windowConfigFor(sportId).windowDays
}

const MLB_TEAM_IDS = Object.keys(MLB_TEAM_COLORS_JSON).map(Number)

// Same manual y/m/d parse and local-midnight normalisation the rest of
// lib/dates.js uses, so a window can't drift by a day across a DST edge the
// way subtracting raw Date objects with a time still attached can.
function shiftApiDate(apiDate, n) {
  const [y, m, d] = apiDate.split('-').map(Number)
  return toApiDate(addDays(new Date(y, m - 1, d), n))
}

// `{ fetchStart, windowStart, endDate }` — what to ask the endpoint for, and
// what to keep once it answers. `sportId` defaults to MLB so `clubFeed.js`
// (always an MLB org's own page) and the existing tests keep reading the 3/5
// day window with no second argument. Exported so the trim and the request
// can be tested without a network.
export function feedWindow(endDate, sportId = SPORT_IDS.MLB) {
  const { windowDays, fetchDays } = windowConfigFor(sportId)
  return {
    endDate,
    windowStart: shiftApiDate(endDate, -(windowDays - 1)),
    fetchStart: shiftApiDate(endDate, -(fetchDays - 1)),
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
export async function fetchAffiliateParentMap() {
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
export async function fetchPeople(ids, signal) {
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

// The club-id set a level's stories are owned by, plus the affiliate fold-up
// (MLB only). At MLB, a row owned by an affiliate rolls up to its parent org
// (`assignRowOwners`'s `affilToOrg`) — that's the whole reason the wire reads
// as thirty ORGANIZATIONS' news. A MiLB level has no parent to roll up TO: its
// own thirty clubs are already the top of the set `assignRowOwners` walks, so
// `affilToOrg` is omitted rather than reused — passing the MLB map here would
// fold a Triple-A club's own story up into its big-league parent, which is
// backwards for a page headed by that Triple-A club's own slate.
async function scopeFor(sportId) {
  if (sportId === SPORT_IDS.MLB) {
    return { mlbTeamIds: MLB_TEAM_IDS, affilToOrg: await fetchAffiliateParentMap() }
  }
  const teams = await fetchTeams(sportId)
  return { mlbTeamIds: teams.map((t) => t.id) }
}

// The card's whole load. Two round trips deep, because the `/people` call
// cannot name its ids until the transactions call has answered — measured at
// 52 ms + 106 ms for a four-day window (640 rows, 114 ids, two batches).
//
// `leagueCandidateIds` is what keeps that second leg short: asking only about
// rows that survive the storyworthy filter takes the id list to about a third
// of a naive prefilter's, and builds exactly the same stories (see its own
// header for why that is safe rather than merely lucky).
//
// `debutedIds` rides along on the same `/people` batch at every level (it
// costs nothing extra — `fetchPeople` already reads it off the response for
// the position fallback), but it's folded into the org-scoped ctx ONLY for
// MLB. `isUndebutedSigning` (vocabulary.js) suppresses a signing whose person
// has no MLB debut — the right call when the alternative is anonymous
// organizational filler on the MLB-org-scoped wire, and the wrong one at a
// MiLB level, where an undebuted signee IS the level's actual roster and
// suppressing him would silence nearly every SFA/SGN/IFA row.
export async function fetchLeagueMoves(endDate, sportId = SPORT_IDS.MLB, { signal } = {}) {
  const window = feedWindow(endDate, sportId)
  const [rows, scope] = await Promise.all([
    getJson(
      `/api/v1/transactions?startDate=${window.fetchStart}&endDate=${window.endDate}`,
      { signal },
    ).then((data) => data.transactions ?? []),
    scopeFor(sportId),
  ])

  const people = await fetchPeople([...leagueCandidateIds(rows, scope)], signal)
  const ctx = sportId === SPORT_IDS.MLB
    ? { ...scope, ...people }
    : { ...scope, positions: people.positions }
  return shapeLeagueFeed(rows, ctx, window)
}
