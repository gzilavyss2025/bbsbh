# Peer sites: what other baseball sites do that is cool

Read this file when Gary asks "what are other sites doing that are cool?" or a
similar question. Start from this list. Then do a new search pass, and add what
you find. Do not start from zero.

This file covers **baseball** sites and tools: mostly independent analysts, not
national media. `docs/design-inspiration.md` is its partner. That file covers
patterns from outside sports.

Nothing here is committed work. An item becomes work only when an issue, a
`.scratch/` plan, or an ADR says so.

## How to add an entry

- Give the link, the unique value in one or two sentences, and the fit for Tally.
- Say how you checked it: "fetched the page", "read a write-up", or "from memory,
  not checked". Do not state a feature as fact if you did not see it.
- Put the date of the check in the "Last checked" column.
- If an entry uses a feed field, name the field and the endpoint.

## Sites

| Site | Unique value | Fit for Tally | How checked | Last checked |
|---|---|---|---|---|
| [Umpire Scorecards](https://umpscorecards.com) | An automatic card for each home plate umpire, for each game. It plots the missed calls on a zone. It also gives a net "favor" in runs to each team (from memory, not checked on the page). The archive starts in 2015. | **High.** Tally already shows umpires. A per-game umpire card can be a reveal-only add, because "favor" in runs points at the score. | Read the about page | 2026-10-06 |
| [Ballpark Pal](https://www.ballparkpal.com) | Ratings with luck removed, "based on contact quality and expected outcomes". It also has a *Ball Flight Dashboard*, daily park factors, game simulations, and a *Matchup Machine* (batter vs. pitcher). | **High.** It is the nearest match to a "hard-luck out" note on an at-bat card. Its ball-flight view is a peer to `src/lib/ballpark/ballFlight.js`. | Fetched the home page | 2026-10-06 |
| [Statcast Home Run Tracker](https://baseballsavant.mlb.com/leaderboard/home-runs) | For each batted ball, the number of the 30 parks where it is a home run. It uses the ball's trajectory and each park's wall heights and distances. A "Standard" view uses the trajectory only. An "Adjusted" view adds elevation, wind and temperature. | **High** for the #1875 side view: draw the other parks' walls at the ball's angle and show "N of 30 parks". The live count is `homeRunBallparks` in Savant `/gf` (see @would_it_dong below). `src/lib/ballpark/layout/fields.js` already holds every park's measured wall distance and height. | Read search summaries; the page itself was not fetched | 2026-10-15 |
| Alan Nathan: [A Tale of Two Dingers](https://tht.fangraphs.com/a-tale-of-two-dingers/) (THT) and the [trajectory calculator](https://baseball.physics.illinois.edu/trajectory-calculator-new.html) | Two Statcast home runs by A. Rodriguez (2015-04-17), drawn as side views. 471 ft at 26.1° peaked at 97 ft (hang 5.35 s). 400 ft at 22.8° peaked at 63 ft (hang 3.85 s). Backspin explains most of the gap. The calculator's drag and lift values are fit to 2015 Statcast data. | **High.** These are the measured check for any side-view arc. The no-drag peak in `src/lib/ballpark/ballFlight.js` (range × tan(angle) / 4) gives 58 ft and 42 ft for these two balls, which is too low. A drag-and-lift model, solved to land at the measured distance, gave 94 ft and 56 ft (a two-ball check, on the #1875 design canvas). | Fetched the THT article; read a search summary of the calculator | 2026-10-15 |
| [@would_it_dong](https://x.com/would_it_dong) | For each home run: "a home run in N of 30 parks". | **High.** Savant's `/gf` feed already sends `homeRunBallparks` for each batted ball. No new source is necessary. | Read a write-up (NESN) | 2026-10-06 |
| [TJStats](https://tjstats.ca) (Thomas Nestico) | Dense one-image pitching summaries for MLB **and** MiLB. It has a "Live tjStuff+" app and a daily pipeline that runs every pitch through its own models. | Medium. It is a model for a compact pitcher card. It is one of few sites with MiLB pitch data. | Fetched the home page and the about page | 2026-10-06 |
| [Pitcher List: PLV](https://pitcherlist.com/plv-decision-value-weekly-team-swing-decisions/) | Grades each pitch (quality, average, bad). *Decision Value* grades each swing or take against the other choice. | Medium. A note such as "good take" or "chased a bad pitch" is strong on a second screen. The model belongs to Pitcher List, so Tally can only copy the idea. | Read the write-ups | 2026-10-06 |
| [SEAGER](https://philliesminorthoughts.com/phillies-hitters-and-swing-decisions-a-riff-on-rob-orrs-seager/) (Robert Orr; fans make their own versions) | "Selective aggression": it gives credit for swings at pitches a hitter can damage, and for takes of bad pitches. | Low for one at-bat. It is a season metric, so it fits a player page better. | Read a fan write-up | 2026-10-06 |
| [Adam Salorio (Substack)](https://adamsalorio.substack.com/p/a-closer-look-at-swing-decision-metrics) | Compares the public swing-decision metrics side by side. | Reference only. | Page responds; not read in full | 2026-10-06 |
| [Baseball Egg](https://baseballegg.com/2026/09/08/the-numbers-hidden-inside-every-baseball-swing) | A September 2026 article that explains bat-tracking data for fans. | Reference for how to explain bat data in plain words. | Search result; not read in full | 2026-10-06 |
| [PitchGrader](https://www.pitchgrader.com) | 3D pitch-flight software for iPad, used by teams. | Ideas for the PR #1521 pitch scene. It is not a data source. | Search result only; not read in full | 2026-10-06 |
| [Baseball Savant: 3D pitch visualizations](https://baseballsavant.mlb.com) | Pitch trails you view from named cameras: umpire, catcher, pitcher, each batter side, overhead, zone, and the 1B and 3B sides. | **High.** The Pitcher page camera presets already match this list. Gains must come from motion quality and from what the scene says. | Read a write-up (search result). The page itself was not fetched | 2026-10-12 |
| [PitchSim](https://mwm.ai/apps/pitchsim/6770783407) | App with 3D views (catcher, right-hand batter, left-hand batter, orbit) and 2D views. *Freeze at Zone* pauses the ball at the front of the zone. *Pitch Comparison* overlays several pitches. A stats panel shows horizontal and induced vertical break. | **High.** *Freeze at Zone*, a view from each batter side, and break numbers next to the picture are all cheap ideas. | Fetched the store listing | 2026-10-12 |
| Pitch overlays and tunnel metrics ([FanGraphs on overlays](https://community.fangraphs.com/a-better-understanding-of-pitch-overlays); [Baseball Prospectus](https://www.baseballprospectus.com/?p=37436); Rapsodo and TrackMan overlay tools) | Several pitches drawn over one release, as a GIF or an app view. Tunnel metrics measure the gap between two pitches at release, at the hitter's decision point, and at the plate. FanGraphs warns that a hitter-eye overlay can make a pairing look more deceptive than the data supports. Show the numbers beside the picture. | **High.** It is the most common reason to animate a pitch. Pair every overlay with the three gap numbers, and show it from the left-hand and the right-hand batter side. | Fetched the FanGraphs article; read search summaries for the rest | 2026-10-12 |
| [Baseball Savant: pitch arsenal stats](https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats) | Pitchers and hitters split by pitch type, with run value, whiff rate and xwOBA for each type. | **High.** It is the standard view for "what a hitter does against a pitch". `hitter-grid` holds the same counts by cell, so a pitch-type matchup card needs no new source. Savant's run value is a different measure from our xwOBA, so label which one a card shows. | Search result only; not read in full | 2026-10-07 |
| [FanGraphs: pitch type linear weights](https://library.fangraphs.com/pitching/linear-weights) | Run value of each pitch type, as runs above or below average per 100 pitches. | Reference for a run-value column. | Search result only; not read in full | 2026-10-07 |
| Stuff+, Location+, Pitching+ (Eno Sarris and Max Bay; FanGraphs shows them) | Stuff+ grades velocity, spin, movement and release point. Location+ grades how well a pitcher hits his spot for the count. Pitching+ combines them. | Low for now. Spin and movement are not in the MLB live feed, so Tally cannot compute them. A Savant pull would be needed. | Search result only; not read in full | 2026-10-07 |
| [Adam Salorio: aStuff+ v2](https://adamsalorio.substack.com/p/introducing-astuff-v2?open=false) | An independent Stuff+ model. | Reference only. | Search result only; not read in full | 2026-10-07 |
| [Baseball Savant: bat tracking](https://baseballsavant.mlb.com/leaderboard/bat-tracking) | Bat speed, squared-up rate, blasts (a fast swing that squares the ball up) and swing length. A [swing path page](https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle) adds attack angle (5 to 20 degrees counts as "ideal"), attack direction and tilt. | Medium. See the freshness table below: `batSpeed` arrives minutes late and the swing-path fields exist only in the CSV. | Search result only; not read in full | 2026-10-07 |
| MLB.com: [best hitter against each pitch type](https://www.mlb.com/news/best-hitter-against-each-pitch-type-in-2023) | A yearly story that names the best hitter against each pitch type. | Low. It shows that fans already ask this question. | Search result only; not read in full | 2026-10-07 |
| [ScriMLB](https://github.com/adweed93/scrimlb) (scrimlb.com) | A live stats dashboard (Flask, MLB Stats API, pybaseball) with no spoiler rule. When no starter is posted, it guesses the next one from the rotation order (3 or more starts makes a rotation member) and marks the guess "PREDICTED". When no lineup is posted, it shows the last lineup. Player pages add "🔥 / 🚩" callouts with a line of history, sized to the sample (under 30 G, 30 to 60 G, over 60 G). It also has league-rank medals on stat cells and a Hall of Fame pace check at 3, 5, 7, 10 and 15 seasons. | **High** for the projected lineup: Tally shows the active roster until the lineup posts. (Tally already projects the starter, ADR-0089.) Medium for the callouts and rank markers on player pages (open surfaces, ADR-0034). Its live score refresh breaks the spoiler rule, so do not copy it. | Cloned the repo at `0b1deaf` and read `README.md`, `SESSION_SUMMARY.md` and `mlb_web.py` | 2026-10-12 |

## Open-source repos

Found in a GitHub search pass on 2026-10-13. These are code you can read, so an
entry can name a technique, not only a feature. "Updated" is the date that the
GitHub topic list showed. Nobody cloned these repos or read their commit logs.

| Repo | Unique value | Fit for Tally | How checked | Last checked |
|---|---|---|---|---|
| [charlesnutter/scorecoards-art](https://github.com/charlesnutter/scorecoards-art) | Draws a paper-style scorecard for any MLB game as **one SVG**, from the live feed (GUMBO). Seven layouts share one data model. Colour styles are a set of `--sc-*` CSS variables, and the geometry is in `presets.js`, so a new look needs no renderer change. It traces base paths, shades runs, circles the out number and dots RBIs. Known gap (from its README): a run by a pinch runner does not trace back to the batter. Roadmap: paper grain with `feTurbulence`, and Retrosheet data for old games. | **High** as a peer. It is the nearest match to Tally's scorebook look. It fills every box, so it is a reveal-side idea only (a revealed game as a poster). Compare its layout and style split with `src/styles/`. | Fetched the GitHub page and README | 2026-10-13 |
| [JLeshnick/baseball-scorecard-studio](https://github.com/JLeshnick/baseball-scorecard-studio) | The same stack as Tally (React 19, Vite 8), fully client-side on the Stats API. A click-to-score scorebook, a side view of the pitch arc, spray charts with launch angle, a searchable notation key that you can pin beside the card, and PNG and PDF poster export with "eraser and scratch-out" effects. | Medium. It is a data-entry tool, which Tally is not. The pinned notation key is a good idea for the print sheet (`docs/print-sheet.md`) or a help page. | Fetched the GitHub page and README | 2026-10-13 |
| [justinramos101/baseballhour](https://github.com/justinramos101/baseballhour) | A terminal app (Rust, ratatui) for MLB **and** AAA, AA, High-A and Single-A. One key changes the level. It has a ballpark map and a "Nearby" view sorted by straight-line distance. When a refresh fails, it keeps the saved schedule on screen with a `CACHED` label and its age. Updated 2026-10-03. | **High** for the stale-data label: Tally could mark old data in the same way when the phone is offline. Medium for "Nearby" MiLB parks. | Fetched the GitHub page and README | 2026-10-13 |
| [gdevers/pitch-dataset](https://github.com/gdevers/pitch-dataset) | Pulls **MiLB Statcast** pitches from Savant `statcast-search-minors/csv`, one day per request to stay under the CSV size limit. Its 2026 file holds 738,388 pitches (2026-03-27 to 2026-08-27). The README says coverage is "strongest for AAA and A". It joins IDs to FanGraphs through the Chadwick register. | Medium. It is a working recipe for MiLB pitch data, if a prospect page needs it. | Fetched the GitHub page and README | 2026-10-13 |
| [Zaious/basesmall](https://github.com/Zaious/basesmall) | A desktop widget (Tauri) that shows a live game as a few abstract marks in a corner of the screen. It has a "low-key mode" that looks like plain numbers, a catch-up view for a late join, and replays from 2023. No account and no server. Updated 2026-10-06. | Medium. The catch-up view is a peer idea for a second screen. Its catch-up shows the score, so do not copy it as it is. | Fetched the GitHub page and README | 2026-10-13 |
| [mlb-rs/mlbt](https://github.com/mlb-rs/mlbt) | A terminal Gameday (Rust, 169★). A strike zone with heat-map colour, exit velocity and launch angle, ABS challenge data for 2026 games, and leverage index and win-probability change for each at-bat. Updated 2026-09-06. | Low. It is a full Gameday with no spoiler rule. Its code shows which feed fields carry ABS data and leverage. | Fetched the GitHub page and README | 2026-10-13 |
| [MLB-LED-Scoreboard/mlb-led-scoreboard](https://github.com/MLB-LED-Scoreboard/mlb-led-scoreboard) | A live scoreboard on a Raspberry Pi LED matrix (720★). Version 9 adds third-party screen plugins. Updated 2026-10-12. | Low. It is the largest hobby project on the Stats API, and is useful as proof of what the API supports for a long time. | Fetched the GitHub page and README | 2026-10-13 |
| [etweisberg/mlb-mcp](https://github.com/etweisberg/mlb-mcp) | An MCP server that gives an AI assistant the Stats API, Statcast, FanGraphs and Baseball-Reference. It returns matplotlib charts as images. Updated 2026-09-20. Peers: [guillochon/mlb-api-mcp](https://glama.ai/mcp/servers/@guillochon/mlb-api-mcp), Casiabound177/statcast-mcp. | Low for the app. Possible use for agent sessions in this repo that must check a feed field. | Fetched the GitHub page and README | 2026-10-13 |
| [timothyf/ninelens](https://github.com/timothyf/ninelens) | A research platform (Rails, Vue): player trends, percentiles, two- or three-player comparison, and a scout-style workflow with roles. Team-membership history is its source of truth for rosters, with dated roster snapshots. MLB only. Updated 2026-10-13. | Low. The dated roster snapshot is a peer to the stores in `src/lib/data/`. | Fetched the GitHub page and README | 2026-10-13 |
| [ThatSportsGamer/live-milb-scores-for-stream-deck](https://github.com/topics/milb) | A Stream Deck plugin with live MiLB scores. Updated 2026-10-08. | Low. It shows that MiLB fans want a small, always-on view. | GitHub topic list only; repo not read | 2026-10-13 |
| Stats API clients: [toddrob99/MLB-StatsAPI](https://github.com/topics/mlb?o=desc&s=stars) (849★, Python), [zero-sum-seattle/python-mlb-statsapi](https://github.com/topics/mlb-stats-api?o=desc&s=updated) (109★, typed Python), [BillPetti/baseballr](https://github.com/BillPetti/baseballr) (R, has `statcast_search_minors()`), [jldbc/pybaseball](https://github.com/jldbc/pybaseball) | The clients that most projects above use. The first two were updated in 2026. For pybaseball, the topic list shows January 2026. For baseballr, the last CRAN release found is 2024-01. | Reference only. Their source code is a second record of feed paths, beside `src/api/statsapi.js`. | GitHub topic lists and pages | 2026-10-13 |
| [WilhelmWillie/baseball](https://github.com/WilhelmWillie/baseball) ("Pocket Ballpark") | A live MLB game viewer in a 3D ballpark (Next.js, three.js). It reads the Stats API, turns the feed into its own snapshot and events, and animates them. A queue holds the visible state back until each play has finished animating. Any finished 2026 game replays: the browser rebuilds the frames from the final feed (the author measured about 12 ms). It has no model files. The figures and the park are built in code, and a uniform is flat colours plus a jersey-number texture. The repo has no license file. | **High** as a reference for Gameday (#2566) and for 3D players with uniform skins (#2580). It has no seal, so its design cannot move over as it is. Full write-up: `docs/pocket-ballpark.md`. | Cloned at `40fce1b7c`. Three readers read it in full. Key claims re-checked. Nobody ran it. | 2026-10-23 |

## Gaps: things no site does yet

- **No open-source MLB app hides the score.** The 2026-10-13 pass read the
  README of each repo above. None has a spoiler or reveal mode. Basesmall's
  "low-key mode" only changes how the score looks. (This comes from the
  READMEs; nobody searched the code or the issues.)

- **Expected score for one game.** Hockey has a "deserve to win" meter. No
  baseball site found on 2026-10-06 shows the runs a team "deserved" in one
  game from contact quality (xBA or xwOBA summed over the game). Tally could
  show it on a revealed box score: "On contact, NYY deserved 4.1 runs; scored
  2." This is an idea; nobody has checked the math for it.

## Data notes from the 2026-10-06 pass

These notes say where the numbers behind the ideas above come from.

- **xBA has no public source earlier than Savant.** The MLB Stats API live
  feed (`feed/live`, `hitData`) has no hit probability, no xBA, and no barrel
  flag. `api/v1/game/{pk}/contextMetrics` has win probability and sac-fly
  distance windows only. `api/v1/game/{pk}/{playId}/analytics` returns a login
  page. (Inference: MLB's Gameday app probably gets "hit probability" from that
  locked endpoint.)
- **Savant `/gf`** (`baseballsavant.mlb.com/gf?game_pk=`) sends `xba`,
  `is_barrel`, `homeRunBallparks` and `batSpeed` per pitch. It sends
  `access-control-allow-origin: *`. It also sends the full scoreboard, so the
  spoiler rule applies (see the root `CLAUDE.md`).
- **Savant Statcast CSV** (`statcast_search/csv`) adds `attack_angle`,
  `attack_direction`, `swing_path_tilt`, and the bat/ball intercept point. It
  also carries `bat_score` and `post_bat_score`.
- **Freshness during a live game: measured on 2026-10-06.** A poll every 20 s
  ran for 90 minutes on gamePk 849819 (LAD @ ATL, postseason). It counted 65
  swings and 25 balls in play. The lag runs from the pitch's `endTime` in the
  MLB feed to the first poll that showed the field:

  | Field | Median | p90 | Coverage |
  |---|---|---|---|
  | MLB feed shows the pitch | 10 s | 18 s | 65 of 65 swings |
  | `/gf` `xba` | 51 s | 70 s | 24 of 25 balls in play |
  | `/gf` `is_barrel` | 45 s | 55 s | 24 of 25 balls in play |
  | `/gf` `batSpeed` | 162 s | 479 s | 63 of 65 swings |
  | CSV (any field) | — | — | 0: the CSV returned no rows for the day during the game |

  So xBA is close to live, about 40 s after the MLB feed. Bat speed often comes
  minutes later. The swing-path fields (attack angle, tilt, intercept) exist
  only in the CSV, so a live game cannot use them. Earlier checks found the CSV
  complete the next morning. The fill time after the final out is measured in
  the next note. The lags carry up to 20 s of poll error.
- **CSV fill time after the final out: measured on 2026-10-20 (#2349).**
  One game, so one sample. Game: gamePk 849815 (CLE @ TB, game date 2026-10-19,
  MLB). Final-out time: 03:03:39 UTC (the last play's `about.endTime` in
  `feed/live`). A poll every 20 minutes (a few 22 to 24 minutes apart) with the
  app's phase C query (`statcastUrl` in `src/api/savant/attackAngle.js`: the
  game date and `game_pk`; every row's `game_pk` matched). Polls at 03:12,
  03:34, 03:55, 04:16, 04:38, 05:00, 05:22, 05:43, 06:08, 06:30, 06:54 and
  07:17 UTC all returned 0 rows. The poll at 07:39:04 UTC was the first with rows:
  260 rows, of which 115 were swings, fouls or balls in play, and 114 of those
  had both `bat_speed` and `attack_angle`. So the CSV first filled between 4 h 13 min and
  4 h 35 min after the final out. Error: up to 22 minutes, the poll gap. It was
  not filled when the game ended or in the first four hours. (A CSV for an
  earlier completed game, 849810 on 2026-10-15, had 296 rows, all matching, 135 with
  both fields; that is the earlier "complete the next morning" check.)
