# Enhancement proposals — five candidate features with agent planning prompts

Written 2026-07-11 from a survey of the codebase, `docs/data-enrichment.md`
(the verified catalog of free, CORS-open endpoints), the ADRs, and the
`.scratch/` issue backlog. Each proposal below:

- costs **nothing to run** — every data source is either the free MLB Stats
  API / Baseball Savant / localStorage, or one of the repo's established
  zero-infra patterns (static JSON under `public/data/` refreshed by the
  nightly GitHub Actions cron, `.github/workflows/update-nightly-data.yml`);
- is **not already implemented** and **not already tracked** in `.scratch/`
  (checked against the existing feature surface: WAR, prospects, rehab,
  callouts, vs-team splits, former teammates, game notes, buzz, weather,
  broadcast, umpire game logs, day highlights, win probability, pitch
  arsenal, "firsts" milestones);
- respects the spoiler rule (`CLAUDE.md`, `CONTEXT.md`, `docs/adr/`) — each
  section notes where its data sits on the spoiler spectrum.

**How to use this doc:** each proposal ends with a self-contained prompt to
paste into a fresh Claude (Opus or Sonnet) planning session in this repo.
The prompts ask for a *plan*, not an implementation — the output of each is
a design/plan doc under `.scratch/<feature-slug>/` (the repo's local issue
tracker convention, see `docs/agents/issue-tracker.md`) that a later
implementation session executes. A suggested model is noted per prompt:
Opus where the work is mostly design judgment (spoiler-safety trade-offs,
UX shape, pipeline architecture), Sonnet where the shape is already clear
and the plan is mostly enumeration.

---

## 1. Batter-vs-pitcher career matchup card (lineup staging)

**What.** On each lineup page (`TeamInfo`), next to the existing staging
facts, a "VS. TONIGHT'S STARTER" column or card: each hitter's career line
against the opposing probable pitcher — AB, H, HR, K, AVG/OPS. The classic
scorebook pregame ritual ("Contreras is 0-for-3 career vs tonight's
starter") that broadcast crews read off their game notes.

**Why it fits.** It's the single most scorebook-native staging fact the app
doesn't have yet, and `docs/data-enrichment.md` §2 already verified the
endpoint and recommended exactly this use.

**Data & cost.** Free, live, no cron:
`GET /api/v1/people/{batterId}/stats?stats=vsPlayer,vsPlayerTotal&opposingPlayerId={pitcherId}&group=hitting`
(verified working, CORS-open). One call per lineup slot (~9–18 per game,
fetched once at staging time alongside the existing lineup fan-out). The
probable pitcher already comes with the schedule/feed data the page has.

**Spoiler notes.** Career-to-date numbers pregame are spoiler-free (same
footing as the season lines and vs-team splits already shown). Fetch at
staging time; mid-game refetch could drift to include tonight's PAs — same
tiny-drift caveat `data-enrichment.md` documents for season stats. MLB-only
in practice (MiLB probables are sparse); degrade to hiding the card, per
the MiLB-degrades-gracefully convention.

**Likely touchpoints.** `src/api/person-fetch.js` or a new small
`src/api/vsPitcher.js` (fetcher), `src/screens/TeamInfo.jsx` (render),
possibly `src/api/select.js` (lineup + probable-pitcher ids).

**Agent planning prompt (suggested model: Sonnet):**

```
You are planning (not implementing) a new feature for bbsbh. Read CLAUDE.md,
CONTEXT.md, docs/data-enrichment.md §2, and docs/enhancement-proposals.md §1
first.

Feature: a batter-vs-pitcher career matchup card on the lineup pages
(TeamInfo.jsx) — each hitter in the starting nine gets his career line vs
the opposing probable pitcher (AB, H, HR, K, AVG, OPS), from the verified
statsapi endpoint stats=vsPlayer,vsPlayerTotal&opposingPlayerId=. Spoiler-
free pregame staging data, fetched live (no cron, no static JSON).

Produce a plan document at .scratch/bvp-matchup-card/plan.md covering:
1. Where the probable/starting pitcher id comes from for each side (check
   what TeamInfo and select.js already have — schedule hydration vs. the
   live feed's probablePitcher), and what happens when there is no probable
   yet or the game is MiLB (the card should hide, per the degradation
   convention).
2. The fetch design: per-batter calls vs. any batching option, where the
   fetcher lives (a new src/api/ module vs. person-fetch.js), how it rides
   the page's existing useAsync loading, and in-session caching so
   navigating lineup1 → lineup2 → back doesn't refetch.
3. The render design: where the card/column sits relative to the existing
   staging facts, what a hitter with no career PAs vs the pitcher shows
   ("1st meeting" vs. omitting the row), and the paper-scorebook styling
   hooks (existing tokens/classes to reuse — see how SplitsVsTeam and the
   lineup card render).
4. Spoiler audit: confirm every displayed number is career-to-date pregame
   data, note the staging-time-fetch requirement, and confirm nothing needs
   a SealBox.
5. A verification plan using npm run dev / npm run e2e and a gamePk from
   docs/test-games.md or the live slate.
Keep the plan scoped to this one card; list every file you expect to touch.
```

---

## 2. "My Scorebook" shelf (client-side scoring archive)

**What.** A page listing every game this device has ever scored — the app
already writes a reveal high-water mark to localStorage under
`bbsbh:reveal:{gamePk}` for each game the user opens and reveals. Enumerate
those keys, hydrate them into slate-style cards (date, matchup, how far you
got), and present them as a shelf of past scorebooks: tap to jump back into
the game's box score or the half where you left off. In-progress games
(revealed partway) sort separately from finished ones — "pick up where you
left off."

**Why it fits.** The app's metaphor is a paper scorebook; a scorer keeps a
shelf of filled books. This is the only proposal that needs **zero network
sources** beyond what already exists — pure localStorage plus the existing
`fetchGamesByPk` (`src/api/schedule.js`) to resolve pks into matchup cards.
It also makes the stored reveal marks — currently invisible — into a
feature.

**Data & cost.** None. localStorage keys + one existing batch schedule call.

**Spoiler notes.** This is the design-heavy part: a shelf card must not
leak a score for a game that isn't fully revealed. `revealedThrough` alone
doesn't say "finished" (you'd need the feed to know how many halves the
game had), so the plan must pick a mechanism — e.g. persist a small
completion flag when the final half is revealed (a deliberate, ADR-worthy
extension of the "only the half-index is stored, never a score" rule), or
render every card sealed the way past-slate cards already do
(`PastGameFlipCard` / `GameResultFace` are prior art).

**Likely touchpoints.** `src/hooks/useRevealProgress.js` (key enumeration,
possibly a completion flag), a new `src/screens/` page, `src/lib/route.js`
(new route), `src/components/SiteMenu.jsx` or the slate header (entry
point), `fetchGamesByPk`.

**Agent planning prompt (suggested model: Opus — the spoiler/persistence
design needs judgment):**

```
You are planning (not implementing) a new feature for bbsbh. Read CLAUDE.md
(especially "The spoiler rule" and the localStorage paragraph under
Architecture), CONTEXT.md, docs/adr/0002 and 0011, src/hooks/useRevealProgress.js,
and docs/enhancement-proposals.md §2 first.

Feature: a "My Scorebook" shelf — a page enumerating every bbsbh:reveal:{gamePk}
key in localStorage, hydrated via fetchGamesByPk into slate-style cards
(date, away@home, progress), split into "in progress" (resume where you
left off) and "finished" shelves, each card deep-linking back into the game.
Zero new data sources; purely client-side.

Produce a plan document at .scratch/my-scorebook-shelf/plan.md covering:
1. The completion problem: revealedThrough alone can't distinguish "revealed
   through the 9th" from "fully finished" without the feed. Compare (a)
   persisting a completion flag at final-reveal time (spell out exactly what
   gets stored and why it stays inside the "never a score" persistence rule
   — this likely needs a new ADR; draft its text), vs (b) treating the shelf
   like past slate cards and keeping every result sealed behind the existing
   FlipCard/GameResultFace pattern. Recommend one.
2. Key enumeration + hygiene: iterating localStorage safely, ordering
   (newest first needs the game date, which comes from the fetch — handle
   the unresolved/404 pk case), and whether to offer "remove from shelf"
   (which deletes the reveal mark — call out that this re-seals the game).
3. Route + entry point: the new route shape in src/lib/route.js, where the
   link lives (SiteMenu? slate header next to /logos?), and the page's
   screen component structure reusing GameCard/PastGameFlipCard prior art.
4. Spoiler audit per rendered element (progress label wording matters:
   "through TOP 7" is safe; anything derived from outcomes is not).
5. A verification plan (seed localStorage with a few known pks from
   docs/test-games.md, npm run dev, exercise resume + finished paths).
List every file you expect to touch and keep the diff small.
```

---

## 3. Umpire plate-accuracy scorecards

> **Implemented** (`scripts/gen-umpire-accuracy.mjs` →
> `public/data/umpire-accuracy.json`, read by `src/api/umpires.js`; card on
> `UmpirePage.jsx` + one-liner on `TeamInfo.jsx`). See
> `.scratch/umpire-accuracy/plan.md` for the design that shipped.

**What.** Extend the existing umpire pipeline with ball/strike accuracy:
for every game an umpire works behind the plate, derive called-strike
accuracy from the feed's per-pitch data (`pitchData.coordinates.pX/pZ`
vs. `strikeZoneTop/Bottom`, call code from `details`), and aggregate to a
season accuracy figure plus tendencies (e.g. tight low zone / generous
edges). Surface it on `UmpirePage` as a summary card, and as one line on
the lineup page's Umpires card for tonight's plate ump — the
"Umpire Scorecards" fact scorers love ("tonight's plate ump: 94.1%
accuracy, squeezes the low zone").

**Why it fits.** The umpire surface already exists (`gen-umpires.mjs`,
`public/data/umpires.json`, `UmpirePage`, `UmpireLink`) and already knows
which games each ump worked and at which base. This adds the one fact that
makes the page genuinely interesting, from data statsapi already serves.

**Data & cost.** Free. A nightly step sweeps only the previous day's Final
MLB feeds (~15 games), computes per-game accuracy for the plate umpire, and
appends into the umpire data — the append-only incremental pattern
`gen-game-notes.mjs` already established, so the season never gets
re-crunched. MLB-only (pitch coordinates are park-based; all MLB parks have
them — see `data-enrichment.md` §1).

**Spoiler notes.** Season aggregates and per-game *accuracy* numbers carry
no score. One judgment call for the plan: whether showing a specific past
game's accuracy row on `UmpirePage` says anything about that game a scorer
hasn't revealed (it doesn't reveal a score, but the plan should state the
reasoning, mirroring how the umpire game log was already judged
spoiler-free).

**Likely touchpoints.** `scripts/gen-umpires.mjs` (or a sibling
`gen-umpire-accuracy.mjs` + merge), `.github/workflows/update-nightly-data.yml`,
`src/api/umpires.js`, `src/screens/UmpirePage.jsx`, `src/screens/TeamInfo.jsx`
(Umpires card line), `src/api/select.js` (`selectOfficials` already threads
ids).

**Agent planning prompt (suggested model: Opus — pipeline architecture +
measurement methodology need design):**

```
You are planning (not implementing) a new feature for bbsbh. Read CLAUDE.md
(the umpires.js and gameNotes.js entries — the cron and append-only
patterns), docs/data-enrichment.md §1 (pitchData fields and availability),
scripts/gen-umpires.mjs, src/api/umpires.js, src/screens/UmpirePage.jsx,
and docs/enhancement-proposals.md §3 first.

Feature: umpire plate-accuracy scorecards. A nightly build step computes,
for each previous-day Final MLB game, the plate umpire's called-pitch
accuracy from the live feed's pitchData (called strikes/balls judged
against pX/pZ and strikeZoneTop/Bottom, with a standard plate-width buffer)
and appends per-game rows; the app shows a season accuracy + zone-tendency
summary on UmpirePage and a one-line fact for tonight's plate ump on the
lineup page's Umpires card.

Produce a plan document at .scratch/umpire-accuracy/plan.md covering:
1. Methodology: exactly which playEvents count (called strikes + called
   balls only), the zone geometry (plate half-width + ball radius buffer —
   cite the convention you adopt), per-batter strikeZoneTop/Bottom, and
   which tendency splits are worth storing (accuracy by zone edge? high/low
   vs in/out?) without bloating the file. Verify field paths against a real
   recent gamePk before finalizing (docs/test-games.md).
2. Pipeline shape: extend gen-umpires.mjs vs. a sibling script writing a
   separate public/data/umpire-accuracy.json; how the append-only
   incremental sweep works (previous N days' finals, idempotent re-runs,
   backfill strategy for the current season's earlier months and its
   one-time cost); the file-size budget; and the workflow wiring in
   update-nightly-data.yml.
3. App surfaces: the UmpirePage summary card (reusing its existing
   summary-card pattern) and the TeamInfo Umpires-card line for tonight's
   plate ump; what MiLB games and umpires with no accuracy data show
   (degrade to absent).
4. Spoiler audit: state why per-game accuracy rows and season aggregates
   are spoiler-free, mirroring the reasoning that judged the umpire game
   log spoiler-free.
5. A verification plan: run the generator locally against a known date,
   sanity-check one game's accuracy by hand against a few pitches, then
   npm run dev the two surfaces.
List every file you expect to touch.
```

---

## 4. Career milestone watch ("4 hits shy of 2,000")

**What.** Detect players sitting within striking distance of a round
career milestone (hits: 1,000/2,000/3,000; HR: 100s through 500+; RBI,
runs, stolen bases, doubles; pitcher wins/strikeouts/saves) and surface a
countdown: on the **player page** as a small "MILESTONE WATCH" line near
the career register, and on the **lineup pages** as a staging callout when
a player in tonight's lineup is close enough to plausibly get there tonight
("BETTS sits 4 hits shy of 2,000").

**Why it fits.** The player page already fetches full career splits
(`careerSplits` in `loadPlayer.js`) — the player-page half is pure
arithmetic on data in hand, exactly the "computed live rather than adding a
fetch" category the callouts architecture section prescribes. The
lineup-page half extends the existing nightly callouts precompute
(`gen-callouts.mjs`) rather than adding a parallel path — also as
prescribed. Complements (doesn't duplicate) the existing retrospective
"firsts" feature, which looks backward at first-career events.

**Data & cost.** Free. Player page: zero new fetches. Lineup callout: rides
the existing callouts cron.

**Spoiler notes.** Career-to-date totals pregame are spoiler-free. The
player page has an `asOf` cutoff discipline (see `SplitsVsTeam.jsx`) — the
countdown must respect the same cutoff so revisiting an old game's player
link doesn't leak that "he got there" via a changed countdown. That asOf
interaction is the one subtle design point.

**Likely touchpoints.** `src/api/person.js` (pure milestone math +
thresholds), `src/screens/PlayerPage.jsx`, `scripts/gen-callouts.mjs` +
`src/api/callouts.js` / `callout-notes.js` (the staging note), tokens/CSS.

**Agent planning prompt (suggested model: Sonnet):**

```
You are planning (not implementing) a new feature for bbsbh. Read CLAUDE.md
(the "Callouts / Team Leaders architecture" section is binding: extend
gen-callouts.mjs, do not build a parallel generation path), CONTEXT.md,
src/api/person.js (the firsts/milestone machinery that already exists — the
new feature is forward-looking countdowns, distinct from those backward-
looking firsts), src/api/loadPlayer.js, and docs/enhancement-proposals.md §4.

Feature: career milestone watch. (a) Player page: a MILESTONE WATCH line
computed live from the careerSplits already fetched — the nearest upcoming
round-number milestone per stat family with the countdown ("1,996 H — 4
shy of 2,000"), shown only within a striking-distance window. (b) Lineup
staging callout via the nightly callouts precompute: a note when someone in
tonight's lineup is within a single-game-plausible distance of a milestone.

Produce a plan document at .scratch/milestone-watch/plan.md covering:
1. The milestone table: which stats and thresholds, and the "striking
   distance" window per stat (within-50 hits vs within-3 HR are different
   scales); where the pure function lives in person.js and its unit-style
   verification.
2. asOf correctness on the player page: how the countdown must be derived
   from the same asOf-gated career totals the page already shows so an old
   game's player link can't leak a milestone being reached later. Identify
   the exact data path in loadPlayer.js you'd hook into.
3. The callout half: where in gen-callouts.mjs the check slots in, what the
   note's shape/copy is (match existing CalloutNote conventions), the
   plausibility gate (e.g. ≤4 hits, ≤2 HR), and MiLB behavior (skip — career
   MLB milestones only).
4. Render placement on PlayerPage (near the career register vs the bio
   header) reusing existing tokens; what shows when no milestone is in
   range (nothing — no empty state).
5. A verification plan: pick 2–3 real players currently near milestones
   (verify against live statsapi), npm run dev the player page, and run the
   callouts generator locally for tonight's slate.
List every file you expect to touch.
```

---

## 5. Statcast percentile card on the player page ("savant sliders")

**What.** The familiar Baseball Savant percentile bars, redrawn in the
app's pencil-and-manila idiom: a player-page card showing season percentile
ranks — hitters: avg exit velo, barrel%, hard-hit%, xwOBA, chase%, sprint
speed; pitchers: velo, whiff%, xwOBA-against — as small inked bars with the
percentile number. Staging color for "who is this guy really" when penciling
in a lineup ("tonight's 3-hitter: 94th-percentile exit velo").

**Why it fits.** It's the fourth use of the exact `war.js` build-time-fetch
pattern the repo explicitly says to reuse (`docs/data-enrichment.md` §5):
bulk-only unofficial source → nightly script → trimmed static JSON →
same-origin read. Savant's season leaderboard CSVs are verified CORS-open
and carry MLBAM ids, so rows join to `personId` with no name-matching —
same zero-friction join as FanGraphs WAR.

**Data & cost.** Free. `GET https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=YYYY&csv=true`
(+ pitcher variant, + `/leaderboard/sprint_speed?...csv=true`), fetched by a
new `scripts/gen-savant-percentiles.mjs` on the existing nightly workflow.
Percentiles computed in the script (qualified pool), output trimmed to
`{personId: {field: pct}}` — small enough to precache or fetch at runtime.

**Spoiler notes.** Season aggregates — spoiler-free, same footing as the
season splits the player page already shows. The one nuance: yesterday's
data (nightly snapshot) inherently lags, which is fine and matches WAR.
MLB-only; MiLB players degrade to no card, per convention. Savant is
unofficial — the script fails loud in CI while the site keeps serving the
last-known-good file (the pattern's whole point); pin CSV column names
defensively (`data-enrichment.md` §3 warns they occasionally rename).

**Likely touchpoints.** New `scripts/gen-savant-percentiles.mjs`,
`.github/workflows/update-nightly-data.yml`, new `src/api/savantPercentiles.js`,
`src/api/loadPlayer.js` (thread into the page data), `src/screens/PlayerPage.jsx`
(the card), `src/index.css` (bar styling), possibly `vite.config.js`
(precache decision).

**Agent planning prompt (suggested model: Sonnet):**

```
You are planning (not implementing) a new feature for bbsbh. Read CLAUDE.md
(the war.js entry — the build-time-fetch pattern this MUST follow),
docs/data-enrichment.md §3 and §5, scripts/gen-war.mjs,
.github/workflows/update-nightly-data.yml, src/api/war.js,
src/api/loadPlayer.js, and docs/enhancement-proposals.md §5 first.

Feature: a Statcast percentile card on the player page, fed by a new
nightly script that pulls Baseball Savant's season leaderboard CSVs
(statcast batter + pitcher, sprint_speed; all verified CORS-open, rows
keyed by MLBAM id = statsapi personId), computes percentile ranks over the
qualified pool, and commits a trimmed public/data/savant-percentiles.json.
The app reads it via a new src/api module and renders percentile bars on
PlayerPage in the paper-scorebook idiom.

Produce a plan document at .scratch/savant-percentiles/plan.md covering:
1. Source handling: exact CSV URLs and the columns to consume (fetch one
   for real and pin the actual header names defensively — they occasionally
   rename); the qualification floor for the percentile pool per metric
   (Savant's own qualifiers vs a PA/pitch floor you compute); which 5–7
   metrics per role earn a bar (don't hoard columns).
2. Script + workflow: gen-savant-percentiles.mjs mirroring gen-war.mjs's
   structure (self-contained, trimmed output, loud failure), the output
   schema {personId: {...}} with a generatedAt stamp, expected file size,
   the update-nightly-data.yml step, and the vite.config.js precache
   decision with the size rationale.
3. App wiring: the reader module mirroring war.js (session-memoized,
   degrade-to-empty), how loadPlayer.js threads it in, and the PlayerPage
   card design — placement among existing blocks, bar rendering with
   existing tokens (mono tabular figures, pencil/ink vars), MiLB and
   unranked players degrade to no card.
4. Spoiler audit: state why season-aggregate percentiles are spoiler-free
   and whether the page's asOf cutoff needs to gate the card (compare how
   season splits vs game logs are treated today).
5. A verification plan: run the script locally, spot-check two players'
   percentiles against baseballsavant.mlb.com's own player pages, then
   npm run dev the player page.
List every file you expect to touch.
```

---

## Considered and set aside (so the next survey doesn't re-tread)

- **Game-over / walk-off indicator in the innings navigator** — already
  tracked at `.scratch/game-over-indicator/issues/01-*.md`; needs a
  spoiler design pass, not a new proposal.
- **Season-series ("head-to-head so far") staging card** — feasible
  (`fetchHeadToHead` exists, currently used only by GameFinder) but
  overlaps the nightly callouts' team-record territory; if wanted, it
  belongs in `gen-callouts.mjs`, not a new surface.
- **Printable pre-filled scorecard sheet** (LogoSheet-style page with
  tonight's lineups/umpires/weather laid out for pencil) — attractive and
  free, but it's a print-layout project more than a data feature; worth its
  own survey if the maintainer wants a sixth.
