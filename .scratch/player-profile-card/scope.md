# Player profile card — scope

**Status:** scoping · no implementation scheduled
**Slug:** `player-profile-card`
**Prompted by:** a dtwbaseball.com pitcher card (Clay Holmes, 2026), asking what it
would take to do "this kind of analysis" on our player detail pages — specifically
**Pitches Like** and **the polygon**.

Related parked scopes: `.scratch/player-ovr/scope.md` (a 0–100 OVR/POT rating —
different question, same neighbourhood), `.scratch/metric-engines/README.md` (the
house rules any new metric engine inherits).

---

## 1. What's actually in the reference card

Five separable modules, in descending order of "we could ship this next week":

| # | Module | What it needs |
|---|---|---|
| A | **Percentile strip** — 5 metrics, big ordinal + a bar with a league-average tick | percentiles (have them) |
| B | **The polygon** — 5-spoke radar, raw rate at each spoke, dashed league-average ring, outer ring = best | percentiles (have) + raw rates (one new fetch) |
| C | **By-pitch value bars** — diverging bars, "bases saved / bases allowed" per pitch type | per-pitch-type run value (one new fetch) |
| D | **Grade + archetype** — "B+ · better than 72% · Mixed Profile" + a prose gloss | a blend model + copy rules |
| E | **Pitches Like** — 3 similar pitchers with headshot + club | a similarity model over B/C's inputs |

The hero sparkline (xEB/PA 2022–26) is a sixth, cheap module — it's just the
multi-season version of whatever headline metric D settles on.

## 2. What we already have

More than I expected going in.

- **`public/data/savant-percentiles.json`** (`gen-savant-percentiles.mjs`, nightly,
  ~100 KB) — 0–100 percentile per metric, MLB, pre-flipped so higher is always
  better. Pitchers already carry `xera, k, bb, whiff, chase, fbVelo, hardHit`.
  `PITCHER_METRICS`/`BATTER_METRICS` in `src/api/savantPercentiles.js` already hold
  the display order, labels, and plain-language definitions.
  `qualifiedCount(data, group)` already gives the "vs. 428 qualified pitchers"
  denominator from the file itself rather than an invented number.
- **`StatcastPercentiles.jsx`** already renders those percentiles on the player page
  as flip cards. Module A is a **re-skin of an existing component**, not new data.
- **`public/data/pitch-arsenal.json`** (`gen-pitch-arsenal.mjs`, nightly, ~400 KB) —
  per-pitcher pitch-type mix and average velocity, MLB **and AAA**, built off our own
  feed sweep. `PitchMix.jsx` renders it on the player page today.
- **`AdvancedPitchingCard`** (`advancedPitchingView` in `person.js`) already surfaces
  raw K%, BB%, K−BB%, FIP, ERA−, GB%, opponent AVG/OPS from statsapi.
- **`src/lib/statTiers.js`** — SD-based tiering (`elite/good/average/below`) with
  `meanAndSd`, already used by umpire accuracy and Game Score.
- **`src/lib/beeswarm.js`** exists, so there's precedent for pure-JS chart geometry
  in `lib/` with the drawing in a component.

## 3. Module B — the polygon

### What drives it

A radar needs two numbers per spoke: a **radius** (0–1) and a **label** (the raw
rate). We have the radius already — Savant's percentile *is* the radius, and it's
pre-flipped, which is exactly the "farther out is better" property the reference
card's caption describes. The reference card's dashed inner ring is league average;
on a percentile scale that's a constant ring at 0.50, which is simpler than their
version and means the ring needs no extra data at all.

What we don't have is the **raw rate for the label** (`.422`, `21.7%`, `8.7%`). The
percentile-rankings CSV we already fetch carries percentiles only — every column is
0–100.

**Verified fix (probed live 2026-08-03):** Savant's `custom` leaderboard is CORS-open
(`access-control-allow-origin: *`) and returns raw rates for an arbitrary column
selection in one CSV:

```
https://baseballsavant.mlb.com/leaderboard/custom?year=2026&type=pitcher&min=1
  &selections=k_percent,bb_percent,hard_hit_percent,home_run,pa,xwoba,whiff_percent
  &chart=false&x=k_percent&y=k_percent&r=no&chartType=beeswarm
  &sort=k_percent&sortDir=desc&csv=true
```

736 pitcher rows at `min=1`. Holmes comes back
`K% 20.9 · BB% 8.4 · hard-hit 44 · HR 3 · PA 215 · xwOBA .306 · whiff 21.9` — his
`pa` of 215 matches the reference card's "215 BF" exactly, so the two cards are
reading the same underlying season. (Their spoke values differ by a few tenths
because their metrics are their own model, not Savant's — see §6.)

This is a **column add to `gen-savant-percentiles.mjs`**, not a new generator: same
host, same nightly job, same `personId` key, and the merged file stays well under the
~100 KB PWA-precache comfort line if we keep it to the 5–7 metrics the radar shows.

### What has to be built

- `scripts/gen-savant-percentiles.mjs` — second fetch, merge raw values in beside the
  percentiles (`{pct, raw}` per metric, or a parallel `rawPit`/`rawBat` map).
- `src/lib/radarGeometry.js` — pure: `(spokes[]) → {points, gridRings, labelAnchors}`.
  Pure and unit-testable, same shape as `lineupSolver.js`/`beeswarm.js`. This is
  where the whole thing gets pinned by `npm test`.
- `src/components/StatRadar.jsx` — inline SVG. No chart library; the app has none and
  a radar is ~40 lines of polygon points.
- Design-system work: the polygon fill/stroke need tokens. **Kraft-seal amber is
  off-limits** (reserved for score covers). Navy ink on manila with a graphite dashed
  ring is the obvious reading of the scorebook metaphor.
- Accessibility: a 5-spoke polygon encodes nothing a screen reader can use, so it
  must be `aria-hidden` with the same numbers in the labelled percentile strip
  beneath it — the exact pattern `PitchMix.jsx`'s decorative bar already uses.

**Estimate: ~1 day.** The data is a column add, the geometry is pure and small, and
the component sits next to `StatcastPercentiles` in a slot the page already has.

### Batters get this free

`BATTER_METRICS` is already a 6-metric set (xwOBA, EV, hard-hit, barrel, chase,
sprint). Same radar, same component, different metric list — the hitter card costs
nothing extra beyond picking which 5 of the 6 to plot.

## 4. Module E — Pitches Like

Two genuinely different features share this label, and picking between them is the
main open decision.

### E1 — arsenal similarity ("throws the same stuff")

Nearest neighbours in *repertoire* space: pitch mix shares + velocity per type. This
is the literal reading of "pitches like," and **we can build it from
`pitch-arsenal.json` today with no new fetch** — it already has mix and velo for
1,025 pitchers.

Shape: per pitcher, a vector over the ~12 pitch-type codes of `(usage share,
avg velo)`; cosine or weighted-Euclidean distance; take the top 3. Handedness should
almost certainly be a hard filter rather than a feature (a lefty who "pitches like"
a righty is a broken result, not an interesting one), and it's already on the player
page as `bio.throws`.

**Caveat found while probing:** our `pitch-arsenal.json` currently reports
`coverageSince: 2026-07-09` / 582 games — it's a trailing window from when the sweep
was backfilled, not the full season. Fine for a mix estimate, but a similarity model
built on a partial season should either say so, or the generator gets a one-time
`--since=<opening day>` backfill first. That backfill is cheap and worth doing either
way.

### E2 — outcome similarity ("gets the same results")

Nearest neighbours in the *percentile* space the radar already plots. Trivially
cheap — it's a 5-dimensional distance over a file we already ship — but it answers a
different question, and "pitches like" is the wrong label for it ("profiles like").

### E3 — both, which is what the reference card is probably doing

Arsenal shape *and* what the arsenal produces. Best result, most calibration nerve.

### What has to be built (E1, the recommended start)

- `src/lib/pitcherSimilarity.js` — pure vectorise + distance + top-N. Unit-tested.
- Precompute vs. runtime: 1,025 pitchers × ~12 dims is a ~150 KB distance problem if
  precomputed, or **nothing at all if computed in the browser** — one pass over an
  already-loaded file for one player is microseconds. **Compute it at runtime.** No
  new generator, no new static file. This is the cheapest module in the whole card.
- `src/components/SimilarPitchers.jsx` — three pills, `Headshot` + `PlayerLink` +
  `TeamLogo`, all of which exist.

**Estimate: ~1 day for E1**, most of it spent on whether the neighbours it picks
actually look right to a baseball fan — which is the real work and can't be
shortened. Budget a second day for calibration against pitchers you know well.

## 5. Module C — by-pitch value bars (worth flagging: also cheap)

Not asked about, but it's the third thing on the card and it turned out to be a
one-fetch add, so it belongs in the scope.

**Verified (probed live 2026-08-03):** `pitch-arsenal-stats` is CORS-open and carries
`run_value`, `run_value_per_100`, `pitch_usage`, `whiff_percent`, `est_woba`,
`hard_hit_percent` **per pitcher per pitch type**:

```
https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&year=2026&min=10&csv=true
```

2,326 rows / 652 pitchers / 3.57 pitch types each. Trimmed to the six fields above it
serialises to **~141 KB**. Holmes' sinker comes back at 50.5% usage against the
reference card's 51% — same data, and `type=batter` works identically (3,115 rows) if
the hitter card ever wants "how he does against each pitch type."

Note this **doesn't replace `pitch-arsenal.json`** — ours covers AAA, Savant's is
MLB-only, and ours is built from feeds we control. The two are complementary: keep
ours for mix/velo, add Savant's for outcomes.

**Estimate: ~1 day** (new nightly generator + reader + a diverging-bar component).

## 6. Frictions with house convention

Four, and the first is a real decision, not a nit.

1. **The letter grade.** `.scratch/metric-engines/README.md` states the house
   convention outright: *"numeric (0–10 or 0–100) + SD-based tier labels via
   `statTiers.js` — no letter grades anywhere in the app. Docs recommend 0–10; A+–F
   stays available as a pure presentation-layer skin."* So a "B+" is allowed only as
   a skin over a 0–10 with a tier underneath. Worth deciding deliberately rather than
   drifting into it.
2. **`xEB/PA` is somebody else's model.** The reference card's headline metric is
   dtwbaseball's proprietary expected-extra-bases figure. We can't reproduce it and
   shouldn't try. The `feverRadar` precedent is the governing one: a third-party
   model output is deliberately *not* a callout family, because bbsbh can't reconcile
   it against the official record — it gets surfaced only via an attributed pill.
   Either build our own blend from Savant components (reconcilable, ours) or don't
   have a headline metric. The radar works fine without one.
3. **MiLB degradation.** Every input here is MLB-only except our own
   `pitch-arsenal.json` (MLB + AAA). The whole card must render nothing below MLB
   rather than a half-empty polygon — same rule `StatcastPercentiles` already
   follows.
4. **Flat directories.** `src/components/` is already ~110 files. Root `CLAUDE.md`
   says to propose subdirectories around the 10th file in a directory; this feature
   adds 3–5 components. They should land in `src/components/playercard/` (or similar)
   rather than on the pile.

**Spoiler rule: no exposure.** Every input is a season aggregate over completed
games — the same footing as WAR, fouls, and the existing Statcast percentiles. No
`SealBox`, no `revealedThrough` gating, no reveal-only module. The one thing to watch
is the `asOf` cutoff: like `FoulCard` and the Milestone Watch projection, a nightly
precompute can't be cut back to "entering today," so **the whole card should hide
under a spoiler `asOf`** rather than show full-season numbers on a page frozen to a
past date.

## 7. Recommended order

1. **E1 — Pitches Like** (~1 day + calibration). Zero new data, zero new pipeline,
   entirely runtime, and it's the module with the most personality per byte.
2. **B — the polygon** (~1 day). One column-add to an existing nightly generator;
   the rest is a pure geometry module and an SVG.
3. **A — percentile strip** (~half a day). Re-skin of `StatcastPercentiles` into the
   reference card's ordinal + bar + average-tick form, once B establishes the visual
   language.
4. **C — by-pitch bars** (~1 day). New nightly generator; the first module here that
   adds a pipeline.
5. **D — grade + archetype**. Deliberately last and deliberately unestimated. This is
   a metric-engine problem, not a UI problem — it wants the `.scratch/metric-engines/`
   treatment (candidate engines → research pass → stack rank) and it overlaps
   `player-ovr` directly. Don't let it block 1–4.

**~4 days to a card carrying A, B, C, and E** — the whole visual structure of the
reference, minus the proprietary headline metric and the letter grade.

## 8. Open decisions

1. Letter grade as a presentation skin over 0–10, or stay numeric? (§6.1)
2. Similarity on arsenal (E1), outcomes (E2), or blended (E3)? Recommend E1 first —
   it matches the words "pitches like."
3. Handedness as a hard filter on similarity, or a weighted feature? Recommend hard
   filter.
4. Does the hitter player page get the same treatment in the same pass, or does the
   pitcher card ship alone first? (`BATTER_METRICS` makes the hitter radar nearly
   free; hitter *similarity* is a separate model.)
5. Backfill `gen-pitch-arsenal.mjs` to opening day before building similarity on it?
   (§4, E1 caveat — recommend yes, independent of this feature.)
6. Where does this live on the page — one new card, or does it absorb the existing
   `StatcastPercentiles` + `PitchMix` sections? The reference is one dense card;
   our page is a long scroll of small sections.

## 9. Verification trail

All external probes run live 2026-08-03 from this repo's sandbox. Every endpoint
below returned `access-control-allow-origin: *`:

| Endpoint | Result |
|---|---|
| `leaderboard/pitch-arsenal-stats?type=pitcher&year=2026&min=10&csv=true` | 200, 2,326 rows, 652 pitchers, ~141 KB trimmed |
| `leaderboard/pitch-arsenal-stats?type=batter&…` | 200, 3,115 rows |
| `leaderboard/custom?…&selections=k_percent,bb_percent,hard_hit_percent,home_run,pa,xwoba,whiff_percent` | 200, 736 rows at `min=1` |
| `leaderboard/expected_statistics?type=pitcher&year=2026` | 200, 775 rows (raw xERA/xwOBA — alternative to `custom`) |
| `leaderboard/percentile-rankings?type=pitcher&year=2026` (already in use) | 200, 610 rows, percentiles only — **no raw values** |

Per `docs/data-enrichment.md` §3, Savant is undocumented and unofficial: every call
stays optional-with-fallback, and if Savant is ever fetched from the browser rather
than the nightly job it needs adding to `vite.config.js`'s `NetworkOnly` list.
