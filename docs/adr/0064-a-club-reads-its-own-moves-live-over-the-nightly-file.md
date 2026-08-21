# ADR-0064 — A club reads its own moves live, over the nightly file

Status: accepted (2026-08-21)

## Context

Roster moves reach the reader by two paths, and until now they disagreed about
what "recent" means.

| Surface | Source | Freshness |
| --- | --- | --- |
| The home slate's wire (`WireRail` / `WireDock`) | `/api/v1/transactions`, on page load | seconds |
| A club's Transactions deck (`TeamTransactionsCard`) | `public/data/team-transactions/{season}/{teamId}.json` | up to a day |

The nightly cron writes those files at 07:00 UTC (`update-nightly-data.yml`;
today's run committed at 13:03 UTC). So a trade or a call-up filed at noon was
on the home page within seconds and **absent from that club's own page until
the next morning** — worst exactly when it matters most, on a deadline day,
when the club's page is the page a reader opens.

Moving the club surfaces onto a live feed outright is the wrong correction. A
season of one club's moves is 45-day-paged history, which is what a precompute
is for; only the last few days need to be live.

## Decision

**The file keeps the season; a live three-day window is laid over its newest
days.** `src/api/transactions/clubFeed.js` owns the join, and every club surface
loads its first page through it — the Overview's preview, the Games tab's deck,
and the club's ledger page.

Three things make that safe, and none of them is optional.

### 1. It re-runs the club pipeline; it does not filter the league feed

Filtering `fetchLeagueMoves` by `teamId` would be one line and would be wrong.
The league pass gives every row exactly ONE owning club so an event is told once
league-wide (ADR is the module header of `transactions/league.js`), and for a
trade that owner is the **acquiring** club. Filtered to one club, a deal the
club sold in would vanish from its own page — the page that has to carry both
sides. The club pipeline buckets instead (`bucketToOrg`): a row belongs to every
org it touches, which is why a trade appears on two clubs' pages, each written
from its own side.

So the live leg runs the generator's own four steps — bucket, de-dupe, filter,
group — over live rows.

### 2. The grouping is a function of its rows alone

Running the same code over the same rows only gives the same stories if the code
does not depend on the order the rows arrive in. It did. The wire returns a day
in an arbitrary order — stable across identical queries, **not** stable across
different ones — and the pairing step took an arrival and a departure in the
order it met them. Measured on 2026-08-19, the nightly file and a live five-day
pull disagreed on **3 of 30 club-days** about which of the Mets' two recalls was
told beside the injured-list placement, from the identical set of rows. Both
tellings were correct and neither was chosen.

`groupIntoStories` now orders a day's rows by row id before grouping, which is
what `STORY_TYPE_RANK`'s "ties keep discovery order" always meant and never
enforced. With that in place a season-long pull and a five-day pull agree on
**30 of 30 club-days**.

### 3. The join is by DAY, never by story

A day is told by exactly one of the two sources:

- inside the window, live wins — that is the point;
- outside it, the file wins — the live fetch never looked there;
- inside it but unknown to live, the file still wins. That is the one row shape
  the wider fetch can miss: post-dated, filed more than `FETCH_DAYS` before the
  day it takes effect.

Merging by story identity instead is the failure the league-wide study already
measured: two groupings of one event share no key, and 24 of 193 rows escaped a
de-duplication built on story identity. Day-level replacement cannot produce
that failure even if the two sources ever disagree again.

## Consequences

- A club's page is as fresh as the home page. The file still carries the season,
  and paging back past the window stays on it.
- The two legs run in parallel and neither can take the other down: live alone
  fails and the card is what it always was; the file alone fails and the reader
  still gets the last three days, with paging off; both fail and the caller
  draws its own error state.
- A dated (`?d=`) view skips the live leg. A frozen page must stay frozen.
- The window and the fetch are the wire's own (`WINDOW_DAYS` / `FETCH_DAYS` in
  `transactions/leagueFeed.js`), inherited rather than chosen again — including
  ADR-0058's rule that a windowed feed selects on the date a move took effect
  while the endpoint filters on the date it was filed.
- The nightly generator is unchanged, and its output shifts once: the first run
  after the ordering fix re-pairs a small number of past club-days. Both
  pairings were correct; only one of them is now reproducible.
