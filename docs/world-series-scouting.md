# World Series scouting report (#2316)

The scouting report is a navy band of cards on the World Series home page. It sizes up
one opponent, compares the two clubs, and shows their past regular-season meetings. It is
an open surface (ADR-0034): no score is read, and every read ends the day before the slate
date (ADR-0087, ADR-0088). The innings viewer stays sealed.

The code is the source of truth for the order: the `CARDS` list in
`src/lib/postseason/worldseries/scouting/scouting.js`. This page records the intent. The
design spec is `.scratch/ws-scouting/handoff.md`.

## Two-team scouting ledgers

The home page's Nine keys and Glove and legs use Design A, selected on 2026-10-21:
matching internal titles, regular-season labels, club heads, and measure → first club →
second club columns. Figures use mono type; an amber underline marks the better figure.
Nine keys marks a failed rank in clay with an asterisk, without striking through the rank.
Its threshold and verdict come from the data file. Ties and missing figures mark no leader.
Glove and legs keeps the Defense and Running groups and all six measures and their units.

`cards/scouting/ComparisonLedger.jsx` draws both cards with the existing Card, Table,
Key and layout parts. The home-only `NineKeys.jsx` leaves the series pages' `SeriesNineKeys`
view unchanged. `styles/worldseries/comparison.css` holds the shared presentation;
`glove.css` only sets the group and measure heights. The failed-key explanation remains
available by tap or keyboard, and Full report still opens `/nine-keys`.

Issue [#2455](https://github.com/gzilavyss2025/bbsbh/issues/2455) tracks making this the
documented standard for future two-team analysis. This first pair does not close that issue.

## Card order

A card with no data drops, and its jump-bar button drops with it. The jump bar shows no
count badges (Gary, 2026-10-19).

| Card | Off day | Game day | Source |
| --- | --- | --- | --- |
| Nine keys | 1 | not shown | `nine-keys.json` |
| Glove and legs | 2 | 7 | `club-defense-running.json` (`glove-and-legs-data.md`) |
| Matchup edges | 3 | 1 | `career-matchups.json` by gamePk |
| Umpire edge | not shown | 2 (once the crew posts) | `umpires/` |
| Pitch by pitch | 4 | 3 | `hitter-grid`, `pitch-arsenal` |
| Platoon | 5 | 4 | team `statSplits` |
| Park fit | 6 | 6, only at Milwaukee (venue 32) | `spray` store |
| Film room | 7 | 5 | `fetchMeetings` |

## Rules

- Glove and legs shows on both day types when at least 4 of its 6 measures are real for both clubs.
- Park fit always draws Milwaukee's field. The other club's park is not on file, so Games 3 to 5 show it only at Milwaukee.
- Club order on every card follows the Tale of the tape (`sides`).
- Chosen by Gary (2026-10-20, from the threshold report): Pitch by pitch `EDGE_BAND` = .020; Matchup edges hitter rule = 8 PA and 8 AB, then .350 or better or 2+ HR. The AB floor also changes the series primer's `MatchupEdges` card.
- Still placeholders, which Gary tunes: Pitch by pitch `MIN_PA` (10), `MIN_USE` (.05), `MAX_HITTERS` (9); the Matchup edges pitcher rule and caps.
- `worldSeriesMode` returns null until the ALCS ends, so check the page with an untracked harness until then.

Per-module notes: `docs/api/postseason.md`, "World Series scouting reads". The component
notes are in `src/components/worldseries/CLAUDE.md`.
