// The club Transactions card's freshness half — what the nightly precompute
// cannot be, laid over what only a precompute can hold.
//
// THE GAP THIS CLOSES. The club surfaces read
// `public/data/team-transactions/{season}/{teamId}.json`, written by the
// nightly cron at 07:00 UTC (update-nightly-data.yml). The home slate's wire
// reads the endpoint live. So a trade or a call-up filed at noon was on the
// home page within seconds and absent from that club's OWN page until the next
// morning — up to a full day, and worst exactly when it matters most, on a
// deadline day when a club's page is the page a reader opens.
//
// The fix is not to move the club page onto a live feed. A season of one
// club's moves is 45-day-paged history, which is what a precompute is for; only
// the last few days need to be live. So: the file keeps the season, a live
// window is laid over its most recent days, and the two meet at
// `windowStart`.
//
// WHY THIS RE-RUNS THE PIPELINE INSTEAD OF FILTERING THE LEAGUE FEED. It would
// be one line to call `fetchLeagueMoves` and keep the stories whose `teamId`
// matches. It would also be wrong: the league pass gives every row exactly ONE
// owning club so an event is told once league-wide (transactions/league.js),
// and for a trade that owner is the ACQUIRING club. Filtered to one club, a
// deal the club sold in would simply vanish from its own page — the very page
// that has to carry both sides. The club pipeline buckets instead: a row
// belongs to every org it touches, which is why a trade appears on two clubs'
// pages, each written from its own side.
//
// So this runs the generator's own four steps — bucket, de-dupe, filter,
// group — over live rows. That is what makes the overlay safe to merge: the
// same code over the same rows produces the same stories with the same ids
// (`${orgId}-${date}-${type}-${anchor}`), so a day the file already holds and
// a day the wire just filed cannot disagree about what happened.
//
// Spoiler note: a roster move and its date carry no score, so nothing here is
// reveal-only — as spoiler-free as the two pipelines it joins.

import { getJson } from '../statsapi.js'
import { toApiDate } from '../../lib/dates.js'
import {
  bucketToOrg,
  dedupeTransactions,
  filterStoryworthy,
  groupIntoStories,
  loadMoreTeamTransactions,
} from '../teamTransactions.js'
import { feedWindow, fetchAffiliateParentMap, fetchPeople } from './leagueFeed.js'

// One club's live window: the same three-day window and five-day fetch the
// wire uses, for the same reason — the endpoint filters on the day a row was
// FILED and the grouper buckets by the day it took EFFECT, so the fetch has to
// reach further back than the window and the result is trimmed afterwards.
// leagueFeed.js's own header carries the backtest behind those two numbers;
// this path inherits it rather than choosing again.
//
// The `/people` leg is the same trick too: ask about the rows that could
// become a story with NO debut set, which is a superset of the rows that will
// (the debut set only ever suppresses), and the position/debut lookup stays a
// fraction of the club's raw row count.
export async function fetchClubMoves(orgId, endDate, { signal } = {}) {
  const window = feedWindow(endDate)
  const [rows, affilToOrg] = await Promise.all([
    getJson(`/api/v1/transactions?startDate=${window.fetchStart}&endDate=${window.endDate}`, {
      signal,
    }).then((data) => data.transactions ?? []),
    fetchAffiliateParentMap(),
  ])

  const clubRows = dedupeTransactions(bucketToOrg(rows, orgId, affilToOrg))
  const candidates = new Set()
  for (const row of filterStoryworthy(clubRows, { orgId })) {
    if (row.person?.id != null) candidates.add(row.person.id)
  }
  const { positions, debutedIds } = await fetchPeople([...candidates], signal)

  const kept = filterStoryworthy(clubRows, { orgId, debutedIds })
  return groupIntoStories(kept, { positions, orgId, debutedIds }).filter(
    (day) => day.date >= window.windowStart && day.date <= window.endDate,
  )
}

// The join, by DAY rather than by story. A day is told by exactly one of the
// two sources, never by both, so a story can never print twice — which is the
// failure the league-wide study measured when two groupings of the same event
// were merged on their own identity (.scratch/home-transactions/findings.md).
//
//   • inside the window, live wins — that is the whole point;
//   • outside it, the file wins — the live fetch never looked there;
//   • inside it but unknown to live, the file still wins. That is the one row
//     shape the wider fetch can miss: post-dated, filed more than FETCH_DAYS
//     before the day it takes effect. Rare, and there is no reason to drop a
//     day the file can still tell.
export function mergeLiveDays(fileDays, liveDays, windowStart) {
  const live = new Set((liveDays ?? []).map((day) => day.date))
  const merged = [...(liveDays ?? [])]
  for (const day of fileDays ?? []) {
    if (day.date < windowStart || !live.has(day.date)) merged.push(day)
  }
  return merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// What every club surface loads for its FIRST page — the file's newest 45 days
// with the live window laid over them. Paging further back (the deck's "Load
// more", the ledger page's "Earlier moves") stays on
// `loadMoreTeamTransactions`, since nothing live reaches that far.
//
// The two legs run in PARALLEL and neither can take the other down. The file
// is a static asset and the live window is two statsapi round trips; making
// the card wait for the file before it starts the wire would have added the
// slower of the two to the faster for no reason.
//
//   • live alone fails -> the file, which is the card exactly as it was before
//     any of this existed;
//   • the file alone fails -> the live window, so a reader still gets the last
//     three days instead of an empty card. It comes back with paging off,
//     because a cursor into a file that would not load points nowhere;
//   • both fail -> the rejection reaches the caller, which is what draws the
//     card's own error state.
//
// A dated view (`asOf`) skips the live leg entirely. The whole promise of a
// `?d=` link is a page frozen at that date, and today's moves would break it.
//
// The cursor is the file's, untouched. It counts days CONSUMED from the file,
// not days shown, so replacing a handful of them with live ones leaves the next
// page pointing exactly where it did.
//
// `endDate` defaults to the reader's own local day, the same reckoning the
// slate and its wire use (`toApiDate`), so a club page and the home page opened
// side by side ask about the same three days. Injectable for a test, which
// cannot depend on what day it runs.
export async function loadClubTransactionsPage(teamId, asOf, endDate = toApiDate()) {
  const [file, live] = await Promise.all([
    loadMoreTeamTransactions(teamId, null, asOf).catch(() => null),
    asOf ? Promise.resolve(null) : fetchClubMoves(teamId, endDate).catch(() => null),
  ])
  if (!file) {
    if (!live) throw new Error(`club transactions unavailable for ${teamId}`)
    return { days: live, cursor: null, hasMore: false }
  }
  if (!live) return file
  return { ...file, days: mergeLiveDays(file.days, live, feedWindow(endDate).windowStart) }
}
