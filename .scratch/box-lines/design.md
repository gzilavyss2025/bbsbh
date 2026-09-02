# Box Lines — data design (Phase 1, 2026-09-02)

Working notes for the game-by-game split drilldown. The canvas holds the
visual half; this file holds the data half. Phase 2 turns the decisions here
into ADR-0069, `src/api/boxlines/`, `src/components/boxlines/` and a
`node:test` that fails without the cutoff gate.

## The name

**Box Lines.** Each row is the player's box-score line for one game, and each
row links to that game's box score. Prompt usage: "make the box lines open
from X, showing Y." Alternatives considered: *Stubs* (ties to the ticket-stub
game cards in `TeamGames.jsx`, but "stub" reads as a code stub in a prompt)
and *Receipts* ("receipt" already names My Tally's sync receipt in
`ProfilePage`). No collision for `boxlines` in `src/`, `e2e/`, `test/`,
`docs/` (grepped).

## Sources, verified live on 2026-09-02

Game log, one call per season the player has played:

    /api/v1/people/{id}/stats?stats=gameLog&group={pitching|hitting}&season={yr}&sportId=1

Each split carries `date`, `gameType`, `isHome`, `isWin`, `opponent{id,name}`,
`team{id,name}` (the club he was on that season), `game{gamePk,gameNumber,dayNight}`
and the full `stat` object. Checked on personId 656849 (Peterson) seasons
2020–2026, 158 splits total; 7 regular-season games vs team 158.

Facts that change the design, each verified against the live API:

| Fact | Evidence |
| --- | --- |
| The game log carries **no final score** and **no venue**. | Split dump above. |
| `fields=` trims a pitcher's season to **7 KB** (from 36 KB) and a hitter's to **25 KB** (from 96 KB). | 656849/2024, 592885/2024. |
| `endDate=` on the game log is honoured and **inclusive**. | `endDate=2024-09-29` returns the 9/29 game; `2024-09-28` does not. |
| `opposingTeamId=` is **ignored** on the game log. | Same 21 rows with and without it. |
| `/api/v1/schedule?gamePks=a,b,c` takes a comma list: 60 gamePks in one call, **22 KB** with `fields=`; returns `teams.*.score`, `status.abstractGameState`, `venue{id,name}`, `dayNight`, `officialDate`, `gameNumber`, and with `hydrate=team`, each club's `abbreviation`. | Probe 3, probe with `hydrate=team`. |
| The game log's `game.dayNight` is **unreliable**: it said `day` for gamePks 717597 (2023-06-27) and 823770 (2026-06-27); the schedule says `night` for both. | Probe 2 vs schedule. |
| `stats=playLog` per season carries `pitchHand`, `batSide` and the `pitcher` per plate appearance. | 669004/2025. |

Peterson vs Milwaukee, all seven rows, all Final, all `gameType R`
(score is his club first; club is his club that day):

| Season | Date | Where | Club | Line | Score | gamePk |
| --- | --- | --- | --- | --- | --- | --- |
| 2026 | 6/27 | @ MIL | CHC | GS · 5.2 IP, 5 H, 2 ER, 2 K, 0 BB | W 8–2 | 823770 |
| 2025 | 7/3 | vs MIL | NYM | GS · 6.2 IP, 5 H, 1 ER, 4 K, 3 BB | W 3–2 | 777257 |
| 2024 | 9/29 | @ MIL | NYM | GS · 7.0 IP, 1 H, 0 ER, 8 K, 3 BB | W 5–0 | 745932 |
| 2023 | 6/27 | vs MIL | NYM | GS · 6.0 IP, 5 H, 0 ER, 5 K, 3 BB | W 7–2 | 717597 |
| 2023 | 4/5 | @ MIL | NYM | GS · 4.0 IP, 5 H, 5 ER, 5 K, 5 BB | L 6–7 | 718698 |
| 2022 | 9/21 | @ MIL | NYM | 0.2 IP, 0 H, 1 ER, 1 K, 1 BB | L 0–6 | 661158 |
| 2022 | 6/15 | vs MIL | NYM | GS · 4.0 IP, 6 H, 4 ER, 3 K, 2 BB | L 2–10 | 662480 |

Sums match the nightly file's line exactly (7 G, 34.0 IP, 3.44 ERA, 28 K,
17 BB). The story the user heard is in the last four rows: 24.2 IP, 3 ER.
Tonight (2026-09-02, gamePk 824634, MIL @ CHC) he is the Cubs' probable
starter, so `/09022026/milchc/lineup1` is the real v1 surface.

One wording quirk the rows expose: `careerVsOpponentLine` prints `car.g` as
"GS", but the generator sums `gamesPlayed`. Peterson's 7 includes one relief
outing. Phase 2 changes the label to "G" (one character in `TeamInfo.jsx`).

## Fetch strategy: live on a tap

**Chosen: option 1, fetch live when the sheet opens.** Numbers behind it:

- The nightly file today: 837 players, 20,851 player-opponent pairs,
  **264,770 game rows** summed from `car.g` (median player 168, p90 825, max
  2,313). At ~95 bytes a compact row that is ~25 MB before scores, nine times
  the 3.5 MB dataset. Sharded by club: ~850 KB a shard, so a lineup page would
  read 1.7 MB for a tap that may never come. The generator would also need
  the score, which the game log lacks: ~750 club-season schedule calls a run.
  And the cron would rewrite hundreds of shards into git nightly.
- Live: `yearByYear` (~1 KB, seasons only) → N trimmed game logs in parallel
  (7 KB / 25 KB each) → one schedule call for every matching gamePk. A
  twelve-season veteran is 14 requests and under 200 KB, on a tap, memoized
  per `(personId, group, cutoff)` for the session.
- Not a parallel data path: the same endpoint the generator sweeps, one tier
  down. The file keeps the summary line; the tap fetches the rows. The
  umpires and rookies shards are the precedent for "fetch the detail on
  demand".

## The spoiler gate

Class: **`cutoff-gated`**, registered in `spoiler-manifest.json`, same footing
as `person/gameLog.js` and `vsTeamSplits.js`. No `importers` list (only the
reveal classes carry one).

- Rows leave `src/api/boxlines/` already trimmed: `date < cutoff` and schedule
  status `Final`. The component holds no date logic.
- The cutoff season's game log is requested with `endDate = cutoff − 1 day`,
  so the game being scored (and a same-day game 1) is never fetched. Past
  seasons are immutable and fetched whole.
- With no cutoff (player page, no `?d=`), a game in progress today can appear
  in the log; the schedule join drops any non-Final game. Permitted there: an
  open surface (ADR-0034).
- The lineup page passes the scored game's `officialDate`; a `?d=` page passes
  that; neither means no cutoff.
- The headline is the line already on the page (a career aggregate from the
  nightly file). It may say a seventh meeting happened; it never says how it
  went. Same as today.

Test (written first, watched red): a captured game log with one game dated
on the cutoff, one after, one in progress → none is a row; the requested
`endDate` for the cutoff season is the day before; no row without a Final
schedule record.

## Row model

    { season, date, gamePk, gameNumber, home, opponentId, opponentAbbr,
      teamId, teamAbbr, started, line, won, runs, oppRuns,
      venueId, venueName, dayNight, boxScorePath }

`line` is `person/gameLog.js`'s `pitcherLine`/`hitterLine` (reused, not
copied). `boxScorePath` is `gamePath(officialDate, awayAbbr, homeAbbr,
'boxscore', gameNumber)` from the schedule join's `hydrate=team`
abbreviations.

## Size guards

- `src/api/` is at 107/107 → new modules go in a new subdirectory
  `src/api/boxlines/` (`vsClub.js` + `rows.js`), no raise.
- `src/hooks/` is at 25/25 → no new hook; the sheet uses `useAsync`.
- `src/components/ui/` is at 12 → `src/components/boxlines/` (`BoxLinesSheet.jsx`,
  `BoxLineRow.jsx`).
- `src/styles/` is at 108/108 → `src/styles/boxlines/boxlines.css`,
  component-imported like `48d-stamp-detail.css`, so no raise.
- `TeamInfo.jsx` 1375/1400 → the door is a button wrapping the existing line
  plus one state + one mount: under ten lines.

## The framework (facets beyond v1)

See the Framework artboard. Venue and day/night come from the schedule join
(already fetched for the score). Handedness and batter-vs-pitcher rows need
`stats=playLog` per season. Pinch-hit appearances need a boxscore per game
row, so they belong in the nightly precompute or behind a ~20-row cap.

`SplitsVsTeam` should open the same sheet (a second door on the stat grid)
in a follow-up PR: the component takes the same query; the cutoff is the
page's `?d=` or none.
