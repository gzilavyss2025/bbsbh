# The Matchup Scout reads Savant from the browser, behind a date cutoff

**Status:** Accepted
**Date:** 2026-10-02
**Issues:** #1408 (parent), #1410 (phase 1), #1411 (phase 2)

## Context

The Matchup Scout (`/scout/{pitcher}/{hitter}`) shows one pitcher against one
hitter: where the pitcher throws each pitch, the hitter's line against each
pitch, and every past plate appearance between them. Gary approved the design
on 2026-10-02 (`docs/scout-design.md`, with his 15 decisions).

Two parts of it are new to this app:

- **A browser request to Baseball Savant.** No other page fetches a Savant CSV
  at run time. The head-to-head list needs one, because no nightly store holds
  plate appearances by pair.
- **A list that can name a meeting.** The page is an open surface (ADR-0034),
  but a live read of the pair "could leak whether/how tonight's batter and
  pitcher have already matched up" (`src/api/careerMatchups.js`).

## Decision

**1. The head-to-head list holds back every game dated on or after its
cutoff.** The cutoff is today, or `?d=` when present (ADR-0087, ADR-0088).
`AsOfBanner` moves it. Yesterday's plate appearances show. There is no
`SealBox` on the page, and none may be added: the date cutoff is the seal.

**2. Savant's date bounds are inclusive.** The request sends `game_date_lt` =
the day **before** the cutoff (`src/api/scout/headToHead.js`, verified
2026-10-02). The page never asks Savant for today.

**3. The list and its totals come from the same rows.** Scope (Regular,
Postseason, All) filters the rows by round, and `totalsOf` runs on the
filtered rows. statsapi `vsPlayer` is a cross-check only: summing its splits
counts each plate appearance twice.

**4. The request fails loudly and the page fails soft.** A response of 25,000
rows or more is Savant's silent cap, so the module throws. Any failure gives
`null`, and the page prints "No head-to-head on file". An empty answer is a
pair that never met: "No meetings before {date}". `baseballsavant.mlb.com` is
`NetworkOnly` in the service worker (ADR-0004).

**5. The maps read the nightly stores, in 13 regions.** The pitcher map sums
his 5x5 command cells (`public/data/pitch-command`) into 13 regions:
the zone's nine, High and Low (each with two corners), and the third-base and
first-base sides (`src/lib/zone/regions.js`). The stored cells never change.
The regions are a read-time sum, so no shard changes. A map under
`MIN_COMMAND_PITCHES` prints counts only. One season store at a time, so a
map never pools 2025 with 2026.

**6. Scope moves the maps only when the stores hold a postseason.** A shard
with `post` beside `pit` (ADR-0094) makes the board "scoped": Scope then sits
under the maps and moves the maps and the list together, and the tag names
the scope. A shard without `post` keeps the maps on the regular season, with a
"Regular season" tag, and Scope sits on the list, the only thing it moves
(Gary, item 9).

**6a. The hitter's map comes from the hitter-grid store, or not at all.** With
the #1411 Part B grid, the page draws the hitter's map in the same 13 regions,
each coloured against the league's rate in the same region and pitch types,
and joins the two maps into an expected value: the pitcher's share times the
hitter's value, region by region (`src/screens/scout/hitterBoard.js`). Hand
picks the pitcher hands his map reads; for a switch hitter "All" is off (Gary,
item 1). Metric offers "xwOBA (est.)" only when the grid carries `wobaSum`.
Without the grid, the hitter's slot prints his Savant board line per pitch
type, labelled "xwOBA · Regular season" (Gary, item 15), and there is no
expected value: with no hitter regions it would be his whole-type value, the
same for every pitcher.

**7. The address holds the choices.** `?view`, `?scope`, `?pitch`, `?hand`,
`?metric` and `?d`
(`src/lib/scout/route.js`). The view also persists in `localStorage`, never in
My Tally (ADR-0039). The view toggle itself is ADR-0093.

## Consequences

- The page makes one Savant request per pair and cutoff, about 100 KB for a
  long rivalry (Judge vs Verlander: 162 rows, 41 plate appearances, matching
  `vsPlayer`).
- The pickers reuse the site search in a pick mode (`SiteSearch.jsx`), so the
  on-screen keyboard rules of ADR-0037 hold for them too.
- `searchPeople`'s session cache keeps the whole result list, and each caller
  slices its own: the pickers fetch more rows than the site search, then filter
  by role.
- The Design Lab prototype (`src/screens/designlab/scout/`) runs the page's own
  hitter board (`hitterBoard.js`, `lib/scout/metrics.js`) on invented data, so
  the two cannot drift.

## Alternatives weighed

- **A nightly head-to-head store.** Every pair of every pitcher and hitter is
  far too many rows, and a nightly file is a day stale in a different way.
  Rejected.
- **statsapi `vsPlayer` as the source.** Regular season only by default, no
  pitch detail, and a double count across its splits. Rejected; a cross-check.
- **A seal on the list.** It would put a reveal surface on an open page, the
  regression ADR-0034 undid. The cutoff closes the leak without one.
