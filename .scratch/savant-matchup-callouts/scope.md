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

## Voice spec — DECIDED

**Short form on the strip, full prose on the lineup page.** Decided 2026-08-20.

Every note carries BOTH strings. The builder returns `text` (short) and
`prose` (long); the surface picks. No surface computes the other one.

### The short form has a measured ceiling

Existing callout templates run a median of **79 characters**, p90 **119**, max
**150** — that longest one is the times-through note, which is the precedent
for a two-clause note that names both sides:

> Batters see Imanaga a 3rd time this inning — they're hitting .444 off him the
> 3rd time through this season (.286 the 1st time)

So: **short form caps at 150 characters**, two clauses joined by an em dash,
batter fact then pitcher fact. That is the house shape already. It is enough
for all three families — the prototype's sentences came in at 87–107 characters
before any tightening.

| Family | Short form (strip, Between Innings) |
| --- | --- |
| A skill collision | `Perdomo chases just 21% of the pitches he sees out of the zone; league average is 31%. Tolle draws a chase 36% of the time.` |
| B style clash | `Crow-Armstrong pulls half his batted balls this season — league average is 39%. Hitters pull just 33% against Newcomb.` |
| C arsenal | `A third of Nola's pitches are curveballs, and they miss 43% of the swings they draw; Caissie misses on 57% of his swings at a curveball.` |

These are the POST-REVIEW forms. See "Copy review" below for what changed and
why — the originals had two outright errors in them, not just style problems.

### The full prose adds the "what that means" sentence

The strip states the collision. The lineup page explains why it matters. Same
two facts, then one sentence of reading — this is the part the ask was after,
and it is the part that does not fit on a two-slot strip.

- **A.** *Perdomo chases just 21.1% of the pitches he sees out of the zone,
  against a league mark of 30.5% — he makes a pitcher come to him. Tolle's game
  is the opposite: he draws a chase 35.8% of the time. Whoever blinks first
  decides the at-bat.*
- **B.** *Crow-Armstrong pulls 50.4% of his batted balls, well over the 39.4%
  league rate. Newcomb gets pulled on just 33.3% — hitters tend to put his stuff
  the other way. One of those two habits has to give.*
- **C.** *Nola throws his curveball a third of the time and misses 43.3% of the
  bats that chase it. Caissie swings through 56.5% of the curveballs he sees,
  the wrong end of a league mark of 31.5%. He is going to see a lot of them.*

Rules for the prose sentence:

- It reads the numbers already printed. It never introduces a third statistic.
- It never predicts an outcome ("he'll strike out"). It names the tension.
- League baselines print only in the prose, never in the short form — that is
  what the short form spends its 150 characters avoiding.

## Copy review — two independent passes, 2026-08-20

Reviewed against two stated principles: does it read like a professional
game-notes nugget (STATS Inc./Elias/club media relations), and does it read as
beat-writer prose rather than AI, without being hokey. Two reviewers, run blind
to each other. They converged on almost everything.

### Two real errors, not style

1. **`chase` was used to mean "swing."** Sub-family A is built on `chase`
   meaning "swing at a pitch OUT of the zone." Family C's prose said a
   curveball "misses 43.3% of the bats that chase it," where the denominator is
   all swings. That makes one word mean two things inside one product.
   **Ban `chase` as a synonym for `swing` everywhere in this family.**
2. **"Newcomb gets pulled on just 33.3%."** *Get pulled* means removed from the
   game. Every reader parses it that way for half a beat. **Never use `pulled`
   with a pitcher as its subject.**

Also broken: `hits 29.9% on the ground` is not English — it reads as a batting
average for two words. Use `puts 30% of his batted balls on the ground`.

### The rules that came out of it

- **Round rate percentages. No decimals.** Decimals belong on averages, ERA,
  mph, pitches per inning — which is exactly what shipped copy already does
  (`21.4 pitches per inning`, `4.1 foul balls a game`). `vsTeamNote.js:56`
  already ships the helper: `` const pct = (rate) => `${Math.round(rate * 100)}%` ``.
  Reuse it. Mixing registers inside one sentence (`41.5%`, then `30%`, then
  `12%`) was the single loudest "this came out of a dataframe" tell in the batch.
- **One construction for the league baseline**, matching shipped voice:
  `league average is X`. The draft had three (`against a league mark of`,
  `well over the league rate`, `the wrong end of a league mark of`). A notes
  desk has one and reuses it.
- **Where a rank is available, print the rank instead.** The app already ships
  `MLB's No. 2 pitch-spoiler` and has `rankWorthPrinting`. A rank beats a league
  average in this genre every time.
- **Scope every note `this season`.** Six shipped notes do it; not one draft
  line did, and there is cap headroom for it.
- **Surname only in short forms**, full name on prose first reference —
  `docs/callouts.md:585`. The draft mixed `Perdomo` with `Miguel Vargas`.
- **Kill the `just`/`only` tic.** It appeared in three of six lines. Allow an
  intensifier ONLY when the second number runs opposite to what the sentence has
  set up — make it a condition in the template, not a default word. Then it
  reads as judgment, because it is.
- **Signal polarity in the VERB, never by arithmetic.** The draft used an
  identical construction for a matchup that is bad for the hitter and one that
  is good for him. `McGonigle does not miss it, whiffing on 12%`.
- **Print the sample when it is thin.** The app already does this
  (`Career .312 against the Cardinals (48 AB)`). A rookie's 12% on 40 swings
  needs `(61 swings)` or suppression.
- **Never a dash plus `but`** — the dash already made the turn. One em dash per
  note, maximum.

### Interpretation: allowed, but rationed

The reviewers split here, and the nugget rule won because it matches shipped
voice — `Bullpen watch:`, `Laboring:`, `MLB's No. 2 pitch-spoiler` all
editorialize.

**One interpretive clause per prose form, maximum**, and it must pass this
test: *could this closer be pasted onto any other note in the family?* If yes,
it is filler and it gets cut.

- `Whoever blinks first decides the at-bat` — **CUT.** Fits every note in A and
  half of B. It also breaks its own idiom: whoever blinks first *loses*.
- `One of those two habits has to give` — **CUT.** Same failure, and it is
  false: both numbers can hold all night.
- `He's going to see a lot of them` — **KEEP** (contracted; the draft's
  uncontracted `He is` is not how a note reads). It only works when the
  pitcher's best pitch is this hitter's worst, so it cannot migrate, and it
  tells the scorekeeper what to watch in the next three minutes.
- `he makes a pitcher come to him` — **KEEP** as A's one clause, inside
  sentence 1. A then gets no closer.

Expect roughly a third of the family to have no third sentence. A note with
nothing extra to say should stop.

### The drone problem — rotate the SHAPE, not the words

Every note in three sub-families is the same seesaw: subject A, stat A, dash,
subject B, stat B. Nine innings across two slots plus a between-innings card is
15+ impressions of one rhetorical figure, and the reader stops reading words and
starts reading shape. The fix is syntax, not vocabulary. Three joiners, rotated
deterministically by note index so no two adjacent notes share a shape:

1. **Em dash** — only when the second clause is CONTEXT for the first (a league
   average, a sample). Never to introduce a second subject.
2. **Semicolon** — the true parallel, both clauses taking the same verb.
3. **Two sentences with a named turn** — the asymmetric case, where one side is
   the outlier. `McGonigle is the exception: he whiffs on 12%.`

Two further variations worth building as alternate templates:

- **Halve the number density.** Give one stat and name the other side's intent:
  `Perdomo has swung at 21% of the pitches he's seen out of the zone this
  season. Tolle needs him to.` One number instead of two. Run it on roughly a
  third of firings.
- **Label register**, which the app already owns via `Bullpen watch:` /
  `Laboring:` — `Curveball night: Nola throws it a third of the time, 43%
  whiff. Caissie whiffs on 57%.` Completely different silhouette on the page.

Supporting mechanic: **vary precision by magnitude** — rates over 50 round to
whole, a rate near a clean fraction gets words (`a third of the time`). Applying
one rule uniformly is what makes copy feel templated; keying it to the number's
own size is what a person does without thinking.

### The cap problem the reviewers could not see

Both reviewed SENTENCES. The app generates TEMPLATES with variable-length name
slots, and the improved, properly-scoped forms run 118–145 characters against a
150 cap. Measured against real name pairs, the best C-family shape overflows:

| pitcher / batter | 145-char shape | 136-char shape |
| --- | --- | --- |
| Nola / Caissie | 145 | 136 |
| Skenes / McGonigle | 149 | 140 |
| Yamamoto / Guerrero Jr. | **154** | 145 |
| Crow-Armstrong / Witt Jr. | **156** | 147 |
| Yoshinobu Yamamoto / Vladimir Guerrero Jr. | **173** | **164** |

**So the builder must be length-aware**, with a documented drop order rather
than a truncation: drop the league-average clause first, then the sample
parenthetical, then fall back to the short parallel shape. Same graceful-
degradation discipline the MiLB selectors already use. Do NOT solve this by
raising the cap — 150 is the measured ceiling of the existing strip.

### Not doing: a tap-to-open gloss

Considered and dropped. `StatcastPercentiles`' flipped back face works there
because the gloss is a fixed definition of a metric. Here the gloss is
per-matchup prose, so it would be a third rendering path for a string the
lineup page already shows in full.

## Open decisions

1. **Which of the three families ship first?** C (arsenal) is the most striking
   and the most work. A and B share one code path and are cheap.
   **Working default: A and B together, C as a follow-up.**
2. **BA display.** Confirm it prints only as color behind a whiff-triggered
   note, never as its own trigger. **Working default: yes.**

## Reproduction

The probe scripts behind every number above were throwaway and live only in the
session scratchpad. The durable part — endpoint URLs, column names, the
selection ids that blank silently, and the measured baselines — is recorded
above. Re-probe before implementing; Savant is undocumented and renames columns
without notice.
