# src/api — the static-data catalog (the build-time-fetch pattern)

Per-module notes for the readers of the static, same-origin `public/data/*.json`
files that a `scripts/gen-*.mjs` generator precomputes — mostly on the nightly
GitHub Actions cron (`.github/workflows/update-nightly-data.yml`), a couple
hand-run. The driver is either an **unofficial/bulk source** (WAR) or **cost**
(anything that would need dozens of statsapi calls per page load).

This is tier-3 reference (root `CLAUDE.md`'s doc tiers) — it loads when you are
pointed at it, not on every session. **`src/api/CLAUDE.md` carries the rule that
governs these modules and is the file to read first.** `docs/scripts/generators.md`
documents each GENERATOR; this file documents each READER. Every module's spoiler
class is recorded machine-readably in `src/api/spoiler-manifest.json`.

Almost everything here is spoiler-free — a season aggregate over completed games
is not a score. Do not add a `SealBox` to one of these surfaces; that is the
mistake ADR-0034 undid.

Siblings: `docs/api/live-game.md` (the live-feed modules),
`docs/api/account-layer.md` (`src/lib/account/`).

## The reader modules


Several modules read a static, same-origin `public/data/*.json` file that a
`scripts/gen-*.mjs` generator precomputes (mostly on a nightly GitHub Actions
cron, `.github/workflows/update-nightly-data.yml`; a couple are hand-run). The
driver is either an **unofficial/bulk source** (WAR) or **cost** (everything
that would need dozens of statsapi calls per page load). See `docs/scripts/generators.md`
for each generator; the reader modules:

- `staticJson.js` — not a dataset: the memoized read every reader below is built
  on. `staticJson(url, {shape, fallback})` returns a loader that fetches once per
  session and hands the SAME in-flight promise to concurrent callers;
  `staticJsonBy(urlFor, …)` does it per shard key. Written after a network trace
  showed a player page fetching `teams.json` fourteen times and `milb-history.json`
  eight: each reader used to hold a `let cached` assigned after its `await`, which
  only short-circuits a call that starts once the first has resolved, and React
  mounts a page's cards on one tick. A failure memoizes the `fallback` too, so a
  missing file is not re-fetched on every render of the session. `jerseys.js` had
  a private copy of this fix; it now uses the shared one.
- `war.js` — season WAR per player, from `public/data/war.json`. FanGraphs'
  leaderboard API is CORS-open but bulk-only (~1MB) and unofficial, so
  `scripts/gen-war.mjs` trims it to `{personId: war}` on a nightly cron. Keyed by
  MLB Stats API `personId` (FanGraphs' `xMLBAMID` is that same id, so no
  name-matching). This is the **template** for the pattern (bulk/unofficial →
  nightly script → static JSON → same-origin read; see `docs/data-enrichment.md`
  §5). A companion `public/data/war-history/{NN}.json` (hand-run by
  `gen-war-history.mjs` — completed-season WAR is immutable) covers past seasons,
  keyed by PLAYER and bucketed on `personId % 100` (`warShardKey`, shared with the
  generator), the same shape as the rookie records and for the same reason: a
  player page wants one career, not 416 KB of league-seasons.
  `fetchWarHistory(personId)` + `warByYearFor(personId, group, current, history)`
  union the two into a player's `{season: war}` map (live season from war.json wins its own
  year), which `loadPlayer.js` threads into the player page. MLB-only at source,
  so MiLB rows fall back to a dash.
- `team.js`'s `fetchMilbAlumni(teamId)` — one farm club's big-league alumni, from
  `public/data/milb-alumni/{teamId}.json` (`scripts/gen-milb-alumni.mjs`, nightly).
  Not its own module: this reader sits beside `fetchAffiliates`, which already
  owns the static farm-system snapshot it is keyed against. Sharded by the club's
  OWN team id rather than its parent org's, because the page that opens it always
  knows its own id and never wants a sibling's list — a farm-team page pulls
  ~900 bytes instead of the system's ~100 KB. Read through `staticJsonBy`, so
  concurrent card mounts share one request. Degrades to `{minGames: null,
  players: []}` — no card, not a broken page. Spoiler-free: career WAR and a
  jersey number are stat lines, not a score (ADR-0034), and nothing here touches
  a game feed.
- `jerseys.js` — what a team actually wore in a given game, from
  `public/data/jerseys.json` (`scripts/gen-jerseys.mjs`, nightly). Keyed
  `${gamePk}:${teamId}` → `'alternate' | 'city-connect'`; a standard jersey or
  an unposted assignment simply has no key. `jerseyTreatmentFor(data, gamePk,
  teamId)` returns that or `null`. `GameCard.jsx` reads it to pick which
  `TeamLogo` variant to render for the home-page slate — `null` (or a team
  with no curated art in `public/team-logos/`) falls back to `'base'` via
  `TeamLogo`'s own fallback chain, never a broken image. Spoiler-free: a
  jersey choice, not game state.
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
  "Lost Rookie Status" timeline row. Rule is AB/IP thresholds only (130
  career at-bats or 50 innings pitched) — not MLB's full official rookie rule,
  which also has a 45-active-roster-days clause, deliberately left out. A
  closed record (`rookieUntil` set) is a frozen historical fact, so
  `scripts/gen-rookies.mjs` (nightly) is APPEND-ONLY — it only adds a new
  debut or closes a still-open one, never recomputes a closed record or drops
  a player who's fallen off every MLB org's roster. `scripts/gen-rookies-backfill.mjs`
  (hand-run, not on the cron) is the one-time historical sweep that establishes
  everyone else. `isActiveRookie(data, id)` is the level-agnostic rookie-record
  lookup; `showRookiePill(data, id, isMlb)` is what RookiePill call sites
  actually use — MLB-only by design, since a debuted-but-still-rookie player
  showing up in a MiLB game (rehab, option) gets `hasDebuted`/DebutPill there
  instead, not a second ROOKIE claim. `fetchRookieRecord(id)` feeds
  `rookieUntil` into `transactionTimelineView` (`person.js`) via `loadPlayer.js`.
  **Three files, split by role.** `public/data/rookies.json`
  (`{personId: {debutDate, rookieUntil}}`, ~1.3 MB and growing) is the
  generator's MASTER record and is never fetched by the app. From it,
  `scripts/lib/rookie-shards.mjs` derives what is:
  `public/data/rookies/status.json` — the compact whole-league answer the pills
  need (`{personId: 1 | 0}`, open or closed, ~230 KB) — and
  `public/data/rookies/records/{NN}.json`, the full records bucketed on
  `personId % 100` for the player page's one-player lookup (`rookieShardKey`).
  The status map cannot be id-sharded: a game asks about ~80 scattered
  personIds at once and would touch nearly every bucket. All three stay OUT of
  the PWA precache (see `vite.config.js`). Every predicate here reads a record
  or the compact flag interchangeably, which is what lets the two files share
  them.
- `umpires.js` — the umpire detail page (every game an umpire worked this season +
  base, most recent first), from `public/data/umpires/{personId}.json` — one shard
  per umpire (~22 KB), because every reader here is after a single man: the detail
  page, and the accuracy modal one tap away on the lineup page. The league-wide file
  this replaced reached 3.2 MB by August and grows all season. Cost-driven: no
  "games by umpire" endpoint, so `gen-umpires.mjs` does a
  full-season schedule scan (`hydrate=officials,team`) then re-indexes thousands of
  rows by umpire id. MLB + AAA (one scan each, sportId 1 + 11; the same umpires
  shuttle between the levels, so each game row is `level`-tagged). Wired via
  `selectOfficials` (`select.js`) threading
  each official's `id` to the Umpires card (`TeamInfo.jsx`), rendered as an
  `UmpireLink` to `/umpire/{id}`; the page needs no `SealBox` (assignments + dates
  carry no score). Each entry carries the venue, so `UmpirePage.jsx` tallies
  most-worked teams + ballparks client-side. A COMPANION dataset
  (`gen-umpire-accuracy.mjs`, same cron) adds each home-plate umpire's season
  called-pitch accuracy + a compact zone-tendency breakdown, keyed by the same
  personId. It ships in TWO shapes from one run, and between them
  they ARE the season archive: `umpire-accuracy-summary.json`, every umpire's
  season aggregates (~0.12 MB — the ranking pool the lineup page, the box score,
  and the rankings table read), and `umpire-accuracy/{personId}.json`, one man's
  scored game rows (~13 KB — the game log the detail page and the accuracy modal
  draw). There is no league-wide archive file: it was ~2 MB by August, it was
  both the merge base and a served file, and the row shards are the merge base
  now, so the accumulated history has exactly one copy.

  The figure that kept the archive alive was the pitcher/hitter LEAN, which
  z-scores an umpire against the pool's per-game favor rows. Its ingredient is
  now summed at build time into the aggregate (`favorNet`/`favorNetGames`) by
  `leanInputFromRows`, which `gen-umpire-accuracy.mjs` imports from the reader
  rather than re-implementing; `umpireLeanFor(season)` beside it does the
  division. Do not confuse `favorNet` with `favorMagnitude` — the latter is
  UNSIGNED and answers the "run impact" tile's question instead.
  Unlike `umpires.json`'s cheap full nightly
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
  `public/data/vs-team-splits/`, and the play-by-play vs-opponent callout
  (`callout-notes/vsTeamNote.js`). Cost-driven: the API's vs-team split types
  carry no game granularity, so `gen-vs-team-splits.mjs` sweeps each player's whole
  MLB game log season by season. `loadPlayer.js` (`vsTeamSplitsFor`) pre-selects the
  club's next opponent. The career totals are spoiler-free like "Season splits"; the
  one score-revealing element — the last-game line — is gated against the page's
  `asOf` cutoff in `SplitsVsTeam.jsx`. **SHARDED BY THE PLAYER'S OWN CLUB**
  (~3 MB all told, so a single file made every game page parse 30 rosters to
  print a line about two): `index.json` carries the club catalog, each club's
  next opponent, and the `owner` map (`personId → teamId`) that says which
  shard holds a player; `{teamId}.json` carries that club's players.
  `fetchVsTeamSplitsForTeams([away, home])` serves a game, and
  `fetchVsTeamSplitsForPlayer(id)` the player page — both return the ORIGINAL
  whole-file shape, so every pure consumer is unchanged. Kept OUT of the PWA
  precache and fetched at runtime (see `vite.config.js`).
- `gameNotes.js` — the lineup page's Game notes button: each MLB club's pre-game
  press-notes PDF, resolved to the game's date. TWO sources, one shape: the LIVE
  feed at `dapi.mlbinfra.com` (CORS-open, keyed by `teamid-{n}`) for the game being
  staged, and a static `public/data/game-notes/{teamId}.json` archive for older
  games — one file per club, since every caller asks about one club.
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
  (`schedule.js`). `rosters[season]` is
  `{ AL, NL }`, each precomputed into `{ starters, bullpen, substitutes }` by the
  generator (one extra boxscore fetch per season resolves who actually started)
  so the page renders the sections directly with no client-side grouping. It
  shows each season's final score plainly (a small full-width result card, not
  `GameCard`) — not an exception to the spoiler rule but a page outside its
  scope, since the subject is who was NAMED to a squad and an All-Star Game's
  result is decades-settled exhibition trivia carrying no individual game's
  stakes; see ADR-0019, and the root `CLAUDE.md` for the scope it sits outside
  of. The same card also shows `mvps[season]` (absent before
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
  (`gen-fouls.mjs`) for the whole-league Foul Tracker page, and from
  `public/data/fouls/{NN}.json` — the same batter/pitcher rows bucketed on
  `personId % 100` (`shardKey100`) — for the player page's one-man card, which
  used to pull 805 KB to draw four tiles and now reads ~2 KB
  (`fetchFoulsFor`). Completed-game aggregates → spoiler-free, no SealBox
  (same footing as WAR); MLB only. Feeds the Foul Tracker page (`/fouls`,
  `FoulTrackerPage.jsx`) and the player page's `FoulCard` (current-day only —
  the precompute can't be cut to a spoiler `asOf`, so the card hides under
  one, same rule as the Milestone Watch projection). `FOUL_PRIORS` carries the
  SABR foul-accumulation hit-probability constants used in copy. The LIVE
  per-half foul counters (`fouls`/`twoStrikeFouls`) live in `derive.js`'s
  bucket instead (reveal-only, surfaced in `StatBox` + the box-score digest).
- `pitchArsenal.js` — each pitcher's season pitch-type mix (share of pitches +
  average velocity per type), from `gen-pitch-arsenal.mjs` in TWO shapes, because
  its two readers want opposite things: `public/data/pitch-arsenal/{NN}.json`
  (buckets on `personId % 100`) for the opposing-starter card, which wants ONE
  pitcher; and `public/data/pitch-arsenal-pool/{mlb,aaa}.json` for the player
  page's similarity card, which genuinely needs a pool. The pool file is
  deliberately less than the buckets carry — one level (the two are never ranked
  against each other), only arms past `MIN_SIMILARITY_PITCHES` (the ranker drops
  the rest anyway), and no `description` strings (it ranks on `code`). 692 KB
  became 12 KB for the mix bar and 149/194 KB for the pool. Completed-game aggregates → spoiler-free, no
  SealBox (same footing as `fouls.js`); MLB + AAA (`mlb`/`aaa` keys — AA and
  below carry no Hawk-Eye pitch tracking, so `pitchArsenalFor` just resolves
  to null there). `pitchArsenalFor(data, personId, isMlb)` picks the level
  matching the game being staged, sorts most-thrown first, and gates on
  `MIN_ARSENAL_PITCHES` so a two-pitch cameo doesn't render a misleadingly
  confident-looking mix. `pitchFamily(code)` groups codes into
  fastball/breaking/offspeed/other for `PitchArsenalMix.jsx`'s bar coloring
  (`tokens/colors.css`'s `--arsenal-*`). Surface: the opposing-starter card's
  wide-layout pitch-mix bar (`TeamInfo.jsx`'s `OpposingStarterCard`), filling
  the space the name/stats column leaves open on a wide screen.
  `similarPitchersFor(pool, personId)` is the SECOND surface — the
  player page's "Pitches like" card. It only flattens the file's per-level
  entries into a pool (same level as the subject, never both — MLB and AAA are
  different peer pools); the ranking itself is `src/lib/pitcherSimilarity.js`,
  pure and unit-tested. Runs at RUNTIME with no precompute: ~500 arms × ~4 pitch
  types is one pass over a file the page has already loaded, so a neighbour-table
  generator would buy nothing. Handedness does NOT enter the ranking — not as a
  filter, not as a distance term. It was a hard filter until August 2026 and was
  dropped deliberately (the claim is about the REPERTOIRE, not the platoon
  matchup), so a mirror-image lefty can top a righty's card and a pitcher with
  no `throws` on file is ranked like anyone else. Measured effect, before
  re-arguing it: closer neighbours for 327 of 538 MLB arms, by ~1 match point,
  and no change to coverage at all — see `pitcherSimilarity.js`. The file's
  `throws` is still exported and still carried on every returned row — it is
  what `SimilarPitchers.jsx` prints as the RHP/LHP line, now the only place the
  hand appears. Two floors guard against overclaiming —
  `MIN_SIMILARITY_PITCHES` to enter the pool, `MIN_MATCH` below which a pairing
  is dropped — so an unusual arsenal returns a SHORT list or none rather than
  filler. See `.scratch/player-profile-card/scope.md` §4.
- `savantPercentiles.js` — season Statcast percentile ranks, from
  `public/data/savant-percentiles.json` (`gen-savant-percentiles.mjs`, nightly).
  MLB only; completed-game season aggregates, so spoiler-free with no `SealBox`
  (same footing as `war.js`). Savant computes the percentiles AND its own
  qualification floor, and PRE-FLIPS them so a higher percentile is always the
  good direction even where a low raw number is the good one (xERA, BB%, chase).
  Two maps per group: `savantPercentilesFor` (the ranks) and `savantRawFor` (the
  RAW season rates behind them — a SEPARATE Savant leaderboard, because the
  percentile board carries no raw values at all, every column already a rank).
  `BATTER_METRICS`/`PITCHER_METRICS` hold display order, labels, plain-language
  definitions, per-metric raw formatting and the `lowerIsBetter` flag;
  `percentileRows` joins the two maps into the row list
  `components/charts/PercentileStrip.jsx` draws. That pre-flip is what lets
  every metric, in its own unit, share ONE 0–100 axis where farther right is
  always better — so read `lib/percentileStrip.js`'s header before changing how
  any of it is scaled. Surface: `StatcastPercentiles.jsx`'s percentile strip
  (ADR-0040, which records why the five-spoke radar it replaced could show only
  five of the metrics and drew a different shape for the same numbers depending
  on the order the spokes were listed in).
  `similarHittersFor(data, personId)` is the THIRD surface — the hitter page's
  "Hits like" card, the batter counterpart of `pitchArsenal.js`'s
  `similarPitchersFor`: it flattens the `bat` percentile map into a pool and
  ranks it with `src/lib/hitterSimilarity.js` (pure, unit-tested, calibration
  constants documented against the real file's measured distance
  distributions). Skill space only (ev/hardHit/brl/chase/sprintSpeed —
  deliberately NOT xwoba, which would double-count contact quality), no
  handedness filter (nothing here inverts with batting side — and since
  August 2026 the pitching side has none either), and the file carries no
  names — `SimilarHitters.jsx` resolves its
  three rows' names/clubs itself with one batched
  `people?personIds=…&hydrate=currentTeam` call.
- `hitterForm.js` — the PLAYER page's "Recent form" card for hitters (the
  slot the pitcher page fills with `workload.js`'s Recent workload): live
  `lastXGames` splits over 7/15/30-game windows plus the season line, fanned
  out in one `Promise.all`; `hitterFormView` is the pure shaping. It returns a
  small TIME SERIES, not a facts list: one row per window, a `season` anchor
  row that is the baseline the windows are measured against, and per row a
  signed OPS delta plus a `lean` on a FIXED ±.300 scale (a scale fitted to the
  player would draw every hitter alive at full width). `RecentFormCard` renders
  that as a ledger with diverging bars. Current-day only (the card skips under
  a spoiler `asOf`), and NOT
  `src/api/recentForm.js`, which is the TEAM page's unrelated Last-10 roster
  projection — the name differs on purpose so the two never collide.
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
- `comebackWins.js` — the Team Page's "Comeback wins" card, from
  `public/data/comeback-wins.json` (`gen-comeback-wins.mjs`). Per-team,
  per-season comeback WINS (`sub10/20/30`) over ATTEMPTS (`att10/20/30`, times
  the club fell that low win or lose) after its win prob dropped below 10/20/30%
  (both nested). `comebackRatesFor(data, teamId, season)` is what the card uses:
  per threshold the club's `wins`/`att`/`rate` (`sub/att`) plus the pooled MLB
  baseline `leagueRate` (`Σsub/Σatt`) and a count-based `rank`/`of`/`tied` (raw
  win count, sample-size-proof — a rate rank would let a 1-of-1 club top it).
  `comebackWinsFor` selects one raw row; `leagueComebackWinsFor` is the legacy
  `{ teamId, stat }` count shape (still exported for reuse). Spoiler-free (a
  Final-games aggregate, same footing as WAR) — no `SealBox`; the card renders
  only when the club has at least one comeback win.
- `attendance.js` — the Ballpark card's attendance stats, from
  `public/data/attendance.json` (`gen-attendance.mjs`). Per-team, per-season
  HOME-game attendance: `games`/`avg`/`high`/`low`, computed from the
  boxscore's `Att` figure only (an away game folds in nothing — attendance is
  a fact about the HOME club's own park). `attendanceRatesFor(data, teamId,
  season)` is what the card uses: the club's own `avg`/`high`/`low` plus its
  `rank`/`of`/`tied` among every club with a row this season (by average,
  ties sharing the best rank). `attendanceFor` selects the raw row. MLB only
  — the generator is. Spoiler-free (a Final-games aggregate, same footing as
  WAR) — no `SealBox`; the Facts rows render only when the club has one.
- `teamRecords.js` — the Numbers tab's situational **Records** card, from
  `public/data/team-records/{season}/{teamId}.json` (`gen-team-records.mjs`),
  MLB and all four full-season MiLB levels. The file is a compact ROW PER GAME,
  not finished records; `teamRecordsFor(data, { cutoff, half })` does the
  tallying, and that is the point rather than an implementation detail. Two
  things follow. A dated (`?d=`) page passes the same day-before `cutoff` its
  standings use, so the records cannot look further ahead than the rest of the
  tab — a precomputed season total could not do that without a date-keyed
  snapshot per club per day. And `half` (`'all' | 'pre' | 'post'`, `HALVES`)
  answers the pre/post-All-Star lever off the same rows, with no second dataset;
  `data.allStarDate` absent (an early-season file) makes the lever a no-op and
  the card hides it.
  `RECORD_GROUPS` is the declared table — each row a label and a PREDICATE over
  one game. A predicate returning false EXCLUDES that game from the row rather
  than scoring it a loss, so a row nobody has a game for is dropped instead of
  printing `0-0`, and a thin MiLB feed thins a row instead of voiding the table.
  Every shipped row omits its falsy keys, so each predicate coalesces: absent
  `h` is an away game, absent `n` a day game, absent `oh` a starting hand the
  generator could not resolve (counted in neither the RHS nor the LHS row).
  `longestStreaks` / `sweepCounts` / `daysAtPlace` are the season COUNTS, exported
  separately because they are single numbers rather than records; a sweep needs
  every game of its series inside the filter, so a set straddling the break
  belongs to neither half. Spoiler-free (a Final-games ledger, same footing as
  `comebackWins.js` and the team-score aggregates) — no `SealBox`, and the
  nightly cron writes the file before the day's games. Degrades to null with no
  file, and the card hides.
- `teamRecordRankings.js` — the same ledgers, PIVOTED: one split, every club at
  one level, ranked — the standalone `/team-records` page
  (`screens/TeamRecordsPage.jsx`), which every row of the Records card links
  into. `fetchLevelTeamRecords(sportId, season)` pulls that level's thirty
  shards (`teams-static.js` supplies the club list; `staticJsonBy` memoizes each
  one, so paging between splits, halves and levels re-downloads nothing);
  `buildRankingIndex(entries, { cutoff, half })` calls `teamRecordsFor` per club
  and inverts the result into a metric-keyed table; `rankMetric` sorts one of
  them. It derives NOTHING new — a changed predicate in `RECORD_GROUPS` changes
  the card and this page together, which is why the row `id`s there are stable
  strings rather than slugs of the labels (a URL names them).
  **Order is not always highest-first.** A W-L split ranks by win percentage,
  best at the top. A season count ranks by whichever end `COUNT_METRICS` calls
  good: `better: 'low'` opens ASCENDING (fewest losses after leading leads that
  column), `'neutral'` (days in 2nd through 4th) is ordered but carries no
  best/worst framing at all. A club that has never been in the split keeps its
  row, unranked, below the ranked ones — and is excluded from the field size, so
  "of 30" never counts clubs that could not be ranked. The cost is stated in the
  module header: ~99 KB over the wire per level, which is why this is a page a
  reader opts into rather than a card. Spoiler-free, same footing as
  `teamRecords.js`.
- `postseasonOdds.js` — MLB postseason odds (playoff / division / bye
  probability + projected wins) from `public/data/postseason-odds.json`, the
  Team hub's odds pill. DATE-KEYED, exactly like `seasonScore.js` and
  `teamScore.js`: `postseasonOddsFor(data, teamId, season, cutoff)` picks the
  latest snapshot at or before the page's as-of cutoff, so a dated Team Page
  never renders odds computed with knowledge of games past that date. That
  select-the-latest-eligible-snapshot shape is also how the file rots INVISIBLY
  when its generator stops running — the reader answers with the newest thing
  on disk and has no way to know it is three weeks old. `gen-postseason-odds.mjs`
  was off the nightly cron until 2026-08-09 for exactly that reason; if this
  card ever looks wrong, check the workflow before the math.
- `managers.js` — a coach's full career, from the `personId % 100` shards in
  `public/data/manager-history/`, behind `/manager/{id}`. Every job row, not
  just the managerial ones. A club-season shared by two managers carries
  `sharedSeason: true` and NO record rather than a split invented from data
  that can't support one (see the generator). `dedupeStints` runs on every
  read: the coaches endpoint repeats a person once per jersey number, and only
  one twin ever gets the record, so an undeduped shard printed the rest as
  phantom shared seasons AND split continuous tenures in half. Same instinct as
  `aggregateSplits` deduping statsapi's repeated stat rows — the feed repeats
  itself, so the reader dedupes.
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
- `prospectTrend.js` — bbsbh's OWN level-relative OPS/ERA percentile, from
  `public/data/prospect-trend.json` (`gen-prospect-trend.mjs`). Contrast
  `feverRadar.js` above: not a third party, not attributed, and not an MLE —
  purely "how does his OPS/ERA compare to every other qualified player at his
  level this season," computed straight from the same `fetchLevelSeasonStats`/
  `combineToPool` (`statsLevels.js`) the combined minors leaderboard uses. A
  `qualified: false` row means the prospect hasn't cleared the playing-time
  floor (`MIN_PLATE_APPEARANCES`/`MIN_OUTS`,
  `scripts/lib/prospectPercentile.mjs`) yet this season, not that he's off
  the board. `ProspectTrendPill` presents it on `/prospects`; `ProspectCard`
  uses the same signal on a minor-league player page. `movement` is the same
  self-join-against-bbsbh's-own-history pattern as `feverRadar.js`, just a
  wider window (stat percentiles move slower than a daily scouting rank); the
  arrow only appears past a 5-point move, since a percentile wobbles a point
  or two on one good night.

  The board column is **`Standing vs level`** and sits last, after the season
  line. Each row names its metric and exact percentile, then gives the standing
  band, sample confidence, PA/IP, and meaningful movement. The five bands are
  Bottom, Below, Middle, Above, and Top. The filter and Prospect Card use those
  same names. Higher is always better: `percentileRank` inverts ERA before the
  UI receives it. A move under five percentile points reads as `Steady` on both
  surfaces because one game can cause a small percentile wobble.

- `gamePhotos.js` — the unsealed Game Photos page's (`/photos`) high-res photo
  finder, from the same `/api/v1/game/{gamePk}/content` endpoint `highlights.js`
  uses for video. MLB serves every editorial photo through img.mlbstatic.com
  with a Cloudinary resize transform baked into the URL path;
  `fetchGamePhotos` strips each URL's transform segment back to the
  photographer's original upload and dedupes by photo id.
  Deliberately NOT reveal-only or SealBox-wrapped — a recap/celebration photo
  narrates the outcome just by looking at it, same risk as a highlight clip's
  title, but this is a standalone page outside the scoring flow, so it sits
  outside the spoiler rule's scope rather than carving a hole in it (its page
  carries its own disclaimer instead). See the root `CLAUDE.md` for that scope.
  Every image is a video THUMBNAIL (`editorial` has been empty on every game
  checked), so each carries a `kind` — `photographer` (a Getty/AP/MLB
  Photos-Greenfly still), `broadcast` (a frame off the TV feed), `graphic` (a
  Statcast darkroom card or GAME HIGHLIGHTS recap art), or `unknown`. The
  decisive test is the ORIGINAL asset's aspect ratio, which Cloudinary reports
  without serving the file (`fl_getinfo`): cameras shoot 3:2, video is 16:9.
  `image.title` (the asset filename) is checked first as a free shortcut but is
  NOT sufficient alone, and taxonomy keywords describe the VIDEO not the image
  — **read the module header before touching `classifyPhotoAsset`**, it records
  which signals were tried and the specific ways each one fails on its own.
  Each photo also carries `focus` (subject player + team, from the item's own
  `keywordsAll` ids — never name matching), which is what `photosForPlayer`/
  `photosForTeam` query. `withoutGraphics` is the camera-only filter both the
  page and `GamePhotosStrip` apply (keeps `broadcast` + `unknown`, drops
  `graphic`); `onlyPhotographer` is stricter still — `kind === 'photographer'`
  only, dropping broadcast frames too — for a surface that wants camera stills
  alone, e.g. an ABS-challenge result card (`graphic`, from a taxonomy/shape
  match) or a broadcast frame grab slipping in.
  `photosForPlayer` is still unused groundwork; `photosForTeam` now backs the
  Team Page's Photos rail (`TeamPhotosRail`, on the hub's Games tab),
  which walks that team's own `seasonGames` (already `asOf`-cutoff-filtered,
  the same list the tab's `AllGames` grid renders off) backward from the newest game,
  fetching `fetchGamePhotos` per game on demand rather than reading a
  precomputed index — that page already has the one team's full decided-game
  list in memory, so a bounded live walk-back was enough. The cross-game
  "photos by player / by team, from anywhere" index scoped in
  `.scratch/game-photos-by-subject/` (PRD + issue 01) is still open for a
  surface with no such list already loaded (a player page, say) — read that
  doc, including its note on what shipped without it, before building it.
