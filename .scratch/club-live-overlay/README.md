# The club's own moves, live over the nightly file

Working notes and probes behind **ADR-0063** and §13 of `docs/transactions-wire.md`.

The club Transactions surfaces read `public/data/team-transactions/{season}/{teamId}.json`,
written by the cron at 07:00 UTC. The home slate's wire reads the endpoint live.
So a move filed at noon was on the home page in seconds and missing from the
club's own page until the next morning. `src/api/transactions/clubFeed.js` closes
that by laying a live three-day window over the file's newest days.

Every probe hits the real wire (`statsapi.mlb.com`) and reads the shipped data
files. Run them from the repo root. Under the Bash sandbox they fail with
`ENOTFOUND`; run them with the sandbox off.

| Script | Answers |
| --- | --- |
| `probe-overlay.mjs [endDate]` | Does the live pipeline reproduce the nightly file on the days both cover? Also asserts the merge never tells a day twice and never leaves the run out of order. |
| `probe-order.mjs [endDate]` | The invariant the merge needs: does a SEASON-long pull and a FIVE-day pull group a club-day identically? (30 of 30 with the id sort in `groupIntoStories`.) |
| `probe-diff.mjs <orgId> <date> [endDate]` | Prints one club-day's raw rows, then the file's stories beside the live ones. What to reach for when `probe-overlay` reports a mismatch. |
| `probe-degrade.mjs` | Browser-level: blocks the static file, then the wire, then both, and checks the club page still says something in each case. Needs a dev server on 5173. |

## What was measured, 2026-08-21

- **The wire does not order a day's rows.** Repeated identical queries return the
  same order (checked three times on 2026-08-19); different queries do not, and
  it is never id-ascending. The pairing step took an arrival and a departure in
  the order it met them, so the file and a live five-day pull disagreed on
  **3 of 30 club-days** about which of the Mets' two recalls was told beside
  their injured-list placement — identical rows, two correct tellings.
  `groupIntoStories` now sorts a day by row id first.
- **After that sort, a season-long pull and a five-day pull agree on 30 of 30
  club-days** (`probe-order.mjs`).
- **The join is by day, never by story**, so even a future disagreement cannot
  print one event twice. Merging on story identity is the failure
  `.scratch/home-transactions/findings.md` already measured league-wide.
