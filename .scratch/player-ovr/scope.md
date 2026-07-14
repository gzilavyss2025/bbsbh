# Player OVR / POT — deferred scope

**Status:** parked · discovery only, no implementation scheduled
**Slug:** `player-ovr`

## Idea

Give every MLB and MiLB player two video-game-style ratings, each on a 0–100
scale and calibrated to projected major-league value:

- **OVR** — estimated current MLB ability.
- **POT** — plausible future ceiling.

Example: a strong 19-year-old Double-A prospect might read **OVR 58 · POT 82 ·
confidence: medium · trending up**. An established MLB regular may be **OVR 73
· POT 73**.

## Why two values

One rating would conflate what a prospect can become with what he can help an
MLB club do today. Keeping current ability and future potential distinct makes
the scale legible across levels and gives team-level development scores a
useful common vocabulary.

## Candidate inputs

### MLB OVR

- Results and role-adjusted playing time.
- Underlying quality: Statcast contact, pitching, defense, baserunning.
- Reliability and availability.

### MiLB OVR

- Age relative to league and level.
- Level-normalized performance and workload.
- Scouting grades and prospect rank as priors.
- Tracked contact/stuff quality where coverage exists, never as a universal
  requirement.

### MiLB POT

- MLB Pipeline Top-100 / organization rank, rank history, ETA, and 20–80
  overall/tool grades.
- Age, level, position, draft/international context, and promotion path.
- Performance can update POT gradually; a short hot streak must not cause a
  large jump.

## Scale anchors (to calibrate, not hard-code)

- **50:** fringe MLB ability
- **60:** useful regular / reliever
- **70:** All-Star caliber
- **80:** star
- **90+:** exceptional, scarce player

Every MiLB estimate should include a confidence band or label. The point is an
honest, inspectable estimate, not a false claim of precision.

## Relationship to team scores

This is a later shared substrate, not a prerequisite for the active work:

- MLB team scores can summarize roster OVR plus team performance.
- MiLB Farm Score can summarize affiliate OVR/POT and development outcomes.
- Development Pulse can explain who is gaining or losing OVR/POT recently.

The active priority remains the independent MLB and MiLB team-score designs;
do not block either on a player-rating model.

## Open decisions before implementation

1. What target calibrates OVR: projected WAR, percentile of MLB ability, or a
   hybrid?
2. How should starting pitchers, relievers, and position players be made
   comparable without erasing role value?
3. What public scouting source and update cadence are durable enough to support
   POT?
4. How should uncertainty be displayed and incorporated without making the
   card unreadable?
5. Backtest against prior prospect classes before treating any score as
   predictive.
