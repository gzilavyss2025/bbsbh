# World Series fixtures

Real statsapi responses for the World Series callouts (`.scratch/world-series-callouts/`).
Later test rows read these files. Rebuild them with:

    node test/fixtures/world-series/capture.mjs

All files were captured on **2026-10-16** from `https://statsapi.mlb.com`.

## Play-by-play (`{gamePk}-plays.json`)

Each file is `GET /api/v1/game/{pk}/playByPlay`, pruned with the `fields` parameter to the
keys the classifier reads. The script checked that the pruned file keeps every play of
the full feed (same `atBatIndex` list). Each file is under 120 KB. The last play holds the
final score.

| File | Game | Holds | Serves |
| --- | --- | --- | --- |
| `67237-plays.json` | 1907 G1, Tigers at Cubs | Tied 3-3 in 12 innings. | Trap 2: a tie. Not a win for either club. |
| `67266-plays.json` | 1912 G2, Giants at Red Sox | Tied 6-6 in 11 innings. | Trap 2: a tie. The check that the last play has equal scores. |
| `67272-plays.json` | 1912 G8, Giants at Red Sox | The Game 8 that the 1912 Series needed after the tie. | Trap 4: `n` counts the tie (Game 8). O13: winner-take-all extra-inning count. |
| `67524-plays.json` | 1956 G5, Dodgers at Yankees | A 2-0 home win (a shutout). Not a winner-take-all game. | `shutout`. A non-winner-take-all control. |
| `67553-plays.json` | 1960 G7, Yankees at Pirates | Winner-take-all. Home club won 10-9 in the 9th. | `wtaTrailing9` (O1). Home club in Game 7 (O2). |
| `67697-plays.json` | 1975 G7, Reds at Red Sox | Winner-take-all. Research (O4) names Gullett and Lee as pitchers with a hit. | `pitcherHit` (O4: 1975). The hit rows are not checked here. |
| `67878-plays.json` | 1986 G6, Red Sox at Mets | A 10-inning game, not winner-take-all. | `extraInnings` with `innings` 10. A non-winner-take-all control. |
| `67961-plays.json` | 1991 G7, Braves at Twins | Winner-take-all. 1-0 home win in 10 innings. | `wtaTrailing9`, `extraInnings` in a winner-take-all game, `shutout` with the winner's runs as `value`. |
| `563409-plays.json` | 2018 G3, Red Sox at Dodgers | 18 innings. | O5: longest game, 18 innings (with 2025). `extraInnings` with `innings` 18. |
| `775300-plays.json` | 2024 G1, Yankees at Dodgers | Walk-off grand slam (the one case the O8 scan found, 2024-10-25). | O8. `grandSlam`, `walkOffHr`, `walkOffGrandSlam`. |
| `813022-plays.json` | 2025 G5, Blue Jays at Dodgers | Two home runs to open the game. | O10: `openingHrPair`, 2025-10-29. |
| `813024-plays.json` | 2025 G7, Dodgers at Blue Jays | Winner-take-all. Road club won in 11 innings. Research (O4) names Ohtani's hit. | O3: road club. `pitcherHit` (O4: 2025). O13 check. |
| `813027-plays.json` | 2025 G1, Dodgers at Blue Jays | Research (O12) names a pinch-hit grand slam by Barger. | O12: pinch-hit grand slam count (check the count is 1). |
| `813032-plays.json` | 2025 G3, Blue Jays at Dodgers | 18 innings, the largest play count in the set. | O5: 18 innings (with 2018). O7: Ohtani reached base 9 times. `reachedBase`. |
| `67724-plays.json` | 1977 G6, Dodgers at Yankees | Three home runs by one batter. | `multiHrGame` (3). |
| `775296-plays.json` | 2024 G5, Dodgers at Yankees | The Dodgers won 7-6 after trailing 5-0. | `bigComeback` (value 5). |
| `67316-plays.json` | 1920 G5, Dodgers at Indians | The one World Series triple play in the data. | `triplePlay`. |

### Notes on the play files

- **813031 is not a World Series game.** The first plan listed it as 2025 G1. It is a
  regular-season NLCS game (game type `L`, Brewers at Dodgers, 2025-10-17). The 2025 Game 1
  is `813027`, which is what the script captures.
- **67266 is not in the first list.** It is added for trap 2, because the check needs a
  1912 tied game and 1912 G8 (`67272`) is not one.
- **Gap, not captured.** O4 counts a 1986 pitcher hit in Game 7 (Orosco). That is
  `67879`, which is not in the list. The 1967 and 1973 pitcher hits (also in O4) are not
  captured either. Add them if the O4 test needs them.

## Schedules (`schedule-{year}.json`)

Each file is `GET /api/v1/schedule?sportId=1&season={year}&gameType=W&hydrate=linescore,team`,
unpruned.

| File | Holds | Serves |
| --- | --- | --- |
| `schedule-1912.json` | Eight games of the 1912 Series. Game 2 (`67266`) is a tie. | Trap 2 (a tie) and trap 4 (`n` counts the tie, so Game 8 has `n` 8). |
| `schedule-2006.json` | Six rows. Pk `57780` has no `seriesGameNumber`: its 10-25 row is `Postponed` with no `n`, and its 10-27 row is Game 5 with `n` 5. | Trap 1 (one `gamePk`, two rows) and trap 4 (a row with no `seriesGameNumber`). |
| `schedule-2022.json` | Seven rows. Pk `715722` (Game 3) appears twice: `2022-10-31` (Postponed, no score) and `2022-11-01` (Final, `n` 3). | Trap 1: key by `gamePk` and keep the played date (`2022-11-01`). |
