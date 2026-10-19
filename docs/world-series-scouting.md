# World Series scouting report (#2316)

The scouting report is a navy band of cards on the World Series home page. It sizes up
one opponent, compares the two clubs, and shows their past regular-season meetings. It is
an open surface (ADR-0034): no score is read, and every read ends the day before the slate
date (ADR-0087, ADR-0088). The innings viewer stays sealed.

The code is the source of truth for the order: the `CARDS` list in
`src/lib/postseason/worldseries/scouting/scouting.js`. This page records the intent. The
design spec is `.scratch/ws-scouting/handoff.md`.

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
- The thresholds in Pitch by pitch and Matchup edges are placeholders. Gary tunes them.
- `worldSeriesMode` returns null until the ALCS ends, so check the page with an untracked harness until then.

Per-module notes: `docs/api/postseason.md`, "World Series scouting reads". The component
notes are in `src/components/worldseries/CLAUDE.md`.
