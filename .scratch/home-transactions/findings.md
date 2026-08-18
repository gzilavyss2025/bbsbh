> **2026-08-18**: decisions made, filed as gzilavyss2025/bbsbh#772.

# Home-page transaction log — data study

> **Read `docs/transactions-wire.md` first.** Everything this session learned
> about the endpoint, its vocabulary and the roster rules underneath was
> consolidated there as the durable reference. This file is the working record of
> how the first question was answered — whether the team-page pipeline could be
> reused for a league-wide feed. **It could not**, and the session moved to a
> clean slate built on the raw wire; the later scripts in this directory
> (`type-census.mjs`, `last48.mjs`, `join-related.mjs`, `wire.mjs`) are that
> second effort.

**Status:** exploration only. No app code changed. This is the evidence a design
decision should be made against, not a design.
**Slug:** home-transactions
**Window studied:** 2026-07-21 → 2026-08-11 (21 days), pulled 2026-08-11.

The proposal is a home-page log of transactions involving MLB clubs over the last
48 hours, re-using the Team Transactions pipeline. Two risks were named up front:
**duplicated transactions**, and **transactions displayed wrong**. Both are real,
both are measurable, and this pass measures them.

## How this was measured

`pull-window.mjs` fetches the same four endpoints `gen-team-transactions.mjs`
fetches, then runs all 30 orgs through `bucketToOrg` → `dedupeTransactions` →
`filterStoryworthy` → `groupIntoStories`, **imported from
`src/api/teamTransactions.js`** rather than re-implemented, so what this reports
is what the app does. It records, per raw row, which orgs claimed it, what each
org's pipeline decided about it, and which story it ended up in. `build-report.mjs`
renders that trace into `report.html` (self-contained, 1.9 MB, no network).

Row → story association is inferred (date + personId against the story's rail and
cutline player ids), because `groupIntoStories` returns no back-pointer to its
rows. The inference's own failure modes are reported rather than hidden: **0 rows
matched no story** and 28 matched more than one.

## The funnel

| Stage | Rows |
| --- | --- |
| In the API window, every level | 6,496 |
| Claimed by an MLB org (club or affiliate) | 5,692 |
| Survive the noise filter | 910 |
| Club stories built | 560 |
| Distinct events after collapsing exact repeats | 495 |

A 48-hour card is **about 30 events** — the two most recent days here hold 34.

## Duplication

**Only two type codes name two different MLB clubs**: `TR` (trade, 195 rows) and
`CLW` (waiver claim, 18 rows). Everything else names one club plus its own
affiliates and cannot duplicate. That is the whole surface of the problem.

193 rows land in two clubs' stories. De-duplicating on the story's own identity
(`{date}-{type}-{anchorRowId}`) catches 169 of them. **24 escape**, because the
two clubs grouped the same move differently — one filed a claim as a solo roster
move, the other folded it into a three-player shuffle, so the two stories share no
key. 65 of 495 events (13%) are exact duplicate pairs.

**The architectural consequence:** a home feed cannot be assembled by merging the
30 per-club files and de-duplicating on story id. It has to group league-wide,
once, from the raw rows — a second grouping pass with no `orgId`, not a merge of
30 org-scoped ones.

## Displayed wrong

1. **A waiver claim reads backwards on the club that lost the player.** The wire
   writes the description from the claiming club's side ("Baltimore Orioles
   claimed C Yohel Pozo off waivers from St. Louis Cardinals"); `stripLeadingClub`
   removes whichever club leads the sentence, so the Cardinals' card reads
   "Claimed C Yohel Pozo off waivers from St. Louis Cardinals." Trades escape this
   because `cutlineTrade` writes its own lead from the club's own direction
   (`Acquired … from` / `Traded … to`); `CLW`/`PUR`/`WA` never got that treatment.
   **This is live on team pages today** — 18 rows in three weeks.

2. **One player appears twice in one story** — 5 stories. Two causes, both real
   baseball: a DFA followed by a release the same day (step 1b pairs a departure
   with a free-agency election only, not with a second departure), and a trade
   whose pulled 40-man clearing move names a player already in the trade
   (Cleveland genuinely designated Juan Brito and traded him the same day).

3. **A busy club's story runs long** — the shuffle grouper clusters every
   unpaired add and subtract on a day with no cap. Four stories exceed 320
   characters; the longest is 413, with five faces in its rail.

## Coverage

585 rows touch an MLB club directly and never appear. Most is deliberate. Two
slices need a decision:

- **`ACQ` — 5 rows.** MLB clubs acquiring players out of independent leagues
  ("Cincinnati Reds acquired LHP Kent Emanuel from the High Point Rockers of the
  Atlantic League"). Dropped only because the code isn't on the whitelist.
- **Plain activations — 78 rows.** "Washington Nationals activated RHP Miles
  Mikolas" carries no injured-list wording, so `isIlEndingTxn` doesn't match.

The rest: 365 signings of players with no MLB debut on file (deliberate — the
suppression that stops a minor-league signing spree burying the feed), 100 rehab
assignments (`ASG`, deliberate — rehab has its own page), 32 opaque "roster status
changed by" rows, 2 number changes.

## Data-shape facts worth keeping

- **`team` is never sent** on this endpoint — 0 of 6,496 rows. Only
  `fromTeam`/`toTeam`.
- **`id` is not unique.** 6,361 distinct ids across 6,496 rows; every player in a
  trade shares one id with the trade's person-less mirror copy.
- **74 rows carry an `effectiveDate` different from `date`.** The pipeline keys on
  `effectiveDate`; at a 48-hour window that difference decides membership.
- **`currentTeam` never comes back** from the batched `/people?personIds=` call —
  0 of 3,821 people. Read the club off the row's own `toTeam` instead.
- **`mlbDebutDate` is present on 730 of 3,821** people — which is what makes it a
  usable filter for suppressing anonymous minor-league signings.

## Freshness

The per-club files are rebuilt once nightly, so a "last 48 hours" card fed from
them carries today's moves only after the next run. Either the home card accepts
being up to a day behind, or it reads the wire directly for its own short window.

## Open questions for the maintainer

1. **One event or one club's view of it?** A trade's two copies are each correct
   from their own side. A league-wide feed has to pick a voice ("Brewers acquire X
   from the Royals") rather than print both.
2. Do independent-league acquisitions (`ACQ`) belong?
3. Should the plain activations be recovered, or are they noise?
4. Is a nightly-precomputed 48-hour card acceptable, or does this one surface read
   the wire live?

## Files

- `recon.mjs` — field-shape and volume probe over the raw window.
- `pull-window.mjs` — the pipeline trace. Writes `window.json` (8.8 MB, not committed).
- `build-report.mjs` — renders `window.json` into `report.html`.
- `report.html` — the study page. Regenerate with the two commands in its footer.
