# OVR research, part A: sources (issue #1685)

Probed live on 2026-10-07 from the cloud container. Every host answered; none was
blocked. Scripts that produced each number are in this folder. "Inference" marks a
conclusion I drew and did not read in a source. Nothing here edits `docs/ovr-rating.md`.

## Summary

| # | Question | Answer | Verdict |
| --- | --- | --- | --- |
| 1 | Do Pipeline pages or API carry 20-80 tool grades? | No. Two prospect pages and the draft API carry none. The only trace is a UI label. | No grades to fetch. Terms also forbid scripts. |
| 2 | Can `fld` feed a Fielding bar, or use OAA? | `fld` is MLB's own fielding runs. It works. OAA percentile is already in a CSV we fetch. | Use OAA percentile (one line in the generator); `fld` is the fallback. |
| 3 | Where do two prior seasons come from? | Savant `percentile-rankings?year=`. `war-history/` holds WAR only. | Sharded prior-season file, about 3 KB per player. |
| 4 | Which MiLB stat fields are real? | `seasonAdvanced` returns K%, BB%, ISO, BABIP, whiff and batted-ball counts at every level. | Rough bars are possible from live fields. |

## 1. Prospect grades: none found

**Where I looked.**

- `https://www.mlb.com/prospects/stats/top-prospects` (the page `scripts/fetch-top-prospects.mjs` reads). Its embedded `var data` array has 96 rows with these keys only: `name, href, playerId, age, position, rank, team, teamId, slug, battingStats, avg, sportAbbrev`. No grade key.
- Prospect profile pages for rank 1 and rank 2: `https://www.mlb.com/prospects/jesus-made-815908` and `.../franklin-arias-808265` (both redirect to `/milb/prospects/{slug}`). I rendered each in Chromium (`probe-pipeline-page.mjs`). No network response carried a grade, and the visible text has no Hit/Power/Run/Arm/Field value.
- The only match is a UI copy string in the page, `prospects_scouting_grades_header` = "Scouting Grades/Report (20-80 grading scale)". **Inference:** Pipeline has a template that shows grades for some players or at some times of year. I did not find a player it fills for. I checked 2 players only, so "none exist anywhere" is not proven.
- `https://statsapi.mlb.com/api/v1/draft/2025` and `/draft/prospects/2025`: `scoutingReport` is a video URL, and `blurb` is prose (198 of 615 picks). A pattern search for "Hit: 55" style grades found 0 matches. The prose says things like "easily plus changeup that some scouts hang a 70 grade on", which is not parseable per tool.
- `statsapi.mlb.com/api/v1/people/815908?hydrate=scoutingReport,prospect`, `/prospects/815908`, `/people/815908/scouting`: no grade data (the hydrations return no extra field, the other two return 404).

**Build-time fetch.** There is nothing to fetch, so the question is moot for MLB Pipeline.

**CORS.** `www.mlb.com` sends no CORS header (stated in `scripts/fetch-top-prospects.mjs`, header comment), so only a build-time fetch could work. `statsapi.mlb.com` sends `access-control-allow-origin: *`.

**Terms.**

- MLB Terms of Use, `https://www.mlb.com/official-information/terms-of-use`, prohibited-use item (xi): "use automated scripts to collect information from or otherwise interact with the MLB Digital Properties".
- `http://gdx.mlb.com/components/copyright.txt`, the notice statsapi responses link to: "Only individual, non-commercial, non-bulk use of the Materials is permitted".
- `https://www.mlb.com/robots.txt` does not disallow `/prospects`; it disallows `/api/`.
- **Inference:** the existing nightly scrape of the Top 100 page already sits under clause (xi). That is a decision for Gary, and I changed nothing. Adding a per-player scrape of 100 profile pages would widen it.

**Not checked:** FanGraphs "The Board" and other third-party grade sources. Not an MLB Pipeline source, and their terms need a separate read.

## 2. Fielding

### What `fld` measures

- `scripts/gen-war.mjs` writes `fld[personId] = split.stat.fielding` from `statsapi.mlb.com/api/v1/stats?stats=sabermetrics&group=hitting&season=…&playerPool=ALL` (the header comment says it is MLB Advanced Media's own sabermetrics calculation). Rounded to 0.1.
- The unit is **runs above average from fielding, season total**, a counting stat. Sample row (season 2026, `personId` 691718, Pete Crow-Armstrong): `fielding: 21.09`, `positional: 1.92`, `war: 10.62`.
- The positional adjustment is a separate field (`positional`), so `fld` does not carry the position penalty.
- Distribution in `public/data/war.json` (751 players): min -13.8, p10 -3.8, median 0, p90 4.0, max 21.1.
- By listed position (`probe` of the same response): P and TWP are exactly 0; DH mean -1.0; catchers range -4.1 to 6.8. **Inference:** catcher `fld` leaves out most framing value, because the range is narrow next to OAA's infield range. I did not verify this against a framing source.
- Caveat: it is a **counting stat**. A part-time player's near-zero value means "few chances", not "average glove". To make a bar, rank it against players with a playing-time floor, or scale it per innings. The file has no innings field.

### Can it feed a Fielding bar?

Yes, with two chores: apply a floor, and convert runs to a 0-100 percentile (ranking inside the app, because it is not pre-ranked like the Savant file). Nothing else is needed; `war.json` is already read by the player page.

### Savant outs above average

- Raw board: `https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&year=2026&min=1&csv=true`. HTTP 200, `access-control-allow-origin: *`, 563 rows. Columns include `player_id, primary_pos_formatted, fielding_runs_prevented, outs_above_average`, the direction splits, and success rates. Positions present: SS, 2B, 3B, 1B, LF, CF, RF. **No catchers, DH or pitchers.**
- Agreement: for the 563 players in both sources, `r(fld, OAA) = 0.931` and `r(fld, fielding_runs_prevented) = 0.928` (`probe-fielding.mjs`). 188 players in `fld` have no OAA row (catchers, DH, pitchers, low sample).
- **The shortcut:** the percentile board `gen-savant-percentiles.mjs` already fetches (`/leaderboard/percentile-rankings?type=batter&year=2026&csv=true`) already has two unused columns: `oaa` and `arm_strength`. Live coverage: `oaa` 254 of 612 hitter rows, `arm_strength` 388 (`probe-savant-oaa-percentile.mjs`). `oaa` percentile 1 maps to raw -17, 63 to 0, 100 to +26.

### What `gen-savant-percentiles.mjs` needs

1. In `METRICS.bat` (about line 30), add `oaa: 'oaa'` and, if wanted for an Arm bar, `arm_strength: 'arm'`. The header check at line 108 already throws if the column vanishes. No new request.
2. Optional raw value for the percentile strip: a third fetch of the `outs_above_average` board above, keyed by `player_id`, same fail-soft pattern as `fetchRawRates`. The `RAW_METRICS` ids do not apply here; `outs_above_average` is its own board. Not needed for the bar.
3. File size: two more keys per hitter in `bat`. The `bat` map is 83 KB today for 612 hitters × 9 keys, so roughly +9 KB (**inference** from key count).
4. Reader: `src/api/savantPercentiles.js` flattens `bat`; check its metric lists and `percentileRows()` so the strip does not show a new row by accident.

**Verdict:** use the OAA percentile as the Fielding bar for the 254 hitters who have it. For catchers and thin-sample players, `fld` is the fallback, or show no bar (the spec already says a missing bucket shows no bar). Mixing the two in one bar needs a decision.

## 3. Prior seasons

**Option A: Savant percentile board by year.** `…/percentile-rankings?type=batter|pitcher&year=2025|2024&csv=true` returns data for both years (2025: 617 hitters, 711 pitchers; 2024: 606 and 696). I built each year with the same `METRICS` map as the generator (`probe-prior-seasons.mjs`):

| Layout | Raw JSON | Gzip |
| --- | --- | --- |
| One flat file per season | 143 KB (2025), 140 KB (2024) | 17 KB each |
| Both seasons, one flat file | 296 KB | 32 KB |
| Both seasons, 100 shards on `personId % 100` | avg 3.0 KB, max 5.2 KB per shard | max 0.8 KB |

Today's `public/data/savant-percentiles.json` is 299 KB (51 KB gzip), of which `bat` + `pit` are 145 KB.

**Option B: `public/data/war-history/{NN}.json`.** 100 shards, 19 KB for shard 00, 2.0 MB for all. It holds **WAR per player per season only** (`bat`/`pit` maps keyed by `personId`, then season). It has **no Statcast percentiles**. It adds 0 KB to a player page, which already fetches one shard. It can blend the WAR side, not the percentile buckets.

**Against the sizing rule** (`src/api/CLAUDE.md`, "a static file is sized against the ONE surface that opens it"): the surface is one player page, which needs one player. A flat 296 KB file would double what the page parses to print about a dozen numbers. The shard layout costs about 3 KB, which is the `war-history` / `rookies.js` pattern. **Inference:** a hand-run generator fits, like `gen-war-history.mjs`, because a finished season's percentiles do not change. I did not check whether Savant revises past-year ranks.

**Verdict:** Option A as shards, keyed by `personId % 100`, two seasons per shard, hand-run once a year. Option B only if the blend is WAR-based.

## 4. Minor-league fields (live responses)

Calls: `GET https://statsapi.mlb.com/api/v1/people/{id}/stats?stats={type}&group={hitting|pitching}&season=2026&sportId={11|12|13|14|16}`. `sportId` takes **one** value; a list returns "Invalid Request". Scripts: `probe-milb-fields.mjs`, `probe-milb-coverage.mjs`.

**Hitter: Jesús Made, personId 815908, AA Biloxi, 558 PA.**

- `stats=season`: `plateAppearances, atBats, hits, doubles, triples, homeRuns, strikeOuts, baseOnBalls, hitByPitch, avg, obp, slg, ops, babip, stolenBases, caughtStealing, groundOuts, airOuts, groundIntoDoublePlay, totalBases, rbi, numberOfPitches, atBatsPerHomeRun`.
- `stats=seasonAdvanced` adds the rates the spec wants, **as ready-made strings**: `strikeoutsPerPlateAppearance` (.143), `walksPerPlateAppearance` (.102), `iso` (.159), `homeRunsPerPlateAppearance`, `walksPerStrikeout`, `pitchesPerPlateAppearance`, plus counts `totalSwings` 919, `swingAndMisses` 180, `ballsInPlay` 419, and batted-ball buckets `groundHits, flyHits, lineHits, popHits, groundOuts, flyOuts, lineOuts, popOuts`.
- Not there: exit velocity, launch angle, sprint speed, xwOBA. `stats=expectedStatistics` returns placeholders (`avg ".000"`, `wobaCon ".---"`). `stats=sabermetrics` returns no split. `sprayChart` returns all zeros.

**Pitcher: Ryan Sloan, personId 815549, AA Arkansas, 414 batters faced.**

- `stats=season`: `inningsPitched, era, whip, strikeOuts, baseOnBalls, hits, homeRuns, battersFaced, strikes, strikePercentage, strikeoutsPer9Inn, walksPer9Inn, hitsPer9Inn, homeRunsPer9, strikeoutWalkRatio, groundOutsToAirouts, gamesStarted`.
- `stats=seasonAdvanced` adds: `strikeoutsPerPlateAppearance` (.309, the K%), `walksPerPlateAppearance` (.039, the BB%), `strikeoutsMinusWalksPercentage` (.271), `whiffPercentage` (.309), `homeRunsPerPlateAppearance`, `babip`, `flyBallPercentage`, `qualityStarts`, `totalSwings`, `swingAndMisses`, `ballsInPlay`, and the same hit/out buckets.
- Not there: velocity, spin, pitch mix, xERA, and FIP. (FIP can be computed from `homeRuns`, `baseOnBalls`, `hitByPitch`, `strikeOuts` and `inningsPitched`; **inference**, since I did not test the math.)

**Coverage across levels** (40 players each with at least 100 PA or 100 batters faced, taken off each level's own 2026 leaderboard): `seasonAdvanced` returned every rate field above for **40 of 40 players at AAA, AA, A+, A and Rk**, for hitters and pitchers. Sample personIds: AAA 649966, AA 813841, A+ 691942, A 814505, Rk 825484 (hitters); AAA 678020, AA 687798, A+ 694537, A 691017, Rk 842077 (pitchers). The 0/40 rows for `ops`, `stolenBases`, `era`, `whip` and `airOuts` in the coverage script are my mistake in the field list: those fields live in `stats=season`, not `seasonAdvanced`.

**Gaps to handle:** past 100 PA is a sample choice, not a feed limit. Fewer-than-100-PA players still return a row, but the rate is noisy. Rates arrive as strings with a leading dot (`".143"`), so parse them with `Number()`. A rate field can read `".---"` or be absent for a zero denominator (seen in `wobaCon`); treat both as null per the repo's MiLB rule.

**Verdict:** rough minor-league bars can be built from live fields: Contact (K%, whiff), Discipline (BB%), Power (ISO), Speed (stolen bases per PA, from `season`). Power and Speed are thin, and the Fielding and Arm buckets get nothing. A pitcher gets K%, BB%, K-BB%, whiff, HR rate.

## Files

- `probe-pipeline-page.mjs` — Q1, renders a Pipeline prospect page and looks for grade responses.
- `probe-fielding.mjs`, `probe-savant-oaa-percentile.mjs` — Q2.
- `probe-prior-seasons.mjs` — Q3.
- `probe-milb-fields.mjs`, `probe-milb-coverage.mjs` — Q4.

Run any of them with `node .scratch/ovr/<file>` (arguments are in each header comment).
