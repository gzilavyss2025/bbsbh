# A dataset no surface reads ships in its own file

**Status:** Accepted
**Date:** 2026-09-16

## Context

The ABS report's three-PR stack (ADR-0075's chances denominator, the umpire
board, and per-player exposure) added two things to
`public/data/abs-challenges.json`:

- `exposure`, one row per player per level — how many pitches he saw, how many
  plate appearances he took, how many innings he caught and how many games he
  started behind the plate.
- Ten more fields on every one of the 1,553 `byPlayer` rows: the same four
  denominators, his challenges split by the job he was doing, and the three
  rates those make.

The file went from **198 KB to 895 KB**. Nothing in `src/` read a byte of it.
The boards that will (issues #1063, #1066, #1069) were not built, and the
`/abs-challenges` page fetches the whole file on every visit and shows none of
it.

The size is not the whole problem. It is a phone-first app read at a ballpark,
often on a bad connection, and the report page is one of the heavier routes
already. A 4.5x increase for data no reader can see is a cost with nothing on
the other side of it — and the date it would have been noticed is the date
somebody profiled the page, not the date it landed.

## Decision

**A file a page fetches carries what that page reads. A dataset built for a
surface that does not exist yet ships beside it, in its own file.**

`abs-challenges.json` (206 KB) is the report page's. `abs-exposure.json`
(418 KB) is the per-player denominator list, and nothing fetches it until a
board needs it. Both are written by `gen-abs-challenges.mjs` on every run, from
the same tables, by `buildExport` and `buildExposureExport`
(`scripts/lib/abs/export.mjs`).

The split is along a real seam, not an arbitrary size line.

### The two files answer different questions about different populations

`byPlayer` is every man who CHALLENGED. `abs-exposure.json` is every man who
PLAYED — and the difference is the finding, not an edge case. Four qualified
MLB hitters (300 plate appearances and up) never called for a review all
season, and **three of them leave no challenge row anywhere**, so `byPlayer`
cannot see them at all. 115 of the 659 MLB men in the exposure file have no
`byPlayer` entry.

So the list needed to exist separately whatever was decided about size. Putting
the rates where the denominators already were is what let `byPlayer` go back to
a player's own challenge totals and nothing he is divided by.

### The name travels with the id

`exposureByPlayer` folded the roster rows to a Map of four numbers and dropped
`name` and `position`, which the `abs_player_exposure` table stores. For the
115 men with no challenge row that left nothing to print them by: a board built
on the list could show only player ids. The fold carries the name and the
position now, first non-empty wins, so a traded man is deterministic rather
than last-club-wins.

### A row with no opportunity is dropped, not shipped as nulls

A pitcher who never batted and never caught supports no rate, and cannot answer
"he had the chance and never took it" either — there is nothing he had the
chance to do. 1,963 of the 3,521 men on a `fullSeason` roster are that shape.

The test is a REAL opportunity, at least one column above nought, not merely a
column that is not null: a pitcher who never came to the plate carries a hitting
split reading `0` rather than no split at all, and a zero divides to no rate
exactly as a null does.

### The second file costs nothing until it is fetched

`vite.config.js` opts `data/**.json` OUT of the service worker's precache by
default — only `data/teams.json` is named in, and the inverted default exists
because the old opt-out list leaked 128 KB of umpire aggregates into every
install unnoticed. So a new data file does not join the install. It falls to the
runtime `/data/{anything}.json` rule, which caches it the first time something
asks.

## Consequences

- `summarizeLevel` no longer takes an `exposure` argument, and `buildExport` no
  longer takes an `exposure` option. `buildExposureExport(rows, exposure, …)`
  takes both, because a player's role split comes off the challenge rows and
  his denominators off the roster rows.
- `test/abs-challenges.test.js` pins the split by asserting the exact key set of
  a `byPlayer` row. A field added back there fails the suite rather than growing
  the file quietly, which is the regression this ADR exists to prevent.
- The nightly writes both files every run, and its commit step stages
  `public` wholesale (`git add -A -- public scripts/data src/lib/data`), so the
  new file needed no edit there. `scripts/check-data-freshness.mjs` is
  default-on for any dataset carrying a `generatedAt` stamp, so it covers the
  new file with no edit either.
- A board that comes to need the rates adds its own `staticJson` reader in
  `src/api/around-the-game/`. Until one does, `abs-exposure.json` is generated
  and committed but never fetched, which is the intended state and not an
  oversight.
- **The rule generalises past this report.** The repo already keeps the
  build-time-fetch pattern (`docs/api/static-data.md`) and already shards the
  sets that are too big to ship whole (`team-records`, contracts). This is the
  same discipline one step earlier: the question is not only "is the file too
  big" but "does the page that fetches it read this". A dataset that fails the
  second test does not belong in it, at any size.
