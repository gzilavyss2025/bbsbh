# Savant matchup callouts — a batter profile against the arm he is facing

**Status:** explored, verified against live data, not yet built. This doc is the
finding set and the recommended design; a later session implements it.

**Date:** 2026-08-20. Every endpoint claim below was probed live on that date.

## The ask

Callouts that read a batter and the pitcher he faces on the SAME axis, and say
something when the two collide. The examples given:

- a pitcher who draws a high chase rate against a batter who rarely chases;
- a batter who pulls everything against a pitcher who does not allow pull;
- a batter's average against a specific pitch type, matched to the arsenal of
  the arm he is facing — relievers and starters both.

## What the data can actually do

### 1. The two Savant boards use ONE metric vocabulary for both sides

This is the finding the whole feature rests on. `leaderboard/custom` accepts
`type=batter` and `type=pitcher` and returns the SAME columns for each. A
batter's `pull_percent` is how often HE pulls; a pitcher's `pull_percent` is how
often hitters pull AGAINST him. Same for chase (`oz_swing_percent`), whiff,
ground ball, hard hit, barrel, xwOBA, xOBP, K%, BB%, first-strike%.

Verified league means, batter board vs pitcher board (2026, min 25):

| metric | batters | pitchers |
| --- | --- | --- |
| pull% | 39.43 | 39.30 |
| chase% (oz_swing) | 31.38 | 30.47 |
| whiff% | 25.84 | 25.39 |
| ground ball% | 42.94 | 42.36 |
| hard hit% | 37.16 | 38.22 |

They agree because they are the same events counted from two sides. **That is
what makes a shared-axis comparison legitimate** rather than a category error.

Pool sizes: 559 batters and 445 pitchers at `min=25`; `min=1` gives 637 / 768.

### 2. `pitch-arsenal-stats` is a direct per-pitch-type join, both sides

`leaderboard/pitch-arsenal-stats?type=pitcher|batter&year=YYYY&min=10&csv=true`
returns identical columns for both roles, one row per (player, pitch type):

`run_value_per_100, run_value, pitches, pitch_usage, pa, ba, slg, woba,
whiff_percent, k_percent, put_away, est_ba, est_slg, est_woba, hard_hit_percent`

So a pitcher's sweeper and a hitter's record against sweepers join on
`(player_id, pitch_type)` with no name matching — `player_id` is the MLBAM id
the app already keys on.

**Relievers are covered.** The arsenal board carries 683 pitchers against the
custom board's 445 — the extra 238 are bullpen arms. Starters and relievers use
the same rows, so one family serves both: the probable starter before first
pitch, any reliever once he is in.

Per-pitch-type league baselines (PA-weighted, computed from the board itself):

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

A rate against one pitch type MUST be judged against that type's own baseline.
League BA is .281 on sinkers and .207 on splitters — a flat "above average"
test would fire on the pitch type, not on the hitter.

### 3. What does NOT work — do not plan around these

- **No handedness splits.** `pitcher_throws=L`, `batter_stands=L` and `hand=L`
  are all accepted and all IGNORED on the custom board: L and R return
  identical rows (559 rows, 0 differing values, checked value by value). Every
  number here is overall, not platoon. The app's existing `platoon` family
  (statsapi `sitCodes`, vs-L/vs-R AVG) stays the only handedness source.
- **`iz_swing_percent` and `obp` come back empty** on the custom board — the
  same silent-blanking trap `gen-savant-percentiles.mjs` documents for renamed
  selection ids. Use `oz_swing_percent` and `xobp`.
- **No MiLB.** Savant is MLB only, so this family never fires on a MiLB bundle,
  like the existing foul-spoiler family.

### 4. The sample-size problem — this is the important one

**Batting average against a specific pitch type is mostly noise at the sample
sizes that exist.** Two independent checks agree.

Binomial noise model — exact for BA, K% and whiff, which are all counts over
trials. Sweepers, hitters with 25+ PA, median n = 36 PA:

| metric | observed SD | chance SD | share of spread that is real skill |
| --- | --- | --- | --- |
| BA | .0734 | .0688 | **12%** |
| whiff% | .0931 | .0377 | **84%** |
| K% | .0967 | .0758 | 39% |
| hard hit% | .1255 | .0777 | 62% |

Model-free confirmation — compare the spread among low-sample hitters (20–45
PA) to high-sample hitters (80+ PA), pooled across seven pitch types. A real
skill spreads the same in both groups; noise spreads wider when the sample is
small:

| metric | low-PA SD | high-PA SD | ratio | verdict |
| --- | --- | --- | --- | --- |
| BA | .0862 | .0497 | 1.73 | mostly noise |
| SLG | .1638 | .1048 | 1.56 | mostly noise |
| xwOBA | .0775 | .0467 | 1.66 | mostly noise |
| **whiff%** | 7.27 | 6.87 | **1.06** | **real skill** |
| hard hit% | 13.35 | 10.50 | 1.27 | noisy |
| K% | 9.45 | 7.15 | 1.32 | noisy |

Why whiff wins: its denominator is PITCHES SEEN (median 149 against one pitch
type), not plate appearances (median 36). Four times the trials.

Concretely — the leaderboard says Nico Hoerner hits .457 against sweepers. That
is 37 plate appearances. It is almost entirely luck and will not repeat.

Note the binomial model does NOT apply cleanly to SLG or xwOBA (neither is a
count over trials), so only the model-free row above should be trusted for
those two. Both land in the same place regardless.

**Rule: trigger and rank on whiff%. Show BA as color, never as the trigger.**
A note may print "hitting .312 against them in 170 PA" once whiff% has already
earned the note, and only past a real PA floor.

## Recommended families

Three, all entering-tense season aggregates off a nightly static file. All are
spoiler-free by construction: no tonight material, no score, nothing from
`liveData`. They belong in `select.js` territory, not reveal-only.

### A. Skill collision — chase, whiff, hard contact

Both sides z-scored against their own board's league mean. Fires when BOTH
sides clear about 1.15 SD. Four readings, of which three are worth printing:

- **standoff** — both strong. *"Perdomo chases only 21.1% of pitches out of the
  zone — Payton Tolle gets hitters to chase 35.8% of the time."* This is the
  first example from the ask, found unprompted in real data.
- **pitcher exploits** — his strength, the hitter's hole.
- **hitter exploits** — the hitter's strength, the pitcher's hole.
- weakness vs weakness — drop it, it says nothing.

### B. Style clash — pull, ground ball

Neither side is "good" or "bad" — these are tendencies, and the note only fires
when they point OPPOSITE ways. Real examples:

- *"Crow-Armstrong pulls 50.4% of his batted balls — but Sean Newcomb gets
  pulled just 33.3% of the time."* (the second example from the ask, again
  found in real data.)
- *"Miguel Vargas hits 29.9% on the ground — but Clay Holmes gets a ground ball
  59.6% of the time."*

### C. Arsenal matchup — the pitch-type family

Pitcher's pitch, gated on usage 15%+ and 150+ thrown; hitter gated on pitches
seen against that type. Both whiff rates regressed toward that pitch type's own
league mean, then z-scored:

- **mismatch** — *"Aaron Nola throws his curveball 33.1% of the time and misses
  43.3% of bats with it. Caissie whiffs on 56.5% of the curveballs he swings
  at."*
- **standoff** — *"Skenes throws his four-seamer 41.5% of the time, 30% whiff.
  McGonigle whiffs on only 12% of four-seamers."*

Tuning notes from the prototype:

- Regression weight matters a lot. At K=200 pitches the family collapsed to 3
  notes across 6 games and lost every good one. At **K=50** it produced 9 notes
  across 6 games — about 1.5 a game, the right volume for a surface with 2–5
  slots. Whiff barely needs regression; it is already the stable metric.
- A single global "pitches seen" floor makes the family ALL FASTBALL, because
  secondaries have smaller samples. Scale the floor per pitch type instead, or
  the interesting curveball and sweeper notes never print.
- The fourth quadrant (weak whiff pitch meets whiff-prone hitter) is ambiguous.
  Drop it. The prototype labelled it "hitter edge" and was wrong to.

## Where it should live

**Do NOT put this in the per-game callout bundle.** A trimmed profile is about
157 bytes per player; 40 players a game across a 15-game slate would roughly
double every bundle for data that is identical league-wide.

Instead follow the pattern `gen-savant-percentiles.mjs` already sets: one
league-wide static file, joined client-side.

1. Extend `scripts/gen-savant-percentiles.mjs`, or add a sibling
   `gen-savant-matchup.mjs`, to pull the extra custom-board columns plus both
   arsenal boards, and to write the per-pitch-type league baselines it computes
   from the same response.
2. Read it through a new `src/api/savantMatchup.js`, same shape as
   `savantPercentiles.js` — `staticJson`, in-memory cache, empty-map fallback.
3. Build the notes in a new `src/api/matchup-callouts.js`, scored into the
   existing worthiness system.

Add it to the nightly job in `.github/workflows/update-nightly-data.yml`, and
keep every fetch optional-with-fallback per `docs/data-enrichment.md` §3.

## Surfaces and the spoiler rule

- **Between Innings** — the stated target. Add the new kinds to
  `BETWEEN_INNINGS_ALLOWED_KINDS` in `src/api/between-innings.js`. Safe: pure
  season aggregate, no tonight material at all, so it clears that surface's
  stricter bar without needing a reveal gate.
- **Pre-half strip / Margin Notes** — same footing, via `prehalf-callouts.js`.
- **Lineup pages** — the natural home for the full nine-hitter version.

**On folding tonight's line in** ("he's 0-for-1 today"): Between Innings only
renders after a revealed half, so a batter's line from strictly-previous halves
is material the reader has ALREADY SEEN — the same footing `foulVolume`,
`pitchPace` and `tto` already stand on. It is defensible. Two conditions:

1. It must read only strictly-previous halves, gated on `revealedThrough` in
   the MODULE, not the component — the rule ADR-0014 sets for the
   leading-after note.
2. The note must fire on the season profile ALONE, with tonight's line as an
   optional extra clause. If the note only appeared when the batter had a line,
   card DEPTH would start tracking how eventful the half was, which
   `between-innings.test.js` pins as an invariant.

## Open decisions

1. **How much explanation?** The ask included a plain-language read ("that
   means he's swinging at more pitches than he should, but when he connects
   he's hitting it harder than average"). That is roughly twice the length of
   any existing callout. Options: full prose everywhere; short form on the
   strip with prose on the lineup page; or short form plus a tap-to-open gloss
   like `StatcastPercentiles`' flipped back face.
2. **Which of the three families ship first?** C (arsenal) is the most striking
   and the most work. A and B share one code path and are cheap.
3. **BA display.** Confirm it prints only as color behind a whiff-triggered
   note, never as its own trigger.

## Reproduction

The probe scripts behind every number above were throwaway and live only in the
session scratchpad. The durable part — endpoint URLs, column names, the
selection ids that blank silently, and the measured baselines — is recorded
above. Re-probe before implementing; Savant is undocumented and renames columns
without notice.
