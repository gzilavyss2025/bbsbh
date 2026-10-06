# Old games: measured data paths

Measured on 2026-10-06 from a cloud session. This file holds numbers only. It has no
design, no ADR and no plan. Prompt 15b does those.

**Base:** `origin/main` at `6a66f68`. **Scope:** MLB Stats API (`statsapi.mlb.com`) and
Retrosheet CSV downloads. Issues #1525 and #1527 are not in scope.

## How the numbers were made

- `scripts/lib/open-data.mjs` and `scripts/lib/retro-bridge.mjs` do not exist on this base.
  Prompts 5, 10 and 13 are not merged. I wrote throwaway scripts in the session scratchpad,
  outside the repo. They are not in this PR.
- Each Retrosheet download went into its own new empty folder under the scratchpad.
  The scripts sit in a different folder. Paths went in as arguments.
- Each number below names the call or file that made it.
- A note marked **(inference)** is my reading and not a measured value.
- Row counts and byte counts are exact unless a line says "estimate".
- The API calls used `fields=` to cut bytes where a line says "fielded". A "fielded" call
  returns only the named fields. An "unfielded" call returns the full response.

## Step 1. Join test (Retrosheet game to API gamePk)

**Sample.** 198 games from `nohitters.zip` (103) and `cycles.zip` (95). Seeded random draw,
spread over six eras.

**Warning about the second file.** `cycles.zip` is not a cycle list.
See Step 2 for the proof. Those 95 games are real Retrosheet games with a 3+ home run
player. They still test the join. They do not test cycles.

**Method.** One call per distinct date:
`GET /api/v1/schedule?sportId=1&date={date}&hydrate=linescore` (196 calls, 8,615,389 B,
average 160 ms per call). A game matched when the date, the home team id, the away team id
and the doubleheader number agreed. The team-code table (Retrosheet code to API team id,
42 codes) is mine **(inference)**. I wrote it from the franchise ids. The scores then served
as a check.

| Result | Count |
| --- | --- |
| Joined by date, teams and number | 175 of 198 (88.4%) |
| Of those, scores agree | 175 of 175 |
| Of those, API state | 175 Final |
| API `gameType` of the joined games | 172 `R`, 2 `W`, 1 `L` |
| Doubleheader games in the sample | 39 (27 joined, 0 ambiguous) |

**By era.**

| Era | Joined |
| --- | --- |
| 1897 to 1919 | 5 of 8 |
| 1920 to 1939 | 25 of 38 |
| 1940 to 1959 | 31 of 38 |
| 1960 to 2025 | 114 of 114 |

**The 23 failures, by kind.**

| Kind | Count | Detail |
| --- | --- | --- |
| API has no game that day | 2 | 1899-05-25 and 1900-07-12. The API returned 0 games on both dates. |
| Same teams and score on the date, but my table has no code | 7 | Negro league clubs. The API names them (for example "Chicago American Giants @ Kansas City Monarchs", 1944-08-10, 4-0). |
| Same teams on the date, home and away swapped | 2 | 1938-07-07 BIR@KCM and 1939-07-17 CAG@KCM. |
| Same teams on the date, different score | 5 | 1926-07-13, 1927-05-15, 1927-08-14, 1929-09-01, 1942-08-30. |
| Teams not in the API on that date | 7 | 5 exhibition games (all 5 exhibition rows in the sample failed), plus 1940-07-12 IN8@BIR and 1949-07-25 BIR@MEM. One is a score coincidence with an MLB game (1937-09-19). |

**Other facts from the join.**

- All 5 exhibition games in the sample failed to join. No MLB-versus-MLB exhibition game was
  in the sample. So I cannot say whether the API holds those.
- The 1904-06-20 doubleheader is a case where the API and Retrosheet number the two games in
  the opposite order. Duff Cooley's cycle sits under the other gamePk
  (Step 2, 1901 to 1959 table). The join by number alone fails there.
- Retrosheet has no gamePk. I found no crosswalk file.

## Step 2. Event index, two ways (1960 onward)

### What the Retrosheet files are

- `https://www.retrosheet.org/downloads/cycles.zip` (3,894,693 B) has the same size and the
  same 716 game ids as `https://www.retrosheet.org/downloads/3HR.zip` (the "3+ Home Run Games"
  set). Only 1 of the 716 games has a cycle line in its `batting.csv`.
  The page `downloads/othercsvs.html` labels the link "(Batting) Cycles".
  **Retrosheet has no cycle list today.**
- `nohitters.zip` (1,438,142 B) lists 359 games. 198 are 1960 or later.
- `tripleplays.zip` (2,880,177 B) lists 635 games. 266 are 1960 or later, all regular season.
- `20runss.zip` returns HTTP 404 (9,948 B error page).
- Other game-set zips on that page: `15K.zip` (1,508,629 B), `20innings.zip` (376,296 B).
- Each per-year zip is at `downloads/{Y}/{Y}csvs.zip`. Each holds `gameinfo.csv`,
  `batting.csv`, `pitching.csv`, `fielding.csv`, `teamstats.csv`, `allplayers.csv` and
  `plays.csv`. 1960 to 2025: 66 zips, 530,062,727 B in total. 1901 to 1959: 59 zips,
  223,029,280 B.

### Method (a): Retrosheet lists plus the API

| Event | Retrosheet source | 1960+ regular rows | Joined to an API gamePk |
| --- | --- | --- | --- |
| No-hitter | `nohitters.zip` | 196 (plus 2 postseason) | 196 of 196 |
| Triple play | `tripleplays.zip` | 266 | 266 of 266 |
| Cycle | none. Derived from per-year `batting.csv` (4+ hits, with a double, triple and home run, and at least 1 single) | 198 (plus 1 postseason) | 198 of 198 |

- The join used the season schedule: 66 calls, 48,589,813 B (fielded). The first run of
  this sweep gave 44,642,137 B. I re-ran it with extra fields (`officialDate`, `resumeDate`,
  `resumedFrom`).
- **Cost of (a):** 1 call for each list zip; 66 calls and 530 MB for the cycle derivation;
  66 calls and 48.6 MB for the join. About 580 MB and 134 calls in total for the three
  events. The no-hitter and triple-play lists alone cost 4.3 MB and 2 calls, plus the join.
- Display data is a separate cost per game. One game's `/api/v1/game/{pk}/boxscore`
  averaged 214,111 B over 42 sampled games. `/api/v1/game/{pk}/linescore` averaged 2,546 B.
  `/api/v1.1/game/{pk}/feed/live` averaged 501,750 B (Step 4).

### Method (b): the API alone

| Event | API route | Calls | Bytes | Found (vs Retrosheet) | Extra |
| --- | --- | --- | --- | --- | --- |
| No-hitter | Season schedule with `hydrate=linescore`. A played game where a team had 0 hits. | 66 | 48,589,813 | 196 of 196 (100%) | 1 |
| Triple play | `GET /api/v1/teams/{id}/stats?stats=gameLog&season={Y}&group=fielding`, field `triplePlays` | 1,762 (all team-seasons) | 29,100,591 | 265 of 266 (99.6%) | 0 |
| Cycle | `GET /api/v1/sports/1/players?season={Y}` then `GET /api/v1/people?personIds=...&hydrate=stats(group=[hitting],type=[gameLog],season={Y})`, 100 players per call | 470 | 473,861,179 | 198 of 198 (100%) | 0 |

Facts behind that table:

- **No-hitter extra.** The 1979-07-12 DET@CWS game (gamePk 177426). Status `Forfeit`, score
  0-0, 0 hits for both sides. A filter on `detailedState` removes it. 7 of the 197
  candidates ran under 9 innings (1967-08-06, 1984-04-21, 1988-09-24, 1990-07-12,
  2006-10-01, 2021-04-25, 2021-07-07). All 7 are in the Retrosheet list. So both sources
  count shortened games.
- **Triple-play miss.** 2023-08-18 TBA@ANA (gamePk 716945). I checked that game:
  the box score `info` has the line "Triple Play:(Rengifo-Drury-Schanuel-O'Hoppe)" under
  FIELDING. The team game log shows `triplePlays` 0 and `doublePlays` 2. The feed has 88
  plays and none says "triple play". So this triple play exists only in the box score text.
- **Second triple-play route.** The player game log field `groundIntoTriplePlay`
  (fielded into the cycle sweep) found 121 of 266 (45.5%). It misses line-out and fly-out
  triple plays and is not a usable route alone.
- **Cycle counts per game** agree in every game (0 of 198 differ). The Retrosheet side is
  my derivation from `batting.csv`, not a Retrosheet list.
- **The field limit matters.** A 100-player batch of game logs was 11,648,368 B unfielded
  and 1,153,106 B fielded (2017, same players).
- **Postseason.** The sweeps cover regular season only. The API cycle logs returned
  `gameType` `R` for all 198 hits. Retrosheet has 2 postseason no-hitters, 0 postseason
  triple plays, and 1 postseason cycle for 1960 to 2025. I did not test the API on those.

**Agreement is not proof.** The two methods agree, but no third source exists. If both
miss a game, I cannot see it. The task context showed 31 of 36 for the schedule rule
across 12 seasons. A full sweep for 1960 to 2025 gives 196 of 196. The one miss the context
listed for 2010 may be the 2010 NLDS no-hitter, a postseason game that a regular-season
sweep cannot find **(inference)**.

### 1901 to 1959 (the same checks, for the later features)

| Event | Retrosheet rows (regular) | Joinable by my table | Found by the API rule | Notes |
| --- | --- | --- | --- | --- |
| No-hitter (zero hits) | 136 | 108 | 108 of 108 | 28 rows have non-MLB codes (for example Federal League, Negro leagues) **(inference from the codes)**. 1 API candidate not in the Retrosheet list. |
| Triple play (team log) | 348 | 316 | 305 of 316 (96.5%) | 32 rows not joinable. 8 API-only games. 60 team-seasons returned HTTP 404 (Negro league team ids 1489 to 1541 and 6142 to 6156, 1924 to 1944). |
| Cycle (player log) | 118 (derived) | 107 | 106 of 107 | The 1 apparent miss is the 1904 doubleheader order swap. 9 more API-only cycles are by Negro league players (for example Oscar Charleston, 1920-08-05). 11 Retrosheet rows are not joinable. |

- A match that took the number of the doubleheader game failed on old games. A match that
  accepted either game of that day did not. I used the second kind for 1901 to 1959.
- Cost of these old sweeps: 59 schedule calls (29,070,399 B); 1,292 triple-play calls
  (16,086,099 B); 347 cycle calls (205,847,652 B).
- Per-game player logs return data for 1927, 1950 and 1959 (checked with one batch each).

### Where each method fails

**(a) Retrosheet lists plus the API**

- No cycle list exists, so (a) needs a 530 MB download to derive cycles for 1960 to 2025.
- The join needs a team-code table. Retrosheet codes for defunct clubs (Federal League,
  Negro leagues, 1890s clubs) are not in my table. 21 of 198 sample games hit this.
- Old doubleheaders can join to the wrong gamePk (Step 1 and the 1904 case).
- A mislinked or missing file (`cycles.zip`, `20runss.zip`) fails with no warning.

**(b) The API alone**

- Cycles need 470 calls and 474 MB for 1960 to 2025 even with `fields=`.
- The triple-play field can be wrong (2023-08-18).
- A forfeit with 0 hits shows as a no-hitter unless the filter reads `detailedState`.
- The schedule lists a postponed game twice (Step 3) and lists cancelled games. Any index
  must dedupe by gamePk.
- Negro league team ids return 404 for the team game log.
- It needs the API to stay as it is today. A field revision changes the recall.

## Step 3. The 1975 gap (1,941 against 1,934)

**Cause found in 4 calls.**

1. `GET /api/v1/schedule?sportId=1&season=1975&gameType=R&hydrate=linescore` returns
   1,941 game rows (`totalGames` 1941, 8,619,296 B) but only **1,934 distinct gamePks**.
2. 7 gamePks appear twice (168575, 168579, 168738, 168866, 168879, 168904, 169252). All
   7 are suspended games. The first row sits under the original date and carries
   `resumeDate`. The second row sits under the resume date and carries `resumedFrom`.
   Both rows have the same gamePk, teams and score.
3. Retrosheet `https://www.retrosheet.org/gamelogs/gl1975.zip` (306,305 B) holds 1,934
   lines. Exactly 7 lines have a completion date. They match the 7 pairs (for example
   MIL@TEX 1975-05-14, completed 1975-05-15, 3-2).
4. 1941 minus 7 duplicate rows is 1,934.

**What this does to other counts.**

- The task context figure of 224,752 games is a row count. My row count for 1901 to 2025
  is 224,754 (140,613 for 1960 to 2025 plus 84,141 for 1901 to 1959).
- **Distinct played games, 1901 to 2025: 223,450** (139,366 for 1960 to 2025; 84,084 for
  1901 to 1959). I counted a game as played when `detailedState` is `Final`,
  `Completed Early` or `Forfeit`, once per gamePk.
- For 1960 to 2025 the extra 1,098 rows come from: 144 resumed rows, plus `Postponed`
  rows (953 rows in all) and `Cancelled` rows (149). In `abstractGameState` these rows
  say `Final`. A filter on that field alone counts them.
- 1975 itself has only `Final` rows. It has no `Postponed` or `Cancelled` rows.
- Four same-key collisions in my first 1975 index (same date, home, away, game number)
  were a resumed row next to a real game. They are the reason I rebuilt the index with
  `officialDate`.

## Step 4. Sizes, and the repo and host rules

### Inputs

- **Events.** The API-derived index for 1901 to 2025 (regular season only) holds
  **1,193 events**: 314 cycles, 574 triple plays, 305 no-hitters. Retrosheet's own
  all-era lists hold 359 no-hitter games and 635 triple-play games. Cycles derived from
  per-year box lines: 199 games for 1960 to 2025 and 120 for 1901 to 1959. I did not
  derive 1897 to 1900.
- **Per-game record.** I built a proxy record from 42 sampled feeds (3 games in each of 14
  seasons). It holds the venue name, the officials, the line score by inning, and each
  player's batting and pitching line. This is a measuring device, not a design.
  Average **7,588 B raw, 1,456 B gzipped**. By era: 10,204 B (1901 to 1949), 6,817 B
  (1950 to 1999), 5,281 B (2000 to 2025). The sample is small, so treat these as
  estimates.
- **What the 42 games contained.**
  - Play-by-play: 0 plays for all 15 games from 1901 to 1940. 74 to 78 plays for the three
    1950 games. 66 to 102 plays from 1960 on.
  - Officials: 0 for every game before 1950. 0 to 2 in 1950 to 1980 (5 of the 12 games had none).
    1 to 3 in 1990. 4 in every game from 2000.
  - Batting orders: 9 and 9 in 41 of 42 games. The other game (1940) returned 0 and 0.
  - Box lines and the venue name: present in all 42.
- **Per-game fetch cost.** Feed averaged 501,750 B. Box score averaged 214,111 B. Line
  score averaged 2,546 B. Feed time per call averaged 663 ms (1901 to 1949), 105 ms (1950 to 1999) and 321 ms (2000 to 2025). Treat
  time as noisy.

### Sweep cost (estimates from the 42-game sample)

| Sweep | Games | Estimated bytes | Estimated time at 4 requests at once |
| --- | --- | --- | --- |
| Feed, 1901 to 2025 | 223,450 | 105.6 GB | 5.3 h |
| Feed, 1960 to 2025 | 139,366 | 77.9 GB | 1.9 h |
| Box score, 1901 to 2025 | 223,450 | 44.3 GB | not computed |
| Box score, 1960 to 2025 | 139,366 | 24.6 GB | 0.9 h |

Task context said about 99 GB and about 10 hours for a full feed sweep. My byte estimate
is close (105.6 GB). My time estimate is lower, because my sample averaged 366 ms per
feed. No rate limit showed up in about 4,400 calls today. I did not push for one.

### Event index: two shard schemes (proxy record, 1,193 events)

| Scheme | Files | Bytes (raw) |
| --- | --- | --- |
| One file | 1 | 84,669 (16,373 gzipped) |
| By decade | 13 | 8,596 largest, 6,514 average |
| By season | 125 | 1,467 largest, 678 average, 84,793 total |
| (extra) one file per event kind | 3 | 24,738 cycles, 37,121 triple plays, 22,812 no-hitters |

### Per-game pages: shard schemes (estimates)

| Scheme | Files | Size per file (raw) | Total raw | Total gzipped |
| --- | --- | --- | --- | --- |
| One file per game, 1901 to 2025 | 223,450 | about 7.6 KB | 1,594 MB | 312 MB |
| One file per game, 1960 to 2025 | 139,366 | about 5.9 KB | 816 MB | 199 MB |
| One file per date | 21,522 | 76 KB average | 1,594 MB | not computed |
| One file per month | 844 | 1.89 MB average, 3.87 MB largest | 1,594 MB | 312 MB (sum of the per-game gzip) |
| One file per season | 125 | 12.8 MB average, 17.9 MB largest | 1,594 MB | 312 MB (same basis) |

The gzipped column adds each game's gzip size. A real shard gzips better, so the true
total is lower. I did not build the shards. One file per game on 4 KB disk blocks is about
2,026 MB for 1901 to 2025.

### Against the repo rules (ADR-0038)

- `scripts/check-dir-size.mjs` walks `src`, `api` and `scripts` and counts files ending in
  `.js`, `.jsx`, `.mjs` or `.css`. `MAX_FILES` is 12. `scripts/check-file-size.mjs` uses the
  same roots and extensions, with `MAX_LINES` 600. Neither guard reads `public/` or
  `.json` files **(from reading both scripts)**. So these guards do not limit a JSON
  shard under `public/data/`.
- If a rule of 12 files per directory applied anyway: one file (1) and per-kind (3) fit.
  By decade (13) is one over. By season (125) is over. One file per game is far over.
- Existing data folders in `public/data/` run to 231 files (`team-records/2026`); the
  next folders hold 212 (`umpires/2024`), 190 (`highlights/day`) and 183 (`umpires/2025`).
  `public/` holds 3,437 files and 141 MB at this base (`find` and `du`).
- A single generator script (`.mjs`) is bound by the 600-line ceiling. I did not measure
  one.

### Against Vercel Hobby

Source: `https://vercel.com/docs/limits` (page header `last_updated: 2026-09-16`),
fetched on 2026-10-06.

- Static file uploads: **100 MB** of source files for a CLI deployment (Hobby).
- Files: **15,000** source files for a CLI deployment. More files fail "at the build step".
- Output files: "no upper limit", but "many thousands" slow the build, and 100,000 or more
  is the example given. A build over 45 minutes fails.
- Routes per deployment: 2,048. Deployments per day: 100.
- This repo deploys from Git (`vercel.json`: `git.deploymentEnabled`, `main` only). The
  page words these limits for the CLI. `public/` is already 141 MB, above 100 MB. So I
  read the 100 MB limit as not binding a Git deployment **(inference; not tested)**.
- Per scheme: 223,450 per-game files exceed 15,000 if the file limit applies. 21,522
  per-date files also exceed it. 844 per-month files and 125 per-season files fit.
  Sums of 1,594 MB raw exceed 100 MB if that limit applies.

### Against GitHub

Source: `https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits`
(read through a page summary tool, 2026-10-06). It gives: repository on-disk size "10 GB",
**3,000** entries in one directory (width), recommended file size **1 MB**, hard limit
**100 MB**.

- One file per game in one directory: 223,450 files needs at least 75 directories at 3,000
  each.
- Per-month shards (3.87 MB largest) and per-season shards (17.9 MB largest) are over the
  1 MB recommended size and under 100 MB.
- Committed data of 1,594 MB raw is 15.9% of "10 GB".

## What is still unknown

1. **Ground truth.** Retrosheet and the API agree on 1960 to 2025. No third source exists.
   A game both miss is invisible here.
2. **Does `cycles.zip` stay mislinked?** I saw it once (2026-10-06). `20runss.zip` is a 404.
3. **Postseason events.** The API sweeps cover regular season. I did not sweep postseason
   games. Retrosheet shows 3 postseason events for 1960 to 2025.
4. **1897 to 1900.** The API sweeps started in 1901. Two sampled dates (1899, 1900) had
   0 API games. I did not check where API coverage starts.
5. **Negro league and Federal League data.** The API schedule holds Negro league games.
   The team game log returns 404 for them. Their scores differ from Retrosheet in 5 of 21
   sampled cases and home/away swap in 2. I do not know which side is right.
6. **Old doubleheader numbering.** Retrosheet and the API number old doubleheaders in
   different orders in at least 1 case, and my number-strict match failed on about 9 more
   no-hitter rows. The cause is not checked.
7. **Retrosheet to gamePk.** No crosswalk file was found. Every join is by date, teams and
   number, with a team-code table I wrote.
8. **Per-game page contents.** Only 42 games sampled. Umpires are missing in most games
   before 1990. Plays are missing before 1950. I did not check attendance, weather or
   lineup order accuracy.
9. **API stability.** Fields such as `triplePlays` can be wrong or revised. I did not see
   a changelog.
10. **Speed limits and time.** No throttle appeared in about 4,400 calls through the cloud
    proxy. The time estimates are noisy and may not hold elsewhere.
11. **Vercel and GitHub limit scope.** The docs word the 100 MB and 15,000-file limits for
    the CLI. I did not test them on a Git deployment. The GitHub figures came from a
    summary of the page, not the raw page.
12. **Per-game record size.** My proxy record may leave out fields a page needs, so real
    shards may be larger. A real shard gzips better than the per-game sum.
