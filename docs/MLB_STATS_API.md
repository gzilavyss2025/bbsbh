# MLB Stats API — Endpoint Reference

Base URL: `https://statsapi.mlb.com/api/{ver}/...` (`ver` is almost always `v1`; a few
endpoints have a `v1.1` variant — notably `game/{gamePk}/feed/live`).

**Provenance / caveat.** This file is transcribed from the community-maintained wiki at
https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints (MIT-licensed Python wrapper,
~820 stars, endpoint page last revised Mar 2025). That wiki states plainly that it is
*"provided for reference only, without warranty or guarantee, and is not official
documentation provided by MLB"* and that the project is not affiliated with MLB. Treat
every parameter below as observed-in-the-wild rather than contractual. MLB can and does
change this API without notice. Use of MLB data is subject to
http://gdx.mlb.com/components/copyright.txt.

---

## The three parameters that matter most

Before the endpoint list, three cross-cutting params are worth internalizing because they
determine payload size and therefore mobile performance:

- **`fields`** — a comma-separated allowlist that prunes the JSON response to only the keys
  you name. Supported by nearly every endpoint below. A `feed/live` response is multiple
  megabytes unpruned; with `fields` it can be a few KB. This is the single highest-leverage
  param for a mobile PWA.
- **`hydrate`** — pulls related objects into one response instead of forcing an N+1 fan-out.
  Call any hydrate-supporting endpoint with `hydrate=hydrations` to have the API *tell you*
  which hydrations it accepts, e.g.
  `/v1/schedule?sportId=1&hydrate=hydrations&fields=hydrations`.
- **`sportId`** — `1` = MLB. The minor leagues are other sportIds (`11` AAA, `12` AA,
  `13` High-A, `14` A, `16` Rookie, `17` Winter, `51` International). Most endpoints that
  accept `sportId` work identically for MiLB, which is the mechanism for MiLB support.

---

## Game — live state, play-by-play, boxscore

| Endpoint | URL | Required | Notable params |
|---|---|---|---|
| `game` | `/{ver}/game/{gamePk}/feed/live` | `gamePk` | `timecode`, `hydrate`, `fields` |
| `game_diff` | `/{ver}/game/{gamePk}/feed/live/diffPatch` | `gamePk`, `startTimecode`+`endTimecode` | — |
| `game_timestamps` | `/{ver}/game/{gamePk}/feed/live/timestamps` | `gamePk` | — |
| `game_playByPlay` | `/{ver}/game/{gamePk}/playByPlay` | `gamePk` | `timecode`, `fields` |
| `game_boxscore` | `/{ver}/game/{gamePk}/boxscore` | `gamePk` | `timecode`, `fields` |
| `game_linescore` | `/{ver}/game/{gamePk}/linescore` | `gamePk` | `timecode`, `fields` |
| `game_contextMetrics` | `/{ver}/game/{gamePk}/contextMetrics` | `gamePk` | `timecode`, `fields` |
| `game_winProbability` | `/{ver}/game/{gamePk}/winProbability` | `gamePk` | `timecode`, `fields` |
| `game_content` | `/{ver}/game/{gamePk}/content` | `gamePk` | `highlightLimit` |
| `game_color` | `/{ver}/game/{gamePk}/feed/color` | `gamePk` | `timecode`, `fields` |
| `game_changes` | `/{ver}/game/changes` | `updatedSince` | `sportId`, `gameType`, `season` |
| `game_uniforms` | `/{ver}/uniforms/game` | `gamePks` | `fields` |

**`timecode` + `diffPatch` are the two most under-used features here.** `game_timestamps`
returns every snapshot timestamp for a game; passing one as `timecode` to `feed/live`
returns the game *as of that moment*. `diffPatch` returns only what changed between two
timecodes. Wiki note: if you only want current win probability per team, use
`game_contextMetrics` rather than `game_winProbability`.

---

## Schedule

| Endpoint | URL | Required |
|---|---|---|
| `schedule` | `/{ver}/schedule` | one of `sportId` / `gamePk` / `gamePks` |
| `schedule_tied` | `/{ver}/schedule/games/tied` | `season` |
| `schedule_postseason` | `/{ver}/schedule/postseason` | none |
| `schedule_postseason_series` | `/{ver}/schedule/postseason/series` | none |
| `schedule_postseason_tuneIn` | `/{ver}/schedule/postseason/tuneIn` | none |

`schedule` full params: `scheduleType`, `eventTypes`, `hydrate`, `teamId`, `leagueId`,
`sportId`, `gamePk`, `gamePks`, `venueIds`, `gameTypes`, `date`, `startDate`, `endDate`,
`opponentId`, `season`, `fields`.

Wiki note: `schedule_postseason_tuneIn` appears to return no data.

---

## People / players

| Endpoint | URL | Required | Params |
|---|---|---|---|
| `person` | `/{ver}/people/{personId}` | `personId` | `hydrate`, `fields` |
| `people` | `/{ver}/people` | `personIds` | `hydrate`, `fields` |
| `person_stats` | `/{ver}/people/{personId}/stats/game/{gamePk}` | `personId`, `gamePk` | `fields` |
| `people_changes` | `/{ver}/people/changes` | none | `updatedSince`, `fields` |
| `people_freeAgents` | `/{ver}/people/freeAgents` | `leagueId` | `order`, `hydrate` |
| `sports_players` | `/{ver}/sports/{sportId}/players` | `sportId`, `season` | `gameType`, `fields` |

Wiki note on `person_stats`: pass the literal string `current` in place of a `gamePk` to get
a player's current-game stats.

`people`/`person` accept a **batch** of `personIds` — one request for a whole lineup rather
than nine.

---

## Teams

| Endpoint | URL | Required |
|---|---|---|
| `teams` | `/{ver}/teams` | none |
| `team` | `/{ver}/teams/{teamId}` | `teamId` |
| `team_roster` | `/{ver}/teams/{teamId}/roster` | `teamId` (`rosterType`, `date`) |
| `team_coaches` | `/{ver}/teams/{teamId}/coaches` | `teamId` (`date`) |
| `team_personnel` | `/{ver}/teams/{teamId}/personnel` | `teamId` |
| `team_leaders` | `/{ver}/teams/{teamId}/leaders` | `teamId`, `leaderCategories`+`season` |
| `team_stats` | `/{ver}/teams/{teamId}/stats` | `teamId`, `season`+`group` |
| `team_alumni` | `/{ver}/teams/{teamId}/alumni` | `teamId`, `season`+`group` |
| `teams_affiliates` | `/{ver}/teams/affiliates` | `teamIds` |
| `teams_history` | `/{ver}/teams/history` | `teamIds` |
| `teams_stats` | `/{ver}/teams/stats` | `season`+`group`+`stats` |
| `team_uniforms` | `/{ver}/uniforms/team` | `teamIds` |

`team_roster` supports `date` — historical roster as of a given day. `team_stats` supports
`sitCodes` with `stats=statSplits` for situational splits (vs LHP/RHP, etc.); look up valid
codes via `meta('situationCodes')`.

`teams_affiliates` maps a parent club to its farm system — the clean way to wire MiLB.

---

## Stats

| Endpoint | URL | Required | Note |
|---|---|---|---|
| `stats` | `/{ver}/stats` | `stats`+`group` | **Defaults to 50 records if `limit` omitted** |
| `stats_leaders` | `/{ver}/stats/leaders` | `leaderCategories` | For all-time leaders, must pass `statType=statsSingleSeason` |
| `stats_streaks` | `/{ver}/stats/streaks` | `streakType`+`streakSpan`+`season`+`sportId`+`limit` | see below |
| `highLow` | `/{ver}/highLow/{orgType}` | `orgType`, `sortStat`+`season` | `orgType` ∈ player, team, division, league, sport, types |
| `standings` | `/{ver}/standings` | `leagueId` | `standingsTypes`, `date`, `hydrate` |
| `gamePace` | `/{ver}/gamePace` | `season` | pace-of-game, back to 1999 |
| `attendance` | `/{ver}/attendance` | one of `teamId`/`leagueId`/`leagueListId` | |

`stats` full params include `startDate`/`endDate`, `personId`, `playerPool`, `position`,
`sortStat`, `order`, `metrics`, `offset` — it is the general-purpose workhorse.

**`stats_streaks`** valid `streakType`: `hittingStreakOverall`, `hittingStreakHome`,
`hittingStreakAway`, `onBaseOverall`, `onBaseHome`, `onBaseAway`. Valid `streakSpan`:
`career`, `season`, `currentStreak`, `currentStreakInSeason`, `notable`, `notableInSeason`.

**`standings` supports `date`** — standings as they stood on any given day, which is exactly
what a spoiler-safe pregame callout wants (standings *entering* the game, not today's).

---

## Officials — umpires, scorers, datacasters

| Endpoint | URL | Required |
|---|---|---|
| `jobs` | `/{ver}/jobs` | `jobType` |
| `jobs_umpires` | `/{ver}/jobs/umpires` | none (`sportId`, `date`) |
| `jobs_umpire_games` | `/{ver}/jobs/umpires/games/{umpireId}` | `umpireId`, `season` |
| `jobs_officialScorers` | `/{ver}/jobs/officialScorers` | none |
| `jobs_datacasters` | `/{ver}/jobs/datacasters` | none |

`jobs_umpire_games` — every game an umpire worked in a season. Enables "this crew chief's
history" style notes.

---

## Reference / lookup

| Endpoint | URL | Required |
|---|---|---|
| `meta` | `/{ver}/{type}` | `type` |
| `venue` | `/{ver}/venues` | `venueIds` |
| `sports` | `/{ver}/sports` | none |
| `league` | `/{ver}/league` | `sportId` or `leagueIds` |
| `divisions` | `/{ver}/divisions` | none (call bare to list all) |
| `conferences` | `/{ver}/conferences` | none |
| `seasons` | `/{ver}/seasons{all}` | `sportId`/`divisionId`/`leagueId` |
| `season` | `/{ver}/seasons/{seasonId}` | `seasonId`, `sportId` |
| `transactions` | `/{ver}/transactions` | `teamId`/`playerId`/`date`/`startDate`+`endDate` |
| `draft` | `/{ver}/draft{prospects}{year}{latest}` | none |
| `awards` | `/{ver}/awards{awardId}{recipients}` | none (call bare to list awardIds) |
| `homeRunDerby` | `/{ver}/homeRunDerby/{gamePk}{bracket}{pool}` | `gamePk` |
| `league_allStarBallot` | `/{ver}/league/{leagueId}/allStarBallot` | `leagueId`, `season` |
| `league_allStarWriteIns` | `/{ver}/league/{leagueId}/allStarWriteIns` | `leagueId`, `season` |
| `league_allStarFinalVote` | `/{ver}/league/{leagueId}/allStarFinalVote` | `leagueId`, `season` |

### `meta` — the self-documenting endpoint

`GET /v1/{type}` where `type` is one of:

`awards`, `baseballStats`, `eventTypes`, `gameStatus`, `gameTypes`, `hitTrajectories`,
`jobTypes`, `languages`, `leagueLeaderTypes`, `logicalEvents`, `metrics`, `pitchCodes`,
`pitchTypes`, `platforms`, `positions`, `reviewReasons`, `rosterTypes`, `scheduleEventTypes`,
`situationCodes`, `sky`, `standingsTypes`, `statGroups`, `statTypes`, `windDirection`

This is how you discover valid values for other calls rather than hardcoding them.
`pitchCodes` and `eventTypes` in particular are the authoritative enumerations for parsing
play-by-play — worth pinning into the repo as generated constants instead of magic strings.

---

## Quick reference: sportIds

| id | league |
|---|---|
| 1 | MLB |
| 11 | Triple-A |
| 12 | Double-A |
| 13 | High-A |
| 14 | Single-A |
| 16 | Rookie |
| 17 | Winter |
| 51 | International |

---

## Copyright

Use of MLB data is subject to the notice at http://gdx.mlb.com/components/copyright.txt.
Neither this document nor the wiki it derives from is official MLB documentation.
