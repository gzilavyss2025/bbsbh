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

`linescore.js` and `derive.js` are **reveal-only** modules — callable only from
inside a `SealBox`'s reveal render function, never at render top-level or in an
eager `useMemo` (ADR-0001). `highlights.js`'s join (`highlightsByPlayId`) is
reveal-only in the same sense — a video clip's title/description narrate the
play's outcome, so the map is built inside `HalfInning`'s `SealBox` reveal
function (next to `revealDerived`), never at `InningViewer`'s top level; the
fetch itself (`fetchHighlights`) is safe eagerly with respect to spoilers,
same as `game.js`'s `fetchWinProbability` — a raw fetch result produces no DOM
on its own — but `useGameData` still waits to fire either until its consuming
surface is actually opened (`useEverActive`), since "safe" here only ever meant
spoiler-safe, not free.
`select.js` is spoiler-**free**. In between sit
**caller-gated pre-pitch selectors** (`selectPrePitchChanges` in `select.js`,
`defenseEntering` in `defense.js`, `lineupEntering` in `battingorder.js`),
spoiler-free only when restricted to the half the user has reached
(`halfIndex <= revealedThrough + 1`). See the root `CLAUDE.md` spoiler section and
`docs/adr/` (0001, 0003, 0005–0007, 0009, 0010) before touching any of these.

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
wrong; this cannot be wrong silently.

**This classification is about the SCORING surfaces only** — the slate's score
cells, the lineup pages, the innings viewer, the box score. Most modules here
feed OPEN surfaces instead (season and career stats, team and player pages,
leader boards, standings), correctly need no seal at all, and say so; a season
aggregate over completed games is spoiler-free, not spoiler-adjacent. Don't read
"no `SealBox`" on one of those as an omission waiting to be fixed, and don't add
one — that is the mistake ADR-0034 undid.

**Start from the manifest, not from a grep.** For any module in this directory,
`spoiler-manifest.json` answers "what is this and who may import it" in one line,
and `docs/api/` answers "how does it work". Reading a module's own header is the
third step, not the first — a header can be wrong, as `loadScorecard.js`'s was.

## The build-time-fetch pattern

Several modules read a static, same-origin `public/data/*.json` file that a
`scripts/gen-*.mjs` generator precomputes (mostly on a nightly GitHub Actions
cron, `.github/workflows/update-nightly-data.yml`; a couple are hand-run). The
driver is either an **unofficial/bulk source** (WAR) or **cost** (everything that
would need dozens of statsapi calls per page load). `war.js` is the template.
`docs/scripts/generators.md` documents each GENERATOR; `docs/api/static-data.md` documents
each READER.

Three rules that keep biting. A file that grows without bound (the rookie
dataset, the vs-team splits, per-date `callouts/*.json`) is kept OUT of the PWA
precache and fetched at runtime — see `vite.config.js`. For a hand-seeded
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

## Callouts

The callout families (`callouts.js` and the nightly `gen-callouts.mjs`) are
catalogued in `docs/callouts.md` (every family, trigger, surface, gate, worthiness
score) and ADR-0014 (the two-tense rule). Extend the nightly precompute — do NOT
build a parallel generation path. The checkpoint innings and thresholds live ONCE,
in `callout-notes/checkpoints.js`, and `gen-callouts.mjs` imports them: a second
copy would tally one inning while the note spoke about another. Before adding a data source, check whether an
existing split file covers it (`vs-team-splits`, the API's own `statSplits`, per-PA
`playLog`). Notes computable from data on hand should be computed live.

## Conventions

- **Verify a new field path against a real response.** The feed shape is
  undocumented; `statsapi.js`'s header names the gamePk each path was checked
  against. Don't guess, and record what you checked it against.
- **MiLB degrades, it doesn't crash.** Minor-league feeds (sportIds 11–14) often
  miss lineups, weather, coaches and logos. Every selector falls back to
  `''`/`null`/`—` and the caller renders "not posted yet".
- **A generator that needs app logic imports it** rather than keeping a second
  copy (`gen-minors-leaders.mjs` imports `combineToPool`/`computeLeaders`;
  `gen-milestones.mjs` imports the projection math from `person.js`). The
  deliberate exceptions are self-contained scripts that mirror a small helper —
  see `docs/scripts/generators.md`.

## Where the per-module notes live

The catalogs were split out of this file so the per-session cost of working here
stays small. Each is tier-3 reference (root `CLAUDE.md`'s doc tiers) — read the
one you need:

| File | Covers |
| --- | --- |
| `docs/api/live-game.md` | The live-feed modules: fetchers, `feed/live` selectors, the reveal-only derivations, the pre-pitch staging selectors, and the live leader boards. |
| `docs/api/static-data.md` | The build-time-fetch readers — one entry per `public/data/*.json` file and the module that reads it. |
| `docs/api/account-layer.md` | `src/lib/account/` — the per-user state that crosses a signed-in user's devices (ADR-0039, ADR-0026). |

`reports/` is the fourth subdirectory and the odd one out: it holds no new
fetching and no new spoiler footing, only the four spoiler-FREE readers behind
the four pages the app shows a reader under **Around the game**
(`src/screens/reports/`). MIND THE TWO SENSES OF "REPORT" HERE. `reportPages.js`,
`ReportFooter.jsx` and `check-report-pages.mjs` predate these pages and mean
EVERY standalone page — Standings and League Leaders included. These directories
mean only the broadcast four. The reader-facing label was deliberately changed
away from "the reports" for exactly that collision (see `lib/reportPages.js`);
the code paths kept the older word rather than churn every import, so read a
`reports/` path as "the broadcast four" and a `reportPages` one as "all of
them". Two of them read files
their own generators ship (`gate.js`, `farmSystem.js`); one re-runs an existing
module's rules across the whole league (`bullpen.js` over `workload.js`); one is
the club-name join all three share (`clubs.js`). The rule that directory adds is
about WHERE THE MATH LIVES: the generators ship FACTS, and every ranking, rate,
league comparison and weighted index is computed here, where it is pure,
unit-tested and arguable. `docs/farm-index.md` argues the one that needs it.

The three older subdirectories — `person/`, `playbyplay/`, `callout-notes/` — carry
their notes in each file's own header plus a barrel file that explains the split
(`playbyplay.js`, `callout-notes.js`, `person.js`). Read the barrel first; it is
the one that states the directory's shared spoiler footing.

Related research docs, worth reading before wiring a NEW source:
- `docs/data-enrichment.md` — verified (July 2026) catalog of free, CORS-open
  enrichment endpoints, with per-endpoint spoiler risk.
- `docs/uniforms-and-logos.md` — verified (July 2026) findings on statsapi's
  uniform endpoints and what logo art the mlbstatic CDNs do and don't serve.
- `docs/transactions-wire.md` — verified (August 2026) dictionary of
  `/api/v1/transactions`: every field, all 22 type codes and the thirteen
  distinct events hiding inside two of them, how the wire repeats itself, and
  the 40-man/26-man roster rules the sentences encode but never state. Read it
  before touching `teamTransactions.js` or building anything league-wide.
- `docs/MLB_STATS_API.md` — the endpoint reference.
