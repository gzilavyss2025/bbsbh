# src/api — the data layer

Fetch wrappers and selectors around the public MLB Stats API, split by topic (all
share `statsapi.js`'s `getJson`; a shared header there notes the gamePk field
paths were verified against). This file is the per-module catalog; the always-loaded
root `CLAUDE.md` carries only the spoiler-rule summary that governs these modules.
`../CLAUDE.md` covers how they're consumed by the screens.

## The spoiler rule, applied here

`linescore.js` and `derive.js` are **reveal-only** modules — callable only from
inside a `SealBox`'s reveal render function, never at render top-level or in an
eager `useMemo` (ADR-0001). `select.js` is spoiler-**free**. In between sit
**caller-gated pre-pitch selectors** (`selectPrePitchChanges` in `select.js`,
`defenseEntering` in `defense.js`, `lineupEntering` in `battingorder.js`),
spoiler-free only when restricted to the half the user has reached
(`halfIndex <= revealedThrough + 1`). See the root `CLAUDE.md` spoiler section and
`docs/adr/` (0001, 0003, 0005–0007, 0009, 0010) before touching any of these.

## Core feed / selectors

- `statsapi.js` — the one `getJson` fetch wrapper every topic file below calls.
- `schedule.js` — slate/schedule (`hydrate=team` for the abbreviation +
  teamName the bare row lacks), `resolveGame`, `fetchGamesByPk`,
  `fetchHeadToHead`, `fetchTeamSchedule`.
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
  season's pace pull per MLB active-roster player plus every team's season
  schedule (`gen-milestones.mjs`, daily cron), so the projection can scale by how
  often a player actually plays rather than assuming a #5 starter takes the mound
  every team game. `milestonesForPlayer` filters the league-wide file to one
  player for the card; the projection math (`projectMilestoneETA`,
  `careerPerSeasonRate`, `milestoneRarityRank`) lives in `person.js` alongside
  `MILESTONE_DEFS`, shared by the generator. Counting-stat totals carry no
  individual game's score (same footing as League Leaders/WAR), so the page needs
  no `SealBox`; the player-page card still only shows its projection on a bare
  current-day view (`asOf` unset) since the precompute can't be retrofit to an old
  game's cutoff.
- `umpires.js` — the umpire detail page (every game an umpire worked this season +
  base, most recent first), from `public/data/umpires.json`, keyed by umpire
  personId. Cost-driven: no "games by umpire" endpoint, so `gen-umpires.mjs` does a
  full-season schedule scan (`hydrate=officials,team`) then re-indexes thousands of
  rows by umpire id. MLB-only. Wired via `selectOfficials` (`select.js`) threading
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
  days' finals, deduped by gamePk. Each row also carries a 3×3 zone grid; a
  memoized `accuracyIndex()` ranks every qualifying plate ump by season accuracy
  (`MIN_RANK_GAMES` floor) and builds the league miss-share baseline the zone map
  compares against. `loadUmpire` merges it all in as `accuracy` (`{ season,
  byGamePk }`) + `rank` + `zoneCells` (via `umpireZoneCells`) for `UmpirePage.jsx`'s
  plate-accuracy card (rank line + `UmpireZoneMap`) and per-HP-row figures;
  `umpireAccuracySummary(id)` serves the rank the lineup page's Umpires card
  (`TeamInfo.jsx`) shows for tonight's plate ump, which opens `UmpireAccuracyModal`
  (zone map + last-5 plate games linking to their box scores). Still no `SealBox` —
  accuracy counts ball/strike JUDGMENTS, not runs or hits, and the lineup rank
  aggregates Final games only, so it can't leak tonight's result. MLB-only; MiLB /
  umps with no data degrade to absent.
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
- `whatsBrewing.js` — for CALIBRATED clubs (a `CONFIG` map keyed by teamId; Brewers
  + Pirates so far), the Game notes button opens an in-app modal
  (`WhatsBrewingModal.jsx`) of the narrative blurbs parsed out of the PDF. Parses
  client-side on demand (pdfjs-dist, dynamically imported so pdfjs stays off the
  main bundle — see `vite.config.js`) rather than in the cron, because tonight's
  note posts after the cron runs and the PDF host is CORS-open. Each club's InDesign
  template needs its own calibration, so `CONFIG` carries a `layout` per club —
  `column` (Brewers' narrow-column sheet) or `flow` (league-standard full-width,
  e.g. Pirates) — plus font/geometry tunables. Callers gate on
  `hasWhatsBrewing(teamId)`; add a club = add a `CONFIG` entry (not a new parser).
  See `docs/whats-brewing.md` for parsing details + the Node harness
  (`extractForTeam`).
- `minorsLeaders.js` — the combined ALL-MINORS leaderboard, from
  `public/data/minors-leaders.json`. Cost-driven: a league-wide four-level board is
  eight full-level stat pulls (~4,700 players), so `gen-minors-leaders.mjs` (daily
  cron) precomputes it. Stores PRE-RANKED top rows per category (via the app's own
  `combineToPool` + `computeLeaders`, so it can't drift from the live `org` board)
  rather than the raw pool — keeps the file ~150KB and bakes in the leader-relative
  qualifier's playing-time floor. `LeadersPage` reads it for the `minors` scope and
  hands rows to `TeamLeaders`'s `precomputed` path.
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
