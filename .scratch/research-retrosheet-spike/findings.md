# Spike: Retrosheet join for /research (#2234)

Part of #2234 (decision 8: add a Retrosheet history store, only after a join spike
passes). Run 2026-10-21 in a cloud session. No product code changed.

**Labels.** A number in a table is **measured**: a command below gives it again.
*(Inference)* marks my reasoning. Nothing here is an estimate unless it says so.

## The answer

**The join passes, from 1908 to 2025, for the AL and NL regular season.**

- **Games to `gamePk`:** 203,278 of 203,278 Retrosheet games join to a statsapi
  `gamePk` (203,231 by the exact key, 47 by a second pass). For 1961 to 2014:
  112,902 of 112,902 (112,891 exact, 11 second pass).
- **Final score check:** 203,276 of 203,278 joined games have the same final
  score in the Retrosheet game log and the statsapi linescore. The 2 that differ
  are from 1920 and 1922.
- **People to MLBAM ids (Chadwick register):** 18,523 of 18,525 distinct
  Retrosheet people bridge. 15,558,403 of 15,558,422 plate appearances (PAs)
  have both the batter and the pitcher bridged. For 1961 to 2014: 9,553 of 9,553 people and 8,647,152 of 8,647,152 PAs.
- **Independent check, statsapi boxscores:** in 323 of 324 sampled games, and in
  47 of 47 second-pass games, the bridged ids equal the players in the
  statsapi boxscore of that `gamePk`, club by club. The 1 difference is a statsapi
  error (it lists one player for both clubs).
- **Pitcher side (open after #2311):** on 6 days from 2008 to 2023, 6,288 of
  6,288 Savant PAs have the same batter and the same pitcher in Retrosheet.
- **Size, measured on every season:** a lean PA store is 47.8 MB gz for
  1961 to 2014 and 84.3 MB gz for 1908 to 2025 (0.6 to 1.1 MB gz a season).
  With the pitch sequence and the raw event text: 72.5 and 125.2 MB gz.

The join is not the risk. **Completeness before 1960 is the risk:** 6.6% to
13.6% of PAs before 1950 have an unknown result (Retrosheet event `99`).

What #1565 failed on does not repeat here: this join reads no names. Clubs map
by id (a vote on shared dates, section 1), and people map through the register.

## Inputs

All downloads went to a folder outside the repo (ADR-0100, decision 3).

| Input | Source | What came back |
|---|---|---|
| Event files | `https://www.retrosheet.org/events/{YYYY}eve.zip` | 1908 to 2025 (118 seasons). 1901 to 1907: HTTP 404, no file |
| Game logs | `https://www.retrosheet.org/gamelogs/gl{YYYY}.zip` | 1901 to 2025 |
| Chadwick register | `raw.githubusercontent.com/chadwickbureau/register/master/data/people-{0-f}.csv` | 526,894 rows; 24,622 carry both `key_retro` and `key_mlbam`; 0 conflicts |
| statsapi schedules | `/api/v1/schedule?sportId=1&season=Y&hydrate=linescore` | 1901 to 2025. 1895 and 1876 return 0 games; 1901 returns 1,110 |
| statsapi boxscores | `/api/v1/game/{gamePk}/boxscore` | 371 games (section 2). A 1925 game has MLBAM ids; `playByPlay` is empty for it |
| Savant CSV | `statcast_search/csv`, one day each | 2008-06-10, 2011-06-10, 2014-06-10, 2023-06-10/11/12 |
| Chadwick tools 0.7.2 (`cwevent`) | SourceForge tarball, built in the container | Used for sections 3 and 5 |

`docs/agents/research-database.md` says to query the research database first.
No view holds regular-season schedules before 2000 or any Retrosheet data, so I
pulled from statsapi.

## 1. Games to `gamePk`, per decade

Key: statsapi home club id + `officialDate` + game number (`doubleHeader: 'N'`
counts as game 1). Retrosheet: `info,hometeam`, `info,date`, `info,number` (0 is
game 1). Second pass, for a game the key misses: the same date and the same two
clubs in either home/away order, nearest game number first. Each join is then
checked against the final score in Retrosheet's game log.

| Decade | Seasons | Retrosheet games | Exact key | Second pass | Not joined | Final score equal | statsapi R finals with no Retrosheet game |
|---|---|---|---|---|---|---|---|
| 1900s | 1908-1909 | 2,485 | 2,485 | 0 | 0 | 2,485 / 2,485 | 0 of 2,485 |
| 1910s | 1910-1919 | 12,080 | 12,080 | 0 | 0 | 12,080 / 12,080 | 1 of 12,081 (forfeit) |
| 1920s | 1920-1929 | 12,323 | 12,323 | 0 | 0 | 12,321 / 12,323 | 4,255 of 16,578 (Negro Leagues) |
| 1930s | 1930-1939 | 12,310 | 12,310 | 0 | 0 | 12,310 / 12,310 | 3,035 of 15,345 (Negro Leagues) |
| 1940s | 1940-1949 | 12,376 | 12,376 | 0 | 0 | 12,376 / 12,376 | 4,728 of 17,104 (Negro Leagues) |
| 1950s | 1950-1959 | 12,373 | 12,373 | 0 | 0 | 12,373 / 12,373 | 1 of 12,374 (forfeit) |
| 1960s | 1960-1969 | 15,961 | 15,961 | 0 | 0 | 15,961 / 15,961 | 0 of 15,961 |
| 1970s | 1970-1979 | 19,805 | 19,805 | 0 | 0 | 19,805 / 19,805 | 1 of 19,806 (forfeit) |
| 1980s | 1980-1989 | 20,337 | 20,337 | 0 | 0 | 20,337 / 20,337 | 0 of 20,337 |
| 1990s | 1990-1999 | 21,594 | 21,594 | 0 | 0 | 21,594 / 21,594 | 0 of 21,594 |
| 2000s | 2000-2009 | 24,291 | 24,287 | 4 | 0 | 24,291 / 24,291 | 35 of 24,326 (2000, no linescore) |
| 2010s | 2010-2019 | 24,297 | 24,284 | 13 | 0 | 24,297 / 24,297 | 0 of 24,297 |
| 2020s | 2020-2025 | 13,046 | 13,016 | 30 | 0 | 13,046 / 13,046 | 0 of 13,046 |

Not in these rows: 1,243 Federal League games (1914-1915). statsapi has no
Federal League games, so `join.mjs` keeps them out.

**The club map.** No names are read. For each season and Retrosheet code, the
statsapi club id that is home (or away) on the most shared dates wins. It gives
45 code-to-id pairs, and each one follows the franchise history. Examples: `WS1`
to 142 (Twins), `WS2` to 140 (Rangers), `SE1` to 158 (Brewers), `SLA` to 110
(Orioles), `KC1` and `PHA` to 133 (Athletics), `ATH` to 133 in 2025. The full
list is the last part of `report.mjs` output. The weakest margin is 2020, with
60 games a club: `COL` 62 votes against 50 for the next id.

## 2. People to MLBAM ids, per decade

| Decade | PAs | PAs with batter and pitcher bridged | Distinct people (start and sub lines) | Bridged |
|---|---|---|---|---|
| 1900s | 182,343 | 182,343 | 637 | 637 |
| 1910s | 902,738 | 902,738 | 1,879 | 1,879 |
| 1920s | 957,344 | 957,325 | 1,679 | 1,677 |
| 1930s | 961,765 | 961,765 | 1,507 | 1,507 |
| 1940s | 954,455 | 954,455 | 1,705 | 1,705 |
| 1950s | 952,828 | 952,828 | 1,562 | 1,562 |
| 1960s | 1,209,599 | 1,209,599 | 1,786 | 1,786 |
| 1970s | 1,510,990 | 1,510,990 | 2,083 | 2,083 |
| 1980s | 1,551,900 | 1,551,900 | 2,281 | 2,281 |
| 1990s | 1,668,131 | 1,668,131 | 2,805 | 2,805 |
| 2000s | 1,877,536 | 1,877,536 | 3,231 | 3,231 |
| 2010s | 1,848,938 | 1,848,938 | 3,566 | 3,566 |
| 2020s | 979,855 | 979,855 | 2,840 | 2,840 |

The 2 unbridged people (19 PAs) are register gaps, not a join fault:

- `glasn101` (Norman Glaser, 1 game, DET 1920-09-21): the register row has no
  `key_mlbam`. The statsapi boxscore (gamePk 94395) lists him as 844558.
- `blacv101` (Verne Blackbourn, 1 game, CHA 1921-09-02): no `key_mlbam`. The
  statsapi boxscore (gamePk 95488) lists "Charlie Blackburn", 111042. The two
  sources name a different man.

**Boxscore check** (`verify-box.mjs`). For each sampled game, the bridged ids
from the Retrosheet `start` and `sub` lines, club by club, against the
`batters` and `pitchers` lists of the statsapi boxscore. A wrong `gamePk` or a
wrong id bridge shows as a set difference. Sample: a fixed, even spread, 4 games
a season for 1961 to 2014 and 2 for the other seasons.

| Decade | Games | Same players, both clubs | Retrosheet ids not in box | Box ids not in Retrosheet |
|---|---|---|---|---|
| 1900s | 4 | 4 | 0 | 0 |
| 1910s | 20 | 20 | 0 | 0 |
| 1920s | 20 | 20 | 0 | 0 |
| 1930s | 20 | 19 | 0 | 1 |
| 1940s | 20 | 20 | 0 | 0 |
| 1950s | 20 | 20 | 0 | 0 |
| 1960s | 38 | 38 | 0 | 0 |
| 1970s | 40 | 40 | 0 | 0 |
| 1980s | 40 | 40 | 0 | 0 |
| 1990s | 40 | 40 | 0 | 0 |
| 2000s | 40 | 40 | 0 | 0 |
| 2010s | 30 | 30 | 0 | 0 |
| 2020s | 12 | 12 | 0 | 0 |
| Second-pass games (all) | 47 | 47 | 0 | 0 |

The 1 difference: gamePk 115532 (PIT 1938-05-04). statsapi lists Heinie Manush
(118265) in the `batters` of both clubs. Retrosheet has him for Brooklyn only.

## 3. Plate appearances against Savant (the pitcher side)

#2311 found that 2% to 4.5% of PAs had a different pitcher, and did not find
the cause. Here `cwevent` gives the pitcher at the play (field 14) and the
responsible pitcher (field 16). Each Savant PA (last pitch of an at-bat, with a
PA event) is matched in the same `gamePk`, inning and half, by batter.

| Day | Games | Savant PAs | Batter found | Pitcher at play equal | Responsible pitcher equal |
|---|---|---|---|---|---|
| 2008-06-10 | 15 | 1,121 | 1,121 | 1,121 | 1,121 |
| 2011-06-10 | 15 | 1,160 | 1,160 | 1,160 | 1,160 |
| 2014-06-10 | 14 | 1,080 | 1,080 | 1,080 | 1,080 |
| 2023-06-10 | 15 | 1,127 | 1,127 | 1,127 | 1,127 |
| 2023-06-11 | 15 | 1,139 | 1,139 | 1,139 | 1,139 |
| 2023-06-12 | 8 | 661 | 661 | 661 | 661 |

Savant rows with no PA event (`truncated_pa` or blank) are skipped: 20 in all.
*(Inference: the #2311 gap came from its own parser, not from the data. Its
`start`/`sub` regex `(\d),(\d),(\d)` also matches field position 11, a pinch
hitter, as position 1, so a pinch hitter became the "pitcher". I did not rerun
the old script to prove it.)*

## 4. Completeness: unknown plays

The event-file PAs equal the box-score PAs in Retrosheet's game log for 203,277
of 203,278 games. *(Inference: Retrosheet builds the game logs from the same
files, so this shows that they agree, not that every play is known.)* The real
gap is the PA whose result Retrosheet does not know. It writes the event `99`
for it. The batter is known; the result is not.

| Decade | PAs | PAs with result `99` | Games with at least one | Deduced games (`.EDA`/`.EDN`) |
|---|---|---|---|---|
| 1900s | 182,343 | 24,862 (13.63%) | 931 of 2,485 | 37 |
| 1910s | 902,738 | 101,596 (11.25%) | 4,014 of 12,080 | 175 |
| 1920s | 957,344 | 62,869 (6.57%) | 2,133 of 12,323 | 564 |
| 1930s | 961,765 | 66,598 (6.92%) | 2,303 of 12,310 | 674 |
| 1940s | 954,455 | 98,596 (10.33%) | 3,118 of 12,376 | 1,476 |
| 1950s | 952,828 | 19,524 (2.05%) | 591 of 12,373 | 415 |
| 1960s | 1,209,599 | 3,319 (0.27%) | 105 of 15,961 | 40 |
| 1970s | 1,510,990 | 708 (0.05%) | 23 of 19,805 | 0 |
| 1980s | 1,551,900 | 110 (0.01%) | 74 of 20,337 | 0 |
| 1990s | 1,668,131 | 28 (0.00%) | 15 of 21,594 | 0 |
| 2000s | 1,877,536 | 0 | 0 of 24,291 | 0 |
| 2010s | 1,848,938 | 0 | 0 of 24,297 | 0 |
| 2020s | 979,855 | 0 | 0 of 13,046 | 0 |

The pitch sequence is a different gap: section 5 gives the share of PAs that
carry one, per season. *(Inference: a count chip, such as "after 0-2", can only
answer for seasons where the pitch sequence is filled.)*

## 5. Store size, PA grain

Measured on every season, not projected. Rows: one per PA (`cwevent` batter
event flag `T`), with `gamePk` and MLBAM ids from the join. Layout: the #2311
column layout (`{ season, month, cols, c: [[...], ...] }`), one JSON shard per
calendar month (the #2311 advice for a "last time" scan). Size: `gzip -9`, sum of
the shards.

Columns:
- **lean** (23): `gamePk`, `ab` (Retrosheet event number), `d` (day of season),
  `batter`, `pitcher` (responsible pitcher), `stand`, `throws`, `event`
  (Retrosheet event type), `inn`, `half`, `outs`, `bases` (bit mask), `balls`,
  `strikes`, `bsd` (batting club's score margin), `slot` (lineup), `hit`,
  `outsOnPlay`, `dp`, `tp`, `rbi`, `fld` (fielded by), `bb` (batted-ball type).
- **+pitchSeq**: adds the Retrosheet pitch sequence string.
- **+eventText**: adds the raw Retrosheet event text (fielders, advances,
  errors), which a later filter can parse.

| Decade | Seasons | PA rows | Pitch sequence filled | lean, MB gz | +pitchSeq, MB gz | +pitchSeq +eventText, MB gz | lean, bytes gz per PA |
|---|---|---|---|---|---|---|---|
| 1900s | 1908-1909 (2) | 182,343 | 0.0% | 0.9 | 0.9 | 1.2 | 4.89 |
| 1910s | 1910-1919 (10) | 902,738 | 0.0% | 4.5 | 4.5 | 6.0 | 4.98 |
| 1920s | 1920-1929 (10) | 957,344 | 0.4% | 4.8 | 4.9 | 6.6 | 5.06 |
| 1930s | 1930-1939 (10) | 961,765 | 0.2% | 4.8 | 4.8 | 6.4 | 5.02 |
| 1940s | 1940-1949 (10) | 954,455 | 3.8% | 4.8 | 4.9 | 6.3 | 5.02 |
| 1950s | 1950-1959 (10) | 952,828 | 12.4% | 5.0 | 5.2 | 6.7 | 5.23 |
| 1960s | 1960-1969 (10) | 1,209,599 | 7.7% | 6.3 | 6.5 | 8.4 | 5.23 |
| 1970s | 1970-1979 (10) | 1,510,990 | 3.3% | 7.8 | 7.9 | 10.2 | 5.13 |
| 1980s | 1980-1989 (10) | 1,551,900 | 21.6% | 8.2 | 8.8 | 11.2 | 5.27 |
| 1990s | 1990-1999 (10) | 1,668,131 | 95.2% | 9.7 | 12.5 | 16.0 | 5.81 |
| 2000s | 2000-2009 (10) | 1,877,536 | 100.0% | 11.0 | 14.2 | 18.3 | 5.84 |
| 2010s | 2010-2019 (10) | 1,848,938 | 100.0% | 10.8 | 14.3 | 18.2 | 5.84 |
| 2020s | 2020-2025 (6) | 979,855 | 100.0% | 5.7 | 7.7 | 9.7 | 5.86 |
| **All** | 1908-2025 (118) | 15,558,422 | | **84.3** | **97.3** | **125.2** | 5.42 |
| **1961-2014** | 54 | 8,647,152 | | **47.8** | **56.5** | **72.5** | |

Single seasons: 1961 is 0.59 MB gz lean (7.7 MB raw JSON); 1987 is 0.85 MB gz
(11.4 MB raw); 2014 is 1.07 MB gz lean and 1.81 MB gz with both strings (16.0 MB
raw).

Reading it *(inference)*:
- A modern Retrosheet season is about 1.1 MB gz lean, against 4.2 to 5.1 MB gz
  for a Savant PA season in #2311. The Savant rows carry tracking columns
  (location, exit velocity), so the two are not the same row.
- The whole history, 1908 to 2025, is 84 to 125 MB gz. That is too large for
  git (`.git` is 171 MB now), and it fits decision 2 (outside git).
- A phone does not load the whole store. A "last time" scan reads month shards
  newest first and stops at the first match; a "how often" count over a range
  reads that range. Not built or timed here.
- The pitch sequence string costs about 30% on top of lean where it is filled
  (1990s on). Before 1988 it is mostly empty, so count filters gray out there.

## Failure modes, with counts

| Failure mode | Count | What fixes it |
|---|---|---|
| **Suspended games.** statsapi lists a suspended game on each date it was played, with one `gamePk` and one `officialDate` (the start date). Retrosheet dates it by the start date. | 316 false "ambiguous" keys in my first run, which indexed both dates | Key on `officialDate` only, one entry per `gamePk`. After the fix: 0 |
| **A designated home club that played in the other park** (makeup games, neutral sites, 2020). Retrosheet's home club is the park's club; statsapi keeps the designated home club. | 44 games: 1 in 2007, 3 in 2010, 3 in 2011, 1 in 2013, 3 in 2015, 3 in 2017, 28 in 2020, 1 in 2021, 1 in 2022 | Second pass (same date, same two clubs). All 44 have equal scores and equal boxscore players |
| **Doubleheaders numbered differently.** A single game that statsapi calls game 2 of a split doubleheader (BAL 2008-09-06), and a day-night pair against two different clubs that statsapi marks `doubleHeader: 'N'` for both (CLE 2000-09-25) | 3 games | Second pass. All 3 checked |
| **Club renames and moves** (the #1565 failure: `TBA` "Devil Rays" against "Rays") | 0 failures. 45 code-to-id pairs over 118 seasons | The vote map reads no names |
| **Person name changes** | 0 failures | Retrosheet ids are stable; the register maps ids, not names |
| **Missing seasons in Retrosheet.** No event files for 1901 to 1907 | 8,288 statsapi regular-season finals (1,110 / 1,117 / 1,114 / 1,249 / 1,237 / 1,228 / 1,233) | None. Retrosheet has game logs (no plays) for those years |
| **Federal League** (1914-1915) is in Retrosheet, not in statsapi | 1,243 Retrosheet games | Keep out |
| **Negro Leagues.** statsapi lists Negro League games for 1920 to 1948 as regular season (`gameType: R`). Retrosheet's `.EVR` files hold only a part of them | 12,018 statsapi games with no AL/NL Retrosheet game. Retrosheet `.EVR`: 2,018 games for 1920-1948; my sample join gave 1,458 exact + 191 second pass, and 4,593 of 5,056 people bridged | **Not proven.** The vote map is not reliable with this few games: for 1913 and 1916 it mapped Negro League codes to AL/NL clubs. It needs a hand-checked club map |
| **statsapi rows with no game.** 2000 has 35 regular-season rows marked `Final` with no linescore. gamePk 5026 has an empty boxscore (0 batters) | 35 | Ignore rows with no linescore. *(Inference: postponed games marked Final. I checked one boxscore.)* |
| **Forfeits** in statsapi with no Retrosheet game | 3: 1914-06-26 (gamePk 86600), 1954-07-18 (135903), 1979-07-12 (177426) | None needed |
| **Final score differs** | 2: NYA 1920-08-26 (gamePk 94183, Retrosheet 16-5, statsapi 16-4), SLA 1922-08-09 (96552, Retrosheet 7-8, statsapi 6-8) | Show the Retrosheet score in the history store; flag the 2 |
| **Register gaps** | 2 people, 19 PAs (section 2) | A two-row override, pinned by a test |
| **statsapi boxscore error** | 1 (Manush, gamePk 115532) | None for the join |
| **Game log parse.** The completion field (`"date,park,vis,home,outs"`) holds commas. A plain `split(',')` moves every later column | My first completeness run was wrong; fixed | Use the quote-aware `parseCsv` (`src/lib/csv/parse.js`) |
| **Postseason** | Not tested | Retrosheet keeps postseason files apart. A separate check |

## Reproduce

From the repo root, with `DL` a new, empty folder outside the repo:

```bash
DL=/tmp/retro-spike            # any folder outside the repo
cd .scratch/research-retrosheet-spike
bash fetch.sh "$DL" 1901 2025                     # event zips, game logs, register (about 1.2 GB unpacked)
node pull-schedules.mjs "$DL/sched" 1901 2025     # 125 statsapi schedule requests
node join.mjs "$DL" 1908 2025 > "$DL/join-out.txt"   # sections 1, 2 and the failure counts
node report.mjs "$DL"                             # the per-decade tables and every failure
node verify-box.mjs "$DL" 2 4                     # boxscore check, sample (344 requests)
PAIR=1 node verify-box.mjs "$DL"                  # boxscore check, every second-pass game
NGL=1 node join.mjs "$DL" 1908 1961               # Negro League sample (writes *-ngl.json)
node completeness.mjs "$DL"                       # section 4
# Chadwick tools: github.com and codeload.github.com returned 403 here; SourceForge worked.
curl -L -o cw.tgz https://sourceforge.net/projects/chadwick/files/chadwick-0.7/chadwick-0.7.2/chadwick-0.7.2.tar.gz/download
tar xzf cw.tgz && (cd chadwick-0.7.2 && ./configure --prefix="$DL/cw" && make && make install)
node pa-check.mjs "$DL" "$DL/cw/bin/cwevent" 2008-06-10 2011-06-10 2014-06-10 2023-06-10 2023-06-11 2023-06-12   # section 3
for r in "1908 1937" "1938 1967" "1968 1996" "1997 2025"; do node size.mjs "$DL" "$DL/cw/bin/cwevent" $r & done; wait   # section 5, about 20 s a season
node size-report.mjs "$DL"                        # section 5 table
```

Delete `$DL` after the run. Nothing here writes into the repo.

## Decisions for Gary

[DECISION: The join gate passes. Recommended: build the Retrosheet history store. Alternative: keep /research to the tracking era.]

[DECISION: First history slice = 1961 to 2014 (112,902 games, 8,647,152 PAs, 0.27% or fewer unknown results a decade). Recommended. Alternatives: 1908 to 2014 now, with the unknown-play share printed per season on the coverage line (decision 11); or 1950 to 2014.]

[DECISION: Join recipe for the generator = club vote map, then the exact key (home club + `officialDate` + game number), then the second pass (same date, same two clubs), then a final-score gate that fails the run on a new difference. Recommended. The 2 known score differences go in an allow list.]

[DECISION: Game state (outs, runners, score, count) comes from Chadwick `cwevent` output, run by hand, and the generator reads its CSV (ADR-0100 shape: a hand-run step, inputs outside the repo). Recommended over a new JS port of Retrosheet's play grammar. Network: github.com and codeload.github.com are blocked (HTTP 403) in this environment; SourceForge serves 0.7.2. To build a newer Chadwick from GitHub, allow github.com and codeload.github.com in the environment's network settings.]

[DECISION: The 2 register gaps go in a two-row override (`glasn101` to 844558; `blacv101` left unbridged until a person checks it, because statsapi names a different man). Recommended. Alternative: leave both unbridged (19 PAs).]

[DECISION: Negro League games stay out of the first history store. Recommended. A later spike can build a hand-checked club map for the `.EVR` files.]

[DECISION: Postseason history needs its own join check before it ships. Recommended.]
