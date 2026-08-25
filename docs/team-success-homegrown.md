# Where the roster came from, and postseason depth

Research spike, 2026-08-25. Second factor spike under
`docs/team-success-research.md`. Reuses the homegrown-vs-acquired classifier
built for an earlier, separate research program
(`docs/homegrown-dependence.md`, prospect development) rather than rebuilding
it — this spike is new analysis over an existing measure, joined against a
different outcome.

**The question.** Relative to the rest of the league, does a team built more
on its own homegrown players (versus players acquired from elsewhere)
correlate with going further in the postseason? And does it separate the
teams that win their division outright from the ones that sneak in on a
wild card?

**The answers, in order of how much weight they carry.**

1. **No, not on the main question.** Homegrown share does not clearly
   predict how far a postseason team goes. The correlation against the outcome
   ladder is small and does not clear conventional statistical significance
   (permutation p=0.07 to 0.23, depending on the cut), even though it points
   the same direction in every one of 19 leave-one-season-out refits. Read
   that combination plainly: a persistent but very weak signal, not a proven
   effect.
2. **But it separates division winners from wild-card teams — and this is
   the mirror image of what the roster-age spike found.** Among the 178
   team-seasons that made the postseason, division winners ran about **5
   percentage points more homegrown** than wild-card teams, on both the
   hitting and pitching side, and both differences clear conventional
   significance (p=0.04). The age spike found the *opposite* pattern — age
   separated "made it" from "didn't" but said nothing about division winner
   vs. wild card. Homegrown share does the reverse: nothing about "made it"
   or "how far," something about "how you got there."
3. **Checking who actually played in October changes nothing.** Reweighting
   each postseason team's homegrown share by real postseason playing time,
   instead of full-season role, moves the number by less than a percentage
   point and does not turn the null into a finding.
4. **This extends, rather than contradicts, the earlier finding that
   homegrown dependence does not predict regular-season win percentage**
   (`docs/homegrown-dependence.md`). That spike found dependence roughly
   irrelevant to winning games; this one finds it roughly irrelevant to
   winning *rounds* too, with one exception — it still says something about
   which KIND of postseason team you were.

## What "homegrown" means here

Unchanged from the prospect-development spike, reused verbatim: **player P
is homegrown to organization X if and only if X is the parent organization
of P's first professional minor-league season.** `homegrownShare` is the
share of an organization's MLB playing time (plate appearances for hitters,
batters faced for pitchers) contributed by such players in a given season.
`homegrownShareHit` and `homegrownSharePit` are the same split by side of the
ball — split the same way the roster-age spike split batting and pitching,
since that spike found the two sides told different stories.

Full method, coverage rate (99.1% of players resolved), and the traps that
went into building this measure are in `docs/homegrown-dependence.md` — not
repeated here. Nothing about the classifier changed for this spike.

## The data, and the gap the caveat has to state up front

**570 team-seasons, 2004-2023, excluding 2020** (600 with 2020 included; the
figures move by less than a point either way — see the sensitivity numbers
in the script output). This is smaller than the roster-age spike's 750,
because `homegrown-panel.json` was built for a different research program
with its own season window (2004-2023) that does not reach the full
2000-2025 ladder. **Six seasons at each end of the ladder's window — 2000-2003
and 2024-2025 — have no homegrown-share row at all**, and are silently
dropped by the join rather than backfilled. Extending the classifier's own
pull to cover them would mean new statsapi calls this spike did not make.

## The result

```
570 team-seasons, 2004-2023 excluding 2020

Spearman rho vs. the 0-5 ladder (permutation p, 5,000 draws, shuffled WITHIN season):
  homegrownShare      rho=0.0747   p=0.0714   same sign in 19/19 leave-one-season-out refits
  homegrownShareHit   rho=0.0633   p=0.1332   same sign in 19/19 leave-one-season-out refits
  homegrownSharePit   rho=0.0494   p=0.2262   same sign in 19/19 leave-one-season-out refits
```

None of the three clears the conventional p<0.05 bar. For comparison,
roster-age's weakest correlation on the same test was rho=0.205 — this
effect, if it exists at all, is roughly a third the size and well within
the range where 570 team-seasons cannot tell it apart from noise.

**Band comparisons** (mean homegrown share, by how far a team went):

| Cut | Hitting share | Pitching share |
| --- | --- | --- |
| Made the postseason at all (n=178) vs. did not (n=392) | 41.9% vs. 39.8% (diff +2.1pp, p=0.15) | 38.3% vs. 36.8% (diff +1.5pp, p=0.29) |
| Reached the LCS or better (n=76) vs. did not (n=494) | 41.3% vs. 40.3% (diff +1.0pp, p=0.61) | 39.6% vs. 36.9% (diff +2.7pp, p=0.14) |
| Won the World Series (n=19) vs. everyone else (n=551) | 41.6% vs. 40.4% (diff +1.2pp, p=0.73) | 35.0% vs. 37.3% (diff **−2.3pp**, p=0.50) |

Every one of these six comparisons is a null at conventional significance.
The World Series row's pitching share even runs the opposite sign from
everything else in the table — with only 19 champions in the sample, that
sign flip is well inside what a small, noisy group can produce on its own,
not a separate finding.

**Division winners vs. wild-card teams, restricted to the 178 clubs that
already made the postseason:**

| | Division winners (n=114) | Wild card (n=64) | diff | permutation p |
| --- | --- | --- | --- | --- |
| Hitting share | 43.7% | 38.6% | +5.1pp | **0.0416** |
| Pitching share | 40.1% | 35.0% | +5.2pp | **0.0374** |

Both clear p<0.05. This is the one clean, positive result in this spike, and
it holds up on both sides of the ball at almost the same size (about 5
percentage points either way) — a division winner's roster ran meaningfully
more homegrown than a wild-card team's roster, among teams that both made
the tournament.

## Does checking real October playing time change any of this?

Reweighting each of the 178 postseason teams' homegrown share by who actually
batted or pitched in their postseason games, instead of by full-season role
— the same check the roster-age spike ran, using the same reusable
postseason-usage primitive (`docs/team-success-postseason-usage.md`) and its
required volume-share control:

```
178 postseason team-seasons, 2004-2023 excluding 2020
first-pro-org resolved for 1,850/1,867 distinct players referenced (99.1%),
  covering 4,455/4,486 PA/IP-weighted playing-time references (99.3%)

  postseasonHomegrownShareHit   RAW rho=-0.0068  p=0.9264   CONTROLLED partial rho=-0.0944  p=0.2102
  postseasonHomegrownSharePit   RAW rho= 0.0600  p=0.3996   CONTROLLED partial rho= 0.0398  p=0.5802
  postseasonHomegrownShare      RAW rho= 0.0362  p=0.6264   CONTROLLED partial rho=-0.0332  p=0.6460

  postseason-actual share minus full-season share, mean: hitting -0.19pp, pitching +0.81pp
```

Two things follow. First, the average team's postseason-actual homegrown
share is within a point of its full-season share — the players who actually
took the field in October were not a meaningfully more or less homegrown
group than the full-season roster, so the (already weak) full-season measure
is not being distorted by unused trade-deadline additions sitting on the
roster without playing. Second, the postseason-actual correlations against
the ladder, run with the required volume-share control from the trap this
program already learned once (`docs/team-success-postseason-usage.md`), stay
null across the board — nothing here turns the already-weak signal into a
real one.

The wonDivision comparison above was not rerun at postseason-actual
resolution, since it is defined the same way in both cases and the
full-season version already has the larger, more reliable sample (234
postseason teams vs. this check's 178, once further restricted to players this
measure can resolve).

## What this does not settle

- **The overall correlation against the ladder is weak and does not clear
  significance — this is a genuine null for the main question asked, but not
  as tight a null as the earlier win-percentage result.** rho≈0.05-0.07 with
  p in the 0.07-0.23 range leaves real room for a small true effect this
  sample cannot resolve, unlike the near-zero, tightly-bounded win-percentage
  interval in `docs/homegrown-dependence.md`.
- **The wonDivision result is the single most interesting number in this
  spike, and it is also the one place multiple comparisons matters most.**
  Eight band/split comparisons were run in total (six band cuts, two
  wonDivision cuts); two came back under p=0.05, both on the same
  comparison (hitting and pitching moving together on the SAME
  division-winner cut, not two independent tests turning up significant by
  chance across unrelated cuts). That is reassuring — a real effect should
  show up on both sides of the roster — but a single a priori test on this
  exact cut, run once rather than as one of eight, would be the stronger
  version of this claim.
- **The panel's own season window (2004-2023) is six years narrower on each
  end than the ladder's (2000-2025)**, so this spike's usable sample (570-600
  team-seasons) is meaningfully smaller than roster age's 750. See the
  reusable trap added to `src/lib/research/contenderDiary/standingNotes.js`.
- **No payroll control**, same gap as every other spike in this program —
  `docs/team-success-research.md`'s payroll factor is still blocked on a
  data source.
- **Nothing here is causal.** A division winner having a more homegrown
  roster could mean a stable, successful core stays together long enough to
  win a division outright before anyone needs to trade for reinforcements —
  or it could mean an unrelated organizational-quality trait (patient player
  development, roster stability generally) drives both the homegrown share
  and the division title independently. This spike cannot separate those.
- **This measure inherits every limitation of the underlying classifier**,
  including the ~1% of playing time that cannot be resolved to a first
  professional organization at all (`docs/homegrown-dependence.md`).

## What would move this next

- **A single, preregistered refit of the wonDivision result alone**, rather
  than reading it as the standout among eight comparisons — the cleanest way
  to know whether it is real.
- **Extending the classifier's own pull to 2000-2003 and 2024-2025**, closing
  the season-window gap with the ladder, if the cost of the additional
  statsapi sweep (six calls per newly-covered player) is judged worth it.
- **A joint model with roster age** (`docs/team-success-roster-age.md`) —
  both spikes only checked one factor at a time; whether homegrown share adds
  anything once age is already accounted for (or vice versa) is unanswered.
- **A payroll control**, if a historical source is ever found — same
  standing item as every other spike here.

## Where the work lives

`.scratch/team-success/`:
- **`analyze-homegrown.mjs`** — the whole spike. Joins
  `.scratch/level-benchmarks/homegrown-panel.json` (built and owned by the
  prospect-development program, not this one) against this program's own
  `outcome-ladder.json`: Spearman correlation, the within-season permutation
  test, leave-one-season-out, the band/division-winner comparisons, and the
  2020-included sensitivity check. The stretch section reuses
  `postseason-usage.json` plus the classifier's own cached intermediate files
  — `.scratch/level-benchmarks/milb-mlb-cache.json` and `orgmap-wide.json` —
  to resolve postseason players' first-pro-org and recompute a
  postseason-actual homegrown share, with zero new statsapi calls (both
  caches already existed from the classifier's original build). Run: `node
  .scratch/team-success/analyze-homegrown.mjs`.
- No new data was pulled for this spike — everything above was already
  cached from the homegrown-dependence spike's own build, plus this
  program's existing `outcome-ladder.json` and `postseason-usage.json`.
