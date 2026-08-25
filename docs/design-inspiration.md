# Design inspiration — cross-industry patterns mapped to bbsbh's data

Written 2026-08-24 from a five-domain research pass (finance, business/SaaS
analytics, healthcare/actuarial, industrial/scientific, consumer/lifestyle +
data journalism), done deliberately outside sports media — the brief was
**"just because it's sports doesn't mean we can only learn from other sports
sites."** Every finding below is a NAMED, specific external product or
technique, not generic dashboard advice, paired with a concrete mapping to a
type of data this app already has or plausibly could.

**How to use this doc.** Read it before starting a fresh external-research pass
for a new feature idea — extend it rather than re-deriving the same ground.
It is a seed list, not a backlog: nothing here is committed work unless a
`.scratch/` plan or an ADR says otherwise. The one item that graduated into a
real build is noted inline (§8).

---

## 1. Composite score, sub-factors always visible

Credit scorecards (FICO), clinical **NEWS2** (six vitals — resp rate, O2 sat,
BP, pulse, consciousness, temp — rolled into one banded 0–20 score), SaaS
customer health scores (Gainsight), and manufacturing **OEE** (Availability ×
Performance × Quality) all converge on the same move: blend several noisy
inputs into one number, but never hide the breakdown behind it.

- **Pitcher workload score** — ACWR (Acute:Chronic Workload Ratio: last-7-days
  workload ÷ 28-day rolling average; >1.5 flags injury-risk spike, <0.8 flags
  detraining) is a literal, off-the-shelf sports-medicine formula, not an
  invented one — public pitch-count data is enough to compute it.
- **Team "form" score** — recent record + run differential + bullpen usage,
  one number with a visible trend arrow, distinct from the season-long
  standings line (mirrors Oura's daily "readiness" vs. its long-term trend
  view — short-term noise kept separate from the slow signal on purpose).
- **Prospect composite grade** — shown with its hit/power/discipline
  sub-tools inline, the way a credit scorecard refuses to show a score
  without its "why."

## 2. Uncertainty rendered as a shape, not collapsed to one number

NOAA's hurricane "cone of uncertainty" (widens from *historical forecast
error*, not the live track), ensemble spaghetti plots (tight cluster =
confidence, wide spread = real disagreement), clinical forest plots (point +
confidence interval per study, pooled-effect diamond), and FiveThirtyEight's
dot-strip/frequency displays (a probability rendered as countable dots, not
an abstract percentage) all argue for showing disagreement rather than
averaging it away.

- **Playoff-odds trajectory** as a cone that narrows as games remaining
  shrink, instead of a single point estimate.
- **Overlay competing projection systems** (Pythagorean W-L vs. actual vs.
  BaseRuns) as separate lines rather than one blended odds percentage — tight
  agreement vs. spread tells the reader how much to trust the number.
- **Prospect ceiling/floor** as a range per source, not one averaged figure.

## 3. Collection + diary, two lenses on the same logged data

Trading-card collection trackers (Dex, Pocardex — completion % per set,
"N cards to complete this page"), Letterboxd (chronological diary *and* an
auto-generated Year in Review once ≥10 entries exist), Spotify Wrapped
(narrative framing — "how YOU experienced this," not a stats table), and
Duolingo streaks (loss aversion kicks in around day 7; a streak-freeze
mechanic; shared/friend streaks) all solve a version of the same problem: a
personal, timestamped log doubling as both a diary and a completable
collection, from data already captured.

**This is the one item that graduated — see §8, the Game Log milestones
build.**

## 4. Money/value change as a waterfall, not a line

10-K revenue waterfalls (floating bars from cumulative to cumulative), SaaS
MRR movement charts (New/Expansion/Reactivation above zero, Contraction/Churn
below), cap tables (stacked ownership per financing round), and M&A league
tables (ranked, sortable, rank-change arrows) all present change as discrete,
labeled deltas landing at a running total.

- **Transactions wire as a roster-value waterfall** — Additions (trades in,
  call-ups), Breakouts, Injuries, DFAs, landing at a running WAR or payroll
  total, month by month.
- **WAR accumulation across a season** as landing bars per month/stint
  instead of a trend line — legible about *when* value was added or lost, not
  just how much.
- **"Trade partners league table"** per season, reusing existing wire data:
  which front offices traded most, rank-change vs. last season.
- **Payroll allocation on the Contracts tab** as rounds (offseason →
  deadline → arbitration), cap-table style.

## 5. Peer-relative bands beat raw numbers

CDC/WHO pediatric growth-percentile curves, actuarial select-vs-ultimate
mortality tables (a recently underwritten person gets a *different* table for
the first few years — risk isn't static post-selection), EHR flowsheet
reference-range flagging (an out-of-range lab value is flagged inline in the
routine trend table, never a separate report), and Credit Karma/Mint
(every number defaults to trend-vs-your-own-history) all argue a number alone
is close to meaningless without a cohort or personal baseline beside it.

- **Prospect development curves** — age-in-level plotted against the
  percentile band of past prospects at that same age/level.
- **"Regression to cohort" band** on a recent call-up's page — small-sample
  hot-start risk, framed the way select-vs-ultimate tables frame new-signee
  risk.
- **Inline range flagging in stat tables** — a cell outside league-average
  range gets a subtle flag in the routine table itself, not a separate
  percentile page. Ties into the existing `preGameAvg` pattern (a season stat
  updates *during* the game, so the safe comparison point is the number as it
  stood before today — see the "Imports don't prove a spoiler class" memory).

## 6. Fixed coordinate axis, independently toggleable stacked tracks

Genome browsers (UCSC, IGV) stack independently toggleable tracks under one
shared linear coordinate (base-pair position).

- **Rethinking the innings viewer** with innings (0–9+) as the fixed axis and
  pitch count / baserunners / win probability / leverage index as
  independently toggleable tracks snapping to the same inning line — a
  structurally different model than the current per-inning table, not just a
  new chart on the existing one.

## 7. Retention/pipeline funnels

Amplitude/Mixpanel cohort retention heatmaps (rows = cohort start date,
columns = time-since-start, a vertical stripe = an event hitting every cohort
at once) and SaaS onboarding funnels (tapering width = drop-off per stage).

- **Prospect-pipeline funnel** — Drafted → Signed → A → AA → AAA → Debut →
  Established, width shrinking at the real bottleneck (often AA → AAA).
- **Prospect-graduation cohort heatmap** by draft/signing-class year — a
  vertical stripe would flag something hitting every class at once (e.g. the
  2020 draft-shortening).

## 8. Built: Game Log milestones (collection sets)

The first idea out of this catalog to become real work, and worth recording
here as the worked example of "research → decision → build":

- **The conflict.** `docs/game-log.md` and ADR-0036 state, as a deliberate
  design decision, that the Game Log has **no completion state** — "not a
  checklist," never "N of 30," never a progress bar, never congratulation
  copy. Pattern §3 above (collection trackers, Letterboxd) directly
  contradicts that stance.
- **The resolution.** A deliberate, scoped reversal, not a silent one: the
  passport book itself (the pages, the stamp-placement flow) keeps its exact
  keepsake voice — still no badges, still no "Nice!," still no exclamation
  marks. Completion tracking lives on the **retrospective**
  (`/logbook/stats`, already the "add it up" page) as a new, separate
  register: real progress counts and one-time physical-feeling completion
  moments (an animation in the paper-and-kraft-tape palette, not app confetti
  or congratulatory copy) rather than words that praise the reader.
- **The backbone.** Every idea floated for this feature — 30 MLB clubs, 30
  ballparks, a club's full affiliate tree, every team at a level, every park
  in a state, "a perfect inning witnessed in each of the 9 innings," a cycle,
  a no-hitter, an immaculate inning — reduces to one shape: a finite set of
  slots, and a rule for which of a stamped game's facts fills which slot. One
  registry, one generic progress function, one generic display; adding a new
  collection later is a config entry, not new plumbing.
  See `src/api/logbookMilestones.js`.
- **Where it landed, and what moved since.** The slots are now a LEVEL's roster
  rather than the 30 MLB clubs — MLB/AAA/AA/A+/A, off the weekly team snapshot,
  toggled on the sheet itself. And the art outgrew the retrospective: the open
  book's page draws the identical panes (`components/logbook/StampSheet.jsx`,
  via `ClubsSeen.jsx`) with the COUNTS SWITCHED OFF, which is what lets the
  book keep `docs/game-log.md` §1's "not a checklist" rule while sharing the
  stamps. The counting register stays on `/logbook/stats` alone.
- **v1 scope, deliberately narrow.** Team and ballpark collections only — both
  computable from facts the Logbook already resolves per stamp (no new
  fetch). The event-based ones (cycle, no-hitter, immaculate inning, the
  nine-inning set) need full play-by-play per stamped game, which nothing
  currently resolves for a stamp; the clean way to add that without breaking
  the "the local record never stores a score" invariant is a nightly
  precompute (same pattern as `gen-callouts.mjs`) that tags rare events
  league-wide, joined against the user's own stamped gamePks at render time.
  Left for a later pass once this backbone has shipped and proven itself.

---

## Domains searched, and what's still open

Finance (trading terminals, portfolio/risk, quant research), business/SaaS
analytics (BI, growth metrics), healthcare/actuarial (clinical monitoring,
risk scoring, insurance), industrial/scientific (process control, logistics,
weather forecasting), consumer/lifestyle + data journalism (wearables,
streaming personalization, election forecasting, collectible apps). **Not yet
searched, worth a future pass:** gaming/esports analytics (and specifically
achievement/trophy-system design — Xbox Achievements, PlayStation Trophies,
Steam Achievements — which turned out to be the closer fit for the
event-based half of §8 than anything in the original five domains, but wasn't
researched in depth this round), urban planning/civic dashboards,
agriculture/commodity markets, legal/compliance risk dashboards,
education/learning-analytics platforms.

## Other single-domain finds worth revisiting later

- **Bloomberg Terminal register** — bordered, monospace, high-density,
  label-hugs-the-number panels. Any new dense stat panel (a WAR breakdown, an
  umpire zone chart) should match the scorebook's existing paper-ledger
  register rather than softening into a generic app card.
- **Volatility surface, sliceable** — options desks cut a 3D IV surface at a
  fixed strike/expiry. An umpire strike-zone page could do the same: a
  full-season zone surface, sliceable by count / batter handedness / pitch
  type.
- **Correlation heatmap (portfolio)** — hitters × situational splits (vs.
  LHP, RISP, late-inning) as a matrix, surfacing redundant lineup risk (e.g.
  four hitters who all struggle vs. lefties).
- **Bond yield curve / inversion as a signal** — a team's aging/salary curve
  (age or cap hit vs. contract-years-remaining); an "inverted" shape (older
  players owed more, later) visually flags a payroll heading for trouble.
- **Andon boards** — a passive glanceable status light, no one has to be
  watching. Could fit callouts/team-leader surfacing as a persistent badge
  rather than a page you have to visit.
- **SPC control charts (±3σ bands)** — flags "special-cause" variation vs.
  normal noise. Fits per-outing pitcher velocity or umpire zone-accuracy%:
  outings outside the band are a real signal, not noise.
- **Semiconductor wafer yield maps** — spatial defect-pattern vocabulary
  (ring = edge issue, cluster = repeatable hole), applicable beyond the
  already-common strike-zone heatmap to a contact-quality-allowed or
  fielder-positioning map.
- **Balanced scorecard** — four deliberately different-typed panels on one
  view. A club scorecard tab (Payroll/Contracts, Standings, Transactions,
  Farm development) would avoid a page that's twelve versions of the same
  offensive metric.
- **North Star Metric discipline** — not a chart, a design constraint: pick
  one headline number a page rallies around (e.g. run differential over win
  total) rather than listing everything with equal weight.
- **A/B test result card** (lift %, confidence interval, sample size, verdict
  withheld until significant) — a reusable shape for a spoiler-safe
  pre-reveal confidence indicator on a lineup/matchup page.
