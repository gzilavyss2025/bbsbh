# Plan — Umpire Consistency + Favor metrics

A design/plan for implementation. Extends the shipped plate-accuracy feature
(`.scratch/umpire-accuracy/plan.md`, `scripts/gen-umpire-accuracy.mjs`,
`src/api/umpires.js`) with two more UmpScorecards-style metrics, per
2026-07-16 research (see chat) into their published methodology:

- **Consistency** — how well the umpire's calls in ONE game match his own
  established zone that game (self-agreement, not rulebook correctness).
- **Favor** — the net run-expectancy swing a missed call handed one team.

Wired into **both** the live box score (a per-game card, reveal-only) and the
season-aggregate pipeline (`umpire-accuracy.json` → `UmpirePage`/`TeamInfo`).

---

## 1. Consistency — Estimated Umpire Zone (EUZ)

UmpScorecards fits, per game, three 2D kernel density estimates over that
game's own called pitches — `pitch(x,z)` (density of any taken pitch),
`strike(x,z)` (density of called strikes only) — then combines them via Bayes:

```
prob_strike(x, z) = strike(x,z)·P(strike) / [strike(x,z)·P(strike) + ball(x,z)·P(ball)]
```

where `P(strike)`/`P(ball)` are that game's overall called-strike/ball rate
(the prior). The **EUZ** is the 50% contour of `prob_strike`. A call is
**consistent** iff (inside EUZ AND called strike) OR (outside EUZ AND called
ball).

**Implementation — we don't need the contour, only pointwise evaluation.**
Tracing the actual 50%-contour polygon is for their public zone-map graphic;
consistency only needs `prob_strike(x, z) > 0.5` evaluated AT each called
pitch's own `(pX, pZ)`. That collapses to: for each called pitch in a game,
sum a 2D Gaussian kernel over every *other* called-strike pitch that game →
`strike_density`; same over every *other* called-ball pitch → `ball_density`;
combine via the Bayes formula above using that game's strike/ball counts as
the prior; call it consistent iff `prob_strike > 0.5` matches the actual call.
No contour tracing, no external stats library — this is ~40 lines of plain
JS (two nested loops over ≤~300 pitches, O(n²), trivial at that n).

**Bandwidth.** Silverman's rule of thumb per axis (`1.06 · σ · n^(-1/5)`),
computed from that GAME's own pitch spread on each axis separately (pX, pZ)
— a tighter zone (fewer, closer pitches) gets a narrower kernel than a wild
game, same idea as UmpScorecards adapting per game.

**Minimum sample.** Below ~40 called pitches (Silverman bandwidth degenerates
with too few points, and a handful of calls can't establish "his zone" at
all) → `consistency: null` for that game, same null-degrade convention as
every other thin-sample guard in this codebase.

**New per-game field:** `consistent` (count) alongside the existing `called`.
Season aggregate adds `sum(consistent) / sum(called)` — a plain proportion,
same shape as `accuracy`.

---

## 2. Favor — run-expectancy impact (RE288)

UmpScorecards: `Favor = RE(state if call correct) − RE(state as actually
called)`, in runs, using a base(8)×outs(3)×count(12) = **288-state** run
expectancy table averaged over real MLB PBP.

**We build our own table from public data — same method, our own numbers.**
Not scraping/reverse-engineering their proprietary output (unpublished,
would be brittle and improper to copy); replicating the *described*
methodology against `statsapi`, which this whole app is already built on.

### State model

`(baseMask 0–7, outs 0–2, balls 0–3, strikes 0–2)` = 8×3×4×3 = **288
states**. `RE(state)` = mean, over every historical instance of that state,
of runs scored from that point until the half-inning ends (inclusive of any
runs the rest of that very plate appearance drives in).

### Verified against a real feed (gamePk 823358, MIL@PIT 2026-07-12, final 5–14)

- **Base-occupancy walk**: process `liveData.plays.allPlays` in feed order
  (this already includes stolen-base/caught-stealing/pickoff/wild-pitch/
  passed-ball/balk as their own top-level plays, interleaved — see
  `playbyplay.js`'s `NON_PA_EVENT_TYPES` header comment), applying each
  play's `runners[].movement.{start,end,isOut}` to a 3-slot base array,
  resetting at each new half-inning. **Runs-per-half computed this way
  matched `linescore.innings[].{away,home}.runs` on all 17 halves of a real
  5–14 game** (real scoring in 3 different innings, not a trivial 0–0 check)
  — the walk is sound.
- **Pre-pitch count**: `playEvents[].count.{balls,strikes}` is the count
  **AFTER** that pitch resolves, not before (confirmed: the game's very
  first pitch, a ball, carries `count.balls: 1`). The state a pitch is
  THROWN into is the previous pitch's `count` in the same plate appearance
  (or 0–0 for the PA's first pitch) — an off-by-one that must be corrected
  in the generator (my first verification pass missed it; caught on
  inspection).
- **Known, accepted edge case**: a PA interrupted mid-count by a genuine
  top-level baserunning play (e.g. a pickoff attempt between pitches) may
  span more than one `play` object sharing context. V1 does not special-case
  this — count tracking resets per `play` object's own pitch sequence. Rare
  (a small fraction of PAs), and 288 buckets aggregate over many seasons'
  worth of instances, so a handful of mistagged pitches is noise, not bias.
  Documented rather than solved, consistent with this codebase's
  MiLB-degrades-gracefully philosophy — flag if a later spot-check shows
  it's not actually rare.

### Generator: `scripts/gen-run-expectancy.mjs` — hand-run, NOT nightly

Run-expectancy is a slow-moving league constant (real tables are refreshed
yearly at most) — nothing like the nightly per-game accuracy sweep. One-time
(or annual) hand-run backfill, mirroring the existing `--since=` full-season
pattern in `gen-umpire-accuracy.mjs`:

```
node scripts/gen-run-expectancy.mjs --seasons=2024,2025
```

- Schedule scan per season (`gameType=R`, `abstractGameState=Final`) →
  every regular-season game's `gamePk`.
- Fetch each game's `feed/live` at concurrency 6 (same
  `mapWithConcurrency` helper already in `gen-umpire-accuracy.mjs` /
  `gen-game-notes.mjs`) — **timed a single feed fetch at ~0.25s**; the
  existing accuracy backfill does ~1,500 feeds in "a few minutes" at this
  concurrency, so this is the same order of magnitude, just per-season.
- Walk each game exactly as verified above, tag every pitch with its
  pre-pitch `(baseMask, outs, balls, strikes)` and the half-inning's
  remaining runs from that pitch forward; accumulate `{sum, n}` per of the
  288 states.
- Write `public/data/run-expectancy.json`: `{ generatedAt, seasons: [...],
  states: { "baseMask-outs-balls-strikes": { re, n } } }`. A state with too
  few instances (e.g. bases-loaded/2-out/3-2, genuinely rare) falls back to
  its own base/out RE24 total (summed across all 4 counts) rather than a
  noisy per-count mean — same "don't trust a thin sample" guard as
  `MIN_RANK_GAMES` elsewhere in this file.
- Static, same-origin file; `favor.js` (or folded into `umpires.js`) reads
  it once and keeps it in memory — same load-once pattern as
  `umpires.js`'s `load()`.

**Open question for the maintainer: how many seasons?** More seasons =
smoother 288-bucket estimates, at roughly linear extra one-time runtime (a
single season's backfill is the same shape as the existing accuracy
`--since` full-season run — a few minutes). Recommend **2 recent full
regular seasons** (~4,800 games) as the default — comfortably more samples
per bucket than 1 season, without an excessive one-time run. Rare states
(bases loaded, deep counts) still won't have huge N even across 2 seasons —
that's what the RE24 fallback above is for.

### Per-pitch favor, wired into `computeGameAccuracy`

For every MISSED called judgment (already detected — `actualStrike !==
strikeCall`), look up `RE(pre-pitch state, ball-call outcome)` vs `RE(same
state, strike-call outcome)`:
- The "corrected" next state is the SAME base/outs, with the count advanced
  the way it should have gone (ball→ +1 ball, or 4th ball → state resets to
  next batter's leadoff state via a walk's forced advance; strike→ +1
  strike, or 3rd strike → next batter's leadoff state via a strikeout).
- `favor = RE(next state per correct call) − RE(next state per actual bad
  call)`, signed toward the batting team (positive = the miss helped the
  batter's team, negative = helped the fielding team).
- A **walk-forcing / strikeout** correction (ball 4 / strike 3) needs the
  NEXT batter's leadoff RE (same outs, next base state after a forced
  advance / no advance) rather than a same-PA 288-state lookup — those are
  the highest-leverage misses (a real "should've been ball 4" vs "rung up on
  a phantom strike 3") and exactly the case UmpScorecards' own bases-loaded
  3-2 example highlights.
- Per-game store: `favorAway`, `favorHome` (signed runs, summed over that
  game's misses, attributed to whichever side was batting when the pitch
  was thrown). Season aggregate: same two, summed across games — "this ump's
  calls have net cost the away/home side N runs this season" reads oddly at
  a season level (it's team-agnostic; "away/home" isn't a stable team
  identity across games), so the SEASON rollup instead reports
  **`favorMagnitude`** (`sum(|favor per miss|)` — total runs of impact,
  no direction) and leaves signed home/away favor as a PER-GAME-only figure
  (which does have a stable team identity within that one game).

---

## 3. Box score wiring (live, reveal-only)

New `src/api/umpireFavor.js` (or extend `challenges.js`'s pattern directly),
**reveal-only** like `challenges.js`: computed only inside `StatBox`'s
`SealBox` reveal function, clamped to the reached half exactly like
`selectChallengeState(feed, throughInning, throughHalf)`.

**Why this needs the same gating as ABS challenges, not the free-standing
umpire season card.** A per-half consistency/favor figure is derived from
THIS game's own ball/strike calls up to the current point — which pitches
were misses and which team they favored is exactly the kind of
score-adjacent in-game state `challenges.js`'s header comment already
calls out ("can flip a called third strike... reads score-adjacent"). The
season aggregate (already shipped, no `SealBox`) stays fine as-is — it's a
number about umpires in general, aggregated across ALL Final games, never
about what's happening in the specific game the user is spoiler-protecting.

**StatBox.jsx**: a new row under the existing `abs` block (same visual
tier), gated the same way (`gameHasAbs`-style MLB/AAA-only check, since only
those levels carry pitch tracking) — "Plate ump: 94% consistent this game ·
+0.8 runs to HOME" or similar, computed from `selectUmpireFavor(feed,
inning, half)`. Exact copy/layout to be finalized once the data shape is
locked; functionally a compact sibling to `AbsRow`.

**Season cards** (`UmpirePage.jsx`'s `PlateAccuracyCard`, `TeamInfo.jsx`'s
one-liner) gain a `consistency` % + `favorMagnitude` runs/game figure
alongside the existing accuracy %/tendency — no new spoiler concerns there,
same footing as the shipped accuracy number.

---

## 4. Spoiler audit

- **Season aggregates** (consistency %, favorMagnitude): same footing as
  the shipped accuracy number — a count/sum over Final games only, no
  individual game's score. No `SealBox` needed (matches existing
  `umpires.js` reasoning).
- **Live per-game figures**: reveal-only, clamped to `revealedThrough`,
  computed inside `StatBox`'s `SealBox` render function exactly like
  `challenges.js` — a later half's misses/favor never reach the DOM.
- **`run-expectancy.json`**: a static table of league-wide averages by
  abstract game state (no team, no game, no player) — spoiler-free at any
  time, same footing as `umpires.json`'s "assignments carry no score."

---

## 5. Files to touch

- **NEW** `scripts/gen-run-expectancy.mjs` — hand-run RE288 backfill (§2).
- **NEW** `public/data/run-expectancy.json` — committed table.
- **NEW** `src/lib/euz.js` (or similar) — shared KDE+Bayes consistency
  function, imported by BOTH `gen-umpire-accuracy.mjs` (Node) and the new
  live selector (browser) — pure JS, no Node-only APIs, so it works in both.
- **NEW** `src/api/umpireFavor.js` — reveal-only live selector (§3), mirrors
  `challenges.js`.
- `scripts/gen-umpire-accuracy.mjs` — add `consistent` (§1) and
  `favorAway`/`favorHome`/season `favorMagnitude` (§2) to the per-game/season
  shape; reads `run-expectancy.json` + `src/lib/euz.js`.
- `src/api/umpires.js` — surface the two new season fields through
  `loadUmpire`/`umpireAccuracySummary`.
- `src/screens/UmpirePage.jsx`, `src/screens/TeamInfo.jsx` — season card
  additions.
- `src/components/StatBox.jsx` — new live per-game row (§3).
- `src/index.css` — styling for the new row (reuse `.abs*` token patterns).
- `.github/workflows/update-nightly-data.yml` — **no new step** (RE288 table
  is hand-run, not nightly); `gen-umpire-accuracy.mjs`'s existing nightly
  step just starts reading the (now-committed) table.
- `CLAUDE.md` / `src/api/CLAUDE.md` — doc updates mirroring the existing
  umpire-accuracy entries.

## 6. Open questions for the maintainer (before writing code)

1. **Season count for the RE288 backfill** — recommend 2 (see §2).
2. **Box-score row's exact copy/layout** — a compact `AbsRow`-style sibling
   under the existing ABS block is the plan; any preference on wording/tone
   before it's built?
