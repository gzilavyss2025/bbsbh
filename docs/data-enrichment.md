# Statcast / external-data enrichment research for bbsbh (verified 2026-07-07 against live endpoints)

All claims below were verified empirically today with real HTTP requests (including `Origin:` headers to inspect CORS grants) unless marked otherwise. Sample game: gamePk 823036 (MIL@STL 2026-07-06 F).

## 1. Statcast data ALREADY in the live feed (`/api/v1.1/game/{gamePk}/feed/live`)

Zero new endpoints needed for per-pitch/per-batted-ball enrichment. Exact paths, confirmed in `liveData.plays.allPlays[].playEvents[]` (only on events where `isPitch: true`):

**`pitchData`** (per pitch):
- `pitchData.startSpeed` (release velo, mph, e.g. 97.8), `pitchData.endSpeed`
- `pitchData.breaks.spinRate` (rpm), `.spinDirection`, `.breakHorizontal`, `.breakVertical`, `.breakVerticalInduced` (IVB), `.breakAngle`, `.breakLength`
- `pitchData.extension`, `pitchData.plateTime`, `pitchData.zone` (1–14 gameday zone), `pitchData.strikeZoneTop/Bottom`
- `pitchData.coordinates.{pX,pZ,pfxX,pfxZ,x0,z0,...}` (full 9-param trajectory)
- Pitch type: `playEvents[].details.type.code` / `.description` (e.g. `SI` / `Sinker`)

**`hitData`** (per batted ball, present only on in-play events):
- `hitData.launchSpeed` (EV, e.g. 110.9), `hitData.launchAngle`, `hitData.totalDistance` (ft)
- `hitData.trajectory` (`ground_ball`/`line_drive`/`fly_ball`/`popup`), `hitData.hardness`, `hitData.location` (fielder position digit), `hitData.coordinates.coordX/coordY` (spray chart)
- NOT in the feed: xBA/xwOBA, barrel flag, bat speed — those are Savant-only (see §3).

**MiLB availability (tested one or two final games per level, 2026-07-05):**
| Level (sportId) | startSpeed/spinRate/pitch type | launchSpeed/distance |
|---|---|---|
| MLB (1) | 100% of pitches | all batted balls |
| AAA (11) | 100% (both samples: 215/215, 287/288) | yes (36/36 BIP) |
| AA (12) | **none** (0/262, 0/308) | none |
| High-A (13) | **none** (0/276, 0/355) | none |
| Single-A (14), Florida State League | 100% (302/302, 274/274) | yes | 
| Single-A, Carolina & California League | **none** (0/285, 0/279) | none |

So availability is **park-based, not level-based**: AAA parks all have Hawk-Eye; at Single-A only the FSL (spring-training stadiums) does. Code must treat every `pitchData`/`hitData` numeric as optional (matches existing CLAUDE.md degradation convention). `src/api/derive.js` already reads playEvents; max-EV / top-velo / longest-hit derivations belong in that same reveal-only module — hitData/pitchData describe outcomes of plays (a 110 EV single reveals a hit), so **anything from playEvents is spoiler-bearing and must stay behind SealBox/`revealedThrough`**. Pitch velocity alone technically doesn't reveal score, but it's attached to plays past the reveal mark, so keep it reveal-gated like the existing pitch/whiff counts.

## 2. statsapi.mlb.com spoiler-SAFE pregame staging endpoints

Host-wide CORS confirmed: `access-control-allow-origin: *` (plus allow-credentials) on every path tested. No key, no auth. All GET.

- **Player season stats**: `GET /api/v1/people/{personId}/stats?stats=season&group=hitting&season=2026` → `stats[0].splits[0].stat.{avg,homeRuns,rbi,ops,hits,atBats,...}`. Pitching: `group=pitching` → `{era,wins,losses,inningsPitched,strikeOuts,whip}`. **MiLB works with `&sportId=11..14`** (verified: AAA pitcher 668968 → Norfolk, 4.57 ERA). Spoiler risk: near-zero pregame; note season totals update after each game, so mid-game refetch could include today's game once plays post — fetch at staging time or use `&season` + accept tiny drift. Value: pencil AVG/HR next to each lineup slot; probable pitcher's line on the matchup page.
- **Batch form (one request per lineup)**: `GET /api/v1/people?personIds=661388,592885,...&hydrate=stats(group=[hitting],type=[season],season=2026)` — verified working; ideal for staging all 9+9 hitters in 2 requests. (Nested `stats` hydration on the *schedule* `probablePitcher` did NOT populate in my test — use the people endpoint instead.)
- **Career batter-vs-pitcher matchup**: `GET /api/v1/people/{batterId}/stats?stats=vsPlayer,vsPlayerTotal&opposingPlayerId={pitcherId}&group=hitting` — verified (`vsPlayerTotal` = career: AB, H, HR, K, AVG, OPS). Spoiler risk: none pregame; classic scorebook staging ("Contreras is 0-for-3 career vs tonight's starter"). Also available: `stats=vsTeam&opposingTeamId=` (untested but same family).
- **Platoon splits**: `GET /api/v1/people/{id}/stats?stats=statSplits&sitCodes=vl,vr&group=hitting&season=2026` — verified (`vs Left .284/.782 OPS`). Other sitCodes exist (risp, h, a, d7, n7...).
- **Standings + streaks**: `GET /api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason&date=YYYY-MM-DD` — verified: `records[].teamRecords[]` has `wins/losses`, `streak.streakCode` ("L1"), `gamesBack`, `divisionRank`, `records.splitRecords` incl. `lastTen`. **Spoiler nuance**: without `date`, standings include the current game's result once final; pass `date` = day before the game (endpoint honors as-of dates, verified) so scoring a finished game later never leaks the result via a changed streak/W-L.
- **League leaders**: `GET /api/v1/stats/leaders?leaderCategories=homeRuns&season=2026&sportId=1&statGroup=hitting&limit=3` — verified. Fun-fact staging ("cleanup hitter leads MLB in HR"). Same as-of caveat as standings (no date param here; leaders drift after games).
- **Team season stats**: `GET /api/v1/teams/{teamId}/stats?season=2026&group=hitting&stats=season&sportId=1` — verified (team AVG/R/HR/OPS/SB).
- **Win probability (reveal-time only)**: `GET /api/v1/game/{gamePk}/winProbability` — verified: one entry per plate appearance with `homeTeamWinProbability`, `homeTeamWinProbabilityAdded`, `atBatIndex`. **Heavily spoiler-bearing** (the WP curve IS the game story) — usable only as a reveal-only module keyed to `atBatIndex <= revealedThrough` plays, e.g. "that double swung win probability 24.5 points." Great reveal-time fun fact; must be filtered by atBatIndex before anything renders.
- **Avoid for staging**: `stats=gameLog` (rows for today's in-progress game reveal outcomes), any `hydrate=linescore` on schedule (raw scores).

## 3. Baseball Savant — **CORS-open, confirmed** (surprising but true)

All three endpoint families returned `access-control-allow-origin: *`, `access-control-allow-methods: GET, OPTIONS`, no key:

- **`GET https://baseballsavant.mlb.com/gf?game_pk={gamePk}`** — JSON per-game feed, verified for MLB and **AAA** (worked for gamePk 815810). Per-pitch rows in `team_home[]`/`team_away[]`/`exit_velocity[]` carry everything the statsapi feed has PLUS Savant-only fields verified in the response: **`xba`** (per batted ball), **`is_barrel`**, **`batSpeed`**, `isSword` (swinging-strike "sword"), `hit_distance`, `pitcher_time_thru_order`, `contextMetrics`. **Spoiler risk: extreme** — payload includes `scoreboard.linescore`, `boxscore`, play descriptions. Under the app's DOM-based spoiler rule it's usable, but only from inside reveal-only code paths (treat like `linescore.js`), filtered by inning/half against `revealedThrough`. Value: reveal-time fun facts statsapi can't give ("that single had a .180 xBA", "barrel", "73 mph bat speed").
- **`GET /statcast_search/csv?all=true&type=details&player_type=batter&game_pk={pk}`** — CORS-open, returns CSV with `release_speed`, xwOBA-family columns, etc. Caveats observed: same-day game returned header-only, and an immediate repeat request returned an empty body — Savant search is known to lag (~next morning) and rate-limit. Not suitable for live use; `/gf` is the reliable per-game source.
- **`GET /leaderboard/statcast?type=batter&year=2026&csv=true`** — CORS-open, `text/csv`. Season Statcast leaderboards (avg EV, barrel%, sprint speed via `/leaderboard/sprint_speed?year=2026&csv=true`, untested but same family). Spoiler risk: none (season aggregates); good staging color ("tonight's 3-hitter: 94th-percentile exit velo"). Caveat: CSV parsing in-browser, columns undocumented and occasionally renamed — pin defensively.
- Savant is undocumented/unofficial; endpoints have historically been stable for years but carry more breakage risk than statsapi. Keep every Savant call optional-with-fallback.

## 4. Other free CORS-open options

- **`https://bdfed.stitch.mlbinfra.com/bdfed/stats/player?...`** — MLB.com's own stats-page backend; **verified CORS-open** (`access-control-allow-origin: *`, max-age 86400). Sortable/filterable season stat tables (e.g. `?stitch_env=prod&season=2026&sportId=1&stats=season&group=hitting&sortStat=onBasePlusSlugging&limit=25`). Mostly redundant with statsapi `stats/leaders` + people stats; useful only if you want ranked tables with percentile-ish context in one call. Undocumented.
- **Fangraphs** (`www.fangraphs.com/api/...`): my test path 404'd and no ACAO header was present — not usable from the browser; skip.
- Legacy `lookup-service-prod.mlb.com` is deprecated; MLB-StatsAPI (toddrob) and the community statsapi docs (github.com/toddrob99/MLB-StatsAPI/wiki) remain the best endpoint reference. Nothing else free/no-key/CORS-open is worth adding — statsapi + Savant covers everything.

## Recommendations mapped to app structure

1. **Reveal-time Statcast facts (task #6)**: derive max EV / hardest hit / top pitch velo / longest HR entirely from the existing feed's `pitchData`/`hitData` inside `src/api/derive.js` (reveal-only) — no new fetch, works at MLB + AAA + FSL, degrades to absent elsewhere. Optionally layer Savant `/gf` for xBA/barrel/batSpeed as a second reveal-only fetch that fails soft.
2. **Staging (task #5)**: batch `people?personIds=...&hydrate=stats(...)` for lineup season lines; `stats=vsPlayer` vs the probable pitcher; `standings?date={day-before}` for streak/GB/L10; all spoiler-safe with the date guard.
3. Service worker: add `baseballsavant.mlb.com` to the `NetworkOnly` list in `vite.config.js` if Savant is adopted (same stale-spoiler rationale as statsapi).

Relevant repo files: /home/user/bbsbh/src/api/mlb.js (fetch layer), /home/user/bbsbh/src/api/derive.js (reveal-only home for new Statcast derivations), /home/user/bbsbh/src/api/select.js (spoiler-free home for staging selectors), /home/user/bbsbh/vite.config.js (SW caching rules).