# The Contender Diary — team-success research framework

A companion research program to the prospect-development spikes
(`docs/agents/research-diary.md`), asking a different question: not "how does
a player develop," but **"what do the teams that go deep in October actually
have in common?"** Findings land at `/admin/contenders` (admin-only, same
Clerk gate as `/admin/research`); this document is the method behind them —
read `docs/agents/contender-diary.md` first if you're adding an entry.

This document is the framework itself: what "success" means here, the season
window, the full factor catalog and where each one stands, and the
statistical approach every spike should follow. It gets revised as the
program's scope changes; a finished SPIKE gets its own `docs/*.md` the same
way the prospect spikes do, and a summary entry in the diary.

## The outcome ladder

Six questions (A-F in the commissioning ask) collapse into one ordinal
variable plus one separate flag, because five of them nest and one doesn't.

**The ladder (0-5), per team-season** — each rung implies every rung below it:

| Rung | Meaning | Corresponds to |
| --- | --- | --- |
| 0 | Did not make the postseason | — |
| 1 | Made the postseason (A), lost its first series | A |
| 2 | Won at least one round (C), did not reach the LCS | C |
| 3 | Reached the LCS (D), lost it | D |
| 4 | Reached the World Series (E), lost it | E |
| 5 | Won the World Series (F) | F |

Rung 2 is structurally empty before 2012 — pre-2012, winning your only round
(there was no separate Wild Card round) put you straight into the LCS, so
"won a round but didn't reach the LCS" could not happen yet. That's a fact
about the bracket shape, not a bug in the ladder.

**Division-winning (B) is NOT a rung.** A wild-card team can outlast a
division winner — 2014 Royals, 2002 Angels, 2015 Royals(won it all) — so B
does not nest inside the 0-5 axis. It is stored as its own boolean,
`wonDivision`, and analyzed as a covariate/subgroup split ("does a factor
separate the three division winners in a league from the three-to-six
wild-card teams," a genuinely different question from "does it separate deep
runs from early exits").

No division winner has ever missed the postseason (a division title has
guaranteed a berth since divisional play began), so `wonDivision` is always a
subset of `madePostseason` — there's no case to reconcile there.

**Built and checked in:** `.scratch/team-success/build-outcome-ladder.mjs` →
`.scratch/team-success/outcome-ladder.json`. Reads
`public/data/postseason-history.json` alone — no new statsapi pull. That
file already carries each postseason participant's 1-6 seed (from the
generator's own standings-derived `divisionChamp` logic), and there have been
exactly 3 divisions per league every year since 2000, so seed ≤ 3 is a
format-independent stand-in for "won the division" across every bracket shape
in the window (verified against the committed file: 2000-2011 four
teams/league, 2012-2021 five/league, 2022+ six/league — checked with
`node -e` against real seasons before relying on it). A team absent from a
season's bracket entirely gets rung 0 and `wonDivision: false`; all 30 current
franchise ids have existed, at their current id, since before 2000 (last
expansion 1998), so no expansion-era membership logic is needed.

Run count as of this writing: 26 seasons (2000-2025) × 30 teams = 780
team-seasons. Rung counts: [530, 124, 22, 52, 26, 26] for rungs 0-5 — the 52 /
26 / 26 are exact (2 LCS losers, 1 WS loser, 1 champion per season × 26
seasons), which is the sanity check that the script is counting correctly.

## The season window, and what it costs

**2000-2025.** Floor set by `postseason-history.json`'s own `EARLIEST_YEAR`
(reuse, don't re-derive) rather than a new choice — extending the window
backward would mean building bracket/seed data from scratch for a
pre-2000 era this app has no other reason to hold.

Three bracket formats sit inside that window and every spike needs an era
control, not just a pooled regression:

- **2000-2011** — straight to the Division Series, 1 wild card/league.
- **2012-2019, 2021** — a single win-or-go-home Wild Card game, 2/league.
- **2020** — pandemic-shortened (60 games) AND an expanded 16-team field
  (8/league). Flagged `shortSeason: true` in the ladder data. Treat this year
  as its own dummy or drop it per-spike — a 60-game sample distorts anything
  measured in a rate stat, and an 8-team bracket makes "won a round" far
  easier to reach than in any other year in the window.
- **2022-2025** — the current 12-team field, a best-of-3 Wild Card round,
  3/league.

**Statistical power is thin at the top rungs by construction.** There is one
World Series winner per year — 26 across the whole window. Any factor spike
that slices down to rung 5 alone (payroll rank of the *champion*, say) is
looking at n≈26, and a single outlier season moves the average a lot. Expect
most useful findings to compare **broad bands** (postseason vs. non-postseason, or
"reached the LCS or better" vs. everyone else) rather than isolate rung 5
alone, and expect the LCS-or-better band (n=104) to be the most powerful
practical cut. Say the n out loud in every entry — this is the single most
likely way this research overclaims.

## The factor catalog

Each row: what's asked, what would measure it, whether the raw data already
lives in this repo, and its status. "Assembled" means a pipeline exists and
produces team-season numbers; nothing below has been regressed against the
ladder yet as of this writing (2026-08-25) — that is deliberately the NEXT
phase, spike by spike, not part of standing up the framework itself.

| Factor (from the commissioning ask) | Candidate measure | Data already here? | Status |
| --- | --- | --- | --- |
| Situational rosters | bench/bullpen depth, platoon splits used, pinch-hit frequency | `team-records/{season}/{teamId}.json` (per-game situational ledger) | Not started |
| Roster construction | positional WAR distribution, starter/reliever split, lineup vs. bench WAR share | `war-history/`, `war.json` | Not started |
| Trades / player acquisition | in-season trade WAR added, deadline activity | `trade-deadline/{year}.json` (deadline window only, 2000s+ per its own floor), `team-transactions/{season}/{teamId}.json` (full-season roster moves) | **Done, bounded** — `docs/team-success-trade-deadline-value.md`. Deadline-only (2021-2025, 150 team-seasons — the thinnest window in this program; the full-season `team-transactions/` reconciliation is still not attempted). Net WAR acquired at the deadline tracks the outcome ladder strongly and survives every stress test, but an independent recheck could not confirm whether that link is the deadline itself or just good teams being the ones who shop — two equally defensible controls bracket the true effect from near-zero to near-full, so that half of the question is open, not settled |
| Payroll (adjusted) | Opening Day payroll ÷ that year's league-average payroll | **Gap.** `salaries.json`/`team-contracts/` are a CURRENT snapshot (Contracts tab), not a historical time series. statsapi carries no historical salary data. This factor needs an external source (e.g. a public payroll archive) before it can be built at all — flag this honestly rather than fake a proxy. | Blocked on a data source |
| Injuries | team-season "WAR lost to IL time," weighted by the hurt player's value | `rehab.json` is a current snapshot only; historical IL stints would come from the `transactions` endpoint's status-change entries, joined to `war-history` for the lost player's value. Buildable, not built. | Not started |
| Diversity of star players | count of All-Stars/top-WAR players per roster; how concentrated team WAR was in its top 1-2 players vs. spread across 8+ | `all-star-rosters.json` (back to 1933), `awards-history.json`, `war-history/` | **Done** — `docs/team-success-star-diversity.md`. A spread-out lineup is a real, sizable edge for MAKING the postseason (this program's strongest correlation to date on the hitting side); pitching concentration barely matters. Neither side separates division winners from wild-card teams. Ran on 2010-2025, which was `war-history`'s own floor at the time; that floor is now **1901**, so a refit on the full ladder window (about 750 team-seasons, up from 450) is the cheapest re-test. The joint model refit this on the wider window and confirmed it holds — see `docs/team-success-joint-model.md`. A follow-up checked the same idea through All-Star/award recognition instead of WAR (`docs/team-success-star-diversity-awards.md`): the sign matches at first glance, but fails the program's own breadth-confound check and reverses once held fixed — the WAR-based finding above is unaffected and remains the one to trust |
| Where their best players played (homegrown vs. acquired) | parent-org-at-first-pro-season classification, reused directly from the prospect research line | The homegrown-dependence spike (`docs/homegrown-dependence.md`) already built and validated this exact classifier — reuse its method and cached data, don't rebuild it. That spike's own finding was that homegrown DEPENDENCE doesn't predict a team's regular-season win total; this program asks the postseason-ladder question instead, which is a different outcome variable over the same classifier | **Done** — `docs/team-success-homegrown.md`. Does not predict postseason depth (weak, not significant), but DOES separate division winners from wild-card teams among postseason clubs (+5pp both sides of the ball, p<0.05) — the mirror image of the age spike's null on that same cut. The joint model confirmed this null does not change under joint control, and that the division-winner split gets slightly STRONGER — see `docs/team-success-joint-model.md` |
| Age of team | PA-weighted batter age, IP-weighted pitcher age, season-average | Built from statsapi's own per-team-stint `stat.age`, PA/IP-weighted | **Done** — `docs/team-success-roster-age.md`. Real, modest, likely-partly-circular effect (older teams go deeper, especially pitching staffs; age doesn't separate division winners from wild cards). The joint model found roster age and postseason experience largely overlap (rho +0.58) — see `docs/team-success-joint-model.md`. The pre-trade-deadline age cut flagged above as the next spike is now **done** — `docs/team-success-roster-age-deadline-cut.md`. Pitching age keeps ~74% of its whole-season correlation once deadline pickups are cut out; batting age keeps only ~52%, and the World Series-winner batting comparison shrinks to a shaky one at n=25 either side |
| **Prior postseason experience** (commissioned directly, not in the original ask) | share of a club's regular-season playing time (PA/IP) given to players who had appeared in a postseason game in a STRICTLY EARLIER season, on any club; plus a late-rounds-only variant | Built from the postseason game list 1969-2025 (`gameType=F,D,L,W`) + boxscores, reusing spike #2's `postseason-boxscore-cache.json` and spike #1's `roster-age-cache.json` for the weights — no new regular-season pull | **Done** — `docs/team-success-postseason-experience.md`. A large, robust effect on REACHING the postseason (rho +0.35 batting / +0.37 pitching; ~20pp more experienced playing time than clubs that missed), and a clean, well-powered NULL on advancing once a club is in (rho -0.02 / +0.02 across 234 postseason clubs). Roughly half the qualifying effect is prior-year continuity, but a within-club test still leaves +0.18/+0.21. Pitching edges batting on raw numbers; the two are indistinguishable under controls. Open follow-up: a player-level version. The joint model found this factor shares over half its predictive power with roster age — see `docs/team-success-joint-model.md` |

| **What is different about the games themselves** (commissioned directly, not in the original ask) | paired same-player, same-season comparisons of October vs. regular season, with BOTH ends of the matchup held: plate discipline, offence, pitch mix and velocity, starter workload; plus better-club win rate over every series against a fair-opponent model | Built from statsapi's `gameType=R` vs `gameType=P` splits (team, player and pitchArsenal endpoints) + the committed `postseason-history.json` bracket | **Done** — `docs/team-success-october-texture.md`. What survives: pitchers throw 0.52 mph harder (0.39 in the newest tracking era), starters go a full inning less than their own regular season and the gap GROWS by era (−0.85 → −1.24 IP), and October hitters walk more (+0.49pp). What does NOT: at-bats are not longer once both ends are held (−0.009, t=−1.05 — the naive +0.037 is a roster fact), the strikeout surge is not settled, the hitting dip's sign flips under a usage floor, and the mix narrowing vanishes above 300 October pitches. Two nulls that matter: the quicker hook does not predict how far a club goes once postseason volume is held, and the better club has won 50.5% of 198 series — against 56.4% from a fair-opponent model, which 198 series cannot tell apart |
| **Organization pipeline behavior** (surfaced by the joint model's fifth signal, not in the original ask) | how long an organization typically keeps a player at Triple-A before his debut, and why a Triple-A stay ends (merit vs. injury/roster-rule/trade) | `docs/price-the-blockage.md`'s 962-stay Triple-A cohort (2009-2023); the joint model's own contemporaneous tenure lead (`docs/team-success-joint-model.md`) | **Done, no-ship on both halves.** Giving the joint model's tenure lead genuine temporal separation (only counting debuts before the season it predicts) drops it from +0.298 SD (contemporaneous, p=0.0003) to a non-significant +0.159 SD (lagged, p=0.145) on the best-powered sample, and incumbent depth explains neither the drop nor what's left — `docs/team-success-organization-tenure.md`. A sibling spike asked a different question on the same cohort, whether a farm system's MIX of promotion reasons (clean merit vs. forced) predicts anything: confirmed null on every cut tried, including the Seattle Mariners running the league's highest merit-promotion share and its longest drought — `docs/team-success-exit-reason-mix.md` |
Nothing here is ranked by importance yet — that ranking is itself a question
a first pass over several factors should answer, not an assumption to bake
into the plan.

## Statistical approach

Follow the house style the prospect spikes already established
(`docs/homegrown-dependence.md`, `docs/level-tenure-benchmark.md` are the
reference examples) rather than inventing a new one:

- **Ordinal outcome, not a binary one.** The 0-5 ladder is the dependent
  variable for "how far did this team get" questions; an ordered-logit (or
  ordered-probit) model is the right tool, not a series of separate
  yes/no logistic regressions per rung, which throws away the nesting and
  double-counts teams across cuts. `wonDivision` gets its own plain logistic
  model where a spike asks that separate question.
- **Era must be a control, not an afterthought.** Include the three-format
  era dummy (or drop 2020 outright and say so) in every model — a factor that
  correlates with "postseason expanded" (more teams get in every rung 1-2)
  will look like it predicts success purely from the format changing under
  it if era isn't held fixed.
- **Every factor needs a league-average-relative version**, not a raw number,
  because "average team payroll" and "average team age" both drift over 26
  years of inflation and roster-building trends. Compare a team to its OWN
  season's league average, the same discipline `gen-team-score.mjs` already
  applies to Pythagorean win expectation.
- **Robustness checks are not optional**, per the two rules in
  `docs/agents/contender-diary.md`: a leave-one-org-out or leave-one-season-out
  refit, and a permutation test where the sample supports one. The
  homegrown-dependence spike's own scripts (`.scratch/level-benchmarks/homegrown-*.mjs`)
  are a working template for both.
- **Any measure expressed as a SHARE of a team's postseason activity needs a
  playing-time control.** Total postseason games/innings correlates with the
  ladder at rho≈0.91 by construction (win more rounds, play more games), so a
  raw correlation against the ladder will pick that relationship up before it
  measures anything real — caught spike #1's own follow-up reporting a
  wrong-signed result (`docs/team-success-postseason-usage.md`). Use a
  partial correlation (or equivalent regression control) against total
  postseason volume instead.
- **A reusable primitive exists for "did a player's October role match his
  regular-season role"** — `docs/team-success-postseason-usage.md`'s mismatch
  measure (postseason share of playing time minus regular-season share),
  built once against `public/data/postseason-history.json` + per-game
  boxscores. Any factor spike that touches trades, acquisitions, or
  situational roster use can join against it rather than re-deriving it.
- **A spike that joins more than one factor's panel should query the shared
  database, not hand-roll a new join script.** `scripts/research-db.mjs`
  registers every cached research panel from both diaries as a read-only
  DuckDB view over its JSON file (`docs/agents/research-database.md`). Reuse
  an existing view for the join. Add a new one to the catalog when a spike
  produces a panel worth keeping.
- **State statistical significance in win-shares-of-doubt terms in the
  entry text**, formal numbers folded behind the `technical` disclosure — the
  two rules in `docs/agents/contender-diary.md` govern voice; this document
  governs method only.

## Planned order of spikes

Not committed, just a reasoned starting point — revise this list as spikes
land or a factor turns out to need more groundwork than expected:

1. ~~**Age of team**~~ — done, `docs/team-success-roster-age.md`. Proved the
   pipeline end to end and surfaced a real (if likely partly circular) effect.
   Its own best follow-up — a pre-trade-deadline age cut — is now done, item 8
   below (`docs/team-success-roster-age-deadline-cut.md`).
2. ~~**Where their best players played**~~ — done, `docs/team-success-homegrown.md`.
   Reused the existing classifier as-is; a null on postseason depth, but a
   real, if secondary, division-winner-vs-wild-card split (opposite pattern
   from the age spike). Best open follow-up: a joint model with roster age,
   to see whether either factor still carries weight once the other is
   controlled for.
3. ~~**Diversity of star players**~~ — done, `docs/team-success-star-diversity.md`.
   A real, sizable hitting-side effect on making the postseason (the strongest
   correlation this program has found so far); pitching concentration and
   the wonDivision split both came back null. The joint model (item 6) is
   that follow-up. A second follow-up tried the same idea through recognition
   instead of WAR — item 9 below (`docs/team-success-star-diversity-awards.md`)
   — and did not hold up.
4. ~~**Prior postseason experience**~~ — done,
   `docs/team-success-postseason-experience.md`. Jumped the queue; commissioned
   directly rather than drawn from this list, and added to the factor catalog
   by the spike itself. A large effect on REACHING October and a clean null on
   advancing once there. It also left the program two reusable assets: a
   postseason participation ledger back to **1969** (the app's 2000 floor does
   not bind for player-level postseason history), and the first
   partial-correlation tooling here that takes more than one control at a time
   (`analyze-postseason-experience.mjs`).
5. ~~**October texture**~~ — done, `docs/team-success-october-texture.md`.
   Commissioned directly and out of order, like spike #4. The first spike here
   that does not use the outcome ladder as its main outcome variable: it
   compares the same men in the same year to themselves. It leaves the program
   **four** reusable warnings, three of them learned the hard way when an
   adversarial review killed two of its own first-pass findings:
   (a) a one-sided "his own regular-season rates" baseline measures OPPOSITION
   QUALITY, not a month effect — and so does a raw league-vs-league gap, which
   is the same error with neither side held;
   (b) any statistic that is a MAXIMUM is biased upward in a small postseason
   sample, and a multinomial resample UNDER-corrects it when the underlying
   events cluster (pitches within an outing), so check whether the corrected
   effect is flat in sample size before believing it;
   (c) a null needs a stated alternative and a power figure, or it is a
   statement about the sample rather than about baseball — this spike's
   "October is a coin" only became honest once a fair-opponent model put a
   number (56.4%) on the alternative;
   (d) report an interval, never a leave-one-out range, which has width about
   SE x 2/(n−1) and reads like one.
   It also re-confirmed the postseason-volume confound from spike #1's
   follow-up on a completely different measure.
6. ~~**The joint model**~~ — done, `docs/team-success-joint-model.md`. The
   motivating question has a clean answer: homegrown share's null does NOT
   change under joint control, because it sits close to unrelated to the
   other three factors (VIF 1.06) — nothing was ever masking it. The bigger
   surprise: roster age and postseason experience turn out to be largely the
   SAME signal (rho +0.58), while star diversity and homegrown share stay
   genuinely independent — so the program's four factors reduce to three
   underlying things, not one and not four. Homegrown share's one real
   result (the division-winner split) survives joint control and gets
   slightly stronger. Ran on 570 team-seasons (2004-2023 excluding 2020, the
   intersection of all four panels), up from 420 pre-workflow now that PR
   #912's WAR-floor lift widened the reachable window. Folding in this
   program's other stress-tested findings also surfaced a fifth, unconfirmed
   lead: organization Triple-A tenure predicts the ladder about as strongly
   as roster age, independent of all four factors — reported as a lead, not
   a finding, since the direction of cause and effect is unresolved. That
   lead was tested directly at item 10 below and did not survive being
   forced to predict forward in time. Best open follow-up, shared with
   several other spikes here: a historical
   payroll source, now this program's single largest unmeasured confound.
7. ~~**Trades / acquisition**~~ — done, `docs/team-success-trade-deadline-value.md`.
   Ran narrower than the full catalog question: the deadline window only
   (2021-2025, 150 team-seasons — the smallest sample tried anywhere in this
   program), not the full-season reconciliation with `team-transactions/`
   this item originally called for. The raw link (net WAR acquired at the
   deadline tracks the outcome ladder, rho=0.56) is real and stress-test-proof.
   The harder question — deadline effect or selection effect — came back
   genuinely unresolved: an independent recheck found two equally defensible
   pre-/post-treatment controls bracket the true effect from near-zero to
   near-full, so the write-up reports that half open rather than settled.
   Best open follow-up: the full-season reconciliation this item still calls
   for, and a cleaner "already good" proxy measured on the actual day of the
   deadline rather than a season-end or prior-season stand-in.
8. **Roster age, deadline cut** (extends item 1) — done,
   `docs/team-success-roster-age-deadline-cut.md`. Item 1's own biggest open
   worry, answered directly: cut every trade-deadline pickup out of a team's
   age measure and remeasure through July 31 only. Pitching age keeps about
   three-quarters of its whole-season correlation to the ladder; batting age
   keeps only about half — roughly half of the original batting-age headline
   was a trade-deadline artifact, the pitching-age headline mostly was not.
   The one comparison that flips from significant to shaky: World Series
   winners' batting-age edge, at only 25 champions either side of the cut.
   Confirmed complementary to, not a duplicate of, item 4's postseason-usage
   check — that spike reweights by actual October role and still gives a
   deadline rental his age; this one zeroes him out entirely for having no
   pre-deadline PA/IP with his new club. Best open follow-up: fold this
   correction into item 1's own text, which had guessed this exact question
   was already answered by the usage check.
9. **Star diversity, checked through recognition** (extends item 3) — done,
   `docs/team-success-star-diversity-awards.md`. Tried a second measurement of
   "star" — All-Star and award recognition instead of WAR — on the four
   seasons `awards-history.json` covers. Looked like a second witness at
   first, on both sides of the ball, but failed the breadth-confound check
   this program already knows to run (`docs/team-success-postseason-usage.md`'s
   own lesson): once held fixed against how many players got any recognition
   at all, the pattern reverses. The original WAR-based finding was run
   through the identical check and survives intact. Best open follow-up: fold
   the breadth-confound check directly into future concentration measures
   before a headline is written, not after.
10. **Organization tenure, forced to predict forward** (extends item 6's
   fifth signal) — done, `docs/team-success-organization-tenure.md`. The
   joint model's own "what would move this next" note, answered: give the
   organization Triple-A tenure lead genuine temporal separation (count only
   debuts before the season being predicted) and test it against
   `docs/price-the-blockage.md`'s incumbent-depth measure. The lead does not
   survive — it drops from +0.298 SD (contemporaneous) to a non-significant
   +0.159 SD (lagged) on the best-powered sample — and depth explains neither
   the drop nor what's left, because the two measures are close to
   uncorrelated. No-ship, but not a disproof: a properly lagged measure is
   also a noisier one, so this is a bounded null, not a settled "the effect
   isn't real." Best open follow-up: revisit once more seasons widen the
   lagged sample, and correct item 6's framing, which had marked this exact
   idea "largely superseded" by the usage check before it was actually run.
11. **Exit-reason mix** (sibling of item 10, same Triple-A cohort) — done,
   `docs/team-success-exit-reason-mix.md`. A different angle on the same
   962-stay cohort: not how long a player waits at Triple-A, but why his wait
   ends — a clean merit promotion versus injury, a roster rule, or a trade.
   Confirmed null at every volume cut and every band, sign itself unstable
   across cuts. The Seattle Mariners are the illustrative case: the highest
   merit-promotion share in the cohort, and the longest postseason drought.
   Best open follow-up: whether promoting-at-all (any exit that season, of
   any reason) predicts anything on its own — a pattern this spike noticed on
   verification but did not chase down (org-seasons with zero classified
   exits average a higher ladder rung, p=0.22, not significant but unexamined).
12. **Injuries** — needs a new IL-stint sweep off the transactions endpoint;
   heavier lift than the above. Register the resulting panel in the shared
   catalog (`docs/agents/research-database.md`) once it exists, the same way.
13. **Situational rosters / roster construction** — richest data
   (`team-records/`) but the least obvious single number to regress; likely
   needs its own sub-framework before a spike can run. Register any panel it
   produces in the shared catalog (`docs/agents/research-database.md`) too.
14. **Payroll (adjusted)** — blocked until a historical payroll source is
   found; revisit if/when one turns up rather than approximating with
   current-season salary data pretending to be historical.

## Where the work lives

Worktree `bbsbh-contender-diary`, branch `claude/contender-diary-framework`.
Pipeline scripts (not app code, same convention as `.scratch/level-benchmarks/`)
in `.scratch/team-success/` — `build-outcome-ladder.mjs` and its output
`outcome-ladder.json` today; each future spike adds its own script and cached
pull there. **Not every cached pull belongs in git**: spike #5's raw cache
(70 MB) and assembled panel (51 MB) are deliberately left uncommitted because
they rebuild in about two minutes, unlike the small caches from spikes #1-#4
that other scripts read directly. Commit the distilled findings file, not the
sweep, whenever the sweep runs to tens of megabytes. The diary itself: `src/lib/research/contenderDiary/`,
rendered at `/admin/contenders` by `src/screens/contenders/ContenderDiaryPage.jsx`.
