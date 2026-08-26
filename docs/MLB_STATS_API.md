# MLB Stats API — Endpoint Reference

Base URL: `https://statsapi.mlb.com/api/{ver}/...` (`ver` is almost always `v1`; a few
endpoints have a `v1.1` variant — notably `game/{gamePk}/feed/live`).

**Provenance / caveat.** This file started as a transcription from the community-maintained
wiki at https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints (MIT-licensed Python
wrapper, ~820 stars, endpoint page last revised Mar 2025). That wiki states plainly that it
is *"provided for reference only, without warranty or guarantee, and is not official
documentation provided by MLB"* and that the project is not affiliated with MLB. Treat every
parameter below as observed-in-the-wild rather than contractual. MLB can and does change
this API without notice. Use of MLB data is subject to
http://gdx.mlb.com/components/copyright.txt.

The **Status** column on each row, and everything under "Audit status" below, comes from a
live audit of THIS APP — direct calls made from this codebase against the real API on
2026-08-26, cross-checked against every caller in `src/` and `scripts/`. The wiki did not
supply any of that. Where the wiki and this app's live behavior disagree, the row now
describes the app's live, verified behavior.

---

## Audit status

A 2026-08-26 audit checked every row below against the live API and against every caller in
this codebase.

| Status | Count | Meaning |
|---|---|---|
| `confirmed` | 21 | Live-checked, matches this row, and a caller in this codebase depends on it. |
| `unused` | 35 | Live-checked and matches this row, but no code in this codebase calls it. |
| `drifted` | 3 | Live-checked, but the row's required params no longer match what the API demands. Each row says what changed. |
| `dead` | 3 | The endpoint no longer responds as documented (404, or now sits behind a login). |
| `new` | 2 | A real endpoint this codebase calls that this file never documented. Added with its real URL and params. |

**Total rows: 64.**

Do not hand-edit these status markers as the only fix for a future drift report. Re-run the
same audit workflow — inventory every documented and called endpoint, live-check each one,
diff the two lists — and update this file from that fresh run. A marker edited by hand,
without a live re-check, is a guess wearing the audit's badge.

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

| Endpoint | URL | Required | Notable params | Status |
|---|---|---|---|---|
| `game` | `/v1.1/game/{gamePk}/feed/live` | `gamePk` | `timecode`, `hydrate`, `fields` | confirmed |
| `game_diff` | `/v1.1/game/{gamePk}/feed/live/diffPatch` | `gamePk`, `startTimecode`+`endTimecode` | — | confirmed |
| `game_timestamps` | `/{ver}/game/{gamePk}/feed/live/timestamps` | `gamePk` | — | unused |
| `game_playByPlay` | `/{ver}/game/{gamePk}/playByPlay` | `gamePk` | `timecode`, `fields` | confirmed |
| `game_boxscore` | `/{ver}/game/{gamePk}/boxscore` | `gamePk` | `timecode`, `fields` | confirmed |
| `game_linescore` | `/{ver}/game/{gamePk}/linescore` | `gamePk` | `timecode`, `fields` | unused |
| `game_contextMetrics` | `/{ver}/game/{gamePk}/contextMetrics` | `gamePk` | `timecode`, `fields` | unused |
| `game_winProbability` | `/{ver}/game/{gamePk}/winProbability` | `gamePk` | `timecode`, `fields` | confirmed |
| `game_content` | `/{ver}/game/{gamePk}/content` | `gamePk` | `highlightLimit` | confirmed |
| `game_color` | `/{ver}/game/{gamePk}/feed/color` | `gamePk` | `timecode`, `fields` | dead |
| `game_changes` | `/{ver}/game/changes` | `updatedSince` | `sportId`, `gameType`, `season` | unused |
| `game_uniforms` | `/{ver}/uniforms/game` | `gamePks` | `fields` | confirmed |

Notes:

- **`game_color` is dead.** It returns HTTP 404 for every `gamePk` tested, on both `v1` and
  `v1.1`. MLB appears to have removed it. No code in this app calls it, so nothing breaks —
  but treat the row as historical, not callable.
- **`game_diff` degrades on purpose.** With both `startTimecode` and `endTimecode` close
  together, it returns the documented array of diff patches. This app calls it with only
  `startTimecode` (a gap over 200 seconds); the live API then falls back to a full, non-array
  feed object instead of a diff array. `src/api/game.js` already documents this fallback and
  handles both shapes. This is an intentional workaround, not a doc error.
- **`game_timestamps` + `diffPatch` are still the two most under-used features here.**
  `game_timestamps` returns every snapshot timestamp for a game; passing one as `timecode` to
  `feed/live` returns the game *as of that moment*. Wiki note, unverified in this audit: if
  you only want current win probability per team, use `game_contextMetrics` rather than
  `game_winProbability`.

---

## Schedule

| Endpoint | URL | Required | Status |
|---|---|---|---|
| `schedule` | `/{ver}/schedule` | one of `sportId` / `gamePk` / `gamePks` | confirmed |
| `schedule_tied` | `/{ver}/schedule/games/tied` | `season` | unused |
| `schedule_postseason` | `/{ver}/schedule/postseason` | none | unused |
| `schedule_postseason_series` | `/{ver}/schedule/postseason/series` | none | unused |
| `schedule_postseason_tuneIn` | `/{ver}/schedule/postseason/tuneIn` | none | unused |

`schedule` full params: `scheduleType`, `eventTypes`, `hydrate`, `teamId`, `leagueId`,
`sportId`, `gamePk`, `gamePks`, `venueIds`, `gameTypes`, `date`, `startDate`, `endDate`,
`opponentId`, `season`, `fields`.

`schedule_postseason_tuneIn` still returns no data — confirmed live, matching the earlier
wiki note.

---

## People / players

| Endpoint | URL | Required | Params | Status |
|---|---|---|---|---|
| `person` | `/{ver}/people/{personId}` | `personId` | `hydrate`, `fields` | confirmed |
| `people` | `/{ver}/people` | `personIds` | `hydrate`, `fields` | confirmed |
| `person_stats` | `/{ver}/people/{personId}/stats` | `personId` + (`type`+`group` or `stats`+`group`) | `season`, `sportId`, `stats` | drifted |
| `people_changes` | `/{ver}/people/changes` | none | `updatedSince`, `fields` | unused |
| `people_freeAgents` | `/{ver}/people/freeAgents` | `season` | `leagueId`, `order`, `hydrate` | drifted |
| `sports_players` | `/{ver}/sports/{sportId}/players` | `sportId`, `season` | `gameType`, `fields` | confirmed |
| `people_awards` | `/{ver}/people/{personId}/awards` | `personId` | — | new |

Notes:

- **`person_stats` drifted.** This row used to point at
  `/people/{personId}/stats/game/{gamePk}` (required `personId`+`gamePk`), with a wiki note
  about passing the literal string `current` for `gamePk`. That form still responds, but no
  code in this app calls it. Every real caller uses the query-param form shown above —
  `/people/{personId}/stats?stats=season&group=hitting&season=…&sportId=…` — with `personId`
  as the only path param. The row now documents the form this app depends on.
- **`people_freeAgents` drifted.** The required param was `leagueId`. Live testing shows the
  opposite: a call with `leagueId` but no `season` fails ("Required request parameter
  'season' ... is not present"); a call with `season` alone succeeds. `season` is required;
  `leagueId` is an optional filter.
- **`people_awards` is new.** `src/api/person-fetch.js` calls it for a player's career awards
  list on the player bio page. It was never a row in this file. It returns an `awards[]`
  array (id, name, date, season, team, player).

`people`/`person` accept a **batch** of `personIds` — one request for a whole lineup rather
than nine.

---

## Teams

| Endpoint | URL | Required | Status |
|---|---|---|---|
| `teams` | `/{ver}/teams` | none | confirmed |
| `team` | `/{ver}/teams/{teamId}` | `teamId` | confirmed |
| `team_roster` | `/{ver}/teams/{teamId}/roster` | `teamId` (`rosterType`, `date`) | confirmed |
| `team_coaches` | `/{ver}/teams/{teamId}/coaches` | `teamId` (`date`) | confirmed |
| `team_personnel` | `/{ver}/teams/{teamId}/personnel` | `teamId` | confirmed |
| `team_leaders` | `/{ver}/teams/{teamId}/leaders` | `teamId`, `leaderCategories`+`season` | unused |
| `team_stats` | `/{ver}/teams/{teamId}/stats` | `teamId`, `season`+`group`+`stats` | drifted |
| `team_alumni` | `/{ver}/teams/{teamId}/alumni` | `teamId`, `season`+`group` | unused |
| `teams_affiliates` | `/{ver}/teams/affiliates` | `teamIds` | confirmed |
| `teams_history` | `/{ver}/teams/history` | `teamIds` | unused |
| `teams_stats` | `/{ver}/teams/stats` | `season`+`group`+`stats` | unused |
| `team_uniforms` | `/{ver}/uniforms/team` | `teamIds` | unused |

Notes:

- **`team_stats` drifted.** The required params used to read `teamId`, `season`+`group`. A
  live call with just those now returns HTTP 404 ("Object not found"). It also needs `stats`
  (for example `stats=season`) to succeed — matching its sibling endpoint `teams_stats`,
  which already required `stats`. No code in this app calls `team_stats` by name, so this is
  a doc fix, not an app break.

`team_roster` supports `date` — historical roster as of a given day. `team_stats` supports
`sitCodes` with `stats=statSplits` for situational splits (vs LHP/RHP, and so on); look up
valid codes with `meta('situationCodes')`.

`teams_affiliates` maps a parent club to its farm system — the clean way to wire MiLB.

---

## Stats

| Endpoint | URL | Required | Note | Status |
|---|---|---|---|---|
| `stats` | `/{ver}/stats` | `stats`+`group` | **Defaults to 50 records if `limit` omitted** | unused |
| `stats_leaders` | `/{ver}/stats/leaders` | `leaderCategories` | For all-time leaders, must pass `statType=statsSingleSeason` | unused |
| `stats_streaks` | `/{ver}/stats/streaks` | — | see below | dead |
| `highLow` | `/{ver}/highLow/{orgType}` | `orgType`, `sortStat`+`season` | `orgType` ∈ player, team, division, league, sport, types | unused |
| `standings` | `/{ver}/standings` | `leagueId` | `standingsTypes`, `date`, `hydrate` | confirmed |
| `gamePace` | `/{ver}/gamePace` | `season` | pace-of-game, back to 1999 | unused |
| `attendance` | `/{ver}/attendance` | one of `teamId`/`leagueId`/`leagueListId` | | unused |

Notes:

- **`stats_streaks` is dead.** Every parameter combination tested — bare, and with
  `streakType`+`streakSpan`+`season`+`sportId`+`limit` filled in — returns HTTP 404
  (`{"error":"Not Found"}`). MLB appears to have removed or renamed it. No code in this app
  calls it.

`stats` full params include `startDate`/`endDate`, `personId`, `playerPool`, `position`,
`sortStat`, `order`, `metrics`, `offset` — it is the general-purpose workhorse.

Historical `stats_streaks` values, kept for reference only (endpoint no longer live): valid
`streakType` was `hittingStreakOverall`, `hittingStreakHome`, `hittingStreakAway`,
`onBaseOverall`, `onBaseHome`, `onBaseAway`. Valid `streakSpan` was `career`, `season`,
`currentStreak`, `currentStreakInSeason`, `notable`, `notableInSeason`.

**`standings` supports `date`** — standings as they stood on any given day, which is exactly
what a spoiler-safe pregame callout wants (standings *entering* the game, not today's).

---

## Officials — umpires, scorers, datacasters

| Endpoint | URL | Required | Status |
|---|---|---|---|
| `jobs` | `/{ver}/jobs` | `jobType` | unused |
| `jobs_umpires` | `/{ver}/jobs/umpires` | none (`sportId`, `date`) | unused |
| `jobs_umpire_games` | `/{ver}/jobs/umpires/games/{umpireId}` | `umpireId`, `season` | dead |
| `jobs_officialScorers` | `/{ver}/jobs/officialScorers` | none | unused |
| `jobs_datacasters` | `/{ver}/jobs/datacasters` | none | unused |

Notes:

- **`jobs_umpire_games` is dead for public use.** It now returns an HTML Okta sign-in page
  (HTTP 401), not JSON, for every umpire and season tested. It sits behind MLB's internal
  login and does not work without MLB staff credentials this app does not have.
- **`jobs_datacasters` returns job title "Stringer"** (`jobId` `MSTR`), not literally
  "Datacaster." The endpoint and shape otherwise match this row.

`jobs_umpire_games`, when it worked, listed every game an umpire worked in a season —
"this crew chief's history" style notes. It no longer works publicly; do not build on it.

---

## Reference / lookup

| Endpoint | URL | Required | Status |
|---|---|---|---|
| `meta` | `/{ver}/{type}` | `type` | unused |
| `venue` | `/{ver}/venues` | `venueIds` | unused |
| `sports` | `/{ver}/sports` | none | unused |
| `league` | `/{ver}/league` | `sportId` or `leagueIds` | unused |
| `leagues` | `/{ver}/leagues` | `sportId` | new |
| `divisions` | `/{ver}/divisions` | none (call bare to list all) | unused |
| `conferences` | `/{ver}/conferences` | none | unused |
| `seasons` | `/{ver}/seasons{all}` | `sportId`/`divisionId`/`leagueId` | unused |
| `season` | `/{ver}/seasons/{seasonId}` | `seasonId`, `sportId` | confirmed |
| `transactions` | `/{ver}/transactions` | `teamId`/`playerId`/`date`/`startDate`+`endDate` | confirmed |
| `draft` | `/{ver}/draft{prospects}{year}{latest}` | none | unused |
| `awards` | `/{ver}/awards{awardId}{recipients}` | none (call bare to list awardIds) | confirmed |
| `homeRunDerby` | `/{ver}/homeRunDerby/{gamePk}{bracket}{pool}` | `gamePk` | unused |
| `league_allStarBallot` | `/{ver}/league/{leagueId}/allStarBallot` | `leagueId`, `season` | unused |
| `league_allStarWriteIns` | `/{ver}/league/{leagueId}/allStarWriteIns` | `leagueId`, `season` | unused |
| `league_allStarFinalVote` | `/{ver}/league/{leagueId}/allStarFinalVote` | `leagueId`, `season` | unused |

Notes:

- **`leagues` is new.** This file documented the singular `league` (`sportId` or
  `leagueIds`) but never the plural `leagues`, which `scripts/gen-farm-system.mjs` calls
  live as `/leagues?sportId={sportId}&season={season}` to sweep every minor-league level. It
  returns a `leagues[]` array (id, name, abbreviation, seasonState, numTeams,
  seasonDateInfo, and more).
- **`transactions` real callers match on `date`, not `effectiveDate`.** `effectiveDate` can
  drift months from `date` for some transaction types. This is known, existing behavior, not
  new drift — see `src/api/transactions/clubFeed.js` and the `gen-*` transaction scripts.
- **`awards`'s real shape in use** is `/awards/{awardId}/recipients?season=…`, read by
  `src/api/person-fetch.js` and several `gen-*` scripts. A bare call to `/awards` still lists
  every `awardId`, as documented.

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
Neither this document nor the wiki it partly derives from is official MLB documentation.
