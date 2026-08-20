# src/api — the live-game catalog

Per-module notes for the modules that read a **live game feed**: the fetchers, the
selectors over `feed/live`, and the staging selectors the lineup pages use before
first pitch.

This is tier-3 reference (root `CLAUDE.md`'s doc tiers) — it loads when you are
pointed at it, not on every session. **`src/api/CLAUDE.md` carries the rule that
governs these modules and is the file to read first**; nothing here restates it.
Each module's spoiler class is recorded machine-readably in
`src/api/spoiler-manifest.json` and enforced by `scripts/check-spoiler-manifest.mjs`.

Siblings: `docs/api/static-data.md` (the precomputed `public/data/*.json` readers),
`docs/api/account-layer.md` (`src/lib/account/`).

## Core feed / selectors


- `statsapi.js` — the one `getJson` fetch wrapper every topic file below calls.
- `schedule.js` — slate/schedule (`hydrate=team` for the abbreviation +
  teamName the bare row lacks), `resolveGame`, `fetchGamesByPk`,
  `fetchHeadToHead`, `fetchTeamSchedule`. `fetchGameCardsByPk` is the
  cross-date sibling of `fetchGamesByPk` — full `normalizeGame`-shaped rows
  (+ `officialDate`) for a gamePk list spanning many dates/levels, e.g. the
  All-Star Rosters page, where each card needs its own team identity rather
  than inheriting one date's sportId like the ordinary slate.
- `uniforms.js` — `/api/v1/uniforms/game` for what each club is wearing (not in
  the live feed; spoiler-free but empty until ~first pitch, so it rides the
  feed's fetch/reload in `GameView` and renders on the lineup pages + box
  score). Also `fetchTeamUniformCatalog` (per-team season catalog) and, for the
  Team Page's record-by-jersey strip (`components/logo/JerseyCombos.jsx`),
  `fetchGameJerseys` (batched per-game worn-jersey join) + the pure
  `buildJerseyCombos` (one card per catalog jersey → its logo treatment + the
  club's W-L in games it wore it, joined by `uniformAssetCode`; the record is
  gated by the schedule's own cutoff so it can't leak a result the standings
  don't already show). A MiLB club has no catalog at all, so its Team Page gets
  the two-card Home/Away form of that strip instead, with no record — there is
  no per-game MiLB jersey feed to attribute one to.
- `jerseys.js` — the nightly `gamePk:teamId → treatment` export
  (`public/data/jerseys.json`). `jerseyTreatmentFor` swaps a slate card's logo,
  drives the WPA band, and since ADR-0030 picks the lineup page's club theme.
  `jerseyWearDates` joins it to a dated team schedule — neither half carries
  what the other has — for `/identity-lab`'s per-tile links into a real game's
  photo gallery.
- `game.js` — the full game feed (`/api/v1.1/game/{gamePk}/feed/live`), a
  **separate** `/teams/{id}/coaches` call for managers (they are **not** in the
  live feed), and a **separate** `/api/v1/game/{gamePk}/winProbability` call
  for per-play WPA — the sole source of the box score's three stars and the
  innings view's WinProbChart band. It's score-revealing, so `GameView` fetches
  it lazily (waiting on `useGameData`'s `useEverActive` for the innings view or
  the box score to actually be opened, not merely the feed landing — a cold
  open always starts on a lineup page, which reads neither) and the DOM only
  gets it inside a seal/reveal clamp; it's null-guarded (absent at most MiLB
  parks). Also exports `fetchGameFeedDiff`/`mergeFeedDiff`, the
  undocumented diffPatch polling path `useGameData` uses ONLY during the
  tight Follow Live/Scores Unlocked cadence (ADR-0032) — `mergeFeedDiff`
  never mutates its `base` argument (see `../lib/jsonPatch.js`) and never
  throws, falling back to `null` (→ a normal `fetchGameFeed` call) on any
  apply failure or gamePk mismatch.
- `highlights.js` — video highlight clips (`/api/v1/game/{gamePk}/content`),
  joined to a specific play by matching a clip's `guid` to the terminal pitch
  event's `playId` in `feed/live` (the only reliable join key; verified live
  against both batted-ball and strikeout-ending plays — see
  `.scratch/video-highlights/`). Reveal-only (see above): `useGameData`
  fetches it lazily, same `useEverActive`-gated tier as `winProb` (waiting on
  the innings view specifically, its only consumer), but `highlightsByPlayId`
  is only ever called inside `HalfInning`'s `SealBox` reveal function.
  Degrades to `[]` on failure or off-MLB. `eligibleHighlightForPlay(items,
  playId)` is the SECOND consumer of that join and reveal-only in the same
  sense — one play's clip for the box score's Play of the Game card, gated by
  `isEligibleForPositiveFilter` so an `abs`/`challenge` review can't anchor a
  card claiming "the best play" (the per-play button deliberately shows ANY
  clip). It requires no significance tag: the play is picked by this app's own
  WPA ranking, and requiring MLB's tag on top measured out at 57% of games
  losing a button that had a real matched clip. The card's `playId` comes from
  `boxscore.js`'s `computePlayOfTheGame` — see its `playIdForWinProbEntry` for
  why the join reads the FEED by `about.atBatIndex` rather than the win-prob
  entry's own (pruned-away) `playEvents`.
  `selectCondensedGame(items)` / `selectGameClips(items)` are the THIRD reader
  of that same one fetch — the box score's video row under the line score
  (`GameVideoRow.jsx`): MLB's ~12-minute condensed cut plus this game's whole
  reel, oldest first by publish time. Reveal-only in the same sense, and the
  row's only protection is being mounted inside the box score's `SealBox`
  reveal function, like `GamePhotosStrip`. `selectCondensedGame` reads the
  `condensed-game` taxonomy tag DIRECTLY rather than loosening
  `NON_PLAY_TAXONOMY`, which must keep excluding it for the rails' sake.
  A condensed cut posts ~30 min after the final out, so its absence (a live
  game, MiLB, or that window) is routine, not an edge. `formatClipDuration`
  turns the feed's `"00:12:20"` into the `(12:20)` the kraft tab says.
  The card's POSTER is not MLB's own — that is always the same designed
  "CONDENSED GAME" plate over both clubs' marks. `GameVideoRow` runs
  `gamePhotos.js`'s `pickHeroPhoto` over the items it already holds and shows
  the still it returns, which is the identical pick the nightly sweep stores
  for the slate's own condensed print (`GameResultFace`), so the two surfaces
  cannot disagree about a game's photograph. Computed live rather than read
  from the day index because that file is written the night AFTER the games,
  and so holds nothing for the game you just finished scoring; `pickHeroPhoto`
  takes a `width` for the render, since the box score's print fills a half-page
  column where the slate card's 480 reads soft. Null (a MiLB park, or a game
  MLB shot nothing usable at) leaves MLB's poster in place.
  Also holds the highlights **cascade**'s pure classification —
  `classifyHighlight`, `isEligibleForPositiveFilter`/`NON_PLAY_TAXONOMY`,
  `highlightPoster` — which is NOT reveal-only: it's plain data transform over
  the same raw items, run by `scripts/gen-highlights.mjs` in Node with no DOM.
  It lives here rather than in a parallel module because it reads the same
  `content` payload, and the FILTER POLICY must have exactly one home (a second
  copy is how a rail and its generator drift apart). Field names and the
  taxonomy vocabulary were verified live over 1,150 clips / 41 games; see
  `.scratch/highlights-cascade/`. `highlightPlaybacks` accepts either the raw
  `content` item's `playbacks` array OR an already-resolved `{hls, mp4}`
  object — the shape a highlights-cascade team/player file stores per clip
  (the generator calls this function once at write time and keeps the
  result) — so `HighlightSheet.jsx` can stay the one consumer for both the
  box score's raw per-play item and a rail's precomputed clip, with neither
  rail re-deriving playback URLs by hand.
- `gamehighlights.js`'s `fetchDayVideos(urlDate)` — one slate date's condensed
  games keyed by gamePk, from `public/data/highlights/day/{MMDDYYYY}.json`
  (~8 KB per day, written by the same nightly sweep). For the home slate's
  revealed result cards, which need EVERY game's poster at once and so can't
  use the live path the box score uses — `content` is 430 KB per game and
  ignores `?fields=`, making 16 cards ~6.9 MB of JSON. Playback URLs ride
  along, so tapping a card's poster opens the player with no network at all.
  Known lag, and the reason the live path still exists: TODAY's slate has no
  file, so a miss is normal and the card falls back to fetching on tap
  (`WatchCondensedButton`). Degrades to `{ games: {} }`, cached per date.
- `gamehighlights.js` — the reader half of the cascade: the static per-team
  archive `scripts/gen-highlights.mjs` precomputes
  (`public/data/highlights/{teamId}.json`), for the Team hub's Games-tab rail
  and the player page's rail. Build-time-fetch pattern (below), same
  thin-static-reader-beside-a-live-fetcher split as `war.js`. Deliberately
  DUMB — every filter already ran in the generator, so there is no policy here
  to drift; a caller's only job on top is identity scoping (the player rail
  keeps `clip.playerId === personId` from his CURRENT team's file). Decided
  games only, so not a spoiler surface. Degrades to `{ games: [] }`, cached per
  team for the session. `flattenPositiveClips(data)` is the shared shaping step
  both rails call on top of a fetch result — flattens `games[].clips[]` into
  one OLDEST-first list, each clip annotated with its `gamePk`/`date`, so both
  rails' newest-at-right scroll anchor (PRD's "Rail ordering") lands at the end
  of the array with no separate reverse step, and the two rails can only ever
  differ in which clips they keep after this call, never in how they unpack
  the file. Both rails also render the same `HighlightClipCard`
  (`src/components/highlights/`) for each clip — purely presentational, no
  fetching of its own — so a clip object only ever needs shaping once, here,
  regardless of which rail is reading it. `highlightPlaybacks`
  (`highlights.js` above) also had to grow a second branch for this cascade —
  a shipped clip's `playbacks` field is already the resolved `{hls, mp4}`
  object the generator wrote, not the raw MLB array of named sources
  `HighlightSheet.jsx`'s box-score caller passes, so the function now accepts
  either shape rather than a rail needing to re-derive playback URLs itself.
- `careerTimeline.js` — the "Team history" rail's fetch side, split out of
  `person-fetch.js`: `fetchTeamLogoTint` (per-club logo wash), the per-(club,
  season) parent-org lookup, `buildCareerTimeline` (the ONE entry point — it
  resolves orgs, shapes with `careerTimelineView`, then enriches the entries),
  and the manager page's `fetchPlayingTimeline` over it. The org lookup exists
  because a year-by-year split carries no dates: a season traded mid-year
  (Joey Wiemer, 2024) sorted by LEVEL alone printed both farm clubs, then both
  big-league clubs — reading as MIL → CIN → MIL → CIN. Grouping a season by org
  restores the real run. Two limits are documented at the sort itself: an org
  he spent the year with in the minors only sorts after every org he played
  big-league games for, and a season with any unresolved farm club falls back
  to the plain bottom-up climb.
- `person-fetch.js` — the player page's bio/stats/"firsts" fetchers
  (see `person.js` for the pure shaping). Read by the player page only —
  never wired into a sealed game surface. **`currentTeam` is not a roster
  claim**: the API keeps aiming a released, unsigned, or long-retired player at
  the last club he was contracted to (Pujols still reads "St. Louis Cardinals"),
  which the hero used to render as his team. `fetchPerson` therefore hydrates
  `rosterEntries` — one row per STINT, `startDate`/`endDate` — and `person.js`'s
  `rosterStatusView(person, onDate)` answers "is he on ANY club that day",
  splitting a gap into free agent vs. retired on `person.active` (a fact about
  today, so it may only classify a gap that runs to the present). Null means
  rostered, i.e. render the club exactly as before; non-null makes `PlayerPage`
  swap the club crest for the league mark and the club name for the status word,
  and drop the club's header theme and headshot tint. Its companion
  `lastPlayedSeason` backs the "Last played in 2022" banner, shown only for the
  unrostered — a signed player who has missed the whole year is the IL banner's
  story, not this one. Both are pure and take the page's cutoff date, so a
  player page opened from an old box score reports his status THAT day.
- `team.js` — team identity, roster, affiliates, standings, ranked team stats.
- `search.js` — the footer's player/team directory search.
- `select.js` — pure, spoiler-free selectors over the raw feed. `selectLineup`
  returns the STARTING nine, from each boxscore player's own `battingOrder`
  value (a starter's is an exact multiple of 100; a sub's is offset 801/802…) —
  never `team.battingOrder`, which mutates to the current slot occupants and
  would sprout PH rows on the staging pages late in a game. It also feeds
  `DefenseDiamond` (the scorebook-style opposing-defense drawing on the lineup
  pages).
- `liveEdge.js` — a THIRD classification, neither reveal-only nor an ordinary
  spoiler-free selector: `selectLiveEdge(feed, spoilersOff)` reports only how far
  the game has progressed (the last play's half-index), never a score, and only
  when the user has consented (returns null unless the flag is exactly `true`, and
  before first pitch / on empty play data). Under the Scores Unlocked pass
  (ADR-0026) it keeps a caught-up viewer on the newest half — NAVIGATION only. It
  deliberately feeds no reveal mark: everything already renders open under the
  pass, so there is nothing to ratchet. Two UNGATED readers sit beside it
  (ADR-0054), answering a narrower question from the linescore's own live state
  rather than from the plays: `selectLiveHalf(feed)` — which half is the game IN
  (or, between halves, which did it just finish), `{ idx, inning, half,
  inProgress }` or null — and `selectCatchUpTarget(feed)`, the same thing shaped
  as a destination for the lineup page's "Catch up to live". They need no pass
  because they report an inning number and which half and nothing else, and
  neither caller RENDERS the inning: `InningViewer` compares `idx` against the
  half on screen to stop a still-being-played half committing itself early, and
  the lineup page uses it to decide whether to draw a button whose label is fixed
  copy. `inningState` is what the plays cannot supply — a half whose third out
  has just been recorded and one whose next batter is still walking up look
  identical in `allPlays`. A feed that posts no live inning state (MiLB) reads as
  "no live half", which is the pre-ADR-0054 behaviour and the safe way to fail.
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
- `boxscore.js` / `boxscore/gameNotes.js` — reveal-only. `boxscore.js` builds
  the tables; `gameNotes.js` owns the INFO BLOCK, the label/value rows MLB hangs
  underneath them, and the rule filing each under a club: a row goes to the club
  of the player it NAMES FIRST. That is a pitcher everywhere except **HBP and
  IBB**, which name the batter and print in HIS club's BATTING notes beside the
  2B/RBI/GIDP lines — being hit belongs with the rest of a hitter's night, not
  under the pitching club's heading. A row the parse can't match to a roster
  name falls to the shared foot at the bottom of the sheet, which means an entry
  down there that NAMES A PLAYER is a bug, not a category: three real shapes
  landed there (a batter hit by two pitchers, a bare "Name N" with no
  parenthetical, and a `Jr.` whose period was eaten as the row's terminator) and
  `test/box-score-note-attribution.test.js` pins each. The foot is for rows with
  no player in them at all — an ejection, written as prose.
  Both grids also read whether a half was PLAYED off the presence of its `runs`
  key, never its value (`test/skipped-half-cells.test.js`): the home 9th of a
  game the home team led entering it carries hits/errors/LOB and no `runs`, and
  testing the half object instead printed real-looking zeros for an inning that
  never happened.
- `linescore.js` / `derive.js` — reveal-only (see spoiler rule above).
  `linescore.js` also holds `revealStampFacts`, the Logbook stamp's game blob
  (final score, clubs, venue, innings) in the exact shape `api/stamps.js` caches
  as `game:final:{gamePk}`. Its one caller is `StampGameButton` inside the box
  score's `SealBox` reveal render — ADR-0035. Two fields there are load-bearing,
  not decoration: `innings` and `homeBattedLast` must match what the SERVER
  derives from the schedule feed, because a stamp is drawn from whichever
  producer resolved it and has to look identical either way. Both are derived by
  scanning for the last half anyone actually batted in rather than off
  `innings.length`, because the live feed pads its linescore out to
  `scheduledInnings` and the schedule feed does not. A rain-shortened game is
  where those two disagree; `test/stamp-art.test.js` pins it.
  `derive.js` also computes the per-half Statcast superlatives (fastest pitch /
  hardest-hit / longest ball from `playEvents[].pitchData`/`hitData`) — absent
  at most MiLB parks, so every field is null-guarded and the UI hides the row.
- **`hitchart.js`** — reveal-only. The hit chart's data layer, and the only
  reader of `hitData.coordinates` (`coordX`/`coordY`, verified against gamePk
  823427). `selectBattedBalls(feed, { teamId, throughHalfIndex })` returns one
  entry per batted ball, each carrying its exit velocity, its trajectory and
  the batter's own scorebook denotation — the latter from
  `playbyplay/scorebookCode.js`, so the card speaks the same notation the
  play-by-play cards do rather than a second spelling of it. `hitCoordToSvg`
  projects Gameday's coordinate pixels into the ballpark drawing's own space at
  `HIT_COORD_FT_PER_UNIT` (2.51), a constant fitted against the feed's own
  carry distances and pinned by `test/hitchart.test.js` — the pin is the only
  defence against a feed change silently shifting every dot. `throughHalfIndex`
  clamps to `halfIndex <= revealedThrough`, one half tighter than the pre-pitch
  selectors, because a batted ball is the result rather than the staging for one
  (ADR-0051). A park that sends no `hitData` yields an empty array and the card
  renders nothing.
  Constants shared across the reveal-only modules (`NON_PA_EVENT_TYPES`,
  `WHIFF_CODES`, `pitchCallCode`) live in `playbyplay.js`: baserunning-only
  top-level plays are NOT plate appearances for PA/BF counts, but their pitches
  DO count. The pitch CALL codes are a closed table (`playbyplay/pitchInfo.js`,
  mirroring MLB's own `/api/v1/pitchCodes`), and everything that reads a code —
  the ladder's lanes, Whiffs, fouls, first-pitch strikes — sorts it with that
  one table rather than naming codes at the call site. Enumerate a new code
  there: a code in none of the sets falls to `ball`, which is how a missed bunt
  came to draw a strikeout on two strikes (`test/pitch-codes.test.js` pins the
  table against MLB's own strike/ball flags). Two things the table says that
  `isPitch` alone does not — an automatic ball or strike moves the count with no
  pitch thrown, so it belongs to the COUNT (`card.pitches`, the ladder) but not
  to the pitches (`card.pitchDetails`, the zone plot and pitch list); and a foul
  TIP or foul BUNT at two strikes ENDS the at-bat instead of extending it
  (`FOUL_ENDS_AB_CODES`, which every two-strike-foul counter excludes).
  `computeHalfInningFeed` emits three entry kinds — `atbat`, `event`,
  and `placed`, the extra-innings automatic runner. His card exists so he can
  enter `originIndex` with `progress` seeded to the base he was given: that
  registration is what lets the shared advancement bookkeeping write his legs,
  his out on the bases, and his run onto a card, instead of computing the whole
  trip and discarding it for want of an origin. See
  `.scratch/placed-runner-card/PRD.md`. `legAdvanceCode`'s per-runner advance
  codes (`ADVANCE_CODES`) have a couple of rare, deliberately-unresolved
  fallback gaps — see `docs/unresolved-scoring-conventions.md`.

  Three things about an at-bat card that the raw feed does NOT hand you
  directly, each of which was getting the card wrong:

  **Whose plate appearance it is** is `creditedBatterId` (`playbyplay/shared.js`),
  not `matchup.batter`. A batter replaced mid-count can still own the result:
  Rule 9.15(b) charges the strikeout and the time at bat to the man who LEFT
  when a substitute finishes a strikeout he already had two strikes on (every
  other ending goes to the substitute). MLB reports that split by leaving
  `matchup.batter` on the substitute while `result.description` and the boxscore
  line name the man who left, so the description's leading name is the feed
  telling you who owns the card. Only the card identity follows it —
  `runners[]`, `progress` and `legs` all keep speaking `matchup.batter`'s id,
  which is safe because the rule fires on strikeouts only, where the credited
  batter is out and has no trip to track. Three of eleven mid-at-bat batter
  substitutions in an 854-game sweep took this path, all strikeouts
  (`test/mid-at-bat-batter-change.test.js`).

  **The order of the notes leading a card** is the order of the play's own
  `playEvents`. Stoppage notes are pushed as the scan walks them, so a
  baserunning event has to be pushed there too, not collected and flushed
  afterwards — flushing sorted every steal, wild pitch and balk AFTER every
  mound visit, ejection and substitution in the same play regardless of when
  each happened (49 plays in the sweep, reading as cause and effect reversed).

  **A `game_advisory` playEvent is two different things** — see
  `isDelayAdvisory` (`playbyplay/eventTypes.js`). Most are the feed's own
  lifecycle bookkeeping ("Status Change - Pre-Game/Warmup/In Progress") and
  belong nowhere; the rest are the in-game stoppages ("Injury Delay.",
  "On-field Delay.", the weather "Status Change - Delayed…" lines), which are
  the account of why a half stopped and were being dropped with them. The
  description is the only thing separating the two, which is why the predicate
  reads it (`test/half-feed-note-order.test.js`).

- `logbook.js` — the Logbook's game facts for a set of STAMPED gamePks
  (`fetchStampGames`, `stampGameFacts`), ADR-0035. The one fetcher here that
  deliberately asks statsapi FOR the score: every other schedule fetcher prunes
  it out with `fields=` (see the `GAMES_BY_PK_FIELDS` block in `schedule.js`),
  which is exactly why this one lives in its own file rather than beside them —
  so nobody reaches for the wrong function. Safe only because its input is the
  user's own stamps, and a stamp cannot exist for a game they have not finished
  revealing. `stampGameFacts` produces the same blob `revealStampFacts` does, so
  a stamp renders identically whichever source resolved it. Do not call it with
  an arbitrary game list.

- `logbookStats.js` — the Logbook's retrospective, Tier 1 (`computeLogbookStats`),
  ADR-0035. **Pure**: `(stamps, gameFacts) -> numbers`, no fetching, so the
  record/streak/aggregation math lands in the CI-gated suite
  (`test/logbook-stats.test.js`) instead of being verifiable only by eye —
  deliberately unlike `FirstScorebookPage.jsx`, which derives the same family of
  numbers inline in `useMemo`s where nothing can reach it. **Reveal-only by
  classification** (it handles scores, so ADR-0001 applies); with no seal to sit
  inside, the discipline is the INPUT — only ever the user's own stamps, never an
  arbitrary game list. Rendered by `screens/LogbookStatsPage.jsx` at
  `/logbook/stats`.


## Leader boards (live)

- `leaders.js` / `teamLeaders.js` / `statsLevels.js` — ranking is pool-agnostic:
  `teamLeaders.js` holds the category descriptors + `computeLeaders`, which ranks
  any normalized `PoolPlayer[]`; `leaders.js` produces the pool for a scope (a team
  level or MLB/AL/NL via `fetchTeamRoster` fan-out; an `org` via `statsLevels.js`).
  `statsLevels.js` reads the roster-INDEPENDENT season-stats endpoint and SUMS a
  player's lines across levels into one combined row (recomputing rate stats from
  summed components) — what lets a promoted farmhand rank on his A+ + AA total.
  Rosters miss him (he's off the club he's left); the stats endpoint doesn't.
