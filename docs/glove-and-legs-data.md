# Glove and legs: club-level data (#2316)

Where each of the six measures on the World Series scouting report's "Glove and legs" card
comes from. Every URL and column below was run against a real response on **2026-10-19**
(2026 regular season over; no host was blocked). The generator is
`scripts/gen-club-defense-running.mjs`; it writes `public/data/club-defense-running.json`.
Reader: `src/api/clubDefenseRunning.js`. The card reads it: `src/components/worldseries/cards/GloveLegs.jsx`.

`[DECISION: the card gets one file with six measures per club, keyed by MLB team id; a measure with no source is null.]`

## Sources

Base for Savant: `https://baseballsavant.mlb.com/leaderboard`. All Savant calls add `&csv=true`.

| Measure (file key) | Source, URL pattern and parameters | Column used | Grain | Traded player |
| --- | --- | --- | --- | --- |
| Outs above average (`oaa`) | `/outs_above_average?type=Fielding_Team&startYear=Y&endYear=Y&split=no&team=&range=year&min=0&pos=&roles=&viz=hide` | `outs_above_average`, club in `team_id` | club, 30 rows | Plays count for the club that made them. |
| Catcher framing runs (`framingRuns`) | `/catcher-framing?type=catcher&seasonStart=Y&seasonEnd=Y&min=1&gameType=Regular&team=ID`, once per club | `rv_tot`, summed per club | catcher, filtered by club | `team=ID` returns that club's share. Pitches add up to the unfiltered board (303,289 = 303,289). |
| Sprint speed, ft/s (`sprintSpeed`) | `/sprint_speed?year=Y&position=&team=&min=0` | `sprint_speed`, weight `competitive_runs`, club in `team_id` | player, 611 rows | One row per player. The club is the latest one: García Jr. (WSH, then NYY) shows NYY. |
| Stolen bases (`stolenBases`) | statsapi `/api/v1/teams/stats?stats=season&group=hitting&season=Y&gameType=R&sportIds=1` | `stat.stolenBases` | club, 30 rows | Not applicable (club total). |
| Stolen-base success, % (`stolenBaseSuccess`) | same call | `stolenBases / (stolenBases + caughtStealing)` | club | Not applicable. |
| Extra bases taken, % (`extraBasesTaken`) | `/baserunning?year=Y&type=batter&n=1&game_type=Regular&team=ID`, once per club | `n_safe / n_opp_xb`, both summed per club | batter, filtered by club | `team=ID` returns that club's share. Per-club sums equal the unfiltered board (35,982 and 12,528). |

How a figure is built: `oaa` is read as is. `framingRuns` is a sum rounded to 0.1. `sprintSpeed` is a mean weighted
by competitive runs, rounded to 0.1. Success and extra bases taken are percents rounded to 0.1. The roll-ups are pure
functions in `scripts/lib/club/defense-running.mjs`.

## Regular season only

- statsapi: `gameType=R`.
- Baserunning: `game_type=Regular` is the default and the page's selected option. `game_type=All`
  (the page's all-game-types option) gave 36,373 opportunities against 35,982. So the default has no postseason.
- Framing: `gameType=Regular` gives the same rows as no parameter (Contreras 9,064 pitches). An unknown value
  (`R`, `P`, `Postseason`) gave 9,648, which is more. So the default has no postseason.
- OAA and sprint speed: the pages have no game-type control and the CSV did not change with one. Savant
  describes both as season figures; **inferred, not proven, that they hold no postseason games.**

## Traps found

- The baserunning floor is `n`, not `min`. `min=...` is ignored; the default floor hides players
  (347 rows against 699 at `n=1`). Without `n=1` the per-club rows do not add up to the combined board.
- Framing `type=team` returns the catcher rows again, with blank `id` and `name`. There is no team board; use `team=ID`.
- `team=` on `/sprint_speed` is ignored. The board already has `team_id`.
- Baserunning with no `team=` labels a traded player's row `team_name = "MLB"` (67 rows at `n=1`). Do not roll up the unfiltered board.
- Savant sends a BOM and string cells. `csvObjects` strips the BOM; `num()` turns a blank cell into null.
- `extraBasesTaken` is `n_safe / n_opp_xb`: `rate_safe` on the board equals that (52 / 146 = 0.356). That `n_safe` is
  Savant's "extra bases taken" count is **inferred** from the column name and that arithmetic.
- `rv_tot` is read as catcher framing runs from its name and the board. It is not the `framing_runs` column on
  `fielding-run-value`, which is a different model. **Inferred.**

## Confirmed live and not confirmed

Confirmed against a real response (URL, columns, grain): all six measures, and the 30 clubs.
Not confirmed: that OAA and sprint speed hold no postseason games (see above), and Savant's own meaning
of `rv_tot` and `n_safe`. Freshness: the boards move when games are played. The regular season ended before the
check, so these are final 2026 figures; the nightly cron keeps them current in season.

## For the card

- Every club has all six measures today. A measure is `null` when its source fails that night, for all clubs, so the card
  must draw a gap, not 0.
- `oaa` and `framingRuns` are signed (negative is worse). `sprintSpeed` is ft/s. The last three are plain numbers, the
  percents without a `%` sign.
- A club with no catcher rows has `framingRuns: null`.
- Neither Savant nor statsapi gives a league rank here. Rank the 30 clubs in the loader's caller if the card needs one.
