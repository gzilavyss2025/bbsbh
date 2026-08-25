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
subset of `madePlayoffs` — there's no case to reconcile there.

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
most useful findings to compare **broad bands** (playoff vs. non-playoff, or
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
| Trades / player acquisition | in-season trade WAR added, deadline activity | `trade-deadline/{year}.json` (deadline window only, 2000s+ per its own floor), `team-transactions/{season}/{teamId}.json` (full-season roster moves) | Not started |
| Payroll (adjusted) | Opening Day payroll ÷ that year's league-average payroll | **Gap.** `salaries.json`/`team-contracts/` are a CURRENT snapshot (Contracts tab), not a historical time series. statsapi carries no historical salary data. This factor needs an external source (e.g. a public payroll archive) before it can be built at all — flag this honestly rather than fake a proxy. | Blocked on a data source |
| Injuries | team-season "WAR lost to IL time," weighted by the hurt player's value | `rehab.json` is a current snapshot only; historical IL stints would come from the `transactions` endpoint's status-change entries, joined to `war-history` for the lost player's value. Buildable, not built. | Not started |
| Diversity of star players | count of All-Stars/top-WAR players per roster; how concentrated team WAR was in its top 1-2 players vs. spread across 8+ | `all-star-rosters.json` (back to 1933), `awards-history.json`, `war-history/` | Not started |
| Where their best players played (homegrown vs. acquired) | parent-org-at-first-pro-season classification, reused directly from the prospect research line | The homegrown-dependence spike (`docs/homegrown-dependence.md`) already built and validated this exact classifier — reuse its method and cached data, don't rebuild it. That spike's own finding was that homegrown DEPENDENCE doesn't predict a team's regular-season win total; this program asks the postseason-ladder question instead, which is a different outcome variable over the same classifier | **Done** — `docs/team-success-homegrown.md`. Does not predict postseason depth (weak, not significant), but DOES separate division winners from wild-card teams among playoff clubs (+5pp both sides of the ball, p<0.05) — the mirror image of the age spike's null on that same cut. Open follow-up: a joint model with roster age |
| Age of team | PA-weighted batter age, IP-weighted pitcher age, season-average | Built from statsapi's own per-team-stint `stat.age`, PA/IP-weighted | **Done** — `docs/team-success-roster-age.md`. Real, modest, likely-partly-circular effect (older teams go deeper, especially pitching staffs; age doesn't separate division winners from wild cards). Biggest open follow-up: a pre-trade-deadline age cut, to separate a genuine age effect from contending teams simply renting veterans |

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
- **State statistical significance in win-shares-of-doubt terms in the
  entry text**, formal numbers folded behind the `technical` disclosure — the
  two rules in `docs/agents/contender-diary.md` govern voice; this document
  governs method only.

## Planned order of spikes

Not committed, just a reasoned starting point — revise this list as spikes
land or a factor turns out to need more groundwork than expected:

1. ~~**Age of team**~~ — done, `docs/team-success-roster-age.md`. Proved the
   pipeline end to end and surfaced a real (if likely partly circular) effect.
   Its own best follow-up — a pre-trade-deadline age cut — is a strong
   candidate for the NEXT spike, ahead of the rest of this list, precisely
   because it would tell a real age effect apart from teams simply renting
   veterans once they're already winning.
2. ~~**Where their best players played**~~ — done, `docs/team-success-homegrown.md`.
   Reused the existing classifier as-is; a null on postseason depth, but a
   real, if secondary, division-winner-vs-wild-card split (opposite pattern
   from the age spike). Best open follow-up: a joint model with roster age,
   to see whether either factor still carries weight once the other is
   controlled for.
3. **Diversity of star players** (WAR concentration) — data already sitting
   in `war-history/`/`all-star-rosters.json`, just needs the per-team-season
   aggregation built.
4. **Trades / acquisition** — two partially-overlapping sources
   (`trade-deadline/`, `team-transactions/`) need reconciling into one
   team-season "value acquired in-season" number first.
5. **Injuries** — needs a new IL-stint sweep off the transactions endpoint;
   heavier lift than the above.
6. **Situational rosters / roster construction** — richest data
   (`team-records/`) but the least obvious single number to regress; likely
   needs its own sub-framework before a spike can run.
7. **Payroll (adjusted)** — blocked until a historical payroll source is
   found; revisit if/when one turns up rather than approximating with
   current-season salary data pretending to be historical.

## Where the work lives

Worktree `bbsbh-contender-diary`, branch `claude/contender-diary-framework`.
Pipeline scripts (not app code, same convention as `.scratch/level-benchmarks/`)
in `.scratch/team-success/` — `build-outcome-ladder.mjs` and its output
`outcome-ladder.json` today; each future spike adds its own script and cached
pull there. The diary itself: `src/lib/research/contenderDiary/`,
rendered at `/admin/contenders` by `src/screens/contenders/ContenderDiaryPage.jsx`.
