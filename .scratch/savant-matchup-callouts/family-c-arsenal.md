# Family C — the arsenal matchup callout

**Status:** specified, not built. Families A and B shipped in PR #813; this is
the third family from the same research pass.

**Prerequisite:** PR #813 must be merged. This family reuses its file, its
reader, its voice rules, its scoring, and its half-resolution wholesale. Do NOT
build a parallel path.

Every number below was probed live on 2026-08-20. Savant is undocumented and
renames columns without notice — **re-probe before you start**, and treat a
figure that has moved as a finding, not a nuisance.

## What it says

Families A and B compare a hitter and a pitcher on a SEASON-WIDE axis. This one
goes a level deeper: it compares them **on one specific pitch**.

> Aaron Nola throws his curveball a third of the time and misses 43% of the bats
> that swing at it. Caissie misses on 57% of the curveballs he swings at.

> Skenes throws his four-seamer 42% of the time, missing 30% of swings.
> McGonigle misses on only 12% of four-seamers.

It is the most striking of the three families and the one with the most tuning
risk. It also covers relievers, which A and B effectively do not — see below.

## The data

`GET https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats`
`?type=pitcher|batter&pitchType=&year=YYYY&team=&min=10&csv=true`

CORS-open, no key. **Identical columns for both roles**, one row per
(player, pitch type):

```
last_name, first_name | player_id | team_name_alt | pitch_type | pitch_name |
run_value_per_100 | run_value | pitches | pitch_usage | pa | ba | slg | woba |
whiff_percent | k_percent | put_away | est_ba | est_slg | est_woba | hard_hit_percent
```

A pitcher's row is that pitch as HE throws it; a batter's row is that pitch as
HE faces it. They join on `(player_id, pitch_type)` — `player_id` is the MLBAM
id the app already keys on, so no name matching.

**Relievers are covered, and this is the family's real edge.** The arsenal board
carries **683 pitchers** against the custom board's 445. The extra 238 are
bullpen arms. Families A and B are effectively starter-only in practice because
a reliever rarely clears the custom board's PA floor; this family is not.

### League baselines per pitch type — compute these, never hardcode

PA-weighted, from the pitcher board (2026, as of 2026-08-20):

| type | pitch | pitchers | lg BA | lg SLG | lg xwOBA | lg whiff |
| --- | --- | --- | --- | --- | --- | --- |
| FF | 4-Seam Fastball | 578 | .246 | .425 | .337 | 21.6% |
| SI | Sinker | 417 | .281 | .413 | .351 | 13.5% |
| SL | Slider | 367 | .223 | .384 | .288 | 33.6% |
| CH | Changeup | 308 | .222 | .345 | .277 | 31.4% |
| ST | Sweeper | 245 | .209 | .360 | .266 | 31.4% |
| FC | Cutter | 225 | .273 | .461 | .346 | 22.8% |
| CU | Curveball | 225 | .218 | .361 | .275 | 31.5% |
| FS | Split-Finger | 79 | .207 | .326 | .261 | 34.2% |

**A rate against one pitch type MUST be judged against that type's own
baseline.** League whiff is 13.5% on sinkers and 34.2% on splitters. A flat
"above average" test fires on the pitch type, not on the player.

## The finding that shapes the whole design

**Batting average against one pitch type is mostly noise.** A hitter has a
median of **36 PA** against a given pitch in a season. Two independent checks:

Binomial noise model (exact for BA, K%, whiff — all counts over trials),
sweepers, 25+ PA:

| metric | observed SD | chance SD | real skill |
| --- | --- | --- | --- |
| BA | .0734 | .0688 | **12%** |
| whiff% | .0931 | .0377 | **84%** |
| K% | .0967 | .0758 | 39% |
| hard hit% | .1255 | .0777 | 62% |

Model-free confirmation — spread among low-sample (20–45 PA) vs high-sample
(80+ PA) hitters, pooled across seven pitch types. A real skill spreads the same
in both; noise spreads wider when the sample is small:

| metric | low-PA SD | high-PA SD | ratio | verdict |
| --- | --- | --- | --- | --- |
| BA | .0862 | .0497 | 1.73 | mostly noise |
| SLG | .1638 | .1048 | 1.56 | mostly noise |
| xwOBA | .0775 | .0467 | 1.66 | mostly noise |
| **whiff%** | 7.27 | 6.87 | **1.06** | **real skill** |
| hard hit% | 13.35 | 10.50 | 1.27 | noisy |
| K% | 9.45 | 7.15 | 1.32 | noisy |

Whiff wins structurally: its denominator is PITCHES SEEN (median 149 against one
pitch type), not plate appearances (36).

Note the binomial model does not apply cleanly to SLG or xwOBA (neither is a
count over trials) — trust only the model-free row for those two. Both land in
the same place regardless.

> The leaderboard says Nico Hoerner hits .457 against sweepers. That is 37 plate
> appearances. It is almost entirely luck and will not repeat.

**THE RULE: trigger and rank on whiff%. Batting average may print as colour on a
note whiff has already earned, past a real PA floor, and never as the trigger.**
This was confirmed as a product decision, not a suggestion.

## Tuning learned from the prototype

Do not rediscover these.

1. **Regression weight.** Whiff is already ~94% stable, so it barely needs
   regressing. At K=200 pitches the family collapsed to **3 notes across 6
   games** and lost every good one, including the Nola curveball. At **K=50** it
   produced **9 notes across 6 games** — about 1.5 a game, the right volume.
   Regress toward that PITCH TYPE's own league whiff, not a global mean.

2. **One global sample floor makes the family ALL FASTBALL.** Median batter
   pitches-seen by type:

   | FF | SI | SL | CH | FC | ST | CU | FS |
   | --- | --- | --- | --- | --- | --- | --- | --- |
   | 285 | 170 | 144 | 126 | 103 | 102 | 104 | 56 |

   A floor that keeps four-seamers honest erases splitters. **Scale the floor
   per pitch type** — e.g. a fraction of that type's own median — or the
   interesting curveball and sweeper notes never print, which is most of the
   family's value.

3. **Drop the fourth quadrant.** With pitcher-whiff and batter-whiff each above
   or below their baselines, three readings are worth printing and one is not:
   - pitcher HIGH + batter HIGH → **mismatch**, his best pitch is this hitter's
     blind spot. The strongest note in the family.
   - pitcher HIGH + batter LOW → **standoff**, his out pitch is the one this
     hitter covers.
   - pitcher LOW + batter HIGH → the hitter is exposed to a pitch that is not
     actually a bat-misser. Weak but printable.
   - pitcher LOW + batter LOW → **ambiguous, drop it.** The first prototype
     labelled this "hitter edge" and was wrong to.

4. **Gate the pitch itself**, not just the players: usage ≥ 15% and ≥ 150 thrown.
   A pitch he throws 4% of the time is not what this at-bat is about.

## Payload — pick floors deliberately

Measured, trimmed to 7 fields per (player, pitch):

| slice | rows | players | size |
| --- | --- | --- | --- |
| pitchers, all | 2457 | 683 | ~165 KB |
| **pitchers, usage ≥ 15%** | 1737 | 683 | **~119 KB** |
| batters, all | 3271 | 548 | ~214 KB |
| **batters, 40+ PA vs that pitch** | 1223 | 396 | **~83 KB** |
| batters, 25+ PA vs that pitch | 2036 | 454 | ~136 KB |

`public/data/savant-matchup.json` is currently ~77 KB. The recommended slices
take it to roughly **280 KB**, comparable to `savant-percentiles.json` (236 KB).
Acceptable — but it is the whole budget, so do not also carry `slg`, `woba`,
`k_percent`, `run_value` or `est_ba` unless a note actually prints them.

## What to build

Everything here extends PR #813. Read `src/api/matchup/notes.js` first — its
header is the voice contract, and this family inherits all of it.

1. **`scripts/gen-savant-matchup.mjs`** — add the two arsenal-board fetches
   alongside the existing custom-board ones. Use `fetchCustomBoard`'s sibling
   pattern in `scripts/lib/savant.mjs`; add an `fetchArsenalBoard` there rather
   than inlining a fetch. **Wrap it in the existing `withRetry`** — Savant
   refuses cold connections often enough to fail a single-shot nightly job.
   Compute per-pitch-type league baselines from the same response and write them
   beside the existing `league` block. Keep the existing coverage warnings and
   add one for a blanked arsenal column.

2. **`src/api/matchup/savant.js`** — a reader for the new block, same shape as
   `matchupRatesFor`: null on a miss, never zero.

3. **The note builder.** `src/api/matchup/notes.js` is already ~300 lines;
   check `scripts/check-file-size.mjs` (600-line cap) and
   `scripts/check-dir-size.mjs` before deciding. A sibling
   `src/api/matchup/arsenal.js` is likely cleaner. Either way, **reuse**
   `pct`, `quantity`, the shape rotation, `fitShort` and its drop order, and
   `emphasisFor` rather than reimplementing them — extract them to a shared
   module if you add a file.

4. **`SCORE_BASE.matchupArsenal`** in `src/api/callout-notes/shared.js`.
   Suggested **38** — above `matchupSkill` (36), since a pitch-specific
   collision is more pointed than a season-wide one. Update the table in
   `docs/callouts.md` in the same edit; the two are tuned together.

5. **`BETWEEN_INNINGS_ALLOWED_KINDS`** in `src/api/between-innings.js` — add the
   new kind. No new gate is needed: like A and B this reads only season
   aggregates.

6. **`src/api/matchup/forHalf.js`** already resolves the due-up hitters and the
   arm entering the half, with the reveal gate inherited from `selectDueUpNow`
   and `selectHalfStartingPitcher`. Call the new builder from there. **Do not
   add a gate of your own** unless you introduce a new source, and if you do,
   say so in the spoiler-manifest `why`.

7. **`src/api/spoiler-manifest.json`** — an entry for every new module or lint
   fails. Insert it IN PLACE alphabetically; do not re-sort or reformat the
   file (a previous pass churned 32 unrelated lines that way).

8. **`.github/workflows/update-nightly-data.yml`** — no change needed IF you
   extend the existing file, since `public/data/savant-matchup.json` is already
   in the `git add` list and `savant-matchup` is already in the fail-check. If
   you write a NEW file you must add it to BOTH: **that `git add` list is
   explicit, not a glob**, and the workflow header documents a past incident
   where a generated file was never committed because of exactly this.

9. **Tests** — `test/matchup-callouts.test.js` is the model. Pin at minimum:
   the per-pitch-type baseline is used (not a global one); the ambiguous
   quadrant produces nothing; BA never appears without whiff having earned the
   note; the pitch-usage and per-type sample floors hold; short forms stay under
   `SHORT_MAX` with long name pairs; and secondaries still fire (a test that
   only passes on four-seamers is the failure mode to guard).

10. **Docs** — `docs/callouts.md` ("Matchup callouts" section) and
    `docs/scripts/generators.md`.

## Voice — inherited, non-negotiable

Two blind copy reviews produced these; three exist because draft copy was
WRONG. Full reasoning in `scope.md` and in `notes.js`'s header.

- **`chase` means "swing at a pitch OUT of the zone" and nothing else.** This
  family talks about swings constantly. Say "swings", never "chases", unless you
  genuinely mean out-of-zone. The draft said a curveball "misses 43% of the bats
  that chase it" and that is the exact error.
- **Rates round.** No decimals on a rate percentage.
- **One construction for the baseline:** `league average is X`.
- **Scope every note `this season`.**
- **Surnames in short form, full name on prose first reference.**
- **`just` is conditional** — one side only, past 1.5 SD, and only on a value
  BELOW its own league mean.
- **Polarity lives in the verb**, never in arithmetic the reader must do.
  "McGonigle does not miss it" — the reader should never subtract to learn which
  way a note points.
- **One interpretive clause per prose form, maximum**, and it must fail a paste
  test: if the closer would fit any other note in the family, it is filler.
  `He's going to see a lot of them` passes (it only works when the pitcher's
  best pitch is this hitter's worst). `Whoever blinks first decides the at-bat`
  and `One of those two habits has to give` were both cut — the first inverts
  its own idiom, the second is simply false.
- **Print the sample when it is thin.** The app already does this
  (`Career .312 against the Cardinals (48 AB)`). A rookie's 12% on 40 swings
  needs its count shown, or suppressing.
- **Rotate the sentence SHAPE by index**, and keep at most one em dash per note.

## Gotchas

- **`defenseEntering` contains NO pitcher** — it returns the eight fielders plus
  the DH. This cost a full debugging cycle in PR #813. The arm entering a half is
  `selectHalfStartingPitcher` (`src/api/select.js`), which carries its own
  reveal gate. `forHalf.js` already handles this; do not re-derive it.
- **Callout bundles are pruned to ~10 days**, and both surface builders bail
  early with no bundle — so an older game shows no matchup notes at all even
  though this data is league-wide. Known limitation, out of scope here.
- **`src/api` is at its 100-file cap.** New app modules go in
  `src/api/matchup/`. If you bump a budget in `check-dir-size.mjs`, the bump
  carries **no comment** — that file is pinned at its own 600-line ceiling.
- **Verify by exit code, not by grepping output.** Guard scripts print `✗` while
  eslint prints `✖`; a grep once reported green while CI was red.
- **No handedness splits exist.** `pitcher_throws` / `batter_stands` / `hand`
  are accepted by these endpoints and silently ignored.

## Reference

- `scope.md` in this directory — the full research trail, both copy reviews, and
  the A/B design.
- PR #813 — the shipped A and B families.
- `docs/callouts.md` — the catalog, the worthiness rubric, and the voice rules.
- `docs/data-enrichment.md` §3/§5 — the Savant and nightly-precompute policy.
