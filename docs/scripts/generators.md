# scripts — the generator catalog

One entry per `scripts/gen-*.mjs` (plus the two non-generator scripts that ride
the same crons, and the asset/off-app scripts), grouped by cadence: what it
writes, where the data comes from, and the traps particular to it.

This is tier-3 reference (root `CLAUDE.md`'s doc tiers) — it loads when you are
pointed at it, not on every session. **`scripts/CLAUDE.md` carries the rules
that govern this directory and is the file to read first.** It was split out of
that file when the catalog had grown to two thirds of a document every session
touching `scripts/` pays for in full; `docs/api/static-data.md` is the same
split on the other side, documenting each READER of the files below.

**A generator that runs on a cron must be listed under the cron that runs it,
and a generator listed under no cron must say what runs it instead.** That is
not tidiness. Two generators here were written for the nightly batch, said so
in their own headers, and were never added to the workflow — one of them served
a twenty-three-day-old playoff-odds snapshot to the Team hub the whole time,
with nothing on screen to say so. A date-keyed file rots quietly. This catalog
is where that becomes visible.

## Nightly-cron generators (`update-nightly-data.yml`)

Precomputed because they're too heavy (COST) to build on a page load. Normally you
don't run these by hand.

- `gen-war.mjs` → `public/data/war.json` — season WAR per player, from FanGraphs'
  bulk leaderboard API (~1MB, unofficial), plus parallel `pa` (hitter plate
  appearances), `wrc` (wRC+) and `fld` (season fielding runs) maps on the same
  keys. Reads the `type=6` **Value** view, which carries WAR's components
  alongside the total at no extra request; `Fielding` there already includes
  catcher framing (the components sum to WAR, so `CFraming` is NOT additive on
  top). The three extra maps were the removed Lineup Strength grade's inputs
  (it needed a bat and a glove SEPARATELY) and are unread today; they cost no
  extra request, and `.scratch/lineup-strength/` records why the WAR total
  can't be decomposed after the fact. The template for the build-time-fetch
  pattern; see `docs/data-enrichment.md` §5. App reads it via `src/api/war.js`.

> **A PR that adds a generator ships the generator's committed output alongside
> it.** The surface it feeds has to work on the first deploy; the nightly cron
> keeps that data fresh, it never creates it. Run the backfill locally, commit
> the result with the code, and report the sweep's runtime and the output's size
> in the PR body so the committed data is reviewable rather than just present. A
> generator merged with an empty surface waiting for its first cron is a feature
> that ships broken and looks finished.
- `gen-milb-alumni.mjs` → `public/data/milb-alumni/{teamId}.json` — for each of the
  ~120 current farm clubs, the six big-league players who came through it, ranked
  by career WAR ("Made The Show", the last card on a MiLB team's Overview).
  **Runs directly after `gen-war.mjs` and depends on it**: the ranking is summed
  from `war.json` + the committed `war-history/` shards, so this generator makes
  no WAR request of its own and a FanGraphs outage can't break it (it does mean
  career WAR is 2010-on, understating a pre-2010 debut). Stints come from the
  PLAYER side — `/people/{id}/stats?stats=yearByYear&sportId={11,12,13,14,16}`,
  one call per sport because a comma list silently returns zero stat groups — and
  are filtered to current affiliates via `affiliates.json`.
  **Two traps.** A stint under `MIN_GAMES` (20) is dropped, because a rehab
  assignment is a minor-league stint: unfiltered, Nashville's top three alumni
  are three-game cameos by Yelich, Sonny Gray and Semien, above the Chapman and
  Olson who actually played there. And the `/people` enrichment call needs
  `hydrate=currentTeam` — without it the endpoint answers 200 with name, number
  and position present and the club silently blank, which is what the first run
  shipped. Incremental: `scripts/data/milb-alumni-scan.json` carries each
  player's scanned stints, and only a new player, a stale season, or someone
  whose bus-league career could still be moving is re-scanned. Shards carry no
  `generatedAt` on purpose — 120 committed files on a nightly cron must not all
  churn on a timestamp. App reads it via `fetchMilbAlumni` in `src/api/team.js`.
- `gen-rehab.mjs` → `public/data/rehab.json` — the league-wide Rehab Assignments
  list. Starts from a transaction scan, then verifies each candidate against his
  game log + club's schedule to drop ended stints. Keeps its own self-contained copy
  of the transaction-scan logic (mirrors `person.js`'s `detectRehabAssignment`).
- `gen-umpires.mjs` → `public/data/umpires/{personId}.json` — each MLB + AAA umpire's
  season game log, ONE FILE PER UMPIRE (readers want one man; the league-wide file hit
  3.2 MB). Full rebuild, sweeping stale shards, from a season scan per level
  (`/api/v1/schedule?...&hydrate=officials,team`, one each for sportId 1 + 11)
  re-indexed by umpire id, each row tagged `level` + `gameType`. AAA rides along
  because the same umpires shuttle between the levels (shared personIds); AA and below
  stay out (thinner officials data + no pitch tracking for the accuracy companion). Sweeps regular season + postseason + the All-Star Game
  (`gameType=R,F,D,L,W,A`) so six-man crews (Left/Right Field, ASG + postseason) and
  variable MiLB crews (two/three-man) all land in the log; `UMP_LABELS` maps every
  role incl. LF/RF, and `selectOfficials` (`src/api/select.js`) mirrors it for the
  live crew card.
- `gen-umpire-accuracy.mjs` → `umpire-accuracy-summary.json` (aggregates, the ranking pool)
  + `umpire-accuracy/{personId}.json` (one man's rows, and this job's own merge base — no
  archive file) — COMPANION to `umpires.json`: each plate umpire's season called-pitch
  accuracy + zone tendencies. Needs each game's live feed (per-pitch `pX/pZ` vs the strike
  zone), so unlike `gen-umpires.mjs`'s one-call rebuild this is a feed fetch PER GAME, too
  costly to redo nightly. Runs APPEND-ONLY/incremental like `gen-game-notes.mjs`: each
  run sweeps a small trailing window of finals and merges per-game rows in, deduped
  by gamePk. Each row also carries a 3×3 zone grid (`cellCalled`/`cellStrikeCall`/
  `cellMiss`, `cellIndex`) that feeds the app's zone map (perceived-zone shading +
  over-league-average miss overlay); a schema change means a one-time `--since`
  backfill so old rows gain the grid. Nightly cron uses the default trailing window;
  a one-time season backfill is `--since=YYYY-MM-DD [--until=…]`. Covers MLB + AAA
  (sportId 1 + 11 — every AAA park feeds Hawk-Eye coordinates; AA/below carry none
  and score to null). The two levels stay SEPARATE (different regime + peer pool):
  the per-umpire aggregate splits into `season` (MLB) + `seasonAAA`, each row carries
  a `level`, and `--sports=1,11` restricts the sweep (its use: `--since=… --sports=11`
  backfills a newly-added level alone without re-fetching the others' immutable rows).
  Also splits by game CONTEXT (`gameType=R,F,D,L,W,A`): only regular-season rows feed
  the ranked `season`/`seasonAAA`; postseason (F/D/L/W) rolls up into a separate
  unranked `seasonPost`; the All-Star Game (A) counts toward no aggregate (per-game
  figure only). Each row also carries `consistent`/`consistentCalled` (agreement with
  the umpire's OWN game-fitted zone — `src/lib/euz.js`'s kernel-density Estimated
  Umpire Zone) and `favorAway`/`favorHome`/season `favorMagnitude` (run-expectancy
  swing of each missed call — `src/lib/runExpectancy.js`, reading the table
  `gen-run-expectancy.mjs` builds; degrades to null before that table exists). App
  reads it via `src/api/umpires.js`. Full write-up: `.scratch/umpire-accuracy/plan.md`
  + `.scratch/umpire-accuracy/consistency-favor-scope.md`.
- `gen-run-expectancy.mjs` → `public/data/run-expectancy.json` — a base(8)×outs(3)×
  count(12) = 288-state run-expectancy table (RE288), averaged over real MLB
  regular-season play-by-play. **Hand-run, NOT on the nightly cron** (run expectancy
  is a slow-moving league constant, unlike per-game accuracy): `node
  scripts/gen-run-expectancy.mjs --seasons=2024,2025` (defaults to the last 2
  complete seasons). Walks each Final game's `liveData.plays.allPlays` — including
  the top-level stolen-base/caught-stealing/pickoff/wild-pitch/passed-ball/balk plays
  interleaved with real plate appearances — to reconstruct base occupancy + outs,
  verified against a real 5–14 game (runs-per-half matched `linescore.innings[]`
  exactly on all 17 halves). Each pitch tags its PRE-pitch `(baseMask, outs, balls,
  strikes)` state (note: `playEvents[].count` is the count AFTER that pitch, an
  off-by-one caught during verification) with the half-inning's remaining runs.
  Writes both the 288-bucket table and a 24-bucket base/out-only RE24 fallback for
  thin per-count buckets (`src/lib/runExpectancy.js`'s `lookupRE`). Consumed by
  `gen-umpire-accuracy.mjs` (nightly season favor) and, live, `src/api/umpireFavor.js`
  (the box score's reveal-only per-game favor card). Full write-up:
  `.scratch/umpire-accuracy/consistency-favor-scope.md` §2.
- `gen-minors-leaders.mjs` → `public/data/minors-leaders.json` — the combined
  ALL-MINORS leaderboard (every farmhand's totals SUMMED across levels). Eight
  full-level stat pulls (~4,700 players). Stores PRE-RANKED top rows per category, so
  the file stays ~150KB and the leader-relative qualifier's floor is baked in.
  **NOT self-contained** — imports the app's own `combineToPool` (`statsLevels.js`) +
  `computeLeaders` (`teamLeaders.js`), the same code the live `org` board uses, to
  stay in lockstep.
- `gen-former-teammates.mjs` → `public/data/former-teammates/{a}-{b}.json` (ids
  ascending; one file per MATCHUP, which is what a game view reads) — for each upcoming
  matchup (MLB + MiLB), pairs of players on the two OPPOSING clubs once teammates. Two players are teammates iff their careers
  share a (teamId, season) pair — a year-by-year pull PER MiLB level per player.
  Self-contained; scopes to the next few days' slate, skips Rookie/complex ball
  (sportId 16), reuses `person.js`'s REHAB_CAP idea to drop a rehab cameo. App reads
  it via `src/api/formerTeammates.js`.
- `gen-career-matchups.mjs` → `public/data/career-matchups.json` — for each
  upcoming GAME (MLB or MiLB), how every batter on a club has fared in his
  career against the OPPOSING club's probable starting pitcher. Keyed by
  gamePk, not by team pair: a three-game series is the same two clubs behind
  three different starters and a doubleheader is two in one day, neither of
  which a team-pair key can represent. Costly for the same reason
  `gen-former-teammates.mjs` is: statsapi's `vsPlayerTotal` takes exactly one
  `sportId` per call (a comma-list 400s, and it rejects a comma-list of
  `opposingPlayerId` too), so a pair is one call per level checked. `levelsFor`
  bounds that — an MLB game checks MLB only (measured across a real slate's
  starter pairs: every pair with any history had it at MLB, none had MiLB-only
  history, so the four extra calls bought nothing), a MiLB game also checks one
  level down, which is where "they last faced off in A+" actually lives.
  **Do not "simplify" this to one call per batter with `opposingTeamId`** —
  `stats=vsPlayer&opposingTeamId={id}` returns a batter's whole career book vs
  a franchise in ONE request and looks perfect, but filters by the uniform the
  pitcher was WEARING AT THE TIME rather than by who is on that staff today;
  measured against a real PIT@MIL card it found 41 of 141 pairs and 140 of 495
  plate appearances, and undercounts the pairs it does return. The generator
  header records the full numbers. Also spoiler-sensitive in a way its sibling
  generators aren't: `vsPlayerTotal` for the CURRENT season already reflects
  tonight's plate appearances the moment they happen, so this data can ONLY be
  safely computed before that night's games are played — the nightly cron
  timing itself is the spoiler guard, not extra code. App reads it via
  `src/api/careerMatchups.js`.
- `gen-vs-team-splits.mjs` → `public/data/vs-team-splits/` — for every MLB
  active-roster player, his career line vs each opposing club + the last meeting's
  line. The API's vs-team splits carry no game granularity, so it sweeps each
  player's whole MLB game log season by season. Self-contained; MLB only. ~3MB, out
  of the PWA precache, **SHARDED BY THE PLAYER'S OWN CLUB** (`index.json` + one
  `{teamId}.json`, written together); read via `src/api/vsTeamSplits.js`.
- `gen-game-notes.mjs` → `public/data/game-notes/{teamId}.json` (one file per club,
  and its own merge base) — each club's pre-game "Game Notes" PDF links. **APPEND-ONLY**: the source feed
  (dapi.mlbinfra.com) only lists a club's last ~10 games, so the job MERGES new links
  and never drops old ones (the img.mlbstatic.com PDF stays live forever, keeping a
  game reachable after mlb.com de-lists it). The twist vs. the other generators,
  which regenerate from scratch. Self-contained; MLB only; kept OUT of the PWA
  precache (grows each game day). App reads it via `src/api/gameNotes.js`.
- `gen-callouts.mjs` → `callouts/{MMDDYYYY}/{gamePk}.json` — every team-record,
  starter-record, hitter-split, and situational callout. Covers MLB + the four
  full-season MiLB levels (each MiLB person-stats fetch must carry the level's
  `sportId` or the API silently returns the empty MLB line); career-derived families
  + standings splits stay MLB-only. A date is ~1 MB across ~76 files, out of
  precache; a page reads one. Also reads the LOCAL `public/data/fouls.json` for two
  MLB-only keys — `foulSpoilers` (top-10 foul-per-game hitters on the clubs) and
  `foulRate.perPitch` (league baseline) — skipped gracefully if that file is
  absent. See `docs/callouts.md` + ADR-0014; extend this pipeline, don't build a
  parallel path.
- `gen-fouls.mjs` → `fouls.json` (league, for `/fouls`) + `fouls/{NN}.json` (`personId
  % 100`, for the player card) — season foul-ball aggregates (per batter/pitcher/team,
  two-strike fouls, single-game highs, league by-inning + by-pitch-type rates). SQLite-backed
  (`fouls` group, ADR-0021) APPEND-ONLY incremental sweep of Final MLB games'
  live feeds like `gen-umpire-accuracy.mjs` (`--days` trailing window;
  `--since`/`--until` backfill with checkpoints); `foul_ingested_games` is the
  idempotency guard. Imports `FOUL_CODES`/`pitchCallCode` from
  `src/api/playbyplay.js` so live (`derive.js`) and precomputed tallies can't
  drift; two-strike detection carries the PRE-pitch count forward across
  non-PA plays (the `count`-is-post-pitch off-by-one). App reads it via
  `src/api/fouls.js` (Foul Tracker page, player-page card).
- `gen-comeback-wins.mjs` → `public/data/comeback-wins.json` — per-team,
  per-season COMEBACK counts that form a RATE: for each Final game BOTH sides'
  minimum win prob is bucketed, so whichever side fell below 10/20/30% counts an
  ATTEMPT (`att10/att20/att30`) and, if it won, a comeback WIN (`sub10/sub20/
  sub30`) — the club's claw-back rate is `sub/att`, `sub <= att`, both pairs
  nested. SQLite-backed (`comeback-wins` group, ADR-0021) APPEND-ONLY incremental
  sweep of newly-Final MLB regular-season games like `gen-umpire-accuracy.mjs`
  (`--days` trailing window / backfill); `comeback_ingested_games` is the
  idempotency guard. Both minimums come from the MLB-only `/winProbability`
  endpoint (home share directly; away = `100 − home max`). A schema change (the
  `att*` columns) needs a one-time `--rebuild` (wipe both tables, re-sweep) since
  old rows carry no attempts. App reads it via `src/api/comebackWins.js` (Team
  Page's "Comeback wins" card — team rate vs. the pooled MLB average).
- `gen-team-records.mjs` → `public/data/team-records/{season}/{teamId}.json` (one
  file per club per season, ~24 KB) — the per-game LEDGER every club's
  situational records are read off, at MLB and the four full-season MiLB levels.
  Feeds the Numbers tab's Records card (`src/api/teamRecords.js`): W-L when
  scoring first, out-hitting the opponent, leading after 7, facing a left-handed
  starter, on a getaway day, by month, by division, plus the season counts that
  aren't records (wins after trailing, sweeps, days in first place, longest
  streak) — each answerable for the full season or either side of the All-Star
  break.
  **The records themselves are not stored.** Each row is raw FACTS (run totals,
  the whole inning line, both starters' lines, the schedule context) and every
  split is derived at EXPORT time, so a new split or a changed definition costs
  `--export-only` and no network at all — the bill `gen-pitch-arsenal.mjs` and
  `gen-comeback-wins.mjs` each paid once, as a `--since` backfill and a
  `--rebuild`. The app derives one more layer at READ time, which is what lets a
  dated (`?d=`) team page apply its own day-before cutoff exactly rather than
  print a season total that looks past it. SQLite-backed (`team-records` group,
  ADR-0021), APPEND-ONLY over newly-Final games; `team_record_ingested_games` is
  the idempotency guard, so the nightly cost is the ~65 games that finished,
  never the season. That table is **seven columns plus a `payload_json`**, not
  thirty-one, and the schema comment says why: `dumpGroup` repeats every column
  NAME on every row, so a five-level season would otherwise have committed
  megabytes of column names.
  **Three calls per game and no more**: the date's schedule (bulk, one per date
  per level, carrying the full linescore), the box score, and a field-pruned
  play-by-play at ~8 KB — the last only for the batted-around count, which no
  other endpoint carries. Pitcher handedness is an EXPORT-time join off one bulk
  `/sports/{id}/players` call per level, same pattern and reasoning as
  `gen-pitch-arsenal.mjs`'s `throws`; an unresolved hand counts in neither the
  vs-RHS nor the vs-LHS row rather than being guessed. Series boundaries, sweeps
  and getaway days come from the LEDGER, not the feed's `seriesGameNumber` /
  `gamesInSeries` — those describe the series as SCHEDULED, and a rained-out
  middle game leaves them describing one that never happened. Daily division
  ranks are computed from the ledger too, since `/standings` carries no history
  and answers a completed season's `date=` query empty.
  **Verified against statsapi's own splits**, the free oracle this dataset
  happens to have: `/standings` publishes eight of these records per club at
  every level. Across all 30 MLB clubs the overall record and the home / away /
  one-run / extra-inning splits matched EXACTLY. Two known disagreements are
  recorded in the generator header and are deliberate — the day/night split of a
  doubleheader's nightcap (statsapi's standings disagrees with its own schedule
  feed there; this generator takes the game's own `dayNight`), and one game's
  starting hand (the starter here is always the boxscore's `pitchers[0]`,
  whoever actually threw the first pitch). Re-run that check after touching the
  linescore handling. Out of the PWA precache with no extra rule —
  `vite.config.js` opts `data/**.json` out unless a file is named.
  Backfill: `--since=YYYY-MM-DD [--until=…]`; `--sports=1` restricts the sweep.
- `gen-jerseys.mjs` → `public/data/jerseys.json` — what each MLB club wore in
  every game, from `/api/v1/uniforms/game` (`docs/uniforms-and-logos.md` — the
  live feed carries zero uniform data). SQLite-backed (`jerseys` group,
  ADR-0021), its own table keyed `(game_pk, team_id)`, one row per side with
  `payload_json` carrying that side's asset list verbatim (label text, piece
  code, and `uniformAssetCode`). APPEND-ONLY/incremental like
  `gen-comeback-wins.mjs`: each run sweeps a trailing window of dates
  (`--days`) and skips any `(gamePk, teamId)` pair already recorded; the
  endpoint fills in around game time, so a game not yet posted just retries
  next run. MLB only — unverified for MiLB. The JSON export is a small derived
  view, keyed `${gamePk}:${teamId}` → `'alternate' | 'city-connect'`
  (`classifyUniformAsset`, `src/api/uniforms.js`), dropping standard `'main'`
  jerseys entirely; read by `src/api/jerseys.js` so the home-page game cards
  (`GameCard.jsx`) can swap in a team's curated logo when that's what it's
  wearing. No team-id whitelist anywhere in this pipeline — curated-logo
  coverage (`public/team-logos/{alternate,city-connect}/`) is decided once, by
  file presence, in `teamLogoUrl`'s fallback (`src/lib/teams.js`), so dropping
  in a new logo file is the only step needed to light up a team, no code
  change. v2 idea, not built: guess a likely pre-posting treatment from
  accumulated history instead of always falling back to the base logo.
- `gen-pitch-arsenal.mjs` → `pitch-arsenal/{NN}.json` (per-pitcher buckets) +
  `pitch-arsenal-pool/{mlb,aaa}.json` (slim similarity pool, `docs/api/static-data.md`) —
  each pitcher's season pitch mix (share + velocity per type), split `mlb`/`aaa` — every
  AAA park (like MLB's) feeds Hawk-Eye tracking, confirmed live against a real AAA
  gamePk's feed; AA and below carry none (same two-level split as `gen-umpire-accuracy`).
  APPEND-ONLY/incremental sweep of Final regular-season games' live feeds like
  `gen-fouls.mjs` (`--days` trailing window; `--since`/`--until` backfill;
  `--sports=1,11` restricts the sweep, its real use being `--since=…
  --sports=11` to backfill AAA alone into a file that already has MLB).
  SQLite-backed (`pitch-arsenal` group, ADR-0021); `pitch_arsenal_ingested_games`
  is the idempotency guard, keyed `(game_pk, level)`. Each pitcher also carries
  `throws`, the hard filter behind the player page's "Pitches like" card — but it
  is resolved at EXPORT time from one bulk
  `/sports/{id}/players?fields=people,id,pitchHand,code` call per level (~50 KB),
  NOT stored per game. That's deliberate and worth keeping: an export-time join
  needs no schema change and no backfill, so every pitcher already on file gained
  a hand on the first run, where a per-game column would only have filled in as
  each pitcher next happened to appear. A failed lookup is logged and skipped,
  never fatal (the card just filters more conservatively — an unknown hand is
  never guessed). `--export-only` rebuilds the JSON view from rows already on
  disk with no sweep: the mode for whenever a derived, non-per-game field like
  this one changes and re-fetching every ingested feed would change nothing in
  the database. App reads it via `src/api/pitchArsenal.js` (the opposing-starter
  card's pitch-mix bar `PitchArsenalMix.jsx`, and the player page's
  `SimilarPitchers`). Each type row also tallies `century_pitches` (count at
  `CENTURY_MPH`+, summed like `pitches`) and `max_velo` (that type's fastest
  reading, `MAX`'d rather than summed) — `gen-callouts.mjs` joins these
  straight from the SQLite table (`scripts/lib/century-club.mjs`, no extra
  JSON read) into `starterRecords[id].centuryClub` for the
  veloVariety/centuryClub/veloPeak callout families (`docs/callouts.md`).
  Adding these columns did NOT retroactively backfill games already
  ingested — `pitch_arsenal_ingested_games` blocks a re-sweep of anything on
  file, so a schema change like this needs an explicit `--since=` backfill
  covering the season to date, same as `gen-pitch-arsenal.mjs` needs for a
  new level.
- `gen-spray.mjs` → `public/data/spray/{NN}.json` (per-batter buckets on
  `personId % 100`) — the batter-side sibling of `gen-pitch-arsenal.mjs`: every
  ball in play this season, with the raw Gameday landing coordinate, the exit
  velocity, the result class, the pitcher's hand, the side the batter used that
  time up, the level and the pitcher's id. Read by `src/api/spray.js` for the
  player page's spray map. Same two levels and the same reason — landing
  coordinates come from the PARK, and every MLB and AAA park is Hawk-Eye
  tracked while AA and below carry none (measured: 4,409 of 4,411 balls in play
  across four sampled windows had a landing point). Same sweep shape too:
  trailing window (`--days`), `--since`/`--until` backfill, `--sports=` filter,
  the postponed-replay `officialDate` dedup, bounded concurrency and periodic
  checkpoints.
  **Three things about it are its own.** (1) **The source is the FEED, not
  Baseball Savant.** Savant's `hc_x`/`hc_y` are a different projection with a
  different origin and scale; this repo has already verified the feed's
  coordinate space and pinned it in `test/hitchart.test.js`, and running two
  coordinate spaces in one app has a mirrored spray map as its failure mode.
  (2) **The committed shards ARE the accumulator** — the one deliberate
  departure from the SQLite layer its siblings use (ADR-0021). A season is
  ~190,000 rows, and a `dumpGroup` TEXT dump of one row each is ~17 MB, nine
  times the largest group on file and duplicating the JSON it would export
  byte for byte. So each run reads the buckets back, folds the new games in and
  rewrites them; the ingested-games ledger lives beside the SQL dumps at
  `scripts/data/spray-ingested.json` and is what stops the next run re-sweeping
  the season. **Both paths are staged by the nightly commit step** — buckets
  without the ledger would make every night a full backfill.
  (3) **The feed is fetched field-pruned**: a `fields=` allowlist cuts each
  ~800 KB `feed/live` body to ~29 KB, which is what makes a whole-season
  backfill 51 seconds instead of an hour. A decided game that yields no tracked
  contact is counted and reported at the end for that reason — a silent zero is
  how a 30x saving turns into an empty dataset nobody notices.
  Two filters worth knowing: **decided games only, never today's**
  (`abstractGameState === 'Final'` AND an officialDate strictly before today),
  which is the card's whole spoiler footing; and `detailedState === 'Cancelled'`
  is skipped, because twenty AAA games this season report as Final having never
  reached the first inning.
- `gen-attendance.mjs` → `public/data/attendance.json` — per-team, per-season
  HOME-game attendance: games counted, season total, average, high, low, and a
  SELLOUT count. An away game folds in nothing — attendance is a fact about the
  HOME club's own park. Stateless: it reads the gate off the SCHEDULE
  endpoint's `hydrate=gameInfo` (the same feed `gen-gate.mjs` sweeps, and the
  same `toRow` reducer), so a whole season is about a dozen requests and it
  rebuilds from scratch every night. It used to fetch one boxscore per game
  (~1,900 requests) behind a SQLite ingested-games table; that sweep, its two
  tables and its committed dump are gone, and the two sources were verified to
  agree club for club before it went. `--season=`/`--seasons=` for a past year.
  A SELLOUT is a date whose crowd reached `SELLOUT_FILL` (95%) of the LISTED
  capacity of the park it was played in (`src/lib/ballpark/ballparkData.js`) —
  the one figure this generator derives rather than reports, because it needs
  the per-game gates that never leave the script; the threshold ships in the
  file so the card can label the count. A date at a park with no listed
  capacity counts toward the total and toward no sellout. MLB only — a league
  rank needs the whole 30-team pool. App reads it via `src/api/attendance.js`
  (the Ballpark card's figures plus its rank by average, by season total and
  by fill rate).
- `gen-doubleheaders.mjs` → `public/data/doubleheaders.json` — every completed
  MLB regular-season DOUBLEHEADER from 2004 to now, the file behind
  `/doubleheaders`. One row per PAIR — `[date, teamA, teamB,
  teamAWins, teamBWins]`, club ids sorted low-first — and nothing per club: the
  page's year slider changes every per-club number, so the fold lives in
  `src/api/around-the-game/doubleheaders.js` instead. FULL REBUILD each night
  (23 schedule requests with a narrow `fields` filter, ~20 KB out); only the
  current season's rows can change. TWO RULES ARE LOAD-BEARING. The day is keyed
  on the UNORDERED club pair, because a makeup doubleheader swaps home and away
  between its two games (2020-08-05 has two) and an away|home key silently drops
  every one of them. And a day with only ONE Final game is DROPPED, not folded
  in — that is a rained-out second game, and counting it would put single games
  inside a doubleheader record; those days are counted as `incomplete` in the
  run log and the payload. `--from=`/`--to=` for a shorter sweep. MLB only, and
  regular season only.
- `gen-gate.mjs` → `public/data/gate.json` — per-club attendance AND game
  DURATION, the two facts behind `/attendance` (The Gate) and `/pace-of-play`
  (The Clock). Deliberately NOT an extension of `gen-attendance.mjs`, which owns the
  Ballpark card's own much smaller file: both now read the SCHEDULE endpoint's
  `hydrate=gameInfo` (`{ attendance, firstPitch, gameDurationMinutes,
  delayDurationMinutes }`), roughly a dozen requests for a whole season, so
  neither needs SQLite, an ingested-games table or an incremental window, and
  both rebuild from scratch every night. This one owns the shared row reducer
  (`toRow`). TWO DENOMINATORS on purpose: attendance is counted for
  the HOME club only (a gate is a fact about that club's park), game length for
  BOTH clubs (it is made by the two rosters on the field, not by the park).
  Ships per-club aggregates only — month splits, day/night, weekend/weekday,
  top-drawing opponents, the extremes with their dates — never a per-game
  table; every rank, fill rate and league comparison is derived in
  `src/api/around-the-game/gate.js`. `--season=`/`--seasons=` for a past year. MLB
  regular season, Final games only. Spoiler-free.
- `gen-farm-system.mjs` → `public/data/farm-system.json` — the facts behind
  `/farm-system-rankings` (The Farm Report): every organisation's four full-season affiliates
  with their won-lost records, plus every ranked prospect it holds. A JOIN, not
  a sweep — it READS the committed `public/data/affiliates.json`
  (`gen-affiliates.mjs`) and `public/data/top-prospects.json`
  (`fetch-top-prospects.mjs`) rather than refetching either, and adds only live
  minor-league standings. Those come **by league, not by sport**:
  `?sportId=11` returns an empty `records: []` — a successful-looking response
  that would have shipped a page of blank records — so the sweep resolves
  `/api/v1/leagues?sportId={11..14}` first and then one `/api/v1/standings`
  per league. The Farm Index itself (the value curve, the level weights, the
  three-pillar composite) is NOT here: it lives in
  `src/api/around-the-game/farmSystem.js` where it is testable and visible, and the
  research behind every constant is `docs/farm-index.md`. Spoiler-free.
- `gen-savant-percentiles.mjs` → `public/data/savant-percentiles.json` — season
  Statcast percentile ranks per player (`bat`/`pit`), keyed by personId, from
  Baseball Savant's CORS-open percentile-rankings CSV. Savant does the percentile
  math AND the qualification filtering itself, so this script does none of either.
  TWO leaderboards, not one: that board reports percentiles ONLY — every column
  in it is already a 0–100 rank — so the RAW season rates the player page's radar
  prints beside each spoke come from a second call to Savant's `custom` board
  (`rawBat`/`rawPit`). **The `custom` selection ids are NOT the percentile
  board's column names**, which is the trap here: `chase_percent`,
  `exit_velocity` and `brl_percent` are all accepted by `custom` and all come
  back silently EMPTY (the working ids are `oz_swing_percent`,
  `exit_velocity_avg`, `barrel_batted_rate`, `fastball_avg_speed`). A renamed id
  therefore fails as blank cells rather than as an error, so the script logs
  per-metric coverage and WARNS when a metric returns mostly empty — check that
  warning first if spoke labels go missing. The raw fetch is never fatal; on
  failure the radar plots its shape with no labels. App reads it via
  `src/api/savantPercentiles.js`.
- `gen-savant-matchup.mjs` → `public/data/savant-matchup.json` — season Statcast
  RATES (chase, whiff, hard-hit, pull, ground-ball) for every qualified batter
  AND pitcher, plus the league mean/SD each is scored against. A sibling of the
  percentiles file rather than part of it: that board carries percentile ranks
  for a fixed handful of metrics, and the matchup callouts need raw rates on
  both sides of one axis, batted-ball direction, and the league SPREAD. Both
  roles come off the same `custom` leaderboard, which returns identical columns
  for `type=batter` and `type=pitcher` — the fact the whole family rests on. The
  run warns if the two boards' league means drift apart, since that would mean
  the comparison itself has broken. Handedness splits are NOT available: those
  query params are accepted and silently ignored. MLB only. Also writes the
  file's `arsenal` block — a hitter against ONE PITCH TYPE, joined on Savant's
  `pitch-arsenal-stats` board (`player_id`, `pitch_type`, identical columns
  both roles). Gates the pitch (pitcher usage ≥ 15%, ≥ 150 thrown) and the
  batter (40+ PA against the type), then regresses whiff toward that pitch
  type's own league mean (`WHIFF_REGRESS_K` = 50 pitches) rather than applying
  a second, stricter sample floor — a flat floor tuned for four-seamers would
  starve the splitter and sweeper notes, which is most of this family's value.
  `ba` is carried on the batter row for display color only, never scored. See
  `docs/callouts.md`, "Matchup callouts".
- `gen-workload.mjs` → `public/data/workload.json` — per-pitcher recent
  workload: last-12 appearance list (date/pitches/started), season totals, SP/RP
  role inference, league mean/SD baselines per role, and winning/losing-record
  team cohort means (descriptive color only). Full nightly rebuild from each
  active-roster pitcher's season gameLog; MLB only. All bucket math (last
  1/3/10, consecutive days, availability rules) lives in the reader
  `src/api/workload.js`, computed relative to a caller-supplied date.
- `gen-milestones.mjs` → `public/data/milestones.json` — the league-wide Milestone
  Watch list: every debuted player on an MLB org's `fullRoster` (active, IL, or in
  the minors) within reach of a round career-total milestone (`MILESTONE_DEFS` in
  `src/api/person.js`), each with a projected timeframe. Undebuted prospects are
  filtered out on the roster's hydrated `mlbDebutDate` (a career MLB milestone
  needs a debut) so they never cost a stats fetch; an injured or optioned veteran
  near a milestone still shows. Per kept player, one `yearByYear` stats call
  (MLB-only, so MiLB totals never inflate a milestone) yields both his career total
  and this season's pace; each of the 30 teams' season schedule (fetched once, not
  per player — `sportId=1` is REQUIRED or the endpoint 400s) supplies
  games-played-so-far + remaining dates, so the projection can scale by how often
  the player actually plays rather than assuming every team game. An inclusion floor
  (`MILESTONE_PROGRESS_FLOOR`, 75%) trims barely-started chases the wide `farWindow`
  admits. Imports `aggregateSplits`/`MILESTONE_DEFS`/`MILESTONE_PROGRESS_FLOOR`/
  `projectMilestoneETA`/`careerPerSeasonRate`/`milestoneRarityRank` straight from
  `src/api/person.js` (pure, no DOM deps) — extend the projection math there, not in
  the script. MLB careers only.
- `gen-rookies.mjs` → `public/data/rookies.json` — each player's rookie window
  (debut date + the date, if any, his career crossed the rookie limit: 130 at-bats
  or 50 innings pitched — AB/IP only, not MLB's full official rule, which also has
  a 45-active-roster-days clause). Feeds `RookiePill` + the player page's "Lost
  Rookie Status" timeline row (`src/api/rookies.js`). Same `fullRoster` scan as
  `gen-milestones.mjs`, but APPEND-ONLY/incremental like `gen-game-notes.mjs`, not
  a full rebuild: a closed record is a frozen historical fact the timeline already
  shows, so this script only ever adds a new debut or closes a still-open one —
  never recomputing a closed record, never touching a player who's fallen off every
  MLB org's roster. `gen-rookies-backfill.mjs` (hand-run, below) does everyone else.
  **rookies.json is the MASTER; the app reads the derived `rookies/` views instead**
  — `scripts/lib/rookie-shards.mjs`, called by both scripts, splits those by ROLE
  rather than by id (`docs/api/static-data.md` has why). Shares its crossing-detection
  helpers with the backfill by deliberate small duplication (self-contained generators,
  like `gen-rehab.mjs` mirroring `detectRehabAssignment`), not an import.
- `gen-season-score.mjs` → `public/data/season-score.json` — an MLB-only,
  date-keyed 0.0–10.0 Season Surprise Score. One normal run adds yesterday's
  snapshot; `--date` and `--from`/`--to` make a reproducible backfill. The
  generator sums schedule-adjusted preseason win expectations (home edge
  blended from trailing PRIOR seasons, never this one — `seasonScoreFormula.js`)
  through the cutoff, stores actual-vs-expected as the headline, and keeps
  earned pace plus last-30 form as diagnostics. Market baselines live in the
  hand-curated `season-expectations-seed.json`; incomplete seasons fall back
  to Marcel. See `docs/season-score.md` and ADR-0018; backed by the SQLite
  layer above (`team_snapshots`, `metric='surprise'`).
- `gen-team-score.mjs` → `public/data/team-score.json` — date-keyed MLB Quality
  plus a last-10 Current Form diagnostic. Quality blends 60% actual wins with
  40% Pythagorean wins off park-adjusted run differential, plus a capped
  strength-of-schedule nudge (Current Form skips both — see
  `src/api/teamScoreFormula.js`). Combined with Season Surprise into the
  headroom-aware Season Grade; see `docs/season-grade.md`/ADR-0020. Backed by
  the SQLite layer above (`team_snapshots`, `metric='quality'`/`'current_form'`).
- `gen-team-transactions.mjs` → `team-transactions/{season}/{teamId}.json` — an
  MLB-only roster-move story feed, ONE FILE PER ORG per season, written even with
  no moves (`days: []`) so a 404 means "no such season", never "quiet club".
  `index.json` holds the metadata: once `final`, a run skips the season unless forced.

- `gen-highlights.mjs` also → `public/data/highlights/day/{MMDDYYYY}.json` — the
  per-slate-date **condensed-game index**, `{gamePk: {title, duration, poster,
  playbacks, heroPhoto}}`, ~8 KB for a 16-game day. One fetch per game
  (`sweepGame` reads the content package three ways, not three requests),
  MERGED into whatever the file already holds (`writeDayFiles`) so a partial
  re-sweep stays additive. Read by the home slate's revealed result cards
  (`fetchDayVideos`), which can't go live (`content` is 430 KB/game). Stores
  the CONDENSED cut only, never the recap (score in its title). `heroPhoto`
  (`{original, thumb} | null`, `pickHeroPhoto` via `dayIndexEntry`) is a real
  still shown instead of MLB's "CONDENSED GAME" graphic — URLs only, no
  caption, since the file is fetched whole for every game, revealed or not.
- `gen-highlights.mjs` → `public/data/highlights/{teamId}.json` — one small file
  per MLB club holding its per-play video highlights, game by game, newest first.
  Feeds the Team hub's Games-tab rail and the player page's rail; the box score's
  own per-play clips stay a LIVE single-game fetch (`src/api/highlights.js`) and
  are unaffected. **Scans by GAME, not by team** — each game belongs to two clubs,
  so per-team schedule scans would fetch the same `content` twice — and files each
  clip under the team its own `team_id` names, which handles a mid-season trade for
  free (pre-trade clips stay under the old club). APPEND-ONLY/incremental like
  `gen-umpire-accuracy.mjs` (`--days` trailing window, `--since`/`--until`
  backfill), deduped by gamePk; MLB only. **All filtering happens in the
  generator, never the reader**, so the rails stay dumb: the `abs`/`challenge`
  exclusion (the `team_id` sign is unrecoverable for those — it tags the
  participant, not who benefited), the non-play content gate
  (`NON_PLAY_TAXONOMY` in `src/api/highlights.js` — the same `content` array
  carries recaps, condensed games, interviews, pressers, Data Viz cards, injury
  exits and ejections, ~half of all items), and the hand-maintained
  `scripts/highlight-blocklist.json` (`{clipId, reason}`, starts empty — **edit
  the seed, never the output**). Clip identity is `guid ?? id`, NOT `guid` alone:
  54% of content items carry no guid, real highlights among them. Kept OUT of the
  PWA precache. Shares every bit of its per-game logic with the hand-run backfill
  below via `scripts/lib/highlights.mjs`. App reads it via
  `src/api/gamehighlights.js`. Full write-up: `.scratch/highlights-cascade/`.

- `gen-postseason-odds.mjs` → `public/data/postseason-odds.json` — date-keyed
  MLB postseason odds (playoff / division / bye probability + projected wins),
  from a 5,000-run Monte Carlo of the rest of each season. Team strength comes
  from `team-score.json`, not a separate projection system, so the odds stay in
  lockstep with the Team Score badge beside them — which is why this step **must
  run after `gen-team-score.mjs`** in the workflow. Same date-keyed snapshot
  shape as `season-score.json`, so a Team Page under an as-of cutoff renders the
  odds as they stood entering that day. World Series / pennant odds are
  deliberately NOT here: those need a best-of-3/5/7 bracket simulation on top,
  a separate layer; this answers only "does this club make the six-team field."
  `--date=YYYY-MM-DD` rebuilds one date and `--from`/`--to` backfills a range,
  which is how the 2026-07-14 → 2026-08-09 gap was closed when this generator
  was finally wired to the cron. App reads it via `src/api/postseasonOdds.js`.
- `gen-manager-history.mjs` → `public/data/manager-history/{NN}.json` (bucketed
  on `personId % 100`) — every current MLB club's full coaching staff, season by
  season, re-indexed by personId so `/manager/{id}` can show a person's whole
  coaching career rather than his managerial stints alone (Pat Murphy was a
  Padres bench coach years before he managed the Brewers; both belong). The cron
  runs **`--current-only`**: this season, all 30 clubs, ~30 calls, MERGED into
  the existing shards so the hand-run full backfill (2000-present, ~800 calls)
  survives. Per-stint W-L for a club-season with more than one manager can't be
  split from the coaches endpoint alone (no dates, no ordering), so
  `scripts/manager-transitions-seed.json` supplies the transition date and a
  season with no seed entry is appended to
  `scripts/manager-transitions-needs-research.json` and marked `sharedSeason`
  with no record — never a guessed one. One undocumented trap in the source:
  `/coaches` returns a person once per JERSEY NUMBER he wore that season, not
  once per job, so a skipper who changed numbers — or simply wore #42 on
  Jackie Robinson Day — arrives two or three times under one jobId. The sweep
  collapses them on `(teamId, season, jobId)`; without that, only one twin gets
  a record attached and the page prints the others as phantom "Shared season"
  rows. `src/api/managers.js` dedupes again on read, for shards written before
  the fix. App reads it via `src/api/managers.js`.
- `gen-fever-radar.mjs` → `public/data/fever-radar.json` — a nightly snapshot of
  Fever Baseball's (feverbaseball.com) breakout/fade prospect radar. A THIRD-
  PARTY scouting opinion, displayed attributed and kept deliberately apart from
  bbsbh's own callouts: every callout family is a fact reconciled against the
  official MLB record, and a model output can't be reconciled that way, so it
  gets its own clearly-sourced surface (a `RadarPill`) instead of a rank in the
  callout worthiness table. App reads it via `src/api/feverRadar.js`.
- `fever/gen-player-contracts.mjs` → `public/data/player-contracts/{00..99}.json` —
  Fever Baseball's current contract feed, reduced from its league-wide payload
  into player-ID shards for the profile-page Contract card. The generator
  validates the feed's shipped count and its MLBAM-key join, retains source and
  Cot's freshness dates, and writes every bucket so an unmatched player is a
  normal null result rather than a 404. App reads it via
  `src/api/person/contracts.js`.

  It also attaches each player's POSITIONAL PAY RANK (`payRank`) — "12th of 259
  starting pitchers". The Fever feed carries no position, so the generator makes
  one batched `/people` call per 100 players, hydrating season and career
  pitching in the same request; that hydrate is what lets pitchers split into SP
  and RP, since `primaryPosition` returns a flat `P`. A failed chunk costs those
  players their rank and nothing else. The ranking itself, and the five
  judgement calls behind it, live in `scripts/lib/contract-pay-rank.mjs` — read
  that file's header before changing a threshold. In short: outfielders are one
  pool; estimated salaries are ranked; a prorated part-season figure (44% of the
  feed) is lifted to the league minimum rather than dropped, with `onMinimum`
  marking that tied band so the card can say "on the league minimum" instead of
  quoting a rank the tie cannot support; a pool under ten players is not ranked;
  and a season with no seeded league minimum ranks nobody. A two-way player is
  ranked in BOTH his pools, hitting first, with the second in `also`.
- `fever/gen-salaries.mjs` → `public/data/team-contracts/{teamId}.json` +
  `public/data/salaries.json` — one contract ledger per club and one league
  rollup, for the Contracts tab and `/salaries`. DERIVED, not re-fetched: it
  reads the shards `fever/gen-player-contracts.mjs` just wrote, which is why it
  MUST run directly after that step in the nightly workflow. Its one live call is
  to statsapi for the 40-man rosters, hydrated with season pitching lines so an
  arm can be told apart as a starter or a reliever (the contract feed only ever
  says "P"). Those thirty requests go through `scripts/lib/concurrency.mjs` at
  the house limit of 8, and — unlike most callers of that helper — a club that
  comes back `null` ABORTS the run: a missing roster would not empty the page, it
  would move that club's whole squad into the "Off roster" band and read as money
  owed to nobody. The arithmetic is pure and lives in `scripts/lib/salaries.mjs`,
  so `test/salaries.test.js` can pin it, and the money rule it enforces (an
  out-year code is a status, never an amount) is ADR-0052. App reads it via
  `src/api/salaries.js`.
- `gen-prospect-trend.mjs` → `public/data/prospect-trend.json` — a nightly,
  level-relative OPS/ERA percentile for every prospect in
  `top-prospects.json`, computed straight from statsapi's own season splits
  (`fetchLevelSeasonStats`/`combineToPool`, `src/api/statsLevels.js`) — no
  hardcoded Major-League-Equivalency translation coefficients, see
  `scripts/lib/prospectPercentile.mjs`'s header. Meant to complement the
  weekly-refreshed Pipeline rank, not replace it: a rank only moves when
  Pipeline re-ranks, this moves with the prospect's own current-season stat
  line. Same SQLite `player_snapshots` + self-join `movement` pattern as
  `gen-fever-radar.mjs`, source `prospect-trend`. Depends on
  `top-prospects.json` already existing; skips (not a failure) if that
  snapshot is missing/empty. App reads it via `src/api/prospectTrend.js`.

## Own-cadence generators (not the nightly batch)

- `warm-previews.mjs` — NOT a data generator (writes no `public/data/*` file,
  no entry in the nightly commit step). Runs in `update-nightly-data.yml`
  alongside the generators above, but is the one script here that calls
  `bbsbh.vercel.app` itself rather than only statsapi: proactively warms
  `api/preview.js` + `api/og.js`'s edge cache (see
  `docs/adr/0012-dynamic-link-previews.md`) for today's MLB slate — every
  game's `lineup1`/`lineup2`/`boxscore` pages + shared `og:image`, every
  playing team's page, and every one of those teams' active-roster players —
  so the first real crawl of a shared link isn't a cold, statsapi-contested
  resolution. Fetches each pretty page and reads its own rendered `og:image`
  tag back out to warm rather than reconstructing `/api/og`'s query params by
  hand, so it can't drift from what `api/_lib/cards.js` actually builds.
  Best-effort only (`mapConcurrent`, same helper as `gen-milestones.mjs`) —
  a failed warm is logged and skipped, never fatal to the run.
- `gen-affiliates.mjs` → `public/data/affiliates.json` — every MLB org's full
  farm system (AAA/AA/A+/A), keyed by parent org id, in ONE
  `/teams/affiliates?teamIds=…` request for all 30. On its OWN workflow
  (`.github/workflows/update-affiliates.yml`), not the nightly batch, because a
  farm system changes at most once a year (the PDC realignment). Its sibling
  `gen-teams.mjs` + `gen-mono-logos.mjs` run on `update-teams.yml` for the same
  reason. App reads it via `src/api/team.js`.
- `gen-milb-ballparks.mjs` → `src/lib/data/milb-ballparks.json` — every current
  MiLB team's venue name, deduped by `venueKey` (one venue can host two clubs,
  e.g. Roger Dean Chevrolet Stadium). Read straight from the `teams.json` this
  same workflow just wrote rather than a second statsapi fetch. This is the
  MiLB counterpart to `src/lib/ballpark/ballparkData.js`'s hand-authored MLB
  table, minus the measurements — a MiLB park carries no diagram, only a
  copy-editable name/photo/logo, since nobody has hand-verified its dimensions.
  `src/copy/registry.js`'s `milbParkFields()` derives one park's worth of
  registry fields per entry, the same shape `parkFields()` derives from
  `BALLPARKS`. Runs on `update-teams.yml` right after `gen-teams.mjs`, same
  reasoning as `gen-mono-logos.mjs` above.

## Hand-run generators (immutable data — NOT on a cron)

Re-run only to fold in a new season.

- `gen-war-history.mjs` → `public/data/war-history/{NN}.json` (player-keyed, bucketed
  on `personId % 100` via the reader's `warShardKey`) — season WAR per player for
  COMPLETED seasons (2010+), the multi-year companion to `war.json`. Same source/join. A finished season's WAR is immutable.
- `gen-awards-history.mjs` → `public/data/awards-history.json` — who won each major
  MLB award (MVP, Cy Young, Rookie of the Year, Silver Slugger, Gold Glove, Platinum
  Glove, Reliever of the Year, Comeback Player, Hank Aaron, Roberto Clemente, All-MLB
  First/Second Team) over the last 5 seasons, grouped by award then by season. Loops
  `MAJOR_AWARDS`' ids (imported straight from `src/api/person.js`, not duplicated, so
  this page can't drift from what the player page's own Awards section counts as
  hardware) × season through `GET /api/v1/awards/{awardId}/recipients?season=YYYY`.
  The in-progress current season simply comes back empty per award until decided —
  no special-casing needed. App reads it via `src/api/awardsHistory.js`.
- `gen-all-star-rosters.mjs` → `public/data/all-star-rosters.json` — every MLB
  All-Star Game roster, year over year back to 1933. Loops
  `GET /api/v1/awards/{ALAS,NLAS}/recipients?sportId=1&season=YYYY` — the same
  authoritative-selections endpoint `fetchAllStarRosterIds` (`src/api/person-fetch.js`)
  already uses, which still names a player who was picked but withdrew (injury, or
  pitched the Sunday before) and never played. Each season's game is looked up via
  `GET /api/v1/schedule?sportId=1&season=YYYY&gameType=A`, but the file stores only
  the `gamePk` — the app resolves team/date info live via `fetchGameCardsByPk`
  (`src/api/schedule.js`), same as the Top Games page, so a franchise rename never
  goes stale in this file. Team NAMES in the roster itself are resolved per
  `(teamId, season)` via the season-scoped `GET /api/v1/teams/{id}?season=YYYY` (not
  the app's current-team table) so a historical pick reads under the name he actually
  played under (a 1933 Washington Senator, not a Minnesota Twin) — deduped across the
  whole run so the same team only costs one extra call per season it's named in.
  ONE more call per season, `GET /api/v1/game/{gamePk}/boxscore`, classifies every
  recipient into a precomputed `{ starters, bullpen, substitutes }` bucket per league
  (same `battingOrder`-multiple-of-100 convention as `select.js`'s `selectLineup`,
  plus `team.pitchers[0]` for the starting pitcher) so the page needs no client-side
  grouping/sorting; a recipient who can't be matched (fetch failure, thin old data)
  falls back to pitcher-or-not. Also stores `mvps[season]` (the Ted Williams
  All-Star MVP award, `GET /api/v1/awards/ASMVP/recipients?season=YYYY`, absent
  before 1962) and `venues[season]` (the venue name off the same schedule row, plus
  a best-effort host-team id resolved against a ONE-TIME fetch of the 30 current
  MLB teams' home parks — an older/relocated venue just carries no team match).
  App reads it via `src/api/allStarRosters.js`.
- `gen-milb-history.mjs` → `public/data/milb-history.json` — per-season parent-org +
  club-name history for every AAA/AA/A+/A affiliate. Sweeps statsapi's season-scoped
  team snapshots for 2005+ (where its affiliate data is clean) and merges a small
  hand-verified seed (`scripts/milb-history-seed.json`) for pre-2005 eras. **Edit the
  SEED, never the output.** See the generator header for the 2005-floor rationale.
- `gen-postseason-history.mjs` → `public/data/postseason-history.json` — the
  completed bracket (who played, who won, how many games, each team's 1-6
  seed) for every MLB postseason back to 2000 (`EARLIEST_YEAR`), plus the
  round MVP where one exists (LCS/World Series only — Wild Card/Division
  Series carry no official MVP award). Sweeps
  `/api/v1/schedule?...&gameType=F,D,L,W&hydrate=team,seriesStatus` per
  season, grouping games into a series by (gameType, seriesDescription,
  sorted team-id pair), then `/api/v1/awards/{ALCSMVP,NLCSMVP,WSMVP}/recipients`
  for the MVP. Seeding has no statsapi field of its own — derived per league
  from `/api/v1/standings`' `divisionChamp` flag plus the Wild Card round's
  own game-1 home/away (the higher seed always hosts), which degrades
  correctly through all three Wild Card formats this range spans (see the
  generator header). Walks backward from the current year, skipping any
  season whose postseason hasn't finished. The app's own UI
  (`PostseasonHistoryPage.jsx`) shows 2020-present eagerly and gates
  2000-2019 behind a "Load more" — that's a UI cutoff, not a generator one;
  this file always carries the full range. App reads it via
  `src/api/postseasonHistory.js`.
- `gen-postseason-leaders.mjs` → `public/data/postseason-leaders.json` — since-
  2000 career postseason batting/pitching leaderboards, plus franchise
  (titles/pennants/appearances) and repeat-Series-MVP leaders computed
  straight from `postseason-history.json` (no extra fetch). Batting/pitching
  need per-game boxscore stat lines that file never carries, so this script
  sweeps every gamePk in it (`GET /api/v1/game/{gamePk}/boxscore`, verified
  live — batting/pitching stats are direct fields, no separate decision
  lookup for W/L/SV) and folds each game into a running CAREER TOTAL per
  player via an incrementing upsert into the SQLite layer's
  `postseason_batting_totals`/`postseason_pitching_totals` (scripts/lib/
  schema.sql) — not one row per game, which would be ~30x more rows for value
  this page doesn't need (see the schema file's own comment: a full re-sweep
  of every postseason game since 2000 takes under a minute, so there's no
  real cost to re-deriving it fresh over keeping a bulky per-game ledger in
  git). `postseason_ingested_games` is the idempotency guard, so a resumed or
  re-run sweep never double-counts a game. RUN gen-postseason-history.mjs
  FIRST — this script reads its gamePk list, never re-walks the schedule API
  itself. AVG/ERA carry a minimum-AB/IP qualifier (same idea as the live
  leader boards' floor) so a single pinch-hit or mop-up inning can't top a
  rate-stat board. App reads it via `src/api/postseasonLeaders.js`.
- `gen-highlights-backfill.mjs` → `public/data/highlights/{teamId}.json` **and
  the day index above** — the one-time historical sweep establishing the season
  the nightly `gen-highlights.mjs` can't reach back to. Same relationship, and
  same ~2,430-game cost, as `gen-rookies-backfill.mjs` below; `--since`/`--until`
  chunk it. TWO OUTPUTS, TWO INDEPENDENT "done" sets (`ingestedGamePks` vs
  `dayIndexedGamePks`) — a game can be filed in one and missing from the other,
  so it sweeps if EITHER is. **`--days-only`** writes just the index: a full CLIP
  backfill grows every team file to ~0.5 MB and the rails fetch a whole one to
  render, so that is a page-weight call about a different surface. Per-game
  logic is shared with the nightly job (`scripts/lib/highlights.mjs`).
- `gen-rookies-backfill.mjs` → `public/data/rookies.json` — the one-time
  historical sweep that establishes every player's rookie window before
  `gen-rookies.mjs` (nightly, above) is ever live. Enumerates every MLB
  season's player pool (`/api/v1/sports/1/players?season=YYYY`, which carries
  each player's own `mlbDebutDate` — no separate debut lookup needed), deduped
  by personId, defaulting to the full modern-era range (1901–present;
  `--since`/`--until` narrow it for a chunked run). A re-run only computes
  personIds NOT already in the output file, so widening the range later never
  recomputes — or overwrites — anyone already done. Not "immutable data" in
  quite the same sense as the other two generators in this section (a
  player's crossing date doesn't change once computed, but the file is still
  actively appended to every night by `gen-rookies.mjs`) — it's here because, like
  them, it's a large one-time crawl. Rewrites the derived `rookies/` shards too.

- `gen-trade-deadline.mjs` → `public/data/trade-deadline/{year}.json` (+ an
  `index.json` nothing reads today) — every completed trade within ~4 weeks of
  that season's deadline, deduped and grouped into one story per real trade
  however many clubs and players it involved. ONE league-wide
  `/api/v1/transactions` fetch per season. A season's window is fixed and its
  results are immutable once it closes, so this is hand-run like
  `gen-postseason-history.mjs`; a file already written `final: true` is never
  silently rewritten (`--force` overrides). App reads it via
  `src/api/tradeDeadline.js`, whose season list is a hardcoded `SEASONS` array,
  not the generated index.
- `gen-milb-team-colors.mjs` → `src/lib/data/milb-colors.json` — the research
  sweep behind each affiliate's primary/secondary pair. Hand-run, and the store
  it writes is hand-tuned afterwards in `/identity-lab`; methodology and the
  per-club confidence definitions live in `.scratch/milb-team-colors/README.md`.
  See `src/lib/CLAUDE.md` for how the pair resolves at render time.
- `gen-scorebook-retrospective.mjs` → `public/data/first-scorebook.json` — the
  one-off dataset behind `/first-scorebook`, a personal retrospective over a
  fixed set of already-scored games. Hand-run by definition: its input is a
  closed list, not a moving season.

## Assets / off-app

- `audit-callouts.mjs` — NOT a generator and NOT a CI gate: a developer tool that
  replays every committed nightly callout bundle's game through the app's own five
  callout builders, at each half's honest reader position, and reports per family how
  often the data was there, how often the family fired, its worthiness spread, and —
  on the two surfaces whose builder does not truncate itself — how often it survived
  the cap. It names the families that never fire, which is the point. `--bundle-only`
  runs with no network (a data-gate upper bound, never a fire rate); `--since/--until/
  --date/--limit/--concurrency` scope the sweep. Writes `.scratch/callout-audit/`
  (gitignored), never `public/data/`. Read alongside `docs/callouts.md`.

- `gen-mono-logos.mjs` → `public/data/logos/mono/{teamId}.svg` — a ONE-COLOR knockout
  version of every club's mlbstatic mark, worn by the navy section mastheads (Batting
  order / Starting pitcher / Defense / Due up next) on the lineup, innings, and box
  score pages. Replaces a `filter: brightness(0) invert(1)` that flattened any mark
  with light interior detail into an unreadable blob — see ADR-0031 and
  `src/lib/logoMono.js`, which holds the pure ink-vs-paper conversion this script
  fetches for (`test/logo-mono.test.js` pins it). Runs on the WEEKLY
  `update-teams.yml` right after `gen-teams.mjs`, whose `teams.json` is its team list,
  so coverage can't drift from the club set. Partial coverage is fine by design: a
  club with no file falls through `TeamLogo`'s variant → base chain to its full-color
  mark, so a new affiliate self-heals on the next run. The ink/paper split is a
  heuristic over art nobody controls — after a run that adds clubs, use **`--sheet`**
  (`.scratch/mono-logos/contact-sheet.html`, gitignored) and LOOK at every mark beside
  its original; a bad conversion is a wrong-looking logo, not a crash, and a blank
  cell means that file doesn't decode as an image at all. `--ids=158,498` spot-checks
  a few. A club the heuristic gets wrong is corrected by SHAPE rather than by retuning
  the thresholds for everyone: `src/lib/data/mono-ink.json` pins individual shapes to
  ink or knockout, picked by eye in `/identity-lab`'s Knockout mark editor, and this
  script applies them (`scripts/lib/mono-logo-art.mjs`, shared with the lab's dev-only
  regenerate route so both produce identical art). Pins carry a fingerprint of the art
  they were picked against — a club that rebrands drops back to automatic and is
  REPORTED at the end of a run rather than having yesterday's answers applied to
  today's shapes. Kept OUT of the PWA precache (~1.7 MB for the league, two marks per
  game) with a CacheFirst runtime rule instead — see `vite.config.js`. Also writes
  `src/lib/data/mono-logo-manifest.json` (a `teamId -> content hash` map), which
  `teamLogoUrl` (`teams.js`) appends to the mono URL as `?v=` so a corrected mark's
  changed hash busts that CacheFirst rule immediately instead of waiting on its 30-day
  expiry — see ADR-0031's amendment. Pins also arrive live: the team hub's identity
  drawer can save a `mono` runtime override (ADR-0054), and this run fetches it
  (`readMonoInkStoreWithOverrides`, a `GET /api/identity` call) and merges it over the
  file before converting — the one generator that makes a network call to this app's
  own API. A fetch failure degrades to the file alone, same as an unconfigured deploy.
- `gen-league-logos.mjs` → `public/data/logos/league/{mlb,milb}.svg` + a viewBox manifest
  — the same knockout conversion run on the two LEAGUE marks, for the Game Log covers
  carrying one instead of a club crest. NOT a loop inside the script above, which prunes
  its output of anything not keyed by a numeric team id. Hand-run; see `docs/game-log.md`.
- `gen-logo-art.mjs` → `src/lib/data/logo-art.json` — the coverage manifest for the
  curated club marks under `public/team-logos/`. Fetches nothing; the source of truth
  is the working tree. Normally you never run it: the Team Identity Lab's
  `/__dev/team-logo` upload rewrites the manifest itself after every drop
  (`lib/dev-logo-upload.mjs`, ADR-0029). It exists for the two cases an upload can't
  cover — the first build, and art added or deleted by hand.
  `test/logo-upload.test.js` compares the committed manifest against disk and names
  this script when they disagree, so a hand-dropped file can't sit unrecorded.
- `compress-logos.mjs` — palette-quantizes (TinyPNG-style, via sharp) every curated
  PNG under `public/team-logos/` in place, typically 60-80% smaller with no visible
  change at rendered sizes. Runs nightly in `update-nightly-data.yml` to sweep up new
  Identity Lab uploads, or by hand as `npm run compress-logos` (which also rebuilds
  the manifest). **Skips palette PNGs (color type 3)** — that guard is what stops the
  nightly run from re-quantizing its own output and cumulatively degrading the art;
  don't remove it. Always regenerate `logo-art.json` after a run that changed anything
  (it pins exact byte sizes).
- `gen-ballpark-thumbs.mjs` → `public/ballparks/thumb/{venueKey}.webp` — a
  ~480px WebP companion to each bundled 1000px ballpark photo (source keys
  read straight off `CREDITS` in `src/lib/ballpark/ballparkArt.js`, never a
  directory glob), for the slate card's touch/scroll backdrop reveal to fetch
  instead of the full photo — `docs/ballpark-photos.md`. Hand-run
  (`npm run gen:ballpark-thumbs`) after adding or replacing a bundled photo,
  same cadence as the photos themselves.
- `gen-icons.mjs` — regenerate PWA PNG icons from `public/icons/icon.svg`.
- `gen-og-image.mjs` — NOT currently used. `public/og-image.jpg` (1200×630
  link-preview card) is a hand-provided phone-mockup asset instead. This script +
  `scripts/og-image.html` render an alternate generated-art version, kept in case we
  go back to it. The `og:*`/`twitter:*` tags in `index.html` point at the current
  `.jpg` (absolute URLs).
- `game-buzz.mjs <gamePk>` — post-game: top social posts from the game's time window,
  ranked by engagement, to seed handwritten GAME NOTES. FREE sources — Bluesky (no
  auth) always, plus the Reddit game thread when `REDDIT_CLIENT_ID/SECRET` are set.
  Deliberately a terminal script, NOT part of the app (game-night posts are spoilers).
  Source scoping/queries: `docs/game-buzz.md`.
- `gen-sitemap.mjs` → `public/sitemap.xml` — runs as part of `npm run build`. Lists
  the `/learn` guides plus the stable, public, non-scoring app routes, and
  deliberately lists NO game, date, player or team URL: a sitemap is a standing
  invitation to crawl, and inviting a crawler onto a scoring surface is the one
  thing these pages exist to avoid (ADR-0053). `lastmod` for a guide comes from
  that page's own `updated` field, not from the clock, so the file does not
  churn on every build. Exports `buildSitemap()` for `test/landing-pages.test.js`
  and only writes when run as a script.
