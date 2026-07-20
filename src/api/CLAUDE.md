# src/api — the data layer

Fetch wrappers and selectors around the public MLB Stats API, split by topic (all
share `statsapi.js`'s `getJson`; a shared header there notes the gamePk field
paths were verified against). This file is the per-module catalog; the always-loaded
root `CLAUDE.md` carries only the spoiler-rule summary that governs these modules.
`../CLAUDE.md` covers how they're consumed by the screens.

## The spoiler rule, applied here

`linescore.js` and `derive.js` are **reveal-only** modules — callable only from
inside a `SealBox`'s reveal render function, never at render top-level or in an
eager `useMemo` (ADR-0001). `highlights.js`'s join (`highlightsByPlayId`) is
reveal-only in the same sense — a video clip's title/description narrate the
play's outcome, so the map is built inside `HalfInning`'s `SealBox` reveal
function (next to `revealDerived`), never at `InningViewer`'s top level; the
fetch itself (`fetchHighlights`) is safe eagerly, same as `game.js`'s
`fetchWinProbability`, since a raw fetch result produces no DOM on its own.
`select.js` is spoiler-**free**. In between sit
**caller-gated pre-pitch selectors** (`selectPrePitchChanges` in `select.js`,
`defenseEntering` in `defense.js`, `lineupEntering` in `battingorder.js`),
spoiler-free only when restricted to the half the user has reached
(`halfIndex <= revealedThrough + 1`). See the root `CLAUDE.md` spoiler section and
`docs/adr/` (0001, 0003, 0005–0007, 0009, 0010) before touching any of these.

## Core feed / selectors

- `statsapi.js` — the one `getJson` fetch wrapper every topic file below calls.
- `schedule.js` — slate/schedule (`hydrate=team` for the abbreviation +
  teamName the bare row lacks), `resolveGame`, `fetchGamesByPk`,
  `fetchHeadToHead`, `fetchTeamSchedule`. `fetchGameCardsByPk` is the
  cross-date sibling of `fetchGamesByPk` — full `normalizeGame`-shaped rows
  (+ `officialDate`) for a gamePk list spanning many dates/levels, e.g. the
  Top Games page, where each card needs its own team identity rather than
  inheriting one date's sportId like the ordinary slate.
- `uniforms.js` — `/api/v1/uniforms/game` for what each club is wearing (not in
  the live feed; spoiler-free but empty until ~first pitch, so it rides the
  feed's fetch/reload in `GameView` and renders on the lineup pages + box
  score).
- `game.js` — the full game feed (`/api/v1.1/game/{gamePk}/feed/live`), a
  **separate** `/teams/{id}/coaches` call for managers (they are **not** in the
  live feed), and a **separate** `/api/v1/game/{gamePk}/winProbability` call
  for per-play WPA — the sole source of the box score's three stars (the feed
  carries no WPA). It's score-revealing, so `GameView` fetches it lazily and
  the DOM only gets it inside the box-score seal; it's null-guarded (absent at
  most MiLB parks).
- `highlights.js` — video highlight clips (`/api/v1/game/{gamePk}/content`),
  joined to a specific play by matching a clip's `guid` to the terminal pitch
  event's `playId` in `feed/live` (the only reliable join key; verified live
  against both batted-ball and strikeout-ending plays — see
  `.scratch/video-highlights/`). Reveal-only (see above): `useGameData`
  fetches it lazily alongside the feed, same tier as `winProb`, but
  `highlightsByPlayId` is only ever called inside `HalfInning`'s `SealBox`
  reveal function. Degrades to `[]` on failure or off-MLB.
- `person-fetch.js` — the player page's bio/stats/logo-tint/"firsts" fetchers
  (see `person.js` for the pure shaping). Read by the player page only —
  never wired into a sealed game surface.
- `team.js` — team identity, roster, affiliates, standings, ranked team stats.
- `search.js` — the footer's player/team directory search.
- `select.js` — pure, spoiler-free selectors over the raw feed. `selectLineup`
  returns the STARTING nine, from each boxscore player's own `battingOrder`
  value (a starter's is an exact multiple of 100; a sub's is offset 801/802…) —
  never `team.battingOrder`, which mutates to the current slot occupants and
  would sprout PH rows on the staging pages late in a game. It also feeds
  `DefenseDiamond` (the scorebook-style opposing-defense drawing on the lineup
  pages).
- `challenges.js` — reveal-only ABS (Automated Ball-Strike) challenge history
  for the R/H/E card's third row (`StatBox`), clamped to the reached half. Each
  club's success/fail outcome list from the pitch-event `reviewDetails`
  (`isOverturned` + `challengeTeamId`); MLB only (`gameHasAbs`). See ADR/`docs`
  research on the retain-on-success rule + extra-inning bonus challenges.
- `umpireFavor.js` — reveal-only, cumulative-through-the-revealed-half plate-
  umpire consistency + favor, same `StatBox` row tier and half-clamp pattern as
  `challenges.js` — a per-game companion to `umpires.js`'s season aggregate.
  `selectUmpireFavor(feed, table, inning, half)` walks base occupancy/outs the
  same way `gen-run-expectancy.mjs`/`gen-umpire-accuracy.mjs` do, then calls
  `src/lib/euz.js`'s `estimateGameConsistency` and `src/lib/runExpectancy.js`'s
  `pitchFavor`. `fetchRunExpectancy()` (the static `run-expectancy.json` table)
  is safe to fetch EAGERLY like `vsTeamSplits.js`/`highlights.js` — it carries no
  game/score info of its own — wired into `useGameData`'s deferred
  `enrichmentReady` tier and threaded down to `StatBox` as a prop; only the
  selector combining it with this game's plays runs inside the `SealBox` reveal.
  `hasPitchTracking(feed)` gates to MLB + AAA. See
  `.scratch/umpire-accuracy/consistency-favor-scope.md` §3.
- `linescore.js` / `derive.js` — reveal-only (see spoiler rule above).
  `derive.js` also computes the per-half Statcast superlatives (fastest pitch /
  hardest-hit / longest ball from `playEvents[].pitchData`/`hitData`) — absent
  at most MiLB parks, so every field is null-guarded and the UI hides the row.
  Constants shared across the reveal-only modules (`NON_PA_EVENT_TYPES`,
  `WHIFF_CODES`, `pitchCallCode`) live in `playbyplay.js`: baserunning-only
  top-level plays are NOT plate appearances for PA/BF counts, but their pitches
  DO count.

Related research docs (read before wiring a new source):
- `docs/data-enrichment.md` — verified (July 2026) catalog of free, CORS-open
  enrichment endpoints (statsapi season/matchup/standings stats, Baseball
  Savant `/gf` with xBA/barrels/bat speed) with per-endpoint spoiler risk.
- `docs/uniforms-and-logos.md` — verified (July 2026) findings on statsapi's
  `/api/v1/uniforms/team` and `/api/v1/uniforms/game`, plus the full inventory of
  what logo art the mlbstatic CDNs do and don't serve (no alternate/City Connect
  marks exist).

## The build-time-fetch pattern

Several modules read a static, same-origin `public/data/*.json` file that a
`scripts/gen-*.mjs` generator precomputes (mostly on a nightly GitHub Actions
cron, `.github/workflows/update-nightly-data.yml`; a couple are hand-run). The
driver is either an **unofficial/bulk source** (WAR) or **cost** (everything
that would need dozens of statsapi calls per page load). See `scripts/CLAUDE.md`
for each generator; the reader modules:

- `war.js` — season WAR per player, from `public/data/war.json`. FanGraphs'
  leaderboard API is CORS-open but bulk-only (~1MB) and unofficial, so
  `scripts/gen-war.mjs` trims it to `{personId: war}` on a nightly cron. Keyed by
  MLB Stats API `personId` (FanGraphs' `xMLBAMID` is that same id, so no
  name-matching). This is the **template** for the pattern (bulk/unofficial →
  nightly script → static JSON → same-origin read; see `docs/data-enrichment.md`
  §5). A companion `public/data/war-history.json` (keyed by season, hand-run by
  `gen-war-history.mjs` — completed-season WAR is immutable) covers past seasons;
  `fetchWarHistory` + `warByYearFor(personId, group, current, history)` union the
  two into a player's `{season: war}` map (live season from war.json wins its own
  year), which `loadPlayer.js` threads into the player page. MLB-only at source,
  so MiLB rows fall back to a dash.
- `rehab.js` — the Rehab Assignments page, from `public/data/rehab.json`.
  Cost-driven: a league-wide transaction scan then per-candidate verification
  against his game log + rehab club's schedule to drop ended stints — dozens of
  calls. `gen-rehab.mjs` (daily cron) keeps its own copy of the transaction-scan
  logic, which mirrors `person.js`'s `detectRehabAssignment`.
- `milestones.js` — the Milestone Watch page + the player page's Milestone Watch
  card, from `public/data/milestones.json`. Cost-driven: a career-total + this
  season's pace pull per debuted player on any MLB org's full roster (active,
  IL, or minors — so an injured or optioned veteran near a milestone still
  shows; undebuted prospects are gated out on the roster's hydrated
  `mlbDebutDate`) plus every team's season schedule (`gen-milestones.mjs`, daily
  cron), so the projection can scale by how often a player actually plays rather
  than assuming a #5 starter takes the mound every team game. An inclusion floor
  (`MILESTONE_PROGRESS_FLOOR`, 75% of the threshold) keeps it to genuine chases,
  since the distance-based `farWindow` alone is wider than the smallest
  thresholds. `milestonesForPlayer` filters the league-wide file to one
  player for the card; the projection math (`projectMilestoneETA`,
  `careerPerSeasonRate`, `milestoneRarityRank`) lives in `person.js` alongside
  `MILESTONE_DEFS`, shared by the generator. Counting-stat totals carry no
  individual game's score (same footing as League Leaders/WAR), so the page needs
  no `SealBox`; the player-page card still only shows its projection on a bare
  current-day view (`asOf` unset) since the precompute can't be retrofit to an old
  game's cutoff.
- `rookies.js` — `RookiePill` (roster/lineup surfaces) + the player page's
  "Lost Rookie Status" timeline row, from `public/data/rookies.json`
  (`{personId: {debutDate, rookieUntil}}`). Rule is AB/IP thresholds only (130
  career at-bats or 50 innings pitched) — not MLB's full official rookie rule,
  which also has a 45-active-roster-days clause, deliberately left out. A
  closed record (`rookieUntil` set) is a frozen historical fact, so
  `scripts/gen-rookies.mjs` (nightly) is APPEND-ONLY — it only adds a new
  debut or closes a still-open one, never recomputes a closed record or drops
  a player who's fallen off every MLB org's roster. `scripts/gen-rookies-backfill.mjs`
  (hand-run, not on the cron) is the one-time historical sweep that establishes
  everyone else. `isActiveRookie(data, id)` is the pill's lookup;
  `rookieRecordFor(data, id)` feeds `rookieUntil` into `transactionTimelineView`
  (`person.js`) via `loadPlayer.js`. Kept OUT of the PWA precache (~1.3 MB and
  growing — see `vite.config.js`), fetched at runtime like `vs-team-splits.json`.
- `umpires.js` — the umpire detail page (every game an umpire worked this season +
  base, most recent first), from `public/data/umpires.json`, keyed by umpire
  personId. Cost-driven: no "games by umpire" endpoint, so `gen-umpires.mjs` does a
  full-season schedule scan (`hydrate=officials,team`) then re-indexes thousands of
  rows by umpire id. MLB + AAA (one scan each, sportId 1 + 11; the same umpires
  shuttle between the levels, so each game row is `level`-tagged). Wired via
  `selectOfficials` (`select.js`) threading
  each official's `id` to the Umpires card (`TeamInfo.jsx`), rendered as an
  `UmpireLink` to `/umpire/{id}`; the page needs no `SealBox` (assignments + dates
  carry no score). Each entry carries the venue, so `UmpirePage.jsx` tallies
  most-worked teams + ballparks client-side. A COMPANION file
  `public/data/umpire-accuracy.json` (`gen-umpire-accuracy.mjs`, same cron) adds
  each home-plate umpire's season called-pitch accuracy + a compact zone-tendency
  breakdown, keyed by the same personId; unlike `umpires.json`'s cheap full nightly
  rebuild, accuracy needs each game's full live feed (per-pitch `pX/pZ` vs the
  batter's `strikeZoneTop/Bottom` with a plate + ball-radius buffer — the Umpire
  Scorecards convention), so it's an APPEND-ONLY incremental sweep of the last few
  days' finals, deduped by gamePk. It covers MLB + AAA (AAA parks feed the pitch
  tracking; AA/below don't and score to null), and the two levels are kept SEPARATE
  — different regime (AAA runs the ABS challenge system) + different peer pool — so
  the per-umpire aggregate splits into `season` (MLB) + `seasonAAA` and every row is
  `level`-tagged. It also splits by game CONTEXT (`gameType`): only regular-season
  rows feed the ranked aggregates, postseason (F/D/L/W) rolls into an unranked
  `seasonPost`, and the All-Star Game (A) counts toward no aggregate (per-game figure
  only) — a different-stakes sample never moves the season rank. Each row also carries
  a 3×3 zone grid; a memoized `accuracyIndex(level)` ranks every qualifying plate ump
  at that level by REGULAR-SEASON accuracy (`MIN_RANK_GAMES` floor) and builds the
  level's miss-share baseline the zone map compares against. (Crew SIZE varies —
  two/three-man in the low minors, six-man with Left/Right Field for the ASG +
  postseason; `selectOfficials` in `select.js` renders whatever crew the feed carries,
  the source of the live Umpires card.) `loadUmpire` merges it all in as `accuracy` (`{ season,
  byGamePk }`) + `rank` + `zoneCells` (via `umpireZoneCells`) — plus a parallel
  `accuracyAAA`/`rankAAA`/`zoneCellsAAA` triplet and an unranked `accuracyPost`/
  `zoneCellsPost` (postseason) — for `UmpirePage.jsx`'s plate-accuracy cards (one per
  level + a separate postseason card, rank line + `UmpireZoneMap`) and per-HP-row
  figures; `umpireAccuracySummary(id)` serves the MLB rank the lineup page's Umpires
  card (`TeamInfo.jsx`) shows for tonight's plate ump, which opens
  `UmpireAccuracyModal` (zone map + last-5 plate games linking to their box scores).
  The summary, modal, and rankings page stay MLB-only (they front an MLB game).
  Still no `SealBox` — accuracy counts ball/strike JUDGMENTS, not runs or hits, and
  the lineup rank aggregates Final games only, so it can't leak tonight's result.
  Umps below AAA / with no data degrade to absent. Each `season`/`seasonAAA`
  aggregate also carries `consistency` (proportion, agreement with the umpire's OWN
  game-fitted zone) and `favorMagnitude`/`favorPerGame` (runs of missed-call
  impact) — same spoiler footing as accuracy (season sums over Final games only);
  `umpireAccuracySummary`/`UmpireAccuracyModal` surface both alongside the
  accuracy rank. See `umpireFavor.js` above for the LIVE per-game companion.
- `vsTeamSplits.js` — the player page's SPLITS VS TEAM card (career line vs each
  opposing club + last meeting's line, per MLB active-roster player), from
  `public/data/vs-team-splits.json`. Cost-driven: the API's vs-team split types
  carry no game granularity, so `gen-vs-team-splits.mjs` sweeps each player's whole
  MLB game log season by season. `loadPlayer.js` (`vsTeamSplitsFor`) pre-selects the
  club's next opponent. The career totals are spoiler-free like "Season splits"; the
  one score-revealing element — the last-game line — is gated against the page's
  `asOf` cutoff in `SplitsVsTeam.jsx`. Large (~3MB), so kept OUT of the PWA precache
  and fetched at runtime (see `vite.config.js`).
- `gameNotes.js` — the lineup page's Game notes button: each MLB club's pre-game
  press-notes PDF, resolved to the game's date. TWO sources, one shape: the LIVE
  feed at `dapi.mlbinfra.com` (CORS-open, keyed by `teamid-{n}`) for the game being
  staged, and a static `public/data/game-notes.json` archive for older games.
  `gen-game-notes.mjs` snapshots the feed daily and **APPENDS** (never drops old
  links — the `img.mlbstatic.com` PDF asset stays live forever, so the archive
  keeps a game reachable after mlb.com de-lists it). MLB only; the button hides for
  MiLB and any date with no note. Spoiler-free in-app (renders only a link), but the
  PDF recaps prior results, so it opens in a new tab as a user-initiated jump.
  Kept OUT of the PWA precache (grows each game day).
- `whatsBrewing.js` — for CALIBRATED clubs (a `CONFIG` map keyed by teamId; all
  30 MLB clubs as of this writing), the Game notes button opens an in-app modal
  (`WhatsBrewingModal.jsx`) of the narrative blurbs parsed out of the PDF. Parses
  client-side on demand (pdfjs-dist, dynamically imported so pdfjs stays off the
  main bundle — see `vite.config.js`) rather than in the cron, because tonight's
  note posts after the cron runs and the PDF host is CORS-open. Each club's InDesign
  template needs its own calibration, so `CONFIG` carries a `layout` per club —
  `column` (Brewers' narrow-column sheet) or `flow-bold`/`flow` (league-standard
  full-width, most other clubs) — plus font/geometry tunables (single zone or a
  `columns:` array for multi-column pages). `hasWhatsBrewing`/
  `whatsBrewingTitle` live in the separate `whatsBrewingClubs.js` (a lightweight
  teamId→title map) rather than here, so `TeamInfo.jsx`'s gate check can import
  them statically without pulling this whole parser out of its lazy chunk; add a
  club = add a `CONFIG` entry here + a title there (not a new parser). See
  `.scratch/game-notes/CALIBRATION.md` for the per-club calibration methodology
  and `docs/whats-brewing.md` for parsing details + the Node harness
  (`extractForTeam`).
- `minorsLeaders.js` — the combined ALL-MINORS leaderboard, from
  `public/data/minors-leaders.json`. Cost-driven: a league-wide four-level board is
  eight full-level stat pulls (~4,700 players), so `gen-minors-leaders.mjs` (daily
  cron) precomputes it. Stores PRE-RANKED top rows per category (via the app's own
  `combineToPool` + `computeLeaders`, so it can't drift from the live `org` board)
  rather than the raw pool — keeps the file ~150KB and bakes in the leader-relative
  qualifier's playing-time floor. `LeadersPage` reads it for the `minors` scope and
  hands rows to `TeamLeaders`'s `precomputed` path.
- `allStarRosters.js` — the All-Star Rosters page, from
  `public/data/all-star-rosters.json`. Hand-run (`gen-all-star-rosters.mjs`) — a
  season's roster is decided once and never changes. Every named selectee,
  including one who withdrew and never played, since the source is the official
  ALAS/NLAS selections endpoint, not a boxscore scan (same source
  `fetchAllStarRosterIds` in `person-fetch.js` uses). Stores each season's
  `gamePk` only; the screen resolves live team/date info via `fetchGameCardsByPk`
  (`schedule.js`), same pattern as the Top Games page. `rosters[season]` is
  `{ AL, NL }`, each precomputed into `{ starters, bullpen, substitutes }` by the
  generator (one extra boxscore fetch per season resolves who actually started)
  so the page renders the sections directly with no client-side grouping. This
  is the one game surface that DOES show the final score plainly (a small
  full-width result card, not `GameCard`) — a deliberate, narrowly-scoped
  exception to the spoiler rule's "never print a score" invariant, since an
  All-Star Game's result is decades-settled and carries no individual game's
  stakes; see ADR-0019. The same card also shows `mvps[season]` (absent before
  1962) and `venues[season]` (a name always, plus a best-effort host-team id
  the generator resolves against the CURRENT 30 teams' home parks — an older
  or relocated venue falls back to name-only). Kept OUT of the PWA precache
  (~650 KB) and fetched at runtime, like `war-history.json`.
- `milbHistory.js` — historical MiLB affiliate/franchise data, from
  `public/data/milb-history.json`. Script-generated (`gen-milb-history.mjs`) but
  **not on a cron** — affiliate history is near-immutable, so it's a hand-run
  regenerate. Derives 2005+ eras from statsapi's season-scoped team snapshots and
  merges a small hand-verified seed (`scripts/milb-history-seed.json`) for pre-2005
  eras (statsapi's own affiliate data is unreliable before ~2005). **Edit the seed,
  never the output.** Fixes a specific illusion: a MiLB affiliate's PARENT org can
  be reassigned (esp. the 2021 reorganization) independent of the player changing
  orgs, so a naive "current parent org" lookup mislabels an old stint as a trade.
  `historicalParentOrg(teamId, year)` is a preferred-when-covered override in the
  career timeline (`loadPlayer.js`) ahead of the live `fetchTeam()` lookup;
  deliberately thin, so most (team, year) pairs fall through unchanged. A parallel
  `historicalClubName()` covers renames/relocations but isn't wired into any screen
  yet (no historical logo art; see `docs/milb-historical-logos.md`).
- `postseasonHistory.js` — the Postseason History page's completed bracket
  (who played, who won, series length, each team's 1-6 seed, round MVP) for
  every MLB postseason back to 2000, from `public/data/postseason-history.json`.
  Hand-run (`gen-postseason-history.mjs`) — a finished postseason's results are
  immutable, same footing as `awards-history.json`/`milb-history.json`. Only
  `teamId`s and each game's `gamePk` are stored (never a score-bearing
  abbreviation or a live-resolvable field) — team names/logos resolve
  client-side via `src/lib/teams.js` so this file can't drift from the rest of
  the app's team identity.
- `postseasonLeaders.js` — the Postseason Leaders page's since-2000 career
  batting/pitching leaderboards plus franchise/award leaders, from
  `public/data/postseason-leaders.json`. Hand-run (`gen-postseason-leaders.mjs`,
  same immutable-history footing as `postseasonHistory.js` above) — batting/
  pitching need per-game boxscore lines `postseasonHistory.js`'s own generator
  never fetches, so this is the one file backed by the shared SQLite layer's
  `postseason_batting_totals`/`postseason_pitching_totals` (scripts/lib/
  schema.sql, docs/adr/0021) — the genuine cross-game aggregation case that ADR
  calls out, storing CAREER totals rather than a per-game ledger to keep the
  committed dump lean. Entries are pre-shaped into `teamLeaders.js`'s
  `precomputed` category-map contract so `PostseasonLeadersPage.jsx` reuses
  `TeamLeaders` (Featured-leader/chasers layout) for the batting/pitching
  sections, same as `minorsLeaders.js` does for the all-minors board; the
  franchise/repeat-MVP boards are plain rank lists (team-keyed, not the
  player-keyed pool `TeamLeaders` expects).

- `fouls.js` — season foul-ball lines + leaders, from `public/data/fouls.json`
  (`gen-fouls.mjs`). Completed-game aggregates → spoiler-free, no SealBox
  (same footing as WAR); MLB only. Feeds the Foul Tracker page (`/fouls`,
  `FoulTrackerPage.jsx`) and the player page's `FoulCard` (current-day only —
  the precompute can't be cut to a spoiler `asOf`, so the card hides under
  one, same rule as the Milestone Watch projection). `FOUL_PRIORS` carries the
  SABR foul-accumulation hit-probability constants used in copy. The LIVE
  per-half foul counters (`fouls`/`twoStrikeFouls`) live in `derive.js`'s
  bucket instead (reveal-only, surfaced in `StatBox` + the box-score digest).
- `workload.js` — rolling pitcher workload, from `public/data/workload.json`
  (`gen-workload.mjs`). Spoiler-free (completed appearances only). The reader
  owns the math, all relative to a caller-supplied `asOfDate`: `workloadFor`
  (1/3/10-appearance buckets, days spanned, consecutive-day pattern),
  `availabilityFor` (rule-based fresh/limited/down with human-readable
  reasons — ESPN-published thresholds), `workloadVsBaseline` (vs. own norm +
  role baseline). Surfaces: `BullpenBoard` on the lineup pages (gated to
  slate-current games — the file describes "now"), the player page's
  `PitcherWorkloadCard`, and the laboring baseline for `pitcherHealth.js`.
- `pitcherHealth.js` — IN-GAME pitching health, ADR-0009 footing like
  `pitchers.js` (gated by `revealedThrough`, never SealBox-wrapped):
  `laboringFor` (tonight's pitches/inning vs. his own season norm from
  workload.json — deliberately raw volume, not situation-weighted; see
  `.scratch/metric-engines/pitching-health.md` for the research trail) and
  `computeVeloDecay` (fastball-family velo, first-two-innings anchor vs.
  latest revealed inning, within one pitch type; null at untracked MiLB
  parks). Folded into Margin Notes (`pitcher-callouts.js`'s `buildMarginNotes`,
  see below and `docs/callouts.md`), not rendered directly.
- `lineupStrength.js` — the Lineup Strength grade, from
  `public/data/lineup-values.json` (`gen-lineup-values.mjs`) +
  `src/lib/lineupSolver.js` (exact Hungarian assignment over the
  position-eligibility matrix; FanGraphs positional-adjustment constants).
  `lineupStrengthFor(data, teamId, actualLineup)` → 0–10 score, statTiers
  tier, and the itemized receipt (bench swaps + out-of-position penalties).
  Spoiler-free by construction (the posted starting nine + season
  aggregates); surface is `LineupStrengthCard` under the batting order on
  the lineup pages. MLB only.
- `gameScore.js` — the slate card's `FINAL · 7.5` badge, from
  `public/data/game-score.json`. Unlike every file above, this ISN'T on the
  once-nightly cron — `gen-game-score.mjs` runs on its own 10-minute cron
  (`update-game-score.yml`) since the whole point is a score within minutes of
  a game going Final. Each entry is `{ score, sportId, homeId, awayId }` — the
  level + both team ids ride along from the same feed already fetched to score
  the game, so a caller can filter the pool by level/team with no extra fetch.
  `gameScoreFor(scores, gamePk)` formats the score to one decimal or returns
  null (not yet scored). This is the one score-derived number the app renders
  OUTSIDE a `SealBox` — see ADR-0015 for the deliberate mitigation that keeps
  that safe, and `docs/game-score.md` for the formula. Gated by the
  `useGameScoreVisible` preference (off by default), not the spoiler rule.
  `gameScoreIndex(scores)` / `topGamesByScore(scores, limit)` rank the whole
  pool (SD-bucket tiers via `lib/statTiers.js`, the same convention
  `umpires.js` uses for plate-accuracy tiers) for the Top Games page
  (`TopGamesPage.jsx`, `/top-games`) — deliberately NOT gated by
  `useGameScoreVisible`, since landing on that page is already an explicit
  "show me scores" action. The page filters the raw `scores` map by
  sportId/homeId/awayId BEFORE calling `gameScoreIndex` so tiers recompute
  relative to whatever level/team subset is currently shown.
- `seasonScore.js` — the MLB Team Page's Season Surprise Score, from
  `public/data/season-score.json`. The nightly generator stores snapshots by
  season, team, and completed date rather than one mutable current row;
  `seasonScoreFor` selects the latest snapshot at or before the Team Page's
  standings cutoff. The static reader degrades to no badge before the first
  generated file exists. See `docs/season-score.md` and ADR-0018.
- `teamScore.js` + `seasonGradeFormula.js` — dated Quality/Current Form readers
  and the Team Page's headroom-aware Season Grade. Grade combines Quality with
  the same-cutoff Season Surprise snapshot; both drivers remain visible and a
  club enters the league Grade pool only when both exist. See
  `docs/season-grade.md` and ADR-0020.
- `comebackWins.js` — the Team Page's ranked "Comeback wins" card, from
  `public/data/comeback-wins.json` (`gen-comeback-wins.mjs`). Per-team,
  per-season counts of wins after the club's win prob fell below 10/20/30%
  (nested). `comebackWinsFor` selects one club; `leagueComebackWinsFor` returns
  every club as `{ teamId, stat }` rows so `TeamPage`'s `statRank` ranks each
  threshold out of 30. Spoiler-free (a Final-games aggregate, same footing as
  WAR) — no `SealBox`; the card renders only when a bucket is non-zero.
- `feverRadar.js` — Fever Baseball's (feverbaseball.com) breakout/fade
  prospect radar, from `public/data/fever-radar.json`. An OUTSIDE scouting
  opinion, deliberately NOT a callout family (see docs/callouts.md's
  worthiness rubric and `gen-fever-radar.mjs`'s header for why: every callout
  is a fact bbsbh derives and can reconcile against the official record,
  Fever's `overlay` score is a third-party model output it can't reconcile
  the same way) — surfaced only via the attributed `RadarPill`, wired onto
  the batting-order rows in `TeamInfo.jsx` next to `MilestonePill`/
  `RookiePill`. MLB hitters only (there's no MLB pitcher board), so it never
  appears on the opposing-pitcher card. Backed by the SQLite layer above
  (`player_snapshots`); each exported row's `movement` is a self-join against
  the nearest prior snapshot bbsbh itself recorded, not Fever's own
  `/api/data/movers` feed.

## Leader boards (live)

- `leaders.js` / `teamLeaders.js` / `statsLevels.js` — ranking is pool-agnostic:
  `teamLeaders.js` holds the category descriptors + `computeLeaders`, which ranks
  any normalized `PoolPlayer[]`; `leaders.js` produces the pool for a scope (a team
  level or MLB/AL/NL via `fetchTeamRoster` fan-out; an `org` via `statsLevels.js`).
  `statsLevels.js` reads the roster-INDEPENDENT season-stats endpoint and SUMS a
  player's lines across levels into one combined row (recomputing rate stats from
  summed components) — what lets a promoted farmhand rank on his A+ + AA total.
  Rosters miss him (he's off the club he's left); the stats endpoint doesn't.

## Callouts

The callout families (`callouts.js` and the nightly `gen-callouts.mjs`) are
catalogued in `docs/callouts.md` (every family, trigger, surface, gate, worthiness
score) and ADR-0014 (the two-tense rule). Extend the nightly precompute — do NOT
build a parallel generation path. Before adding a data source, check whether an
existing split file covers it (`vs-team-splits`, the API's own `statSplits`, per-PA
`playLog`). Notes computable from data on hand should be computed live.
