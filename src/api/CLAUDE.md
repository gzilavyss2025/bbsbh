# src/api — the data layer

Fetch wrappers and selectors around the public MLB Stats API, split by topic (all
share `statsapi.js`'s `getJson`; a shared header there notes the gamePk field
paths were verified against). The always-loaded root `CLAUDE.md` carries only the
spoiler-rule summary that governs these modules; `../CLAUDE.md` covers how they're
consumed by the screens.

**This file is the RULE, not the catalog.** It loads in full whenever anyone works
in this directory, so it holds only what you need before touching any module here.
The per-module notes live in `docs/api/` and load when you're pointed at them —
see "Where the per-module notes live" at the bottom.

## The spoiler rule, applied here

`linescore.js`, `derive.js` and `hitchart.js` are **reveal-only** modules — callable only from
inside a `SealBox`'s reveal render function, never at render top-level or in an
eager `useMemo` (ADR-0001). `highlights.js`'s join (`highlightsByPlayId`) is
reveal-only in the same sense — a video clip's title/description narrate the
play's outcome, so the map is built inside `HalfInning`'s `SealBox` reveal
function, never at `InningViewer`'s top level; the
fetch itself (`fetchHighlights`) is safe eagerly with respect to spoilers,
same as `game.js`'s `fetchWinProbability` — a raw fetch result produces no DOM
on its own — but `useGameData` still waits to fire either until its consuming
surface is actually opened (`useEverActive`), since "safe" here only ever meant
spoiler-safe, not free.
`select.js` is spoiler-**free**. In between sit
**caller-gated pre-pitch selectors** (`selectPrePitchChanges` in `select.js`,
`defenseEntering` in `defense.js`, `lineupEntering` in `battingorder.js`),
spoiler-free only when restricted to the half the user has reached
(`halfIndex <= revealedThrough + 1`). `hitchart.js`'s clamp looks like theirs but
stops one half earlier — `<= revealedThrough`, no `+ 1` — because a batted ball
IS the result, not the staging for one (ADR-0051). See the root `CLAUDE.md`
spoiler section and `docs/adr/` (0001, 0003, 0005–0007, 0009, 0010, 0051) before
touching any of these.

**The classification is also machine-readable.** `spoiler-manifest.json` in this
directory carries one entry per module — its class (`reveal-only`, `reveal-gated`,
`caller-gated`, `cutoff-gated`, `progress-only`, `mixed`, `spoiler-free`), a `why`,
and for the gated classes an `importers` allowlist.
`scripts/check-spoiler-manifest.mjs` (run by `npm run lint`) fails if a module here
has no entry, if an entry names a file that no longer exists, or if a gated module
gains an importer that isn't on its list. **A new module in this directory does not
lint until it is classified** — that is the point. It cannot prove a reveal-only call
sits inside a `SealBox` reveal (ADR-0002's render-function shape is what does that);
what it buys is that a spoiler audit is a diff against that file rather than a
re-trace of the whole graph. The motivating case is in the manifest's own header:
`loadScorecard.js`'s header claimed for months that the module read only spoiler-free
data while importing `revealInning`/`revealTotals` two lines below it. Prose can be
wrong; this cannot be wrong silently. Start from the manifest, not from a grep: it
answers "what is this and who may import it" in one line, and `docs/api/` answers
"how does it work". A module's own header is the third step, not the first.

**This classification is about the SCORING surfaces only** (root `CLAUDE.md` has the
scope). Most modules here feed OPEN surfaces and correctly need no seal. Do not add a
`SealBox` to one of those: that is the mistake ADR-0034 undid.

## The build-time-fetch pattern

Several modules read a static, same-origin `public/data/*.json` file that a
`scripts/gen-*.mjs` generator precomputes (mostly on a nightly GitHub Actions
cron, `.github/workflows/update-nightly-data.yml`; a couple are hand-run). The
driver is either an **unofficial/bulk source** (WAR) or **cost** (everything that
would need dozens of statsapi calls per page load). `war.js` is the template.
`docs/scripts/generators.md` documents each GENERATOR; `docs/api/static-data.md` documents
each READER.

Three rules that keep biting. A file that grows without bound (the rookie
dataset, the vs-team splits, per-date `callouts/*.json`) gets a runtime caching
rule in `vite.config.js`, never the precache. For a hand-seeded
generator (`milb-history`, `mono-ink`, the highlight blocklist) you **edit the
seed, never the output**. And **a static file is sized against the ONE surface
that opens it, not against the dataset**: the whole-league file is the easy
generator output, but a game page paying a 3 MB parse to print one line is the
bug that shape hides. `rookies.js` and `vsTeamSplits.js` are the two worked
examples — sharded by the key their callers actually hold (the club) or split
by role when no id key fits (the pills need a compact whole-league answer; only
the player page wants dates). `docs/api/static-data.md` has both.

**Read every one of these files through `staticJson.js`** (`staticJson` for a
whole file, `staticJsonBy` for a sharded set). It memoizes the REQUEST, not just
its result. A hand-rolled `let cached` assigned after the `await` looks correct
and is not: React mounts a page's cards on one tick, so every caller that starts
before the first resolves fires its own copy. That cost the player page fourteen
reads of `teams.json` and eight of `milb-history.json` on a single load. Each
reader still owns its own `shape` and `fallback`; nothing else changes.

**The six #1200 season stores' readers take `{ seasonYear }`** (a year, `'all'`, or
nothing for `current`; a year after the last reads `current`, a year before the
first reads nothing), resolved by `seasonFolderOf` in `staticJson.js`. Never `season`: in `umpires.js` that is an
umpire's aggregate. A game page passes `selectGameSeason(feed)`. `scout/hitterGrid.js`
is not one of the six and still takes a positional season.
`'all'` reads a league file's `all/` copy; one player's `'all'` is a sum in
`lib/seasons/combine.js` (ADR-0086, #1201).

## Callouts

The callout families (`callouts.js` and the nightly `gen-callouts.mjs`) are
catalogued in `docs/callouts.md` (every family, trigger, surface, gate, worthiness
score) and ADR-0014 (the two-tense rule). Extend the nightly precompute — do NOT
build a parallel generation path. The checkpoint innings and thresholds live ONCE,
in `callout-notes/checkpoints.js`, and `gen-callouts.mjs` imports them: a second
copy would tally one inning while the note spoke about another. `callout-notes/rank.js`
holds both halves of the league rank the W-L families print for the same reason. What
each surface SHOWS is a second, purely presentational layer: `rankNotes`
(`callout-notes/shared.js`) decays a note the reader already saw, drops the facts that
cannot change during a game, and caps one note per kind — it only ever subtracts, and
never touches a gate. Before adding a data source, check whether an
existing split file covers it (`vs-team-splits`, the API's own `statSplits`, per-PA
`playLog`). Notes computable from data on hand should be computed live.

## Conventions

- **A sportId is not always a league.** sportId 17 holds SEVEN winter leagues,
  and Tally ships four of them (ADR-0078). A bare `sportId=17` call is mostly
  the wrong league — on three sampled dates it answered 15 games across four
  leagues where `&leagueId=119` answered exactly the three AFL ones — so every
  winter call carries a `leagueId`: `fetchSchedule`, `fetchTeams`,
  `fetchSlateScores` and `fetchNextGameDate` all take one, and it is `null` for
  the five ordinary levels, which leaves their URLs unchanged. `fetchWinterCalendar(season)`
  takes none: it loops `WINTER_LEAGUE_IDS`. The one call that cannot be scoped at runtime is the club list, so
  it is not made at runtime: `gen-teams.mjs` fetches the four leagues by id at
  BUILD time and writes them as `bySportId[17]`, each club carrying its own
  `leagueId`. The rule that decides which four is in `lib/winter/leagues.js` —
  ship no league whose data would make the app state something false.

## Where the per-module notes live

The catalogs were split out of this file so the per-session cost of working here
stays small. Each is tier-3 reference (root `CLAUDE.md`'s doc tiers) — read the
one you need:

| File | Covers |
| --- | --- |
| `docs/api/live-game.md` | The live-feed modules: fetchers, `feed/live` selectors, the reveal-only derivations, the pre-pitch staging selectors, and the live leader boards. |
| `docs/api/static-data.md` | The build-time-fetch readers — one entry per `public/data/*.json` file and the module that reads it. |
| `docs/api/account-layer.md` | `src/lib/account/` — the per-user state that crosses a signed-in user's devices (ADR-0039, ADR-0026). |
| `docs/api/postseason.md` | `postseason/` — the running postseason's bracket heading into a cutoff date: its two reads, the skeleton it may not trust, and the shape the UI reads. |

`around-the-game/` holds the spoiler-FREE readers behind the Around the game pages: `around-the-game/CLAUDE.md`.

`rotation/` holds the likely-starter guess for a game with no announced probable
(ADR-0089). `projectedStarters.js` is the pure rule; `liveStarters.js` feeds it live
game logs, because `workload.json` is regular-season only. Never hand a card the file's
own `apps`.

`scout/` holds the Matchup Scout's data (#1408). `headToHead.js` reads Savant's
pitch-level CSV for one hitter and pitcher from the browser, with a cutoff date, clamped
to today in US Pacific, that holds today back. Its header has the output shape and the
Savant traps (the 25,000-row cap, the inclusive date bounds, rows with no `plate_x`).
Savant is `NetworkOnly` in `vite.config.js`. `hitterGrid.js` reads the nightly
hitter-grid shards (ADR-0096, ADR-0097); it is spoiler-FREE, with season sums over Final
games.

`expresslane/` holds the Express Lane rail and clip index: `expresslane/CLAUDE.md`.

The subdirectories with their own CLAUDE.md are `around-the-game/`, `boxlines/`,
`expresslane/`, and `transactions/`. `person/`, `playbyplay/`, and `callout-notes/` carry
their notes in each file's own header plus a barrel file that explains the split
(`playbyplay.js`, `callout-notes.js`, `person.js`). Read the barrel first; it states the
directory's shared spoiler footing. `boxscore/`, `matchup/`, `player/`, `postseason/`
(`docs/api/postseason.md`), and `scorecard/` have only their file headers and the
manifest.

Related research docs, worth reading before wiring a NEW source:
- `docs/data-enrichment.md` — verified (July 2026) catalog of free, CORS-open
  enrichment endpoints, with per-endpoint spoiler risk.
- `docs/uniforms-and-logos.md` — verified (July 2026) findings on statsapi's
  uniform endpoints and what logo art the mlbstatic CDNs do and don't serve.
- `docs/transactions-wire.md` — verified (August 2026) dictionary of
  `/api/v1/transactions`: every field, all 22 type codes and the thirteen
  distinct events hiding inside two of them, how the wire repeats itself, and
  the 40-man/26-man roster rules the sentences encode but never state. Read it
  before touching `teamTransactions.js` or building anything league-wide. The pipeline
  (six files, five seams): `transactions/CLAUDE.md`.
- `docs/MLB_STATS_API.md` — the endpoint reference.
