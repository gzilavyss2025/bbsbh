# Contact replay: facts measured before the build

Measured 2026-10-19 in a planning session, on completed games only. The run
plan's prompts use these as settled facts. If one is wrong when you check it,
stop and report; do not work around it.

## The fixture game: gamePk 849810

MIL @ LAD, 2026-10-15 (NLCS), 9 innings, sportId 1, tracked park.
Route: `/10152026/millad/{half}?nointro` (`src/lib/route.js` line 97).

| At-bat (`ab_number`) | Half | What | Batter (bats) |
| --- | --- | --- | --- |
| 1 | `top1` | Ground ball, 104.9 mph, -5°, first pitch | Chourio (R) |
| 2 | `top1` | Strikeout: a foul (pitch 6) and a whiff (pitch 7) | Turang (L) |
| 16 | `bottom2` | Home run, 113.1 mph, 34°, 428 ft, xBA .960, 30 parks | Ohtani (L) |
| 37 | `top5` | Lineout, barrel, xBA .690 (a hard-luck out) | Chourio (R) |
| 45 | `top6` | Home run, barrel, 20 parks | Mitchell (L) |
| 62 | `top8` | Lineout, xBA .790 (a hard-luck out) | Mitchell (L) |

`ab_number` = `atBatIndex + 1` (checked on at-bat 16). Savant's `play_id` equals
the MLB feed's `playId` (checked on at-bat 16).

**To open a half without tapping the seal,** seed localStorage before the page
loads: `bbsbh:reveal:849810` = `"17"` (the half-index: top 1 = 0, bottom 9 = 17),
the way `e2e/scorecard.spec.js` seeds `REVEAL_KEY`.

## Savant `/gf?game_pk=849810`

- 296 pitch rows in `team_home[]` + `team_away[]`.
- `play_id`: on every row. `batSpeed`: a number, on 143 rows (the swings).
- `xba`: a STRING such as `".820"`, on 48 rows (balls in play). Parse it with
  `Number()`.
- `is_barrel`: an int, 0 or 1, on the same 48 rows.
- `homeRunBallparks` is NOT a top-level row field. It is at
  `row.contextMetrics.homeRunBallparks`, an int. In this game it was 0 (45 rows),
  20 (1) or 30 (2). `contextMetrics` held no other key.
- The body also holds `scoreboard`, `boxscore`, and on each row `des`,
  `events` and `result`. These are what the parser must drop.

## Savant Statcast CSV

`statcast_search/csv?all=true&type=details&player_type=batter&hfGT=R%7CF%7CD%7CL%7CW%7C&game_date_gt=2026-10-15&game_date_lt=2026-10-15&game_pk=849810`
returns 296 rows, all with `game_pk` 849810: the `game_pk` filter works.
Without it, the same dates return both games of that day (533 rows).

On those 296 rows: `attack_angle`, `attack_direction`,
`intercept_ball_minus_batter_pos_y_inches` and `bat_speed` on 135;
`estimated_ba_using_speedangle` on 47; `bat_score` and `post_bat_score` on all.
The CSV fill time after a final out is NOT measured (issue #2349).

## Repo limits the build must respect

- `src/api/` is ratchet-locked at 115 files (`scripts/check-dir-size.mjs`): a new
  top-level file there FAILS lint. Both Savant modules go in a new folder,
  `src/api/savant/`.
- `src/api/playbyplay/` holds 11 files; `src/lib/ballpark/` 11 (12 after
  `flightModel.js`, the cap); `src/lib/pitcherCard/` 6;
  `src/components/playbyplay/pitcherCard/` 8. The cap is 12.
- `PitchScene.jsx` is 254 lines; `check-file-size` caps files at 600.
