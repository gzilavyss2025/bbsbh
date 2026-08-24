# Farm Digest — research handoff

**Status: research and scoping only. No app code changed.** This is the
starting point for whoever designs and builds the "here's what happened
today across our farm system" page next. Nothing here is a spec to implement
literally — it's the map of what's possible, what's already half-built, what
has real precedent, and what's still genuinely open.

`wireframes.html` beside this file is a durable copy of the grayscale
wireframe deck this session produced as a Claude Artifact (an ephemeral,
session-scoped link — this file is the copy that survives). Open it in a
browser; it's self-contained, no build step.

## What this is

A daily digest of the org's minor-league affiliates: scores, top performers,
key moments, pitching outliers, ABS/robo-ump data, trending prospects, team
performance, call-ups/injuries, and AAA bullpen health — plus, from a second
research pass, a "who to know" primer, org-wide leaders, a positional depth
chart, a pitcher-stuff-vs-MLB comparison, and affiliate game stories.
Audience is explicitly dual: a casual dropper-in needs a 10-second glance,
a close follower wants a deep read on the same screen.

## 1. Data scoping — what's calculable now vs. what's new work

Graded against this app's existing generators/modules. "Buildable now" means
recombination of data already flowing through the app; "new pipeline" means
a new `gen-*.mjs` or a gated extension of an existing one; "open research"
means no reliable methodology exists yet, publicly or in this codebase.

| Category | Verdict | Where it already lives |
| --- | --- | --- |
| Scores / box scores | Buildable now | `schedule`/`boxscore`/`linescore` work identically across `sportId` 11-14 |
| Top performers (single night) | Buildable now | Same box-score fields the `leader`/`homerRec`/`sbStreak` callout families already read for MLB+MiLB (`docs/callouts.md`) |
| Key moments, positive & negative | Buildable now | Win-probability-added per play, same approach as MLB's WPA-hero detection in `game-buzz.mjs`; needs a live-game probe to confirm MiLB WPA populates reliably |
| Pitching outliers / stuff | Split by level | AAA has full Hawk-Eye (velocity/spin/exit-velo) already ingested by `gen-pitch-arsenal.mjs`/`gen-spray.mjs`; AA and below have **no** pitch tracking, box-score-only |
| ABS / robo-ump data | New, but small | `src/api/challenges.js` already reads per-pitch `reviewDetails` — gated `gameHasAbs` to MLB only. AAA has run the full challenge system since 2025 (longer history than MLB). Needs a live-game probe to confirm AAA's feed carries the same `reviewDetails` shape, then widen the gate |
| Trending data | Buildable now | `top-prospects.json` (weekly Pipeline Top 100) + `prospect-trend.json` (nightly level-relative percentile) compose directly into an up/down signal; the threshold for "trending" is a design decision, not a data gap |
| Team / org performance | Buildable now | `gen-team-records.mjs`'s per-game ledger (MLB + 4 full-season MiLB levels) for per-affiliate context; the Farm Index (`docs/farm-index.md`) for whole-system health |
| Call-ups / send-downs | Buildable now | `docs/transactions-wire.md` — fully solved, verified against 39,247 real rows. `gen-team-transactions.mjs` is currently MLB-club-scoped; filtering to affiliate `teamId`s is a scoping change, not a new source |
| Injuries | Partial | No dedicated injuries endpoint anywhere — IL info rides in `/transactions` as free-text description. `rehab.json` (`gen-rehab.mjs`) covers active rehab assignments cleanly; general injury detail beyond that means parsing free text, which is fragile by nature, not a gap to "just fix" |
| AAA bullpen health | Buildable now, gated to MLB today | `gen-workload.mjs` → `src/api/workload.js`'s `availabilityFor` already implements the industry-standard heuristic (rolling appearance counts, back-to-back flag, pitch-count windows) — it's MLB-only today ("active-roster pitcher's season gameLog; MLB only" per the generator's own header). Extending the sweep to `sportId` 11 is the concrete work; the availability math is date-parameterized and should carry over largely unchanged |

## 2. Layout research — what broadcasters and dashboards actually do

Full findings live in this session's transcript; the load-bearing structural
rules, all reusable without color (this app's spoiler-safe grayscale/ink
aesthetic already has no color budget to spend):

- **Position and size substitute for color as hierarchy.** Bold + large +
  isolated = headline; regular weight + grouped = supporting. Broadcast score
  bugs achieve the same thing by relocating secondary stats into expandable
  elements, not by shrinking font.
- **KPI band ceiling: ~5 metrics** before anything requires a tap.
- **Trend is arrow + signed delta + sparkline, together** — never just one of
  the three, sign always printed explicitly.
- **Card anatomy learned once, reused everywhere**: title top-left, value
  top-right, supporting lines below, same order on every card (affiliate
  cards, player cards) so a reader's eye doesn't re-parse the layout each
  time.
- **Two-line "flipper" format beats a single scrolling ticker** for the
  transactions/moves feed (ESPN BottomLine's own 2018 redesign made this
  exact change).
- **Progressive disclosure, not two separate pages**, for the
  casual-vs-superfan problem — "Show N more" is already this app's own idiom
  (`MarginNotes`/`InsightsCard`), reused rather than invented fresh.
- **Organize by affiliate level first** (AAA → AA → High-A → Single-A) — the
  dominant real-world pattern (SB Nation affiliate blogs' daily recap format)
  and it matches this app's existing per-affiliate architecture.

### The three wireframe concepts (`wireframes.html`)

- **Concept A — Digest Scroll.** One continuous scroll ordered by
  importance: KPI band → who-to-know primer → today's headline story →
  trending → org leaders → per-affiliate cards (AAA shown expanded, others
  collapsed) → AAA bullpen health → moves → depth-chart teaser → Farm Index.
  Best for someone who scrolls once and is done.
- **Concept B — Command Center.** A persistent score-bug strip plus a tab bar
  (ALL / AAA / AA / A+ / A / TRENDING / BULLPEN / MOVES / WHO TO KNOW /
  LEADERS / DEPTH) instead of scrolling. Best for a nightly regular who wants
  one thing without paging past four recaps.
- **Concept C — Depth Chart.** A reference page, not a daily one — position
  tabs across the top, two lists held deliberately apart underneath
  (Scouting / Performance, see §3 below for why they're never merged).
  Reached from a teaser card on either A or B, not part of the daily scroll.

**No direction has been picked yet.** That's the open decision for whoever
picks this up next — possibly a genuine hybrid (A's card anatomy inside B's
tab structure) rather than a pure pick of one.

## 3. Second research pass — the gaps the first scoping missed

- **"Who to know" primer** — buildable now. Every org player on the national
  Top 100 (`top-prospects.json`, filter by `teamId`) is the spine;
  `prospect-trend.json`'s level-relative percentile adds anyone hot enough to
  belong without a national rank.
- **Top hitters/pitchers, org-wide** — already solved, not new work.
  `gen-minors-leaders.mjs` already sums a player's stats **across levels** so
  a midseason promotion doesn't fragment his line, and the ranking machinery
  behind it (`computeLeaders`/`combineToPool` in `statsLevels.js`) already
  supports an `org` scope.
- **Positional org depth chart (potential + performance)** — do **not**
  build one blended number. FanGraphs' "The Board" — the real precedent — is
  the strongest finding here: it ships Scouting-Only and Stats-Only as
  separate, parallel views, never merged, and no outlet has a published
  formula for merging a scouting grade with a stat line. Show two parallel
  rankings per position instead: scouting (this org's Top-100 names, the
  Farm Index's existing `value(rank)` decay curve) beside performance
  (`prospect-trend.json`'s level-relative percentile). The "unranked
  majority" question resolves the same way the Farm Index already resolved
  it — real outlets draw a line around 18-30 ranked names per org and leave
  the rest unranked rather than inventing a value (`docs/farm-index.md`: "a
  prospect outside the published pool scores zero, not a small positive").
- **"Pitcher stats as they compare to the future"** splits into two features:
  - A **hitting MLE** (translating a stat line toward MLB-equivalent) has a
    real, reusable lightweight method: a wOBA z-score against the level's
    own mean/SD, rescaled — rule of thumb, a hitter keeps ~90% of his
    level-adjusted wOBA moving up one level. Classic James/Davenport MLE has
    real lineage but the actual translation-factor tables were never
    published, only described conceptually — don't go looking for a table to
    reuse.
  - For **pitchers**, classic outcome-based MLE (translated ERA/runs
    allowed) has no solid public precedent, and the field is actively
    moving away from it — ER-allowed is too polluted by defense, park, and
    sequencing to translate cleanly. The better, more honest, *already
    buildable* feature: compare raw **stuff** (velocity, spin, movement)
    directly, since Hawk-Eye measures it identically at AAA and MLB —
    `gen-pitch-arsenal.mjs` already ingests this at AAA, so "this arm's
    velocity sits at the 74th percentile of current MLB starters" needs no
    new data, only a new comparison.
- **Affiliate game stories** — real per-affiliate recap prose exists.
  MiLB.com publishes it per team (`milb.com/{team-slug}`), almost certainly
  AP/Automated Insights' automated copy (confirmed to run for every AAA/AA/A
  game since 2016) republished per affiliate. There is no longer a separate
  affiliate-owned website to worry about — MiLB Digital consolidated
  everything onto the milb.com platform. **The catch: it's not an API.**
  `statsapi`'s own `content.editorial` field — what this app's existing
  `src/api/gameStory.js` reads for MLB — comes back **empty even on real MLB
  games**, so it was never reliable even at the level this app already
  supports. `milb.com` blocks a plain fetch the same way `mlb.com`'s
  prospect page does. This needs the same move the codebase already made
  once: an off-device, server-side scrape (`scripts/fetch-top-prospects.mjs`
  is the exact template — Node fetch, a real User-Agent, parse whatever the
  page embeds), not a documented API and not something the PWA's browser
  code could hit directly. Two things worth a direct probe before committing
  to build it: whether the article page embeds a scrapable JSON blob the way
  the Top-100 page does, and whether a lighter per-affiliate RSS feed exists
  as a cheaper alternative to scraping full pages.

## 4. Open: the level-graduation benchmark ("X% done with this level")

**This is the one idea with no real public precedent — treat it as its own
project, not a line item on this page's first version.** What exists
publicly: two industry-wide aggregate numbers (avg. ~2,070 career MiLB PA /
~391 IP before MLB debut — not broken out by level), one magazine article
with a per-level PA breakdown for exactly one narrow cohort (high-school
first-round picks only, missing even a current Triple-A figure), confirmation
that pedigree changes the exposure a player needs (but not quantified
generically), and nothing at all for pitcher innings per level. No dataset,
Sankey diagram, or visualization of level-to-level progression exists
publicly anywhere.

A real version needs an in-house historical cohort study. The prompt below
is ready to hand to a fresh session to start that research spike — it should
run **before** any UI or generator work for this feature, and its own output
(trustworthy or not) is what decides whether the feature ships at all:

```text
I want to build a historical benchmark for how much playing time a typical
prospect accumulates at each full-season minor-league level (AAA, AA, High-A,
Single-A) before being promoted or reaching the majors — the data behind a
future "this player is roughly X% through a typical stay at this level"
feature on the farm-system page.

Context already established — treat this as known, don't re-research it:
No public per-level PA/IP-before-promotion benchmark exists. The closest
public figures are career-AGGREGATE, not per-level: Baseball Prospectus found
an average MLB debut comes after ~2,070 career MiLB plate appearances
(hitters) or ~391 innings (pitchers), summed across ALL levels. Baseball
America published a per-level PA breakdown, but only for one narrow cohort
(high-school first-round draft picks) and it's missing a current Triple-A
number even there. Nothing exists for pitcher innings per level, for any
cohort, and no dataset or visualization of level-to-level progression
distributions exists publicly. This is genuinely open territory — you're
building it, not looking it up.

What I want first — a research spike, no UI, no generator wired into the
nightly cron yet:

1. Design a historical cohort: a bounded, reproducible set of players who
   eventually reached the majors (e.g. everyone who debuted in the last N
   years). Propose a window that keeps the pull size reasonable and tell me
   the tradeoff.

2. For each player, reconstruct their level-by-level MiLB stints — PA
   (hitters) or IP/batters-faced (pitchers) at each level, and the date they
   were promoted off it. Two things already in this codebase solve half of
   this and should be reused, not reinvented:
   - scripts/gen-milb-alumni.mjs already sweeps a player's
     /people/{id}/stats?stats=yearByYear&sportId={11,12,13,14,16} career log
     and already has the MIN_GAMES floor that separates a real stint from a
     rehab-assignment cameo — read that generator's header first.
   - The transactions wire (docs/transactions-wire.md) already resolves exact
     promotion dates precisely (ADR-0058) via the ASG type code's
     affiliate-to-affiliate assignments — that's where "when did this level
     end" comes from, not the season stat line.

3. Bucket players by the pedigree they held AT THAT LEVEL, not their eventual
   outcome. Figure out what pedigree signal is actually available
   historically (an archived Top 100 snapshot from that time, if one exists
   publicly; otherwise propose a fallback like draft round, or tell me
   honestly if this is only buildable for recent cohorts).

4. Report back distributions (median plus a couple of percentiles) of
   PA-at-level and IP-at-level before promotion, per level, split by pedigree
   tier if #3 turns out feasible. Flag anything too thin a sample to trust.

Known traps, since this mirrors problems already solved elsewhere here:
- Exclude Rookie/complex-league stints the same way the Farm Index already
  does (short seasons, leagues that re-form yearly — noise, not signal).
- A player promoted mid-season splits one season across two levels — use the
  per-stint boundary, never a season total, as one level's exposure.
- Define "graduated to MLB" carefully — a scoreless September cup of coffee
  isn't the same as a real promotion. Pick a floor and state it.

Don't write any app code yet. I want a findings write-up — numbers, sample
sizes, and your honest read on whether this is trustworthy enough to build a
feature on — before we decide whether or how it becomes something the page
shows.
```

## 5. Key building blocks to reuse — don't rebuild these

| Need | Reuse | File |
| --- | --- | --- |
| Cross-level stat totals for one player/org | `combineToPool` / `computeLeaders` | `src/api/statsLevels.js`, `src/api/teamLeaders.js` |
| National prospect rank | Weekly snapshot | `public/data/top-prospects.json` via `scripts/fetch-top-prospects.mjs` |
| Level-relative performance trend | Nightly percentile | `public/data/prospect-trend.json` via `scripts/gen-prospect-trend.mjs` |
| Prospect value curve (rank → score) | The Farm Index's exponential decay | `src/api/around-the-game/farmSystem.js`, `docs/farm-index.md` |
| Call-up/option/IL transaction parsing | The full type-code dictionary | `docs/transactions-wire.md`, `src/api/transactions/` |
| Reliever fatigue/availability rules | `availabilityFor` | `src/api/workload.js`, `scripts/gen-workload.mjs` (MLB only today) |
| AAA pitch velocity/spin/mix | Already ingested | `scripts/gen-pitch-arsenal.mjs` → `public/data/pitch-arsenal*.json` |
| ABS challenge outcomes | Reveal-only reader, MLB-gated | `src/api/challenges.js` |
| Off-device scrape template (for the MiLB.com recap scrape) | The exact pattern to copy | `scripts/fetch-top-prospects.mjs`, `docs/top-prospects.md` |
| Existing MLB-only game-story precedent | Proves the concept, not the source | `src/api/gameStory.js`, `api/game-story.js` |
| Rehab assignment tracking | Already built | `public/data/rehab.json` via `scripts/gen-rehab.mjs` |
| Org-wide farm health composite | Already built | `public/data/farm-system.json` via `scripts/gen-farm-system.mjs` |

## 6. Suggested order of work

1. Pick a layout direction (or a hybrid) from the three wireframes — that
   decision should happen before any data plumbing, since it changes what
   "done" looks like for each generator extension.
2. Ship the buildable-now items first (§1, §3's buildable half) — they're
   recombination of data already flowing through the app, lowest risk,
   fastest to a working first version.
3. Run the level-graduation cohort-study prompt (§4) as its own spike,
   independent of the page build — its result decides whether that feature
   exists at all, so it shouldn't block the rest.
4. Probe live-game data before committing code for the two "needs
   verification" items: AAA's `reviewDetails` ABS shape, and MiLB WPA
   population — both flagged, neither confirmed, in §1.
5. Scope the MiLB.com recap scrape (§3) as a bounded, separate PR — same
   shape as `fetch-top-prospects.mjs`, reviewable on its own.
