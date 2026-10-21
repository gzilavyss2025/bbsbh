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

`cards/scouting/ComparisonLedger.jsx` draws both cards through `PairLedger`, which uses the
existing Card, Table, Key and layout parts. The home-only `NineKeys.jsx` leaves the series pages' `SeriesNineKeys`
view unchanged. `styles/system/ledger/pair-ledger.css` holds the shared presentation;
`glove.css` only sets the group and measure heights. The failed-key explanation remains
available by tap or keyboard, and Full report still opens `/nine-keys`.

The shared layout is now the `PairLedger` primitive (`ui/table/PairLedger.jsx`);
`ComparisonLedger.jsx` only turns two club ids into its sides. The standard, its edge
cases and the audit of other two-team cards are in `docs/design-system-pair-ledger.md`
(issue [#2455](https://github.com/gzilavyss2025/bbsbh/issues/2455)).

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
| Park fit | 6 | 6 | `spray` store, `teams.json` home venues, `lib/ballpark` walls |
| Film room | 7 | 5 | `fetchMeetings` |

## Rules

- Glove and legs shows on both day types when at least 4 of its 6 measures are real for both clubs.
- Park fit draws both clubs' home parks over each other (2026-10-21), on both day types. Each park is the club's `venueId` in `teams.json`; the focus game's own venue wins for the club that hosts it. A control picks Both or one park. Under one park the table adds "Carry past wall": the share of each club's regulars' fly balls, by direction, that travel farther than that park's wall on their own angle. It is an estimate: a ball counts when its distance is more than the wall's distance plus the wall's height on its angle (about a foot of carry for each foot of wall, a 45 degree descent, which is an assumption), and a direction with fewer than `MIN_CARRY` (20) balls shows a dash. The card opens on Both on every day. A park with no layout drops out; with none, the card drops. The earlier rule (Milwaukee only, because the Rays' park was thought to be off file) was wrong: Tropicana Field is venue 12 and has an audited wall.
- Why the wall's height counts in the carry estimate (2026-10-21): on the balls each club hit at its own park, where the real result is known (2026 regular season: the Rays' 308 at Tropicana, the Brewers' 300 at American Family), distance alone agreed with "was it a home run" on 94.5% and 96.3% of balls and read 20.5% and 23.7% against real rates of 14.9% and 20.0%. With the height it agrees on 97.7% and 98.7% and reads 17.2% and 20.0%. The rule has no fitted number, but the check covers two clubs in one season. A robbed home run counts as a carry, so the check slightly understates how well the rule fits.
- Club order on every card follows the Tale of the tape (`sides`).
- Chosen by Gary (2026-10-20, from the threshold report): Pitch by pitch `EDGE_BAND` = .020; Matchup edges hitter rule = 8 PA and 8 AB, then .350 or better or 2+ HR. The AB floor also changes the series primer's `MatchupEdges` card.
- Still placeholders, which Gary tunes: Pitch by pitch `MIN_PA` (10), `MIN_USE` (.05), `MAX_HITTERS` (9); the Matchup edges pitcher rule and caps.
- `worldSeriesMode` returns null until the ALCS ends, so check the page with an untracked harness until then.

Per-module notes: `docs/api/postseason.md`, "World Series scouting reads". The component
notes are in `src/components/worldseries/CLAUDE.md`.
