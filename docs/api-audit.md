# MLB Stats API audit — `bbsbh`

Audit of every MLB Stats API call this codebase makes, measured against
`docs/MLB_STATS_API.md` (the community-wiki endpoint reference). Covers the three
surfaces that talk to statsapi: the **client** (`src/`), the **precompute scripts**
(`scripts/`), and the **Vercel edge layer** (`api/`).

**Verification caveat.** Per `CLAUDE.md`, this sandbox usually can't reach
`statsapi.mlb.com`, so the payload-size and `fields=`-behavior claims below were originally reasoned
from the code and the reference doc, **not** confirmed against live responses. Every
recommendation that depends on a live payload is flagged *(verify against a live game)*.
Treat the reference doc as observed behavior, not contract — confirm a field path against a
real response before depending on it. No factual error in `docs/MLB_STATS_API.md` was found
that could be corrected without hitting the endpoints; items needing live confirmation are
flagged inline.

> **Measured follow-up (2026-07-12, local session — statsapi reachable).** A later local
> Claude Code session *did* reach `statsapi.mlb.com` and measured the payload/`fields=` claims
> the sandbox couldn't. Sections **2a**, **R1**, and **R4** below carry inline
> `> Measured:` blocks with the live numbers (all gzipped-on-the-wire, against gamePk 824998, a
> 12-inning game, and 776258, a 9-inning final). Two conclusions changed materially: **R1 grew** (the
> already-downloaded win-prob payload is 97% prunable) and **R4 shrank/redirected** (the feed's
> biggest branch is both needed and un-prunable, so the naive prune is closer to churn than to the
> big win — a split-fetch is the better path). The `fields=`-behavior confirmations are recorded so
> the *(verify against a live game)* flags on those items are now discharged.

---

## 1. Endpoint inventory

Every distinct URL the codebase constructs. All statsapi paths resolve against
`https://statsapi.mlb.com`; the client goes through `getJson` (`src/api/statsapi.js:7-17`),
which sets no default params and no caching.

### 1a. Client — `src/` (browser fetches)

| Reference endpoint | URL built | Params | Where it lives | Score-revealing? |
|---|---|---|---|---|
| `game` (feed/live) | `/api/v1.1/game/{gamePk}/feed/live` | **none** | `game.js:7` `fetchGameFeed`; also `person-fetch.js:268,288,321,435` (player "firsts") | **YES** |
| `game_winProbability` | `/api/v1/game/{gamePk}/winProbability` | none | `game.js:18` `fetchWinProbability` | **YES** |
| `game_boxscore` | `/api/v1/game/{gamePk}/boxscore` | none | `topPerformers.js:34` | **YES** |
| `venue` | `/api/v1/venues/{venueId}` | `hydrate=location,fieldInfo` | `game.js:34` `fetchVenue` | no |
| `team_coaches` | `/api/v1/teams/{teamId}/coaches` | `?season={season}` (optional) | `game.js:60` `fetchManager` | no |
| `person_stats` (season) | `/api/v1/people/{personId}/stats` | `stats=season&group=pitching&season={y}[&sportId]` | `game.js:117` `fetchPitcherSeasonLine` | aggregate |
| `schedule` | `/api/v1/schedule` | `sportId&date&hydrate=team,venue(timezone),lineups,officials,probablePitcher` | `schedule.js:88` `fetchSchedule` | rows carry scores; **dropped in `normalizeGame`** |
| `schedule` | `/api/v1/schedule` | `sportId&date&hydrate=team` (light) | `schedule.js:132` `resolveGame` | dropped |
| `schedule` | `/api/v1/schedule` | `gamePks={csv}&hydrate=team` (batched) | `schedule.js:160` `fetchGamesByPk` | dropped |
| `schedule` | `/api/v1/schedule` | `sportId&teamId&season&gameType=R` | `schedule.js:192` `fetchHeadToHead` | scores present, **not copied** |
| `schedule` | `/api/v1/schedule` | `sportId&teamId&season&gameType=R&hydrate=team` | `schedule.js:229` `fetchTeamSchedule` | scores present, **not copied** |
| `teams` | `/api/v1/teams` | `sportId&activeStatus=Y` | `schedule.js:110` (fallback) | no |
| `game_uniforms` | `/api/v1/uniforms/game` | `gamePks={gamePk}` / `{csv}` (slate batched) | `uniforms.js:16,54` | no |
| `team` | `/api/v1/teams/{teamId}` | none | `team.js:34` `fetchTeam` (static-first) | no |
| `team_roster` | `/api/v1/teams/{teamId}/roster` | `rosterType&hydrate=person(stats(type=season,group=[hitting,pitching],sportId,season))` | `team.js:79` `fetchTeamRoster` | aggregates |
| `team_roster` | `/api/v1/teams/{teamId}/roster` | `rosterType=40Man&season` / `rosterType=active` | `team.js:104,131` | no |
| `teams_affiliates` | `/api/v1/teams/affiliates` | `teamIds&season&hydrate=venue(location)` | `team.js:192` (static-first) | no |
| `standings` | `/api/v1/standings` | `leagueId&season&standingsTypes=regularSeason[&date][&hydrate]` | `team.js:236` `fetchLeagueStandings` | **YES — date-gated (see §4)** |
| `teams_stats` | `/api/v1/teams/stats` | `season&sportIds=1&group&stats=season` | `team.js:292` | aggregates |
| `person` | `/api/v1/people/{personId}` | `hydrate=currentTeam,team,draft` | `person-fetch.js:27` | no |
| `person_stats` | `/api/v1/people/{personId}/stats` | many (`stats`,`group`,`season`,`startDate`,`endDate`,`sitCodes`,`sportId`) | `person-fetch.js:56,130,157` | aggregates |
| `people` (batch) | `/api/v1/teams?teamId={csv}` | batched | `person-fetch.js:210` | no |
| `awards` | `/api/v1/people/{id}/awards`, `/api/v1/awards/{award}/recipients` | `sportId=1&season` | `person-fetch.js:342,411` | no |
| `transactions` | `/api/v1/transactions` | `teamId`/`playerId`+`startDate`+`endDate` | `person-fetch.js:359,383` | no |
| `people` (search) | `/api/v1/people/search` | `names&hydrate=currentTeam` | `search.js:30` | no |
| `stats` | `/api/v1/stats` | `stats=season&group&season&sportId&playerPool=all&limit=5000` | `statsLevels.js:37,53` | aggregates |

**Non-statsapi remote hosts (client):**

| Host | Where | Purpose | Score-revealing? |
|---|---|---|---|
| `api.open-meteo.com` / `archive-api.open-meteo.com` | `weather.js:199,205` | outdoor first-pitch weather | no |
| `site.api.espn.com` (scoreboard) | `broadcast.js:63` | TV network names (not in feed) | response has scores; only network names read |
| `api.bsky.app` (searchPosts) | `buzz.js:67` | Bluesky game buzz | **YES — reveal-only, SealBox-gated** |
| `dapi.mlbinfra.com` | `gameNotes.js:62` | live Game Notes PDF links | link only in-app; PDF recaps results |
| `img.mlbstatic.com` (PDF) | `whatsBrewing.js:337` | client-side pdfjs parse | PDF recaps results |
| `mlbstatic.com` logos / `img.mlbstatic.com` headshots | `lib/teams.js`, `person-fetch.js:235` | art | no |

**Same-origin static reads** (build-time-fetch pattern; `public/data/*.json` precomputed by
`scripts/gen-*.mjs`): `war.json`, `war-history.json`, `vs-team-splits.json`, `rehab.json`,
`umpires.json`, `minors-leaders.json`, `milb-history.json`, `teams.json`, `affiliates.json`,
`game-notes.json`, `savant-percentiles.json`, `top-prospects.json`, `callouts/{date}.json`.

### 1b. Precompute scripts — `scripts/`

| Reference endpoint | URL built | Params | Script | Cardinality per run |
|---|---|---|---|---|
| `schedule` | `/api/v1/schedule` | `sportId={csv}&date&hydrate=team,probablePitcher` | `gen-callouts.mjs:890` | 1 |
| `team_roster` | `/api/v1/teams/{id}/roster` | `rosterType=40Man&hydrate=person(stats(...))` | `gen-callouts.mjs:311` | 1/team |
| `standings` | `/api/v1/standings` | `leagueId&season&standingsTypes=regularSeason&date={asOf}` | `gen-callouts.mjs:344` | 2 |
| `schedule` | `/api/v1/schedule` | `sportId&teamId&season&gameType=R&hydrate=team,linescore` | `gen-callouts.mjs:377` | 1/team |
| `person_stats` | `/api/v1/people/{id}/stats` | `stats=gameLog[,career]&group=hitting/pitching&season[&sportId]` | `gen-callouts.mjs:518,663,702` | 1/player |
| `person_stats` | `/api/v1/people/{id}/stats` | `stats=statSplits&sitCodes=…&group` | `gen-callouts.mjs:626,787` | 1/player |
| `person_stats` | `/api/v1/people/{id}/stats` | `stats=playLog&group=pitching&season[&sportId]` | `gen-callouts.mjs:838` | 1/probable starter |
| `teams` | `/api/v1/teams` | `sportId=1&activeStatus=Y` | `gen-vs-team-splits.mjs:125` | 1 |
| `schedule` | `/api/v1/schedule` | `sportId=1&startDate&endDate&hydrate=team` | `gen-vs-team-splits.mjs:142` | 1 |
| `team_roster` | `/api/v1/teams/{id}/roster` | `rosterType=active` | `gen-vs-team-splits.mjs:173` | 1/team |
| `person_stats` | `/api/v1/people/{id}/stats` | `stats=yearByYear&group&sportId=1` | `gen-vs-team-splits.mjs:191` | 1/player |
| `person_stats` | `/api/v1/people/{id}/stats` | `stats=gameLog&group&season&sportId=1` | `gen-vs-team-splits.mjs:203` | **1/season/player (N+1)** |
| `schedule` | `/api/v1/schedule` | `sportId&date&hydrate=team` (nested days×levels) | `gen-former-teammates.mjs:139` | ~15 |
| `team_roster` | `/api/v1/teams/{id}/roster` | `rosterType=active` | `gen-former-teammates.mjs:172` | 1/team |
| `person` | `/api/v1/people/{id}` | none (debut year) | `gen-former-teammates.mjs:186` | 1/player |
| `person_stats` | `/api/v1/people/{id}/stats` | `stats=yearByYear&group[&sportId]` (×2 groups ×5 levels) | `gen-former-teammates.mjs:197` | ~10/player |
| `teams` | `/api/v1/teams/{id}` | none (org fallback, cached) | `gen-former-teammates.mjs:319` | 1/club |
| `people` (batch) | `/api/v1/people?personIds={csv}` | chunked 100 | `gen-former-teammates.mjs:534` | n/100 |
| `transactions` | `/api/v1/transactions` | `startDate&endDate` | `gen-rehab.mjs:202` | 1 |
| `teams`/`people` (batch) | `/api/v1/teams?sportId=1`, `people?personIds`, `teams?teamId` | batched | `gen-rehab.mjs:104,110,118` | 1 each |
| `person_stats` | `/api/v1/people/{id}/stats` | `stats=gameLog&group&season[&sportId]` (MLB + club level) | `gen-rehab.mjs:126` | 2/candidate |
| `schedule` | `/api/v1/schedule` | `teamId&startDate&endDate&gameType=R[&sportId]` | `gen-rehab.mjs:141` | 1/club (memoized) |
| `schedule` | `/api/v1/schedule` | `sportId=1&season&gameType=R&hydrate=officials,team` | `gen-umpires.mjs:48` | **1 (whole season)** |
| `teams_affiliates` | `/api/v1/teams/affiliates` | `teamIds={csv}&season&hydrate=venue(location)` | `gen-affiliates.mjs:43` | **1 (all 30 orgs)** |
| `teams` | `/api/v1/teams` | `sportId=1`, then `sportId={level}&season` | `gen-milb-history.mjs:90,103` | ~148 (by-hand affiliate map) |
| `teams` | `/api/v1/teams` | `sportId&activeStatus=Y` | `gen-teams.mjs:27` | 1/level |
| `stats` | `/api/v1/stats` | `stats=season&group&season&sportId&playerPool=all&limit=5000` | via `statsLevels.js:37` | 8 (`gen-minors-leaders.mjs`) |
| `game` (feed/live) | `/api/v1.1/game/{pk}/feed/live` | none | `game-buzz.mjs:60` | 1 |
| `game_winProbability` | `/api/v1/game/{pk}/winProbability` | none | `game-buzz.mjs:148` | 1 |

**Non-statsapi (scripts):** FanGraphs leaderboard (`gen-war.mjs:28`, `gen-war-history.mjs:37`),
Baseball Savant percentile CSV (`gen-savant-percentiles.mjs:93`), `dapi.mlbinfra.com`
(`gen-game-notes.mjs:66`), `mlb.com/prospects` HTML scrape (`fetch-top-prospects.mjs:28`),
Bluesky + Reddit (`game-buzz.mjs`).

### 1c. Vercel edge layer — `api/` (crawler-only, server-side)

The **only** server-side statsapi calls, all in `api/_lib/cards.js`, all for link-preview cards:

| Endpoint | URL | Params | Function |
|---|---|---|---|
| `schedule` | `/api/v1/schedule` | `sportId&date&hydrate=team` (per level) | `resolveGame` (`cards.js:71`) |
| `person` | `/api/v1/people/{id}` | `hydrate=currentTeam` | `playerCard` (`cards.js:104`) |
| `team` | `/api/v1/teams/{id}` | none | `teamCard` (`cards.js:126`) |

`api/og.js` makes **no** statsapi call (all display strings arrive as query params); it fetches
only cosmetic assets (`img.mlbstatic.com` headshot/logo, Google Fonts), each inlined as a data
URI and degrading to a monogram/abbreviation/bundled font. `api/preview.js` fetches only its own
`index.html`. Everything degrades to `null` → the static default OG card.

---

## 2. Gaps

### 2a. `fields` — payload pruning: used **nowhere** (0 occurrences repo-wide)

Not one statsapi call in `src/`, `scripts/`, or `api/` passes `fields=`. Every call pulls the
full object and discards most of it client-side; a few scope sub-resources via `hydrate=`, which
trims to related objects but not scalar fields.

- **The live feed is the headline.** `fetchGameFeed` (`game.js:6-8`) is literally
  `getJson(\`/api/v1.1/game/${gamePk}/feed/live\`)` — no `fields`, no `hydrate`. The multi-MB
  feed is pulled unpruned on **every game view and every Refresh**, and again N times per
  player-page "firsts" scan. On a phone at a ballpark with bad signal this is the dominant cost.
  It is also the highest-risk thing to prune (§5), because the app reads deeply across it.

  > **Measured (gzipped wire, the only figure that matters on 4G):** feed/live is **183 KB** on a
  > 12-inning game (824998; 1.11 MB raw) and **142 KB** on a 9-inning final (776258; 843 KB raw) —
  > *not* multi-MB compressed, though the raw JSON is. The server honors gzip
  > (`content-encoding: gzip`) and `fields=` on the `v1.1` nested arrays (both confirmed live).
  > Play-by-play (`liveData.plays.allPlays`) is 76–79% of it; within that, `playEvents[].pitchData`
  > is the bulk. So the feed *is* the dominant payload — but see R4: most of `pitchData` can't
  > actually be dropped.
- **Cheap, clean client win:** `fetchTeamSchedule` (`schedule.js:229`) and `fetchHeadToHead`
  (`:192`) download each schedule row's `score`/`isWinner`/`leagueRecord` and then deliberately
  omit them from the returned shape. A `fields=` allowlist (gamePk, officialDate, gameDate,
  gameNumber, doubleHeader, status, teams.*.team.{id,name,abbreviation,teamName}) would prune the
  payload **and** keep the score out of client memory entirely (a spoiler win too — see §4).
- **Cron sweeps** (`gen-vs-team-splits` game logs, `gen-callouts` roster + full-season linescore
  sweeps, `gen-umpires` season scan, `statsLevels` `limit=5000` pulls) would all shrink
  materially with `fields=`. But these run nightly on GitHub Actions, so the benefit is
  cron runtime / bandwidth / reliability — **not** the ballpark user. Lower priority by the
  impact metric that matters here.

### 2b. `hydrate` — N+1 fan-outs

The app already uses `hydrate` well in several spots (schedule readiness in one call
`schedule.js:85`; roster+season-stats in one call `team.js:79`; venue location `game.js:34`).
Remaining fan-outs:

- **`gen-vs-team-splits.mjs` (worst).** One `gameLog` call **per MLB season per player**
  (`:203`) — ~750 active players × ~5 seasons ≈ several thousand `person_stats` calls. Inherent:
  the vs-team split types carry no game granularity, so a game-log sweep is required. `fields=`
  helps size; nothing collapses the request count.
- **`gen-callouts.mjs`.** ~2 calls/team (roster + full-season linescore sweep) + 1–2/player +
  1/probable → easily 1,000–3,000+ calls on a full MLB+MiLB slate. No batch endpoint covers the
  per-team full-season scoring sweep.
- **`gen-former-teammates.mjs`.** ~11 calls/player (1 debut + ~10 `yearByYear`, because a
  comma-`sportId` list returns nothing, so each of 5 levels × 2 groups is its own call). The
  debut-year call (`:186`) could potentially ride a `hydrate` on another call.
- **Player-page "firsts" (client, real user).** `person-fetch.js:262-321` loops
  **full `/feed/live`** over the debut-year game log to find first start / first strikeout / first
  pitcher faced. Multiple multi-MB feeds on a player page. `game_boxscore`/`game_playByPlay` with
  `fields=` (or `person_stats/game/{gamePk}`) would replace each full feed with a few KB.
- **No `/people?personIds=` batch on the client.** Confirmed absent. The player page loads one
  player at a time, so this is not currently a fan-out — but any future "whole lineup at once"
  surface should use the batch `people` form (scripts already do: `gen-rehab`,
  `gen-former-teammates:534`, `fetch-top-prospects`).

### 2c. `standings?date=` and `team_roster?date=` — as-of-date state

**Already handled well; no fetch-current-and-subtract anti-pattern found.**

- `fetchLeagueStandings` (`team.js:233-236`) passes `&date=${date}`; `src/api/standings.js:5-11`
  documents that spoiler-safety comes entirely from the caller requesting "entering today"
  (yesterday). `gen-callouts.mjs:344` does the same for the extra-inning/one-run split records
  (`date=${asOf}`, slate eve). This is exactly the recommended pattern.
- Where the API has no as-of split (record-when-scoring-first, lead-after-N, game-log-derived
  hitter/pitcher lines), the scripts fetch the full season and cut client-side at `asOf`
  (`gen-callouts.mjs:395,523,707`). Correct results; the game-log endpoint has no clean date-range
  param so the local cut is inherent. One small win: `scoringRecord` (`:377`) over-pulls the full
  season and could bound with `&endDate=${asOf}`.
- `team_roster?date=` is **not** used, and correctly so — roster fetches want tonight's
  participants (current roster), and callouts are generated only for the upcoming slate.

### 2d. `meta` types — hardcoded enums vs generated constants

The codebase carries a large catalog of hardcoded enums that mirror `meta` types:

- **eventTypes** (`meta/eventTypes`): `NON_PA_EVENT_TYPES`, `STOPPAGE_EVENTS`, `HIT_EVENTS`,
  `DOUBLE_PLAY_EVENTS`, `FORCED_OUT_EVENTS` (`playbyplay.js`), `ENTRY_EVENT_TYPES`/
  `PRE_PITCH_EVENT_TYPES` (`select.js`, `enteringHalf.js`), `STRIKEOUT_EVENTS`/`SB_EVENTS`/
  `CS_EVENTS` (`callout-notes.js`, `daySuperlatives.js`), `MILESTONE_EVENTS` (`person-fetch.js`).
- **pitchCodes** (`meta/pitchCodes`): `WHIFF_CODES`, `FOUL_CODES`, `INPLAY_CODES`,
  `pitchDotCategory` (`playbyplay.js`), `NON_STRIKE_CODES` (`derive.js`).
- **positions** (`meta/positions`): `FIELD_POSITIONS`, `DEFENSE_POSITION_ORDER`
  (`defense.js`, `select.js`, `person.js`).
- **situationCodes** (`meta/situationCodes`): `sitCodes=sp,rp`/`risp,vl,vr`/`sah,sbh,sti`.
- **rosterTypes**: `'active'`, `'40Man'`. **sportIds**: `[1,11,12,13,14]` in ~7 files.

**Honest assessment: generating these from `meta` is mostly churn.** These are not raw
enumerations — they are **semantic mappings** (eventType → scorebook code `1B`/`K`/`F8`;
pitchCode → dot category). `meta/eventTypes` gives the valid set and descriptions, not the app's
scorebook semantics, so generation can't replace the constants — at best it adds a **coverage
check**: a nightly lint that flags "the API now returns an eventType/pitchCode we don't handle"
(the exact class of silent-drop bug §3 warns about). That check has modest value; wholesale
"generate constants from meta" does not. Low priority.

### 2e. `game_timestamps` + `timecode` + `diffPatch` — polling

**Not applicable as-is.** The app does **not** poll on an interval. The live feed refreshes only
on a manual Refresh tap (`feedState.reload`) or on app foreground (`refetchOnForeground`,
`useGameData.js:46`). The only `setInterval` is a same-origin Game Notes re-poll
(`TeamInfo.jsx:847`), not a statsapi call. With no polling loop, `diffPatch` would add
timecode-tracking complexity for no current benefit. It would only pay off if a future version
adds live auto-refresh — at which point `game_timestamps` + `feed/live?timecode=` + `diffPatch`
(fetch only the delta since the last snapshot) is the right shape and worth revisiting. Fine
as-is today.

### 2f. `teams_affiliates` — MiLB farm mapping

**Already used correctly.** `gen-affiliates.mjs:43` pulls all 30 orgs' farm systems in one
batched `/teams/affiliates` call. `gen-milb-history.mjs` deliberately does **not** use it — it
reconstructs each affiliate's parent-org **per season** from `teams?sportId&season` snapshots
(`:103`), because it needs historical, season-accurate parent orgs (the 2021 MiLB reorg) that the
current-state affiliates endpoint can't give. Both choices are correct. No hand-mapping to fix.

---

## 3. Fragility — undocumented shape with no fallback

The app leans hard on the (undocumented) feed shape. Most reads are null-guarded and degrade to
`—`/`''`/`null` per the MiLB-degrades-gracefully convention, so an outright **404 or renamed
top-level key fails loudly-enough** (a section renders empty / "not posted yet", the game view
survives because `fetchGameFeed`'s caller shows a retry, and score endpoints resolve `null`). The
real hazard is the opposite: **a shape change that still parses but yields wrong or missing data
mid-game**, silently. Hotspots:

- **Running-total scores on plays.** `firstRunPlay` (`playbyplay.js:295-306`) and the callout
  layer read `result.awayScore`/`result.homeScore` and `about.awayScore`/`about.homeScore` as
  cumulative post-play totals. If MLB ever changed these to per-play deltas, "scored first" and
  lead-after notes would be silently wrong. No cross-check.
- **`battingOrder` string convention.** Starters are exact multiples of 100, subs offset
  (`select.js`, `playbyplay.js:245-251`). A format change (e.g. zero-padded, or a different sub
  offset) would silently misattribute lineup slots and sprout/drop PH rows. This is load-bearing
  for the whole lineup/PA model.
- **Description-string regexes.** `scorebookCode` (`playbyplay.js:214-220`) branches on
  `/called out on strikes/i`, `/lines? (out|into)/i`, `/pops?/`, `/flies?/` to pick `L7` vs `F8`;
  `advanceCode` (`:238`) and manager matching (`game.js:63`, `/(^|\s)manager$/i`) do the same.
  Templated MLB prose is stable but **phrasing-dependent** — a wording tweak silently falls
  through to a generic fielding chain or drops a manager. Most fragile class.
- **Deep runner/credit paths.** `runners[].movement.{isOut,outNumber,outBase,end}` and
  `runners[].credits[].position.code` / `.credit` (`playbyplay.js:274-287,505-515`) drive out
  attribution and the scorebook diamond. Verified against specific gamePks (776137/776141,
  825061), noted in headers — but any of these renaming yields subtly wrong scorebook marks, not
  an error.
- **Statcast sub-objects.** `playEvents[].pitchData.coordinates.{pX,pZ}` / `.startSpeed`,
  `hitData.{launchSpeed,totalDistance}` (`derive.js`, `playbyplay.js:413-429`). Already
  null-guarded (absent at MiLB parks), so these degrade cleanly — the good model to copy.
- **The unpruned feed is itself a fragility multiplier.** Because the app pulls the whole feed and
  reads ~dozens of nested paths across ~10 modules, its exposure surface to any shape change is
  the entire feed, not a declared subset. A `fields=` allowlist (§5) would, as a side effect,
  **document** exactly which paths the app depends on.

**Recommended cheap hardening (independent of any refactor):** the "coverage check" from §2d —
a nightly assertion that every `eventType`/`pitchCode` seen in a sample of live feeds is handled
by the constants — would convert the silent-drop class into a caught-in-CI class.

---

## 4. Spoiler-safety review

The core invariant (root `CLAUDE.md`): *"a score-revealing value must never exist in the DOM
until the user reveals it."* Note the scope: **DOM**, not JS memory. That scoping is the crux.

### Score-revealing network responses that reach the client

Exactly four statsapi endpoints, plus one social feed:

1. **`/feed/live`** (`game.js:7`) — carries the full linescore R/H/E, every play with running
   scores, the full boxscore. **Pulled unpruned into `feedState.data.feed` eagerly on game load.**
2. **`/game/{pk}/winProbability`** (`game.js:18`) — per-play win % (a 4% away WP in the 8th
   announces the result).
3. **`/game/{pk}/boxscore`** (`topPerformers.js:34`) — slate top-performers.
4. **`/standings`** (`team.js:236`) — league W/L aggregates.
5. **Bluesky `searchPosts`** (`buzz.js:67`) — post text stating finals.

### What enforces the invariant, and whether it's *enforced* or *conventional*

| Mechanism | File | Enforced or conventional? |
|---|---|---|
| **SealBox render-function children** — `children` is a function invoked only in the revealed branch, so a score computed inside it physically cannot reach the DOM pre-reveal (ADR-0002) | `SealBox.jsx:56-80` | **Structurally enforced** (the one true impossible-to-leak guard, at the DOM boundary) |
| **SW `NetworkOnly` for statsapi / weather / bsky** — never serves a stale cached score (ADR-0004) | `vite.config.js:123-141` | **Structurally enforced** (closes the cache-leak vector) |
| **Reveal-only module isolation** — `linescore.js`, `derive.js`, `winprob.js` read scores; safe only because no top-level code calls them (ADR-0001) | `linescore.js`, `derive.js`, `winprob.js` | **Conventional** — a stray top-level call or eager `useMemo` leaks; no machine check |
| **`revealedThrough` high-water gate** — Pitchers table, win-prob chart, extras (ADR-0008/0009) | `InningViewer.jsx:157`, `winprob.js:26` | **Conventional** — `selectWinProbPath` defaults `throughHalf=Infinity`; safety depends on the caller passing the clamp |
| **Pre-pitch caller-gating** — lineup/defense cards gated to `halfIndex ≤ revealedThrough+1` (ADR-0003/0010) | `select.js`, `defense.js`, `battingorder.js` | **Conventional** — correctness lives in the caller's check |
| **Spoiler-free selectors avoid score fields** — `select.js` sits atop records carrying `awayScore`/`homeScore` and pointedly doesn't read them | `select.js:413-415,528-529` | **Conventional** — a future edit could read the adjacent field |

### The key finding: the payload is not pruned, only the render is gated

**The complete run/hit/error/win state is resident in the browser JS heap the moment the feed
resolves — before any reveal.** Two independent eager fetches put it there:

- `feedState.data.feed` (the whole feed) — fetched on game load (`useGameData.js:35-48`).
- `winProb.data` (per-play win %) — fetched via `useAsyncOnFeed` gated only on `feed` being
  truthy (`useGameData.js:117`), i.e. **as soon as the feed lands on any game page**, not lazily
  on the box-score view. The in-code comments ("fetched lazily with that view", `game.js:14`;
  "fetched lazily once the feed exists", `useGameData.js:116`) **overstate the laziness** — opening
  a sealed game's *lineup* page already lands the full win-prob array in memory.

This is consistent with the documented invariant (DOM-scoped), and it is by design — the
reveal-only modules must read from the in-memory feed to render the reveal, so the score *can't*
be pruned out of the feed the app renders from. But by the prompt's framing it is
**"conventional, not enforced" at the payload layer**: a DevTools heap inspection, or one
misplaced top-level call to a reveal-only selector, would surface the full score with no seal in
the way. The structural guarantee is render-time (nothing reaches the DOM), not
possession-time.

### Edge layer (link previews) — clean

`api/_lib/cards.js` reads only identity/schedule metadata (team names/ids, player name/position,
date) and **never** reads `score`/`isWinner`/`status`/`linescore`, even though `hydrate=team`
schedule rows carry a live score. `api/og.js` renders logos + names + a date (and literally
stamps a "SPOILER SAFE" note). Matches ADR-0012. Nothing score-revealing is fetched or rendered.

### Where the reliance is strongest

Two low-risk tightenings would move score data out of memory on non-reveal surfaces (both in §5):
make `winProbability` genuinely lazy (gate on the box-score view, not feed existence), and add
`fields=` to `fetchTeamSchedule`/`fetchHeadToHead` so the discarded `score`/`isWinner` never
arrive at all.

---

## 5. Ranked recommendations

Ordered by (impact on the user at a ballpark) ÷ (risk of breaking something that works).
Honest "fine as-is" calls included.

### R1 — Make `winProbability` genuinely lazy (gate on the box-score view, not feed existence)
**Impact: medium (spoiler-in-memory + one fewer score fetch on every non-box-score page). Risk:
very low.** Today the per-play win-prob array lands in memory on *any* game page. Gate its fetch
on the box-score view actually mounting (or on first reveal), matching what the comments already
claim. Also correct the misleading "lazily" comments.
**Files:** `src/hooks/useGameData.js:117` (the `useAsyncOnFeed` trigger), `src/api/game.js:14`.
**What could go wrong:** the innings-view win-prob chart also consumes it — confirm that surface
still gets the data when it needs it (it's `revealedThrough`-gated, so fetch on first reveal, not
on mount). Small, contained.

> **Measured update — R1 is bigger than written: slim the payload, not just its timing.** The
> `/winProbability` array is **186 KB gzipped** (824998) — *larger than the whole feed* — and it's a
> near-duplicate of `allPlays`: **85% of it is `playEvents`** (the same pitch-tracking the feed
> already carries). The app reads only WPA + `result`/`about`/`matchup`/`runners` from it. Adding a
> **17-name `fields=` allowlist** to `fetchWinProbability` (`result,awayScore,homeScore,description,`
> `about,captivatingIndex,inning,isTopInning,matchup,batter,id,runners,details,isScoringEvent,`
> `runner,homeTeamWinProbabilityAdded,atBatIndex`) cuts it to **5.8 KB (97% smaller)**.
> **Validated end-to-end:** `computePlayOfTheGame` and `computeThreeStars` return byte-identical
> output on the full vs. pruned array. Note: an earlier draft pruned to only the two WPA fields —
> that broke Play-of-the-Game, which needs `result`/`about`/`matchup`/`runners`; the 17-name list is
> the verified-complete set. This is the single highest value ÷ risk change in the report and pairs
> naturally with R1's timing fix — do both in one commit.

### R2 — Add `fields=` to `fetchTeamSchedule` and `fetchHeadToHead`
**Impact: medium (payload) + spoiler win. Risk: low–medium.** These download `score`/`isWinner`/
`leagueRecord` per row and discard them; a small stable `fields=` allowlist prunes the payload
and keeps the score out of client memory. Clean, well-scoped, spoiler-relevant.
**Files:** `src/api/schedule.js:192,229`.
**What could go wrong:** `fields=` combined with `hydrate=team` can behave unexpectedly on nested
objects — *(verify against a live game)* that abbreviation/teamName still come through. Keep the
allowlist minimal and confirmed.

### R3 — Replace the player-page "firsts" full-feed loop with a pruned endpoint
**Impact: medium (real user surface, multiple multi-MB feeds). Risk: medium.** `person-fetch.js:
262-321` loops full `/feed/live` over the debut-year game log. Use `game_boxscore` or
`game_playByPlay` with `fields=` (or `person_stats/game/{gamePk}`) — a few KB each instead of a
few MB. Short-circuits at the first match already, so usually one call, but that one call is huge.
**Files:** `src/api/person-fetch.js:262-321,435`.
**What could go wrong:** the "firsts" logic reads specific play/boxscore paths; a narrower endpoint
must still expose them — *(verify against a live game)*.

### R4 — `fields=` on the live `/feed/live` — high potential, high risk, **measure first**
**Impact: potentially highest (the dominant mobile payload). Risk: high.** This is the lever the
prompt calls out. But the app reads ~dozens of nested paths across ~10 modules (linescore,
boxscore, `allPlays[].playEvents[].pitchData`/`hitData`, `gameData.players` bios), so a correct
allowlist is large and fragile — **miss one path and data silently disappears mid-game**, the
worst failure mode. Recommended staged approach, not a one-shot:
1. *(verify)* confirm `fields=` behaves on the `v1.1` feed/live nested arrays at all.
2. Measure the actual unpruned size on a real game — confirm it's the bottleneck before paying the
   risk (it very likely is, but measure).
3. Build the allowlist mechanically from the read-paths in `select.js`/`linescore.js`/`derive.js`/
   `playbyplay.js`/`pitchers.js`/`boxscore.js`, and add the §3 coverage guard so a missing path is
   caught in CI, not at the park.
**Files:** `src/api/game.js:7` plus a shared field-path manifest.
**Honest note:** if measurement shows the feed is tolerable on 4G, this is churn with a real
regression risk. If it's genuinely multi-MB on bad signal, it's the single biggest user win — but
only done carefully.

> **Measured update — R4 shrinks and redirects.** The measure-first step ran. Findings:
> 1. **The feed is the bottleneck** (183 KB gz on a 12-inning game) — step 2 confirmed.
> 2. **`fields=` works on the feed** and the diff harness predicted here was built: run every
>    reader selector on full vs. pruned and deep-diff. A 259-name draft allowlist produced **98
>    silent output diffs** — exactly the "miss one path → data disappears" failure this item warned
>    about, now demonstrated rather than feared.
> 3. **The big prize can't be taken.** `pitchData.coordinates` (~the largest single branch) is
>    *needed* — the app reads `coordinates.pX/pZ` + `strikeZoneTop/Bottom` for the `StrikeZone`
>    plot (`playbyplay.js:565`, `StrikeZone.jsx`) — **and** `coordinates` is a filter-opaque Map:
>    `fields=` can't keep `pX/pZ` without all ~15 sub-fields (confirmed live). So the feed's biggest
>    branch is all-or-nothing and must stay. That collapses the naive prune from a headline win to
>    ~31% (keeping coordinates), pushing R4 toward the "churn with regression risk" side of its own
>    honest note.
> 4. **Better path — split-fetch instead of one fragile allowlist.** Fetch the *stable* branches
>    whole from their own tiny endpoints so there is nothing to enumerate: `/boxscore` whole
>    (18 KB gz — this deletes the entire "miss a stat-key" risk class, since ~200 of the 259 names
>    are boxscore stat names) + `/linescore` whole (1 KB) + `feed/live?fields=<gameData names>`
>    (3.8 KB) + `playByPlay?fields=<~65 play names>` (the only allowlist left, and it's exactly the
>    app's own hard-coded reader vocabulary, so a name MLB adds that we don't list is by definition
>    one the app doesn't read — failure mode is a missing note, not a broken screen). Optionally
>    lazy-load the opaque `coordinates` (~74 KB) only when the strike-zone plot opens.
> **Revised recommendation:** demote the "one big `fields=` allowlist over feed/live" idea; if the
> feed is pruned at all, do it as a split-fetch, and still gate it behind the §3 coverage guard.
> The split-fetch architecture is validated in principle but **not yet run through the diff harness**
> end-to-end — do that before any code, same as R1.

### R5 — `endDate=${asOf}` on the callouts full-season scoring sweep
**Impact: low (cron only). Risk: low.** `gen-callouts.mjs:377` pulls the full season then filters
`date > asOf` locally. Bounding with `&endDate=${asOf}` shrinks the payload. Cron-side, so no
ballpark benefit — a tidy-up, not a priority.
**Files:** `scripts/gen-callouts.mjs:377`.

### R6 — `fields=` on the heavy cron sweeps
**Impact: low for the ballpark user (nightly server-side); real for cron runtime/reliability.
Risk: low–medium (a dropped field silently breaks a callout).** Candidates: `gen-vs-team-splits`
game logs, `gen-callouts` roster + linescore sweeps, `gen-umpires` season scan, `statsLevels`
`limit=5000` pulls. Worth doing for cron health, but weigh against the silent-drop risk and the
fact that it doesn't help the phone.

### R7 — Optional: a `meta`-backed enum **coverage check** (not enum generation)
**Impact: low (defensive). Risk: low.** A nightly lint that flags any `eventType`/`pitchCode` in a
live-feed sample not handled by the constants (§2d, §3). Converts the silent-drop class to
caught-in-CI. Do **not** try to generate the semantic mapping constants from `meta` — that's
churn (§2d).

### Explicitly fine as-is (no change recommended)
- **Standings/roster as-of-date** — already correct: `date=` where the API supports it,
  local `asOf` cut where it doesn't; no fetch-and-subtract anti-pattern (§2c).
- **`teams_affiliates`** — already batched in `gen-affiliates`; `gen-milb-history`'s by-hand
  season snapshots are intentional and correct (§2f).
- **`diffPatch`/`timecode`/`game_timestamps`** — the app doesn't poll, so these solve a problem it
  doesn't have. Revisit only if live auto-refresh is added (§2e).
- **The edge layer** — spoiler-clean and fails safe (§4). Leave it.
- **Batching** — client team/schedule/uniform lookups and script name/position lookups already use
  the comma-CSV batch forms. No change.

---

## Summary

- **Inventory:** ~25 client endpoints, ~30 script call sites, 3 edge endpoints; four
  score-revealing statsapi endpoints (`feed/live`, `winProbability`, `boxscore`, `standings`)
  plus Bluesky.
- **Biggest gap:** `fields=` is used **nowhere**. *(Measured update)* The `/feed/live` payload is
  **183 KB gzipped** (12-inning game), not multi-MB compressed, and its biggest branch is needed +
  un-prunable — so R4 (prune the feed) shrank to a ~31% win better done as a split-fetch. The real
  prize moved to **R1**: the already-downloaded `/winProbability` payload is **186 KB and 97%
  prunable** to 5.8 KB, validated identical.
- **Already good:** as-of-date discipline (`standings?date=`), `teams_affiliates` batching, the
  spoiler-clean edge layer, no wasteful polling.
- **Spoiler:** the invariant is DOM-scoped and structurally enforced only at the SealBox boundary;
  the full score sits in JS memory eagerly (feed + win-prob). By design, but "conventional, not
  enforced" at the payload layer — and win-prob is fetched more eagerly than its comments claim
  (R1).
- **Fragility:** deep undocumented feed paths and description-string regexes are the silent-wrong
  hazard; a `meta`-backed coverage check is the cheap hardening (R7).
