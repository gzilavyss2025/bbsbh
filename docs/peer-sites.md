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

### Second pass: live viewers, live updates, pitch and ball drawing (2026-10-23)

A second search pass for live game viewers, code that draws a pitch or a batted
ball, and code that follows a live game. The table above is the 2026-10-13
pass. This one feeds the Gameday umbrella (#2566), the stage (#2568), the chase
camera (#2569), the live-update spike (#2578) and 3D players (#2580).
`docs/pocket-ballpark.md` is the long write-up of the closest match.

How the rows were checked: most repos were cloned (shallow) into a scratch
folder, and the license and last commit below come from the clone. "Read" names
the files a person or a reader opened. Nobody ran any of these apps. A repo with
no license file is all rights reserved by default, so read it and do not copy it.
Stars appear only where a GitHub topic list showed them.

| Repo | Unique value | Fit for Tally | How checked | Last checked |
|---|---|---|---|---|
| [nuotsu/mlb](https://github.com/nuotsu/mlb) | A Svelte live viewer. `pitch-flight.ts` draws each pitch along its real path from the nine-parameter fit: `pitchData.coordinates` (`x0`, `y0`, `z0`, `vX0`, `vY0`, `vZ0`, `aX`, `aY`, `aZ`), `extension`, and `breaks.spinRate` and `spinDirection`. It draws a dot only when a field is missing, when `vY0` is not negative, or when the path misses `pX` and `pZ` by more than 0.5 ft. It also has a win-probability chart and a home-run chart (scale 2.5 ft per hit-coordinate unit). | **High** for #2568 and #2569. It uses the same inputs as our `realFlight`, with a clear fallback rule. Both use `60.5 - extension` for the release distance. | Cloned. No license file. Last commit 2026-10-21. Read the PR #73 page (merged 2026-10-09 per that page) and the file names. | 2026-10-23 |
| [AlecM33/mlb-gameday-bot](https://github.com/AlecM33/mlb-gameday-bot) | A Discord bot (JavaScript) that follows a live game by push. It opens `wss://ws.statsapi.mlb.com/api/v1/game/push/subscribe/gameday/{gamePk}` and sends the text `Gameday5` as a heartbeat. A socket message carries `updateId`, `timeStamp` and `gameEvents`. The bot then fetches `https://ws.statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live/diffPatch?language=en&startTimecode=..&pushUpdateId=..`. On a `full_refresh` change event it fetches the full feed. It has its own RFC 6902 patch code and falls back to the full feed if a patch fails. | **High** for #2578. Our own check on 2026-10-23: the socket accepted a connection for a finished game and closed it at once with code 4400. Nobody tested a live game. | Cloned. GPL-3.0, so do not copy code. Last commit 2026-09-10. Read `MLB-API-util.js` and `gameday.js`. | 2026-10-23 |
| [NicolasRichards/BallparkMatchups](https://github.com/NicolasRichards/BallparkMatchups) | A Swift iOS app (batter against pitcher, MLB and MiLB). Its PR #1 adds the same push socket and `diffPatch`, and reports 66 to 87 percent less data than polling in its own tests (the author's numbers). The PR text lists traps: `gamePk` arrives as a string; MLB sends `replace` at the end of an empty array; some `copy` and `move` sources do not exist yet. | **High** for #2578. The list of traps is the most useful part. | Fetched the PR page. Cloned. No license file. Last commit 2026-10-08. Found the socket URL in `GamedaySocket.swift`. | 2026-10-23 |
| [Zaious/basesmall](https://github.com/Zaious/basesmall) (second look) | The 2026-10-13 row covers the app. It also holds a measured probe report (`PROBE_REPORT.md` in its docs folder, in Traditional Chinese): the heartbeat `feed/live?fields=metaData,timeStamp,wait`; `diffPatch` needs both `startTimecode` and `endTimecode` (with only a start it returns the whole feed); pitch location on 297 of 297 pitches in one 2026 game; and a table by season (pitch location from 2008, exit velocity from 2015). The polling loop is `live-source.ts`: heartbeat, then patch, with back-off. | **High** for #2578. We repeated the heartbeat on 2026-10-23: `{"metaData":{"wait":10,...}}` and `cache-control: max-age=10`. | Cloned. Apache-2.0. Last commit 2026-10-15. Read the probe report and `live-source.ts`. | 2026-10-23 |
| [mlb-rs/mlbt](https://github.com/mlb-rs/mlbt) (second look) | The 2026-10-13 row covers the app. The strike-zone heat map reads `liveData.plays.currentPlay.matchup.batterHotColdZones` (a colour for each zone). It does not plot pitch locations. The ABS challenge line reads `reviewDetails` (`isOverturned`, `inProgress`, `challengeTeamId`). The API client is a separate crate in the same repo. | **Medium.** Check whether Tally reads `batterHotColdZones` and `reviewDetails`. | Cloned. MIT. Last commit 2026-09-06. Read `strikezone.rs` and `review.rs`. | 2026-10-23 |
| [Amin9666/MLB-Live-Game-Tracker](https://github.com/Amin9666/MLB-Live-Game-Tracker) | A FastAPI, Postgres, Redis and React/D3 tracker with a live strike zone (`StrikeZone.tsx`), a spray chart, a win-probability chart and a pitch log. Its README says that when the feed timestamp stops moving for 45 s it asks `/feed/live/timestamps` for the newest timecode. It can replay a recorded game from a `.jsonl.gz` file. | **Medium** for #2578 (the stalled-timestamp fallback) and for testing with a recorded game. The stack is heavy for a client-only app. | Fetched the page. Cloned. No license file. Last commit 2026-10-13. Read the file names only. | 2026-10-23 |
| [statsleuthgame/baseball-app](https://github.com/statsleuthgame/baseball-app) | React 19, Vite, D3 and React Three Fiber, with a FastAPI backend. It has strike-zone and spray-chart views, a 3D ball-flight scene (`trajectoryPhysics.js`) and committed JSON snapshots. Its spray chart uses the same pixel origin as ours: x minus 125.42 and 198.27 minus y. | **Medium** for #2569: a second batted-ball path to compare with `simFlight`. | Cloned. No license file. Last commit 2026-10-22. Read the file names and the hit-coordinate lines. | 2026-10-23 |
| [FarseaSH/mlb-visual-game-replay](https://github.com/FarseaSH/mlb-visual-game-replay) | The README says "relive completed MLB games through interactive play-by-play pages": a pitch chart on a strike zone, a batted-ball field diagram, and a "progressive reveal" where later action stays hidden until the reader continues. The live site is `mlb-visual-game-replay.win`. | **High** as a peer for the one-tap reveal in #2566. It is the only repo found that says it hides later action. The repo holds no source (5 commits; a README and a workflow folder), so nobody can see how it hides it. | Fetched the page. Not cloned. License not stated. Did not open the live site. | 2026-10-23 |
| [paaatrick/playball](https://github.com/paaatrick/playball) | A Node terminal viewer (1.2k stars on its page). It shows count dots, bases and a colour-coded play list. It fetches `feed/live` with `diffPatch` using start and end timecodes (`games.js`). A `live-delay` setting delays the live view by a set number of seconds. | **Low to medium.** It is the smallest working `diffPatch` loop. Inference: the `live-delay` idea fits a reader who watches a TV with a delay (#2570). | Cloned. MIT (per its page). Last commit 2026-10-04. Read `games.js`; features come from the README page. | 2026-10-23 |
| [buffedlizard55-lab/MLB-Live-PBP](https://github.com/buffedlizard55-lab/MLB-Live-PBP) | A zero-dependency page: no build step; run it with `node server.mjs` or any static server. It has a scoreboard, a game view, play-by-play and review tabs. It polls the live feed every 500 ms (`LIVE_POLL_MS`) and checks status every 125 ms. The feed asks for 10 s (`metaData.wait`, measured 2026-10-23). | **Low.** Do not copy the cadence. It is a fair example of a page with no dependencies. | Cloned. MIT. Last commit 2026-09-26. Read `game.js`. | 2026-10-23 |
| [VaalRL/PlateView](https://github.com/VaalRL/PlateView) | React, Vite and TanStack Query, with a 30 s refresh while a game is live. Its scoreboard switches between MLB, AAA, AA, High-A and A. It has a defensive alignment chart and a postseason bracket back to 2012. Team names are in Traditional Chinese. | **Medium.** The level switch matches Tally's MiLB sport ids (`src/lib/teams.js`). | Fetched the page. Cloned. The README says MIT, but the repo has no license file. Last commit 2026-10-22. | 2026-10-23 |
| [benjamincrom/baseball](https://github.com/benjamincrom/baseball) | A Python library that downloads MLB games and draws an **SVG scorecard** (`game.get_svg_str()`, `generate_svg.py`). It has a data model of games, innings, plate appearances and pitches, and an archive of 1974 to 2020 games. Its README does not name the feed it reads. | **Medium** as a scorecard-from-data reference for the classic-game issue #1525. | Fetched the page. Cloned. MIT. Last commit 2026-09-23. | 2026-10-23 |
| [KUnzeHe/pitch-trajectory-explorer](https://github.com/KUnzeHe/pitch-trajectory-explorer) | One `index.html` that rebuilds pitch paths from the Statcast nine-parameter fit, with catcher, pitcher and batter views and a swing game. The README reports a median flight time of 410 ms over about 120,000 pitches of 2026 (the author's figure). Data comes from the Savant CSV. | **Medium** for #2569: a second check of the same maths as `realFlight`. | Fetched the page. Cloned. MIT. Last commit 2026-10-09. | 2026-10-23 |
| [pybbda](https://pybbda.readthedocs.io/en/latest/modules/analysis/trajectories.html) | A Python package. `BattedBallTrajectory` follows Alan Nathan's trajectory calculator: drag and lift that depend on spin (`cd0` 0.3008, `cdspin` 0.0292, `cl0` 0.583, `cl1` 2.333, `cl2` 1.12, `tau` 10000), integrated with RK4. Tally's `simFlight` uses a constant drag of 0.35 and fits one lift value for each ball to the measured distance (`fitLift`). | **Medium** for #2569, as a physics cross-check, mainly for tier B where nothing is measured. | Fetched the docs page. Not cloned. License not stated. | 2026-10-23 |
| [stiles/mound](https://github.com/stiles/mound) | A Python toolkit and CLI. `plot_zone()` draws scatter, hex-bin and KDE strike-zone plots from Savant `/gf` pitch data and the Stats API. It has no live-game command: a game in progress is fetched again each time. | **Low to medium.** Another recipe for `/gf`, which `src/api/savant/gameFeed.js` already reads. | Fetched the page. Cloned. MIT. Last commit 2026-09-20. | 2026-10-23 |
| [bdilday/GeomMLBStadiums](https://github.com/bdilday/GeomMLBStadiums) | R and ggplot2. Outlines of the 30 parks and a generic park, in the same coordinate system as `hc_x` and `hc_y` (y is flipped). | **Low to medium.** Tally already draws parks from Gameday's field outlines (`docs/gameday-assets.md`, `docs/ballpark-layouts.md`). | Fetched the page. Cloned. A license file exists; its type was not read. Last commit 2023-09-21. | 2026-10-23 |
| [RealRTTV/mlb-api](https://github.com/RealRTTV/mlb-api) | A Rust client with `live_feed`, `diff_patch`, `timestamps`, `win_probability` and a `PlayStream` for live games. | **Low.** | Fetched the docs.rs page. Cloned. MIT. Last commit 2026-04-30. Did not read how `PlayStream` polls. | 2026-10-23 |
| [nuotsu/mlb-stats-api-docs](https://github.com/nuotsu/mlb-stats-api-docs) | An unofficial endpoint reference with a playground and bundled TypeScript types (hosted at `mlb-stats-api-docs.vercel.app`, per its page). | **Low to medium.** A second endpoint reference beside `docs/MLB_STATS_API.md`. | Fetched the page. License not stated. 9 commits. Did not check whether it types the live feed. | 2026-10-23 |
| [nkreeger/baseball-pitchfx-3d](https://github.com/nkreeger/baseball-pitchfx-3d) | A WebGL pitch viewer from 2019 with catcher, pitcher and bird's-eye views. Its inputs use the old PITCHf/x names: `vx0`, `vy0`, `vz0`, `ax`, `ay`, `x0`, `y0`, `z0`, `sz_bot`, `sz_top`. | **Low.** | Fetched the page. Cloned. Apache-2.0. Last commit 2019-01-07. | 2026-10-23 |

**Also seen** (page read only unless noted; nobody read the code):

- [nickolastran/stat-sightline](https://github.com/nickolastran/stat-sightline): Next.js and FastAPI; Statcast through pybaseball into Postgres; strike-zone scatter and density plots. MIT. Cloned for the license only.
- [danibsheehan/caught-looking](https://github.com/danibsheehan/caught-looking): React and Go; spray and pitch dots from the Savant CSV. MIT.
- [xavidop/diamond](https://github.com/xavidop/diamond): a Go terminal app and a Vite and React web app with live linescore, box score and play-by-play. The page lists no strike zone. Apache-2.0.
- [zsheppard78/mlb-stats-frontend](https://github.com/zsheppard78/mlb-stats-frontend) ("StatDugout"): a vanilla JavaScript PWA with standings and live scores. No live detail view was named.
- [qixils/mlb-matchup-viewer](https://github.com/qixils/mlb-matchup-viewer): Svelte; the current pitcher and batter. MIT.
- [JakenHerman/full-count](https://github.com/JakenHerman/full-count): a Rust terminal scorekeeper with an HTML scorecard export. It is a data-entry tool, which Tally is not. MIT.
- [wantaekchoi/kbotop](https://github.com/wantaekchoi/kbotop): a Rust terminal viewer with strike-zone pitch tracking for KBO games, from Naver data and not MLB data. Unlicense.
- [5ne/MLBScoreboard-Arduino-Library](https://github.com/5ne/MLBScoreboard-Arduino-Library): Inkplate e-paper boards; it calls `/api/v1/schedule` and `/api/v1/game/{gamePk}/linescore`. MIT.
- [ThatSportsGamer/live-mlb-scores-for-stream-deck](https://github.com/ThatSportsGamer/live-mlb-scores-for-stream-deck): the README says each key polls once every 30 s. MIT.
- [gregstoll/baseballstats](https://github.com/gregstoll/baseballstats): win-expectancy and run-expectancy calculators built from Retrosheet files (Rust and Python). Apache-2.0.
- [tnestico/streamlit_pitch_plots](https://github.com/tnestico/streamlit_pitch_plots): Streamlit pitch plots for MLB and AAA from the Stats API. MIT.
- [toddrob99/Baseball-GDT-Bot](https://github.com/toddrob99/Baseball-GDT-Bot) and [redball](https://github.com/toddrob99/redball): Reddit game-thread bots; the first is no longer maintained. redball is GPL-3.0.
- Stats API clients seen in topic lists: [sferik/mlb-ruby](https://github.com/sferik/mlb-ruby) (Ruby, MIT), [BaseballSharp](https://github.com/markjamesm/BaseballSharp) (.NET, MIT), [retr0h/mlb-sdk](https://github.com/retr0h/mlb-sdk) (Go), [arraypress/swift-mlb-stats](https://github.com/arraypress/swift-mlb-stats) (Swift), [asbeane/mlb-stats-api](https://github.com/asbeane/mlb-stats-api) (npm), [power-edge/pymlb_statsapi](https://github.com/power-edge/pymlb_statsapi) (Python, schema-driven).

## Gaps: things no site does yet

- **No open-source MLB app hides the score.** The 2026-10-13 pass read the
  README of each repo above. None has a spoiler or reveal mode. Basesmall's
  "low-key mode" only changes how the score looks. (This comes from the
  READMEs; nobody searched the code or the issues.)

  One README now says otherwise (2026-10-23). `FarseaSH/mlb-visual-game-replay`
  describes a "progressive reveal" for finished games: later action stays hidden
  until the reader continues. The repo holds no source to check (5 commits; a
  README and a workflow folder), so how it hides the action is unknown. The
  second-pass table above has the row.

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
