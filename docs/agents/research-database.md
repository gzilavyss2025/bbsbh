# The research database

`scripts/research-db.mjs` is the first thing a research spike opens. It is a
local DuckDB layer over the JSON panels that earlier spikes wrote under
`.scratch/` and `public/data/`. It copies no data. It never runs in the app, in
CI or on Vercel. The JSON files stay the source of truth (ADR-0065).

## The rule

**Before a spike pulls anything from statsapi, query what exists.**

1. Read the catalog below. Find the panel with the season, club or player grain
   you need.
2. Query it: `node scripts/research-db.mjs --sql "SELECT ... FROM <view> LIMIT 5"`.
3. Pull from statsapi only when no panel covers the question, or when the
   question needs newer data than the panel holds. Say which in the spike's
   write-up.

The rule is stated where spikes start: `docs/agents/research-diary.md`,
`docs/agents/contender-diary.md`, `docs/team-success-research.md`, and the two
reminder hooks in `.claude/hooks/`.

## Commands

```
node scripts/research-db.mjs                     # rebuild every view, run the smoke join
node scripts/research-db.mjs --sql "SELECT ..."  # rebuild, run one query, print the rows
node scripts/research-db.mjs --markdown          # rebuild, print every view with its row count
node scripts/research-db.mjs --uncovered         # list tracked JSON that is not a view (no build)
```

A rebuild takes a few seconds. It drops every view first, so a view whose path
left the list does not stay behind. `.scratch/research.duckdb` holds view
definitions only. Git ignores it.

To query from a script, open the same file:

```js
import { DuckDBInstance } from '@duckdb/node-api';
const instance = await DuckDBInstance.create('.scratch/research.duckdb');
const conn = await instance.connect();
const rows = await conn.runAndReadAll('SELECT * FROM team_success_outcome_ladder_by_team LIMIT 5');
```

## How to read the catalog

Most panels are wrapped: one JSON object with a `generatedAt` and a nested
table. Such a view has one row and nested columns. When the nested table is the
data, the loader adds a `<view>__<column>` view with one row per record. Use
that one. The others are reports: read them with `to_json(column)` or
`unnest(column)`.

- **Grain** says what one row is. `1 report` means one row of nested columns.
- **Source** is the file. A glob means many files read as one view.
- Row counts are not written here, because the nightly runs change them. Run
  `--markdown` for the live count.
- Wide views (one column per year or per key) are marked "Awkward". Query them
  with `to_json(column)` or `unnest(column)`.
- The two `_by_team` views use a hand-written schema. All other views use the
  file's own shape.

## Catalog

### Team success: outcomes and roster (Contender Diary)

The frame is the outcome ladder (0 = missed the postseason, 5 = won the World Series). Join the `_by_team` views on `year` and `teamId`.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `team_success_outcome_ladder_by_team` | `.scratch/team-success/outcome-ladder.json` (explicit schema) | One club-season (`year`, `teamId`), 2000-2025 | How far did each club go in October? Ladder rung, seed, division title, furthest round. |
| `team_success_outcome_ladder` | `.scratch/team-success/outcome-ladder.json` | 1 report (nested `seasons`, 26 seasons) | The raw ladder file: the rung definitions (`ladderKey`) and the champion of each season. |
| `team_success_roster_age_by_team` | `.scratch/team-success/roster-age.json` (explicit schema) | One club-season (`year`, `teamId`), 2000-2025 | How old was a club's batting and pitching, alone and against its league? Weighted by PA and IP. |
| `team_success_roster_age` | `.scratch/team-success/roster-age.json` | 1 report (nested `seasons`) | The raw roster-age file, with the league averages per season. |
| `team_success_roster_age_cache` | `.scratch/team-success/roster-age-cache.json` | One player on one club-year-group, keyed `hitting-{teamId}-{year}` | Who was on the roster, at what age and weight? The input behind the roster-age view. |
| `team_success_roster_age_deadline` | `.scratch/team-success/roster-age-deadline.json` | 1 report (nested `seasons`, then `teams`) | Roster age measured at the trade deadline, not the season total. Read with `unnest(seasons)`. |
| `team_success_roster_age_deadline_cache` | `.scratch/team-success/roster-age-deadline-cache.json` | One player on one club-year-group | Who was on the roster on deadline day, and at what weight? |
| `team_success_postseason_experience` | `.scratch/team-success/postseason-experience.json` | 1 report (nested `seasons`, then `teams`) | How much October experience did each club carry into a postseason? Read with `unnest(seasons)`. |
| `team_success_postseason_usage` | `.scratch/team-success/postseason-usage.json` | 1 report (nested `seasons`, then `teams`) | Who played in October, and how much? PA and IP per player per club. |
| `team_success_postseason_boxscore_cache` | `.scratch/team-success/postseason-boxscore-cache.json` | One postseason game, keyed by `gamePk`, 939 games | Who batted and pitched in each October game of the ladder window? The input behind postseason usage. |
| `team_success_prior_postseason_cache` | `.scratch/team-success/prior-postseason-cache.json` | 1 wide row (`games` map, plus one `sched-{year}` column for 1969-2025) | The schedule fetches behind the prior-postseason read. Use the `__games` view for the games. |
| `team_success_prior_postseason_cache__games` | `.scratch/team-success/prior-postseason-cache.json` | One postseason game, keyed by `gamePk`, 555 games | Who played in each earlier postseason game? Used to build a club's October history before 2000. |
| `team_success_october_texture_findings` | `.scratch/team-success/october-texture-findings.json` | 1 report (nested) | What did October rosters look like in play, and did any of it predict a deep run? The result tables of that spike. |
| `team_success_trade_deadline_panel__panel` | `.scratch/team-success/trade-deadline-panel.json` | One club-season (`year`, `teamId`), 2021-2025, 150 rows | What did a club take in and send out at the deadline, in WAR, net? |
| `team_success_trade_deadline_panel` | `.scratch/team-success/trade-deadline-panel.json` | 1 report (`panel`, `findings`, `missingWarPlayers`) | The whole deadline spike. The result numbers sit in `findings`. |
| `team_success_trade_deadline_panel__missingwarplayers` | `.scratch/team-success/trade-deadline-panel.json` | One traded player with no WAR row | Which deadline players could not be priced, and so left the totals? |
| `team_success_tenure_lag_panel__panel` | `.scratch/team-success/tenure-lag-panel.json` | One club-season (`year`, `teamId`), 2013-2023, 104 rows | How long do a club's players sit at Triple-A (`tenureLagDays`), and how deep is the incumbent bench above them (`depthMean`)? |
| `team_success_tenure_lag_panel` | `.scratch/team-success/tenure-lag-panel.json` | 1 report (`panel`, `diagnostics`, `findings`) | The whole tenure-lag spike. The fitted models sit in `findings`. |
| `team_success_exit_reason_mix__orgseasons` | `.scratch/team-success/exit-reason-mix.json` | One club-season with at least one Triple-A exit (`season`, `teamId`), 2009-2023, 359 rows. A club-season with no exit has no row. | Why did a club's Triple-A players leave: merit, roster rule, injury or trade? Counts and merit share. |
| `team_success_exit_reason_mix__rows` | `.scratch/team-success/exit-reason-mix.json` | One Triple-A stay that ended (`playerId`, `season`) | For each Triple-A stay, which reason ended it? |
| `team_success_exit_reason_mix__orgs` | `.scratch/team-success/exit-reason-mix.json` | One club, 2009-2023 | Which farm systems promoted most on merit over the whole run? |
| `team_success_exit_reason_mix` | `.scratch/team-success/exit-reason-mix.json` | 1 report (`rows`, `orgSeasons`, `orgs`) | The raw exit-reason file. Use the three `__` views. |
| `team_success_exit_reason_mix_findings` | `.scratch/team-success/exit-reason-mix-findings.json` | 1 report (nested) | Did merit share predict October? The cuts and the fitted models. |
| `team_success_first_club_cache__results` | `.scratch/team-success/first-club-cache.json` | One split player-season, keyed `{year}|{playerId}` | For a man who played for two clubs in a year, which club did he play for first? |
| `team_success_first_club_cache` | `.scratch/team-success/first-club-cache.json` | 1 report (`results` map) | The first-club lookup, with its method note and coverage counts. |
| `team_success_mlb_field_cache` | `.scratch/team-success/mlb-field-cache.json` | 1 wide row (one column per year, each a list of `{p, t, pos, gs, g}`) | Who played which position, with how many starts, on each MLB club by year? Awkward: `unnest("2019")`. |
| `team_success_milb_field_cache` | `.scratch/team-success/milb-field-cache.json` | 1 wide row, same shape, minors | The same fielding table for the minor leagues. |

### Team success: money (Contender Diary)

These read `contracts-history` for dollars and the WAR files for value. The payroll rules panel is the R1-R4 attribution check.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `team_success_free_agency_market__players` | `.scratch/team-success/free-agency-market.json` | One free-agent signing (`rowKey`), 1991-2026, 5,598 rows | Did a signing overpay against what WAR had been buying? Age, position, qualifying offer, prior WAR. |
| `team_success_free_agency_market` | `.scratch/team-success/free-agency-market.json` | 1 report (`players` array) | The raw market file, with its exclusion counts. |
| `team_success_free_agency_market_findings` | `.scratch/team-success/free-agency-market-findings.json` | 1 report (nested) | Who overpays: by age, by position, by contract length? The result tables. |
| `team_success_payroll_by_player__rows` | `.scratch/team-success/payroll-by-player.json` | One player-season-club (`season`, `teamId`, `mlbId`), 2000-2025 | How many dollars did each club carry for each player? Salary split by time on the club. |
| `team_success_payroll_by_player` | `.scratch/team-success/payroll-by-player.json` | 1 report (`rows` array) | The raw payroll-by-player file, with the split rule. |
| `team_success_payroll_panel` | `.scratch/team-success/payroll-panel.json` | 1 report (nested `seasons`) | How much of each season's salary could be pinned to a club? Coverage by season and pay regime. |
| `team_success_payroll_rules_panel` | `.scratch/team-success/payroll-rules-panel.json` | 1 report (nested `seasons`, then `teams`) | Does the payroll ranking change with the attribution rule (R1 to R4)? Team ranks under each. |
| `team_success_payroll_rules_findings` | `.scratch/team-success/payroll-rules-findings.json` | 1 report (nested) | Did the four rules agree on club rank? The gate checks and the clubs that moved more than three places. |
| `team_success_dead_money_panel__rows` | `.scratch/team-success/dead-money-panel.json` | One paid player-season with no appearance (`season`, `mlbId`), 2000-2025, 1,178 rows | Whose salary bought nothing on the field, and which club paid it? |
| `team_success_dead_money_panel` | `.scratch/team-success/dead-money-panel.json` | 1 report (`rows` array) | The raw dead-money file, with the attribution rule. |
| `team_success_paid_no_appearance__rows` | `.scratch/team-success/paid-no-appearance.json` | One paid player-season with no appearance, 1,178 rows | The plain list before club attribution: who was paid and never played? |
| `team_success_paid_no_appearance` | `.scratch/team-success/paid-no-appearance.json` | 1 report (`rows` array) | The raw file behind the dead-money panel. |

### Contracts

`identity` says who a row is. `terms` says what the deal was. They join 1:1 on `rowKey`: 36,366 rows each side.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `public_contracts_history_identity_arbitration` | `public/data/contracts-history/identity/arbitration.json` | One arbitration case (`rowKey`) | Which MLB player was each arbitration row? `mlbId` and `confidence`. |
| `public_contracts_history_identity_extensions` | `public/data/contracts-history/identity/extensions.json` | One extension (`rowKey`) | Which MLB player signed each extension? |
| `public_contracts_history_identity_free_agency` | `public/data/contracts-history/identity/free_agency.json` | One free-agent signing (`rowKey`) | Which MLB player signed each free-agent deal? |
| `public_contracts_history_identity_salaries` | `public/data/contracts-history/identity/salaries.json` | One salary line (`rowKey`) | Which MLB player drew each salary line? The biggest table: 27,349 rows. |
| `public_contracts_history_terms` | `public/data/contracts-history/terms/*.json` | One contract row (`key` = `rowKey`) | What were the dollars, years and options of each deal? `terms` holds them; text values are JSON. |
| `public_contracts_history_season_players` | `public/data/contracts-history/season-players/*.json` | One player-season candidate | Who was on an MLB roster in a season? The pool the identity match draws from. |
| `public_contracts_history_player` | `public/data/contracts-history/player/*.json` | 1 row per shard, 100 rows | The same deals grouped by player. Deferred: see the note below the catalog. |
| `public_contracts_history_player__players` | `public/data/contracts-history/player/*.json` | One contract row, grouped by player | The same deals grouped by player. Deferred: a full scan throws. |
| `contracts_arbitration_warp_panel__rows` | `.scratch/contracts/arbitration-warp-panel.json` | One arbitration case (`rowKey`), 2018-2026, 2,420 rows | What did the player earn in WAR around the case? Salary, club, `mlbId`, WAR window. |
| `contracts_arbitration_warp_panel` | `.scratch/contracts/arbitration-warp-panel.json` | 1 report (`rows` array) | The raw arbitration panel, with its skip counts. |
| `contracts_arbitration_findings` | `.scratch/contracts/arbitration-findings.json` | 1 report (`partOne`, `partTwo`, `partThree`) | What do arbitration cases price per WAR? The three result blocks. |
| `contracts_extensions_extension_outcomes__outcomes` | `.scratch/contracts-extensions/extension-outcomes.json` | One extension (`rowKey`), 864 rows | Did an extension pay off? Age and service time at signing, the years, the WAR that followed. |
| `contracts_extensions_extension_outcomes` | `.scratch/contracts-extensions/extension-outcomes.json` | 1 report (`outcomes` array) | The raw extension file, with the exclusion counts. |
| `contracts_extensions_fa_war_price` | `.scratch/contracts-extensions/fa-war-price.json` | 1 report (`bySeason`, one column per year 1991 on) | What did a win cost in free agency each season? Dollars per WAR, slope and intercept. |

### Level benchmarks and homegrown dependence (prospect research)

The cohort is 3,061 MLB debutants, keyed by MLB id. Many files here are per-player caches keyed by id.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `level_benchmarks_raw` | `.scratch/level-benchmarks/raw.json` | One debutant (`key` = MLB id), 3,061 rows | Who is in the cohort, and what was his path? Debut date, pedigree, minor-league stops. |
| `level_benchmarks_dates` | `.scratch/level-benchmarks/dates.json` | 1 report (`allDurations`, `allPromotionDates`, `byLevel`) | How many days did each stay at A, High-A, AA and AAA last? Promotion dates. Read with `unnest(allDurations)`. |
| `level_benchmarks_findings` | `.scratch/level-benchmarks/findings.json` | 1 report (nested) | How long is a typical stay at each level? The benchmark result, with pedigree and school-type splits. |
| `level_benchmarks_team_windows` | `.scratch/level-benchmarks/team-windows.json` | 1 report (`byLevel`) | Can we give each club a movement range for a level? The per-club window file. Empty at level A. |
| `level_benchmarks_milb_cohort_cache` | `.scratch/level-benchmarks/milb-cohort-cache.json` | One minor-league stop for a cohort player (`key` = MLB id), 3,058 players | Which club and level did each man play for, by season? |
| `level_benchmarks_milb_mlb_cache` | `.scratch/level-benchmarks/milb-mlb-cache.json` | One stop for a man who reached MLB (`key` = MLB id), 5,870 men, 89,791 rows | The same stop list for a wider pool of MLB-reached players. |
| `level_benchmarks_perf_pool` | `.scratch/level-benchmarks/perf-pool.json` | 1 wide row (one column per `level:year:group`) | What did the level's other players hit or pitch? Awkward: read with `unnest`. |
| `level_benchmarks_draft_cache` | `.scratch/level-benchmarks/draft-cache.json` | One cohort player (`key` = MLB id) | When and where was he drafted? `draftYear` and `drafts`. |
| `level_benchmarks_orgmap_ext` | `.scratch/level-benchmarks/orgmap-ext.json` | One club-season (`key` = `teamId:year`) | Which parent organization did a club belong to, 1999 on? `value` = `[orgId, name]`. |
| `level_benchmarks_orgmap_wide` | `.scratch/level-benchmarks/orgmap-wide.json` | One club-season (`key` = `teamId:year`) | The same map reaching back to 1984. |
| `level_benchmarks_teamstats_cache` | `.scratch/level-benchmarks/teamstats-cache.json` | One player-club-season-group stat line (`key` = `teamId:year:group`) | Who carried the volume for a club? `vol` per player. |
| `level_benchmarks_standings_cache` | `.scratch/level-benchmarks/standings-cache.json` | One club-season (`key` = `teamId:year`), 600 rows | What was a club's record? Wins, losses, win percent. |
| `level_benchmarks_attendance_cache` | `.scratch/level-benchmarks/attendance-cache.json` | One club-season (`key` = `teamId:year`), 600 rows | What was a club's home attendance? |
| `level_benchmarks_context_panel` | `.scratch/level-benchmarks/context-panel.json` | 1 report (`meta`, `orgIds`, `seasons`, `standings`, `attendance`) | The two caches above, joined into one context file. |
| `level_benchmarks_context_panel__standings` | `.scratch/level-benchmarks/context-panel.json` | One club-season, 600 rows | Same rows as the standings cache. |
| `level_benchmarks_context_panel__attendance` | `.scratch/level-benchmarks/context-panel.json` | One club-season, 600 rows | Same rows as the attendance cache. |
| `level_benchmarks_homegrown_cohort` | `.scratch/level-benchmarks/homegrown-cohort.json` | 1 report (`meta`, `perOrg`, `resolved`, `unresolved`, `draftCheck`) | Which organization did each debutant come from? Coverage and the draft cross-check. |
| `level_benchmarks_homegrown_cohort__resolved` | `.scratch/level-benchmarks/homegrown-cohort.json` | One debutant with a resolved first organization (`key` = MLB id), 3,029 rows | Which org and level did he enter pro ball with? |
| `level_benchmarks_homegrown_panel__panel` | `.scratch/level-benchmarks/homegrown-panel.json` | One club-season (`orgId`, `season`), 2004-2023, 600 rows | How much of a club's MLB play came from its own farm? Homegrown share beside win percent and attendance. |
| `level_benchmarks_homegrown_panel` | `.scratch/level-benchmarks/homegrown-panel.json` | 1 report (`meta`, `panel`) | The raw homegrown panel. |
| `level_benchmarks_homegrown_outcomes` | `.scratch/level-benchmarks/homegrown-outcomes.json` | 1 report (nested) | Do clubs that lean on their own players get better players? The outcome models. |
| `level_benchmarks_homegrown_winning` | `.scratch/level-benchmarks/homegrown-winning.json` | 1 report (nested) | Do clubs that lean on their own players win more? The winning models. |
| `level_benchmarks_homegrown_duration_model` | `.scratch/level-benchmarks/homegrown-duration-model.json` | 1 report (nested) | Does homegrown share change how long a stay lasts? |
| `level_benchmarks_homegrown_precheck` | `.scratch/level-benchmarks/homegrown-precheck.json` | 1 report (nested) | Was the homegrown-share signal real before modelling? Within- and between-org checks. |
| `level_benchmarks_era_hump` | `.scratch/level-benchmarks/era-hump.json` | 1 report (nested) | Did promotions slow in 2016-2020? The artifact checks that found the slowdown was mostly the ruler. |
| `level_benchmarks_era_hump_org_recheck` | `.scratch/level-benchmarks/era-hump-org-recheck.json` | 1 report (`published`, `specs`) | Does the organization effect survive once the era artifact is fixed? The rerun of the org test. |
| `level_benchmarks_org_regression` | `.scratch/level-benchmarks/org-regression.json` | 1 report (`orgEffects`, `levelEffects`, `tierEffects`) | Does an organization speed or slow a promotion, all else equal? The main fit, per org. |
| `level_benchmarks_org_regression_perf` | `.scratch/level-benchmarks/org-regression-perf.json` | 1 report (`baseline`, `augmented`, `shifts`) | Does the org effect change when performance is controlled? |
| `level_benchmarks_org_regression_transform_levels` | `.scratch/level-benchmarks/org-regression-transform-levels.json` | 1 report (same shape as `org_regression`) | The org fit with duration in raw days. |
| `level_benchmarks_org_regression_transform_log` | `.scratch/level-benchmarks/org-regression-transform-log.json` | 1 report (same shape) | The org fit with duration in log days. |
| `level_benchmarks_org_regression_transform_sqrt` | `.scratch/level-benchmarks/org-regression-transform-sqrt.json` | 1 report (same shape) | The org fit with duration as a square root. |
| `level_benchmarks_org_omnibus_transform_check` | `.scratch/level-benchmarks/org-omnibus-transform-check.json` | 1 row (`log`, `levels`, `sqrt`) | Does the all-orgs test give the same answer under each transform? R2, F and p for each. |
| `level_benchmarks_org_era_granularity` | `.scratch/level-benchmarks/org-era-granularity.json` | 1 report (`eraSplit`, `eraEffects`, ...) | Does the era split change the org result? Three eras. |
| `level_benchmarks_org_timing` | `.scratch/level-benchmarks/org-timing.json` | 1 report (`aaRows`, `aaaRows`, `buckets`) | Do promotions bunch at some times of year? Counts by month bucket. |
| `level_benchmarks_org_variance_components` | `.scratch/level-benchmarks/org-variance-components.json` | 1 report (nested) | How much of the spread in stay length is club, era or noise? Variance components. |

### Prospect traits (prospect research)

Same 3,061-man cohort. Files keyed by MLB id give one row per player; `q*` files are result reports.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `prospect_traits_bio` | `.scratch/prospect-traits/bio.json` | One debutant (`key` = MLB id), 3,061 rows | How big is he, and where is he from? Height, weight, hand, birth date and country. |
| `prospect_traits_awards` | `.scratch/prospect-traits/awards.json` | One award (`key` = MLB id), 21,375 rows | Which awards had he won before the majors, and when? |
| `prospect_traits_award_catalog` | `.scratch/prospect-traits/award-catalog.json` | One award type, 682 rows | What is each award id? Name, description and league. |
| `prospect_traits_mlb` | `.scratch/prospect-traits/mlb.json` | One MLB player-club-season (`key` = MLB id), 24,084 rows | How did he do in each MLB season? Age, games and the stat line. |
| `prospect_traits_arsenal` | `.scratch/prospect-traits/arsenal.json` | One pitcher-season (`key` = MLB id), 1,690 rows | What pitches did he throw? `pitches` lists each type. |
| `prospect_traits_league` | `.scratch/prospect-traits/league.json` | 1 wide row (one column per `year:group`) | What was the league average each year, for hitters and pitchers? Awkward: `to_json("2019:hitting")`. |
| `prospect_traits_q1_rookie_traits` | `.scratch/prospect-traits/q1-rookie-traits.json` | 1 report (`meta`, `comparisons`, `regressions`) | Is there anything in a rookie's minor-league record that foretold a good first year? |
| `prospect_traits_q1b_confounds` | `.scratch/prospect-traits/q1b-confounds.json` | 1 report (`pitchers`, `hitters`, `ageByRole`) | Do age and role explain the Q1 result? |
| `prospect_traits_q2_size` | `.scratch/prospect-traits/q2-size.json` | 1 report (`byGroup`, `results`) | Does a player's size change how long he sits in the minors? |
| `prospect_traits_q2b_size_robustness` | `.scratch/prospect-traits/q2b-size-robustness.json` | 1 report (nested) | Does the size result hold by quintile, band, era and leave-one-out? |
| `prospect_traits_q3_pitchers` | `.scratch/prospect-traits/q3-pitchers.json` | 1 report (`handRows`, `veloRows`, `repRows`) | For pitchers, do throwing hand, speed or a wide pitch mix get a man up sooner? |
| `prospect_traits_q4_debut_month` | `.scratch/prospect-traits/q4-debut-month.json` | 1 report (nested) | Do the best prospects get called up at a particular time of year? |
| `prospect_traits_q4b_month_checks` | `.scratch/prospect-traits/q4b-month-checks.json` | 1 report (nested) | Does the debut-month result survive the prior-table and cut checks? |
| `prospect_traits_q5_final_four` | `.scratch/prospect-traits/q5-final-four.json` | 1 report (nested) | Were the farm systems of the four clubs in the Championship Series doing anything the other 26 were not? |

### Prospect value and top-prospect lists (prospect research)

`mlbId` joins to `prospect_traits_bio`. Every `top_prospects_history_rows` row has a `source`: never pool `mlb-pipeline` and `baseball-america` without a filter.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `top_prospects_history_rows` | `.scratch/top-prospects-history/rows.json` | One list slot (`season`, `rank`, `mlbId`), 2005-2024, two `source` values | Who was ranked where on the top-prospects list each year? |
| `top_prospects_history_seasons` | `.scratch/top-prospects-history/seasons.json` | One season, 2005-2024 | How deep is each year's list, and was it available? Status, depth, row count. |
| `top_prospects_history_ba_non_debuts` | `.scratch/top-prospects-history/ba-non-debuts.json` | One ranked name that never debuted (BA lists) | Which top-prospect names had no MLB debut, so no id? |
| `prospect_value_panel` | `.scratch/prospect-value/panel.json` | One player (`mlbId`), 3,253 rows | What was a ranking worth in dollars? Peak rank, career earnings and `windowStatus`. Filter to `observed-deep` before you compare ranked and unranked. |
| `prospect_value_panel_meta` | `.scratch/prospect-value/panel-meta.json` | 1 report | How was the panel built? Rank window, salary audit, counts. |
| `prospect_value_bios` | `.scratch/prospect-value/bios.json` | One ranked player (`key` = MLB id), 757 rows | Birth date, debut date and position of a ranked player. 564 of them are in the debut cohort. |
| `prospect_value_findings` | `.scratch/prospect-value/findings.json` | 1 report (nested) | Is a top ranking worth more in career pay? The result tables. |

### Service clock (call-up timing)

One row per MLB debut, 2005-2025. 2020 is flagged `excludedSeason`.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `service_clock_panel` | `.scratch/service-clock/panel.json` | One MLB debut (`id`), 5,008 rows | On which day of the season was he added to the roster? Service line, add date and roster-need counts. |
| `service_clock_panel_meta` | `.scratch/service-clock/panel-meta.json` | 1 row | How was the panel built? Counts and the seasons excluded. |
| `service_clock_debuts` | `.scratch/service-clock/debuts.json` | One MLB debut (`id`), 5,008 rows | Who debuted, when, at what position and age? |
| `service_clock_seasons` | `.scratch/service-clock/seasons.json` | One season, 2005-2025 (21 rows) | When did each season start, end, and hold its All-Star game? |
| `service_clock_findings` | `.scratch/service-clock/findings.json` | 1 report (`t1` to `t7`) | Does the debut calendar follow the service-time clock? The seven result blocks. |
| `service_clock_controls` | `.scratch/service-clock/controls.json` | 1 report (`c1` to `c7`) | Does the call-up result survive the controls? The control checks. |
| `service_clock_decisive` | `.scratch/service-clock/decisive.json` | 1 report (`d1` to `d4`) | The decisive cuts: the band, the raw jump and the per-day counts. |
| `service_clock_k0_blank_rate` | `.scratch/service-clock/k0-blank-rate.json` | 1 report (nested) | Does the blank-rate in the salary file bias the result? The K0 checks. |
| `service_clock_mls_defect` | `.scratch/service-clock/mls-defect.json` | 1 row | How many debuts get the wrong service time from a bare integer? Counts and examples. |
| `service_clock_pedigree_panel` | `.scratch/service-clock-pedigree/panel.json` | One MLB debut (`mlbId`), 4,133 rows | Does a draft or award pedigree change the call-up day? Tiers, ranks and the roster add date. |
| `service_clock_pedigree_panel_meta` | `.scratch/service-clock-pedigree/panel-meta.json` | 1 report | How was the pedigree panel built? Base counts, rank window. |
| `service_clock_pedigree_findings` | `.scratch/service-clock-pedigree/findings.json` | 1 report (`grains`, `interaction`, `placebo`, `loso`, ...) | Do top prospects get called up on a different clock? The result tables. |
| `service_clock_pedigree_power` | `.scratch/service-clock-pedigree/power.json` | 1 report (`grid`, `results`) | Could the pedigree test have seen an effect? Simulated power. |
| `service_clock_pedigree_power_exact` | `.scratch/service-clock-pedigree/power-exact.json` | 1 report (`grid`, `results`) | The same power check, computed exactly. |

### Blockage (does a blocked prospect wait longer?)

Triple-A stays, 2009-2023, with the incumbent at the man's position.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `blockage_exits` | `.scratch/blockage/exits.json` | One Triple-A stay that ended (`key`), 962 rows | Why did each stay end? Prospect event, incumbent event and exit reason. |
| `blockage_incumbent_bio` | `.scratch/blockage/incumbent-bio.json` | One incumbent (`key` = MLB id), 1,014 rows | Who held the big-league job? Name, debut, birth date, position. |
| `blockage_incumbent_ids` | `.scratch/blockage/incumbent-ids.json` | One incumbent id (`value`), 979 rows | The bare id list of incumbents. |
| `blockage_findings` | `.scratch/blockage/findings.json` | 1 report (nested) | Does the job above a Triple-A man predict how long he stays? Duration, quality, scarcity and exit-reason models. |
| `blockage_confound` | `.scratch/blockage/confound.json` | 1 report (`byPosition`, `fits`, `withinSplit`) | Does position explain the blockage result? |
| `blockage_deepen` | `.scratch/blockage/deepen.json` | 1 report (`crosstabs`, `corner`, `robustness`, `warModel`) | Does the blockage result survive deeper controls, and what is it worth in WAR? |
| `blockage_check` | `.scratch/blockage/check.json` | 1 report (nested) | Do the named blocked and open examples match the model? |

### Game notes

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `game_notes_insights_verdicts__entries` | `.scratch/game-notes/insights/verdicts-*.json` | One flagged person in a club's game notes, 14 rows | Whose notes carried a signal, and at what tier? |
| `game_notes_insights_verdicts` | `.scratch/game-notes/insights/verdicts-*.json` | 1 report per dated file (`scannedThrough`, `entries`) | The raw verdict file: how far the scan ran, and every entry. |

### Shipped data that spikes read (from `public/data/`)

These ship in the app. A spike reads them as a source of record. Their row counts move with the nightly runs.

| View | Source | Grain | Answers |
| --- | --- | --- | --- |
| `public_war__bat` | `public/data/war.json` | One batter (`key` = MLB id), current season | How many WAR did each hitter earn this season? |
| `public_war__pit` | `public/data/war.json` | One pitcher (`key` = MLB id), current season | How many WAR did each pitcher earn this season? |
| `public_war__wrc` | `public/data/war.json` | One batter (`key` = MLB id), current season | What was each hitter's wRC+ this season? |
| `public_war__fld` | `public/data/war.json` | One fielder (`key` = MLB id), current season | What was each fielder's fielding runs this season? |
| `public_war` | `public/data/war.json` | 1 report (`bat`, `pit`, `wrc`, `fld`, `batByTeam`, `pitByTeam`) | The raw WAR file with the by-team split. |
| `public_war_history__bat` | `public/data/war-history/*.json` | One batter, history (`key` = MLB id; `value` maps year to WAR) | What was each hitter's WAR by year? Read with `map_entries(value)`. |
| `public_war_history__pit` | `public/data/war-history/*.json` | One pitcher, history (`value` maps year to WAR) | What was each pitcher's WAR by year? |
| `public_war_history` | `public/data/war-history/*.json` | 100 rows, one per shard | The raw shards behind the two history views. |
| `public_rookies__players` | `public/data/rookies.json` | One player (`key` = MLB id), 21,509 rows | When did a man debut, and when does his rookie status end? |
| `public_rookies` | `public/data/rookies.json` | 1 report (`players` map) | The raw rookie-status file. |
| `public_postseason_history__seasons` | `public/data/postseason-history.json` | One season, 2000-2025 | Who won each postseason? Champion and every round, series and game. |
| `public_postseason_history` | `public/data/postseason-history.json` | 1 report (`seasons` array) | The raw postseason file. |
| `public_all_star_rosters` | `public/data/all-star-rosters.json` | 1 report (one column per year in `rosters`, `games`, `scores`, `venues`) | Who made each All-Star team, back to 1933? Read with `to_json(rosters)`. |
| `public_awards_history` | `public/data/awards-history.json` | 1 report (`seasons`, `families`) | Who won the major awards in recent seasons? One family per award. |
| `public_run_differential__rows` | `public/data/run-differential.json` | One club-season (`season`, `teamId`), 1901-2026 | What were a club's runs scored, allowed and October result? |
| `public_run_differential` | `public/data/run-differential.json` | 1 report (`rows`, `seasons`) | The raw run-differential file, with per-season denominators. |
| `public_level_tenure_benchmark` | `public/data/level-tenure-benchmark.json` | 1 report (`cohort`, `levels`) | The shipped level-tenure benchmark: percentiles of stay length by level. |
| `public_prospect_trend__players` | `public/data/prospect-trend.json` | One ranked prospect (`playerId`), 738 rows | Is a prospect's percentile rising or falling? `movement`, and `history`: a list of `[dateIndex, sportId, percentile]` rows (a fourth item `qualified` only when it is not "percentile is not null"). The date for `dateIndex` is `historyDates[dateIndex]` in the raw view below. |
| `public_prospect_trend` | `public/data/prospect-trend.json` | 1 report (`players`, `levelAverageAge`, `historyDates`, `packed`) | The raw prospect-trend file, packed (#1269). |
| `public_top_prospects__players` | `public/data/top-prospects.json` | One prospect on the overall list (`rank`) | Who is on the top-100 list today? |
| `public_top_prospects__orgprospects` | `public/data/top-prospects.json` | One prospect on a club list (`orgRank`) | Who are each club's top prospects today? |
| `public_top_prospects` | `public/data/top-prospects.json` | 1 report (`players`, `orgProspects`) | The raw top-prospects file. |
| `public_trade_deadline__trades` | `public/data/trade-deadline/20*.json` | One deadline trade (`id`), 2021-2026, 433 trades | Who moved at each deadline? Teams, players sent and received, cash. |
| `public_trade_deadline` | `public/data/trade-deadline/20*.json` | One row per season file, 2021-2026 | The raw deadline files, with the window dates. |
| `public_manager_history__bypersonid` | `public/data/manager-history/*.json` | One manager-season (`key` = person id), 2000-2026, 8,848 rows | Who managed which club in which season, with what record? |
| `public_manager_history` | `public/data/manager-history/*.json` | 100 rows, one per shard | The raw manager-history shards. |
| `public_milb_history` | `public/data/milb-history.json` | 1 report (`clubs`, `caveats`) | How did each minor-league club move between parent organizations? Read with `to_json(clubs)`. |

## Skipped

Every JSON file below is tracked, and none is a view. `node scripts/research-db.mjs --uncovered` prints any tracked file that is in neither list. A skip is not a verdict on the file: register it the day a question needs it.

- **Design and probe output, no research question.** `.scratch/design-system/`, `.scratch/abs-reports/design/`, `.scratch/homefeed/canvas/`, `.scratch/offseason-design/`, `.scratch/team-one-scroll/canvas/`, `.scratch/live-feed-diffpatch/`. These are UI measurement sheets, page mock-up canvases and one-off byte-count probes; three probe files are under 1 KB.
- **Empty.** `.scratch/level-benchmarks/org-gaps.json` is an empty array.
- **Raw fetch cache.** `.scratch/team-success/first-club-gamelog-cache.json` holds 6 MB of game logs keyed `{group}-{playerId}-{year}`. `team_success_first_club_cache__results` holds the answer it was built for.
- **Copy of another panel, or a queue.** `public/data/contracts-history/identity/pending.json` is a review queue of fuzzy matches (the same `rowKey` values are in the identity views). `public/data/contracts-history/search-index.json` is a 5.8 MB slim copy of the identity rows for the app's search. `public/data/trade-deadline/index.json` lists the season files.
- **Shipped UI data, whole directories.** These feed one surface each and are rebuilt by the nightly runs: `public/data/callouts/`, `public/data/highlights/`, `public/data/logos/`, `public/data/umpires/`, `public/data/umpire-accuracy/`, `public/data/glove-target/`, `public/data/spray/`, `public/data/fouls/`, `public/data/pitch-arsenal/`, `public/data/pitch-arsenal-pool/`, `public/data/pitch-command/`, `public/data/long-at-bats/`, `public/data/schedule-shape/`, `public/data/vs-team-splits/`, `public/data/game-notes/`, `public/data/team-transactions/`, `public/data/team-records/`, `public/data/team-contracts/`, `public/data/player-contracts/`, `public/data/milb-alumni/`, `public/data/milb-pool/`, `public/data/former-teammates/`, `public/data/youngest-regulars/`, `public/data/rookies/`.
- **Shipped UI data, single files.** `public/data/abs-challenges.json`, `public/data/abs-exposure.json`, `public/data/abs-exposure-clubs-aaa.json`, `public/data/abs-exposure-clubs-mlb.json`, `public/data/affiliates.json`, `public/data/teams.json`, `public/data/attendance.json`, `public/data/career-matchups.json`, `public/data/comeback-wins.json`, `public/data/season-score.json`, `public/data/team-score.json`, `public/data/postseason-odds.json`, `public/data/command-received.json`, `public/data/target-command.json`, `public/data/doubleheaders.json`, `public/data/farm-system.json`, `public/data/fever-radar.json`, `public/data/first-scorebook.json`, `public/data/fouls.json`, `public/data/game-notes-corroboration.json`, `public/data/gate.json`, `public/data/jerseys.json`, `public/data/milestones.json`, `public/data/minors-leaders.json`, `public/data/nine-keys.json`, `public/data/postseason-leaders.json`, `public/data/rehab.json`, `public/data/run-expectancy.json`, `public/data/run-value.json`, `public/data/salaries.json`, `public/data/savant-matchup.json`, `public/data/savant-percentiles.json`, `public/data/uniform-names.json`, `public/data/umpire-accuracy-summary.json`, `public/data/workload.json`, `public/data/workload-summary.json`. Most hold the current season only, or a lookup table, or feed one card. Two overlap a registered source: `public/data/attendance.json` (see `level_benchmarks_attendance_cache`) and `public/data/salaries.json` (see the contracts views).

## Known limits

- **One panel is deferred: `public_contracts_history_player`.** The view exists,
  but a full scan of `public_contracts_history_player__players` throws
  `Failed to cast value to numerical`. A money field holds a number in one row
  and free text (`non-tendered`, `DFA`, `1 y/$2.325+opt`) in another, in all 100
  shards. The older note here said the fix needs a hand-written schema. #1117
  found a smaller fix: DuckDB samples the first 32 files and guesses a number.
  The `FULL_SCAN` set in `scripts/research-db.mjs` reads every row of every file first. It
  fixed `public_contracts_history_terms`, which threw on `forfeited` in
  `salaries-54.json`. Adding the `player` glob to `FULL_SCAN` also reads all
  35,551 rows. That change is not made, because the old note asks for a decision
  first. It is one line.
- **Nested team tables stay nested.** `team_success_postseason_experience`,
  `team_success_postseason_usage`, `team_success_roster_age_deadline` and
  `team_success_payroll_rules_panel` hold a team-keyed table inside each season.
  Only `outcome-ladder.json` and `roster-age.json` have a flat `_by_team` view.
  Use `unnest(seasons)` for the rest, or write the next explicit schema on the
  pattern of `registerRosterAgeByTeam`.
- **Report views hold numbers, not rows.** A `*_findings` view is the result
  table of one spike. Query it to find a number. Do not re-derive the number
  from it.
- **A club-season with no event has no row.** `team_success_exit_reason_mix__orgseasons`
  has no row for a club with zero exits. Join from the ladder view and use
  `COALESCE`, as the example below does.

## What it is worth

Tested on 2026-09-29, for #1117.

**Question (from the newest Contender Diary entry, `exit-reason-mix-v1`, open
follow-up 2):** Do clubs with no Triple-A promotions in a season look different
from clubs that promoted a lot?

**Answer: the data was already on disk.** Two panels and one query answered it.
No statsapi call was needed.

```sql
WITH exits AS (
  SELECT o.season AS year, o.teamId AS teamId, o.total AS total
  FROM (SELECT unnest(orgSeasons) AS o FROM team_success_exit_reason_mix)
),
grid AS (
  SELECT l.year, l.teamId, l.ladder, COALESCE(e.total, 0) AS exits
  FROM team_success_outcome_ladder_by_team l
  LEFT JOIN exits e ON e.year = l.year AND e.teamId = l.teamId
  WHERE l.year BETWEEN 2009 AND 2023
)
SELECT CASE WHEN exits = 0 THEN 'zero exits' WHEN exits < 3 THEN '1-2 exits' ELSE '3+ exits' END AS band,
       count(*) AS org_seasons,
       round(avg(ladder), 2) AS mean_ladder,
       round(avg(CASE WHEN ladder > 0 THEN 1.0 ELSE 0 END), 3) AS made_postseason
FROM grid GROUP BY 1 ORDER BY 1
```

| Band | Club-seasons | Mean ladder rung | Made the postseason |
| --- | --- | --- | --- |
| zero exits | 91 | 0.90 | 42.9% |
| 1-2 exits | 212 | 0.74 | 34.0% |
| 3+ exits | 147 | 0.65 | 29.3% |

The counts match the diary: 359 club-seasons with an exit (212 + 147), 147 with
three or more. Zero-exit clubs average 0.90 against 0.70 for the rest. A
permutation test on those 450 rows (20,000 shuffles) gives p = 0.21. The diary
reported p = 0.22 for the same pattern. So the check confirms the diary's note:
a hint, not significant. It adds no new finding.

**A question the database cannot answer.** Factor 12 in
`docs/team-success-research.md` asks whether injuries predict October. The
database has no club-season injury measure. The only injured-list columns are
`ilAny21`, `ilSameGroup21`, `ilLongTerm21` and `ilSameGroup7` in
`service_clock_pedigree_panel`. Those flag one debutant's injured-list stints
before his roster add. They say nothing about a club's season. That question
needs a new injured-list sweep of the transactions endpoint, as the factor
catalog already says. A spike that starts there still starts with a statsapi
pull.

**A line the catalog showed to be stale.** `docs/team-success-research.md` lists
factor 14 (payroll) as "blocked on a data source". The catalog shows
`team_success_payroll_by_player__rows`: 2000-2025, built from the salary file
and the contract identity crosswalk. A person who read only the framework would think the data did not
exist. The framework line is not changed here. It belongs to the spike that
built the panel.

**What that says about the tool.** The database answers a follow-up on a question
that a spike already asked, because the panels hold the whole spike's rows. It
does not help a new factor that no spike has touched. Expect a hit when the
question reuses the outcome ladder, a roster or payroll panel, or the debut
cohort. Expect a miss for a new factor. The catalog cannot say which case a
question is until someone reads it, which is why reading it comes first.

## How it works

- Each panel becomes a view over `read_json_auto(path)`. The view stores SQL, not
  rows. Every query re-reads the file.
- A bare id-keyed object (a map) becomes one row per key with its fields as
  columns. A bare array of numbers becomes a `value` column. Anything else keeps
  the shape DuckDB reads. A map column inside a wrapped panel also gets a
  `<view>__<column>` view.
- The lists live in `scripts/data/research-db-panels.json`: `panels` (every path that
  becomes a view), `unnest` (the arrays that also get a `<view>__<column>` view, one
  row per element), `skipped` (the reasons below) and `notes` (why a panel is
  shaped as it is). They left the script when it reached the 600-line size guard.
- A JSON reader stops at 16 MB per object by default. The loader raises the cap to
  200 MB, because `level-benchmarks/raw.json` and `prospect-traits/mlb.json` pass
  16 MB.
- `@duckdb/node-api` is a devDependency. The older `duckdb` package is deprecated.
- `test/research-db-catalog.test.js` keeps this document true: every registered
  path and every skip is named here, every view built has one catalog row, every
  view returns a row, and a rebuild leaves no stale view. It does not fail when a
  new JSON file appears, because the nightly runs write there.

## Adding a panel

When a spike writes a JSON panel worth keeping:

1. Add its path to `panels` in `scripts/data/research-db-panels.json`. Use a glob for a
   sharded directory or a dated name. If the glob would leak into the view name,
   add a clean name to `VIEW_NAMES` in `scripts/research-db.mjs`.
2. Add the array that holds its records to `unnest` in the same file if the file is wrapped.
3. Run `node scripts/research-db.mjs --markdown`. Check that the view returns rows.
4. Add one row per view to the catalog above, in the spike's group. Say what one
   row is and what the view answers.
5. If a panel is not worth a view, add it to `skipped` in the same file and to the
   Skipped list, with the reason. `node scripts/research-db.mjs --uncovered` shows what is left.
6. If the panel nests a team-keyed table of about 30 keys or fewer, DuckDB cannot
   infer a map. Write an explicit schema, on the pattern of
   `registerOutcomeLadderByTeam`.
7. Run `npm test`. The catalog test fails until the document and the script agree.
