# Player redesign: data audit

Status: **audit done** (2026-10-13, issue #1880). Research only. No product code changed.

This file lists every number and label on each designed card of the player page
redesign (`docs/player-redesign.md`, section 6), with its source today, its status and
the smallest fix. Gary's rule holds: **adapt an existing source before you add a new
one.**

- **have**: the source has the value now.
- **reshape**: the data exists, but in another shape, file or function.
- **missing**: no source has it. A generator or a fetch must change.

Design canvas: https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK (read with the
Artifact tool, `path: "project/<Board>.dc.html"`). All live checks ran on 2026-10-13
against `https://statsapi.mlb.com` and the `public/data/` stores on `main`.

## Player ids

The audit brief gave two wrong ids. Use these:

| Player | Id | Store shard | Note |
| --- | --- | --- | --- |
| Brice Turang | 668930 | `30` | 678489 is Jorge Barrosa |
| Robert Gasser | 688107 | `07` | 687207 is Jordan Merritt |
| Aaron Ashby | 676879 | `79` | Bullpen tab of `MoundCard` |
| Jesús Made | 815908 | `08` | `PathProspect` |

## Hero header and stat tiles (`B-phone`, `D2-phone`)

Module issue: #1884.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Photo | headshot URL builder in `src/lib/teams.js` | have | — |
| Role and number ("Batter · #2"), name | `fetchPerson` (`src/api/person-fetch.js`), shaped by `personBio` (`src/api/person/identity.js`) | have | — |
| Position pill (2B, SP) | `posAbbr`; SP/RP from `pitcherRole` (`src/api/person.js`) | have | The bio says "P"; use the role for a pitcher |
| Club logo and name | `currentTeam` hydrate, `teamLogoUrl` (`src/lib/teams.js`) | have | — |
| Bats / Throws, Ht / Wt, Born, MLB debut | `personBio` | have | — |
| Age, birthday flip | `currentAge`, `birthDate` | have | The flip is UI only |
| Draft ("2018 · Rd 1 #21", "2021 · Rd CB-B #71") | `draftInfo()` in `src/api/person/identity.js` | have | Format string only |
| Tiles AVG, HR, RBI, SO / W–L, IP, ERA, K | `hitterTiles`, `pitcherTiles` (`src/api/person/stats.js`) | have | — |
| Closer tile SV in place of W–L | `pitcherTiles` (`role === 'CL'`) | have | — |
| WAR tile, "MLB calc" | `public/data/war.json` (`scripts/gen-war.mjs`), `src/api/war.js` | have | — |
| SO caption "680 PA" | season `plateAppearances` | reshape | Add the caption to `hitterTiles` |
| W–L caption "20 GS" | season `gamesStarted` | reshape | Add the caption to `pitcherTiles` |
| AVG "Lg" figure | `leagueAverage()` (`src/api/player/leagueAverages.js`) | reshape | Call it in the tile build in `src/api/player/overview.js` |
| ERA "Lg 4.02" | not a repo figure | reshape | Use `leagueAverage(season, 'pitching')` (4.17). See Mismatches |
| Rank "N of M" (AVG, HR, RBI, IP, ERA, K) | `fetchPersonStats` `type: 'rankings'`, then `hittingRanksView` / `pitchingRanksView` (`src/api/person/stats.js`) give N | have | A rate stat reads "N of M", M the qualified players of his league (`/api/v1/stats … playerPool=qualified, leagueId=L`, `totalSplits`, one request per season and league); a counting stat reads the place only, "6th" (#1856, Gary 2026-10-13; `src/api/player/leagueRanks.js`) |

### Jump bar counts

| Count | What it counts | Source today | Status |
| --- | --- | --- | --- |
| Season 4 / 3 | MLB `yearByYear` rows | `yearByYearFor` (`src/api/player/context.js`) | have |
| Splits 4 | split sections on the card | board label, not data | — |
| Plate approach 2,881 | tracked pitches seen | sum of `pitches`, `public/data/hitter-grid/2026/30.json` | have. Label it "tracked": statsapi says 2,890 |
| Contact 418 | balls in play | `public/data/spray/2026/30.json` | have |
| Form trend 150 | games with a plate appearance | `gameLog` (151 rows, 150 with PA) | have |
| Game log 156 / 22 | games, regular season and postseason | `gameLog` with `MLB_LOG_GAME_TYPES` | have |
| Pitches 5 | pitch types over the floor | `public/data/pitch-arsenal/2026/07.json` | have |

### Pitch flight (`D2-phone`)

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Pitch types, avg mph, "1,815 pitches" | arsenal store `avgVelo`, `pitches` (`scripts/gen-pitch-arsenal.mjs`) | have | — |
| Release point, movement, extension | feed only (`coordinates`, `breaks`, `extension`); read per game in `src/api/playbyplay/pitchInfo.js` | missing | Keep per-type means in `gen-pitch-arsenal.mjs` |
| Flight time ("0.40 s") | feed `pitchData.plateTime` only | missing | Same sweep |

## Season statistics (`SeasonStats`, `SeasonStatsPitcher`)

Module issue: #1885.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Scope switch MLB / Minors / All / Postseason | rows from the sources below | have | UI only |
| MLB rows by year (every column, both roles) | `yearByYear` sportId 1 in `src/api/player/stats.js`, then `careerRegisterView` (`src/api/person/careerRegister.js`) | have | — |
| Minor-league rows by level | `fetchMilbYearByYear` (`src/api/person-fetch.js`, one call per level) | have | — |
| Level pill (AAA, AA, A+, A, ROK) | `SPORT_LABEL` (`src/lib/teams.js`) | have | — |
| Team abbreviation | `fetchTeamAbbrevs` (`src/api/person-fetch.js`) | reshape | It reads today's abbreviation ("ACL" for the 2018 "AZL Brewers"). Pass `season` to `/teams` |
| "2 TM" subtotal row | live `numTeams: 2` row; the repo drops it (`withoutMultiTeamAggregate`, `src/api/person/stats.js`) | reshape | Keep it as a subtotal row in `careerRegisterView` |
| MLB career line | `stats=career` | have | — |
| MiLB career line | per-level `career` (`src/api/person-fetch.js`) | reshape | Sum the levels with `aggregateSplits` |
| Career WAR (12.8 / 2.1) | `public/data/war-history/{NN}.json` + `war.json` | have | — |
| Postseason by year and career | `fetchPostseasonRegister` (`src/api/player/postseasonRegister.js`, `gameType=P`) | have | — |
| Tiles in each scope | same lines | have | — |
| Postseason by round | `fetchPostseasonByRound` (`src/api/player/postseasonRegister.js`, `gameLog` with `gameType=F,D,L,W`, never `P`) | have | — |
| League AVG / ERA per season (WAR popover) | `leagueAverage()` + `public/data/league-averages.json` (`scripts/gen-league-averages.mjs`) | have | Run the generator after the 2026 Final: `lastSeason` is still 2025 |
| All-Star star | `fetchAllStarRosterIds` sets `r.allStar` in `src/api/player/stats.js` | have | Render it. MLB only. Neither board player has an MLB All-Star season |
| Gap rows (injured / did not play) | `missingSeasonRows` (`src/api/person/careerRegister.js`) with IL transactions | reshape | It starts at the MLB debut. Start at the first pro season, and add a fixed "2020: no minor-league season" note |

The known gaps "All-Star star" and "gap rows" are **refuted**: the repo has both
today (`CareerRegister.jsx` draws them). Only the pre-debut range is new.

## Splits (`Splits`, `PitcherSplits`)

Module issue: #1886. Live sitCodes checked: `vl vr r0 ron risp ac bc 2s h a g t d n pH sp rp`,
batting spots `3`–`10` and days `dsu`–`dsa` all return rows. `s2` returns nothing; the code is `2s`.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Season picker (2026 … 2023) | `loadPlayerStats` uses the current season only | missing | Add a season argument to the `statSplits` calls in `src/api/player/stats.js` |
| Career option | `fetchCareerSplits` (`src/api/boxlines/careerSplits.js`, `careerStatSplits`) | reshape | Call it with `vl,vr` + `SITUATIONAL_SIT_CODES` and feed `splitsView` unchanged |
| Scope Regular / Postseason | `postseasonSplits` (`gameType=P`), `SplitsSection` | have | — |
| Scope All (regular + postseason) | none | missing | Extend `mergeCareerSplits` (`careerSplits.js`) to return OBP, SLG, SO, BB, HR, PA per sitCode |
| Hand rows: PA/BF, AVG/OBP/SLG, OPS, HR, K%, BB% | `splitsView` (`src/api/person/stats.js`) | have | — |
| Baseline row | `overallSide([vl, vr])` | have | Pitcher: vl+vr gives 463 BF, r0+ron gives 462. Pick one rule |
| Situational: empty, runners on, RISP, ahead, behind, 2 strikes | `situationalSplitsView` | have | — |
| OPS delta, best / weak flag, thin under 100 PA | none | missing | Pure helper beside `splitsView` |
| One-line reads | none (the board hard-codes one) | missing | Derive from the rows in the same helper |
| Vs team: G, PA, AVG, HR, OPS, last game | `public/data/vs-team-splits/` (`scripts/gen-vs-team-splits.mjs`, `src/api/vsTeamSplits.js`) | have | — |
| Vs team: BB% | shard `bb`, `pa` | reshape | `bb / pa` in `vsTeamSplitsFor` |
| Vs team: OBP, SLG, K% (board shows —) | not stored | missing | Emit `obp`, `slg`, `so` in `buildPlayerVs` |
| Next-opponent marker | `index.json` `nextOpponent` | have | — |
| Pitcher vs team: G, IP, ERA, K, BB | same shard | have | — |
| Game lines: home/road, grass/turf, day/night, month, weekday, pinch hit, start / relief, ballpark, batting spot, postseason | `src/api/boxlines/cardFacets.js` (`careerStatSplits`) | reshape | Doors show G, PA, AVG, HR, OPS only. Add OBP, SLG, K%, BB% to `FIELDS`, `doorCells`, `DOOR_COLUMNS` |
| Started / Substitution counts | `fetchFieldingStarts` | have | — |

## Plate approach (`PlateApproach`)

Module issue: #1887. #1846 is confirmed: the hitter grid holds what it says.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Pitches per zone cell, by pitch type and pitcher hand | `public/data/hitter-grid/{season}/{NN}.json` via `hitterCounters` (`src/api/scout/hitterGrid.js`) | have | Draw columns through `viewCol` |
| Swings, whiffs | grid `swings`, `whiffs` | have | Foul tips: the store counts them as fouls, the board as whiffs. Pick one |
| Called strikes, balls in play, the outcome bar | none | missing | Add `calledStrikes`, `inPlay` to `scripts/lib/pitch/hitter-grid.mjs` and `FIELDS` |
| In-zone count | middle nine cells (`inZone`, `src/lib/zone/zoneGeometry.js`) | reshape | Sum the nine cells |
| Avg mph per pitch type | none for hitters | missing | Add a `speedSum` counter to `hitter-grid.mjs` |
| Pitch-type chips, names, colours | `pitchMark` (`src/lib/pitch/pitchTypes.js`) | have | Do not copy the board's hex values |
| Hand chips, scope | grid `[pitcherHand]`, `reg` / `post` | have | — |
| League colour scale | `hitter-grid/{season}/league.json`, `hitterMap` (`src/screens/scout/hitterBoard.js`) | have | The board bands against himself; #1846 says against the league |
| xwOBA (est.) | `xwobaBip`, `wobaFixed`, `xwoba: true` | have | Not on the board |

## Contact (`Contact`)

Module issue: #1888.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Ball x, y, exit velocity, result, pitcher hand | `public/data/spray/` via `decodeSprayBalls` (`src/api/spray.js`) | have | — |
| Hits, XBH, HR, hard-hit, BIP totals | spray `o`, `splitTotals` | have | — |
| Pull / center / oppo | `directionMix` (`src/api/spray.js`) | have | — |
| Hard-hit 95 mph | `HARD_HIT_MPH` (`src/lib/ballpark/hitProjection.js`) | have | — |
| Park outline | spray `g` + `src/lib/ballpark/` | have | The board draws a generic field |
| Postseason balls | spray `post` | have | Not on the board |
| Launch angle (colour mode, groups, average) | none | missing | Add `launchAngle` as a column in `scripts/gen-spray.mjs` |
| Distance | none | missing | Add `totalDistance` in the same change |
| Barrel flag | none | missing | Derive from exit velocity and launch angle once stored |
| xBA per ball | `xba-table/{season}.json` | lookup on exit velocity and launch angle | A lattice like the `xwoba-table`; nothing reads it yet (#1912, part b) |
| Date, gamePk, opponent (timeline) | spray `g` merges games into park runs | missing | Write `g` as `[count, venueId, gamePk]` runs |
| Pitch type and speed, play text | none | missing | Optional columns; leave out the play text |

## Form trend (`FormTrend`)

Module issue: #1889.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Per-game AB, H, 2B, 3B, HR, BB, HBP, SF, SH, K, PA, RBI | `gameLog` via `fetchHitterForm` (`src/api/hitterForm.js`) | have | — |
| Rolling OPS (10 / 15 / 20 games), best and worst stretch | `hitterFormWindows` gives last 7 / 15 / 30 only | reshape | Add a pure `rollingSeries(log, w)` in `hitterForm.js` |
| Season OPS reference rule | season stat | have | — |
| Opponent label | `gameLog` `opponent`, `isHome` | reshape | Abbreviation from the teams table |
| HR marks, K / BB stretch bars | `gameLog` | have | — |
| wOBA | not in `gameLog`; no weights in the repo | missing | Not needed: the board uses OPS |

## Batter game log (`BatterGameLog`)

Module issue: #1890.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Rows, date, vs / at, opponent, gamePk | `gameLog` with `MLB_LOG_GAME_TYPES` | have | Sort by date, then `game.gameNumber` |
| Postseason tag (NLDS), filter, counts | split `gameType`, `seriesAbbr()` (`src/api/person/gameLog.js`) | reshape | `seriesAbbr` gives "DS"; add the league prefix |
| Result and score ("W 14–2") | `gameLog` has `isWin` only | reshape | One schedule call per season, joined on `gamePk` |
| Position (2B, PH/2B) | split `positionsPlayed` | have | Join with "/" |
| AB R H 2B 3B HR RBI BB K SB HBP SF, AVG | split `stat` | have | — |
| Total tiles (G, AVG, OBP, SLG, HR, RBI) | sum of splits | have | — |
| Pitches seen | split `numberOfPitches` | have | — |
| Fouls and whiffs per game | game feed only | missing | Add per-game `[pitches, fouls, whiffs]` to the batter row in `scripts/gen-fouls.mjs` |

## Pitcher game log (`GameLog`)

Module issue: #1851. The start detail view is in #1851 and
`.scratch/player-pitcher-redesign/notes.md`.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Rows, date, vs / at, opponent logo | pitching `gameLog`, `teamLogoUrl(opponent.id)` | have | — |
| Decision W / L / ND | split `wins`, `losses` | have | — |
| IP, H, R, ER, BB, K, HR, pitches, strikes | split `stat` | have | — |
| Total tiles | sum of splits | have | — |
| Postseason tag, filter | split `gameType` | reshape | Same as the batter log |
| Result and score ("L 3–11") | not in `gameLog` | reshape | Schedule with `hydrate=decisions`, joined on `gamePk` |
| Pitch mix per start (FF / SI / FC / ST / CH bar) | arsenal store is season-level only | missing | Emit a per-game mix `{gamePk: {code: n}}` in `scripts/gen-pitch-arsenal.mjs` |
| Start detail: per-start mph, whiffs | game feed | reshape | Fetch on open, or the per-game arsenal rows |
| Start detail: strikeouts, big plays, clips | feed `allPlays`, `/game/{pk}/content`, Savant clip | reshape | Fetch on open (one game) |

## Foul balls (`FoulBalls`)

Module issue: #1891. Data issue: #1881 (body refined by this audit).

`scripts/gen-fouls.mjs` (`aggregateGameFouls`) reads the full live feed. Each pitch
has its post-pitch `count` and `details.call.code`. The script already carries the
pre-pitch strike count. It does not carry balls and counts no batter swings. The
hitter grid has swings but no count axis, and it skips untracked pitches. So the
foul generator is the right place.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| PA that reach each of the 12 counts | none | missing | Carry `preBalls` beside `preStrikes`; record the counts each PA reaches |
| Fouls in each count | `fouls`, `twoStrikeFouls` totals only | missing | 12-cell `fouls` array on the pre-pitch count |
| Swings in each count, fouls per swing | none | missing | 12-cell `swings` (whiff + foul + in play codes, the hitter-grid rule) |
| How those at-bats ended (hit, walk, strikeout, out in play) | none | missing | Credit `eventType` to every count the PA reached |
| League fouls per swing by count | `fouls.json` `league.totals` (pitches, fouls) | missing | Sum the same arrays into `league.byCount` |
| Season fouls per PA | `fouls/{season}/{NN}.json` `fouls`, `pa` | have | — |
| Season fouls per swing | swings missing | missing | Sum the by-count swings |
| Most fouls in one at-bat | `bestPa.fouls` | have | Define the league figure (median or max) |

## Pitch arsenal (`ArsenalReveal`)

Module issue: #1892. Data issue: #1908.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Pitch list, usage %, count | `public/data/pitch-arsenal/{season}/{NN}.json`, `arsenalMixRows` (`src/api/pitchArsenal.js`) | have | Use the store, not Savant usage |
| Avg and max mph | same store | have | — |
| Usage vs L / vs R | `vs.L`, `vs.R`, `arsenalSidesView` | have | — |
| Spin rpm | feed `breaks.spinRate` only | missing | Per-type sums in `aggregateGamePitchTypes` (`scripts/gen-pitch-arsenal.mjs`) |
| Flight time | feed `plateTime` only | missing | Same sweep |
| Drop / movement, release point | feed `breaks`, `coordinates`, `extension` only | missing | Same sweep |
| Zone mark per pitch | `public/data/pitch-command/{season}/{NN}.json` (25 cells) | reshape | Cell-centroid helper beside `heatView` |
| Whiff % per pitch | pitch-command `whiffs` / `swings` | reshape | Sum the cells in `src/api/pitchArsenal.js` |
| xwOBA per pitch | `gen-savant-matchup.mjs` drops `est_woba` | missing | Keep it in `pitcherArsenalMap` |

## On the mound (`MoundCard`)

Module issue: #1893.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Last outings: date, pitches, start or relief | `public/data/workload.json` `apps` (last 12), `scripts/gen-workload.mjs`, `foldGameLog` (`src/api/workload.js`) | have | — |
| Days since last start, usual gap | `turnStripFor` | have | — |
| Bullpen 14-day strip | `dayStripFor` | have | — |
| Opponent, vs / at, opponent logo | not in `apps` | missing | Store opponent id, `isHome`, `gameType`, `gamePk` per app in `foldGameLog` |
| Postseason tag ("NLDS") | `gameType` | reshape | Same rule as the game logs |
| "Averages N pitches per start" | `moundRateFor().pitchesPerStart` | reshape | Bug: it divides all pitches, relief too, by starts. Keep starter-only pitches |
| A past week (Ashby, May 9–15) | store keeps the last 12 apps only | reshape | Board demo only. A past date needs the live `gameLog` |

The opponent-logo gap is **confirmed**: the board circles are placeholders, and the
store has no opponent.

## Path to the Majors (`PathToMajors`, `PathProspect`)

Module issue: #1894.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Levels reached, years, "Here now" | `levelProgressionView` + `dropRehabStints` (`src/api/person/careerRegister.js`) | have | — |
| Games per level | the view gives AB or IP | reshape | Add `games` (sum of `gamesPlayed`) per level |
| Club and logo per level | `careerTimelineView` has teams per stint | reshape | Add `teams: [{id, name, games}]` per level |
| MLB games, minors total | `yearByYear` sums | have | Sum in the same view |

## Firsts (`Firsts`)

Module issue: #1895.

| Field | Source today | Status | Fix |
| --- | --- | --- | --- |
| Debut, first hit, XBH, HR, run, SO; pitcher start, W, L, SV, SO | `FIRSTS_DEFS`, `PITCHER_FIRSTS_DEFS`, `firstsFromGameLog` (`src/api/person/gameLog.js`), loaded in `src/api/player/history.js` | have | — |
| Dates (m/d/yy) | event `date` | have | UI format |
| Opponent logo | `history.js` has `awayId` / `homeId` but outputs only `oppAbbr` / `oppName` | reshape | Add `oppId`; logo from `teamLogoUrl(oppId)` |

## Mismatches: board against live data

Most board figures match. These do not:

- **Ids.** The brief's ids were wrong (see Player ids). The board data is for the right players.
- **Turang 2026 postseason.** The board misses the 2026-10-12 game. Live: 6 G, 21 AB, .238, 5 H, 5 BB, 4 SO, 2 RBI (board 5 G, .167). Game log is 157 rows, not 156. Every postseason split row is one game behind.
- **Hero ERA "Lg 4.02"**: live MLB ERA is 4.17 (the SeasonStats popover uses 4.17). 4.02 is the ERA of pitchers with 15 or more starts.
- **Hero "125 of 153", "68 of 153"**: the pool is MLB pitchers with 15+ starts. #1856 says qualified players in his league, top 10 only. Gasser is not qualified, so he gets no rank.
- **Pitch flight**: "Ten sliders are left out", but the store has 3 SL. Cutter 88.5 mph against 88.4 in the store.
- **Arsenal usage**: the board uses Savant usage (FF 23.2, SI 22.6, FC 18.1). The store gives FF 23.4, SI 22.5, FC 18.3, CH 10.3 of 1,815 pitches.
- **Firsts, pitcher**: the board read only the 2026 log. Live: debut, first start, first win and first strikeout are all 5/10/24 vs STL; first loss is 9/21/25 at STL.
- **MoundCard "Averages 91 pitches per start"**: starter-only figure is 86.8. The app has the same bug.
- **Path to the Majors, Turang ROK**: 42 G is right, but it is 13 G at AZL Brewers and 29 G at Helena. The board shows Helena only. Season statistics prints "ACL" for 2018; the 2018 club was "AZL Brewers".
- **Form trend**: 151 games live, the board has 150 (it drops a 0-PA game on 2026-09-19). Best 15-game stretch: 1.227 live, 1.214 on the board.
- **Doubleheaders**: the game log and form trend boards swap game 1 and game 2 on 04-04, 07-07 and 07-11.
- **Plate approach**: whiffs 288 on the board, 256 in the store (foul tips). Hand split L 874 / R 2007 against 872 / 2009. Cell counts do not match the repo's grid. The board drops KC, SV, EP and three one-pitch types (69 pitches).
- **Foul balls**: the board says sample numbers, and they are far from the store. Store: 573 regular-season fouls (board 362), 0.85 per PA (board 0.53), most in one at-bat 6 (board 7). Real fouls per swing is about 46%, not 24.5%.
- **Splits, Gasser**: two K% / BB% rows round .5 down (12% against 13%). The weekday doors omit the postseason; the repo includes it. "30 clubs" should be 29.

## Known gaps: verdict

| Gap | Verdict |
| --- | --- |
| League rank on the hero tiles (#1856) | Confirmed. N exists (`rankings`), M does not |
| Foul balls by count (#1881) | Confirmed. Extend `gen-fouls.mjs`, not the hitter grid |
| All-Star star in Season statistics | Refuted. `r.allStar` exists |
| Gap rows in Season statistics | Mostly refuted. They exist from the MLB debut on |
| Opponent logos in On the mound | Confirmed. `workload.json` has no opponent |
| Batter visual data (#1846) | Confirmed. Launch angle, distance and game dates are not in the spray store |
| Pitcher game log (#1851) | Rows have. Per-start pitch mix and score are missing |

## Summary of gaps

Each gap has one data issue, a sub-issue of #1878 that blocks its module issue. Gap 1 also
needs #1856 (the rank pool) and gap 10 uses the older #1881.

1. **Hero tiles** (#1907, blocks #1884): league figure and captions on the tiles; the rank pool M stays with #1856.
2. **Pitch movement** (#1908, blocks #1892): spin, flight time, movement, release point and extension per pitch type in `gen-pitch-arsenal.mjs`; per-pitch whiff %, zone mark and xwOBA. Pitch flight belongs to the Pitch arsenal module, not the hero (Gary, 2026-10-13).
3. **Season statistics** (#1909, blocks #1885): "2 TM" subtotal, MiLB career line, gap rows before the debut, season-correct abbreviations.
4. **Splits** (#1910, blocks #1886): season picker, Career and All scopes, vs-team OBP / SLG / K%, more door columns, deltas and reads.
5. **Plate approach** (#1911, blocks #1887): called strikes, balls in play and speed in the hitter grid; whiff rule.
6. **Contact** (#1912, blocks #1888): spray store with launch angle, distance and per-game runs.
7. **Form trend** (#1913, blocks #1889): rolling series helper; 0-PA and doubleheader rule.
8. **Batter game log** (#1914, blocks #1890): per-game fouls and whiffs; score and series name; doubleheader order.
9. **Pitcher game log** (#1915, blocks #1851): per-start pitch mix; score.
10. **Foul balls** (#1881, blocks #1891): by-count counters in `gen-fouls.mjs`.
11. **On the mound** (#1916, blocks #1893): opponent on workload apps; pitches-per-start bug.
12. **Path to the Majors** (#1917, blocks #1894): games and clubs per level.
13. **Firsts** (#1918, blocks #1895): opponent id.
