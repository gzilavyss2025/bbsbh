# PR 655 Prospect Desk redesign

Status: Approved

Approved by the maintainer on August 10, 2026.

## Purpose

Redesign the prospect surfaces introduced or changed in PR 655. Keep the PR's
data and interaction contracts. Improve hierarchy, responsive use, statistical
context, and visual consistency with Tally's paper-scorebook system.

The approved direction is **Prospect Desk**: a baseball newspaper ledger with
the alignment of a sports statistics menu. Show progression through actual
minor-league levels and promotion events. Do not use fantasy-game ornament,
dark-console styling, fake scouting grades, or unsupported projections.

## Source state

- Pull request: PR 655
- Branch: `claude/prospect-vs-level-dots`
- Reviewed commit: `3f67b41fe6b67edd69e62edcf1184c97ed4b8574`
- Review worktree: `C:\Users\gzilavy\bbsbh-prospect-vs-level`
- Routes: `/prospects`, `/player/815908`, `/player/807739`
- Viewports: 390px, 768px, and 1440px
- The review included the expanded Prospect Card trend.

## Required contracts

Implementation must preserve all of these contracts:

- Fixed MLB Pipeline rank. Filtering must never renumber a player.
- Independent, cumulative team, performance-band, and batter/pitcher filters.
- Separate MLB and MiLB season lines when both apply.
- Level-relative OPS or ERA percentile.
- Sample-size confidence and the player's PA or IP.
- Percentile movement with direction, units, and comparison date.
- Promotion and demotion markers in trend history.
- Age versus level.
- Existing headings, table relationships, links, focus treatment, accessible
  names, `aria-pressed`, `aria-valuetext`, and `aria-expanded` behavior.

## Lead review decisions

### Corrected mobile finding

At 390px, the ledger table is approximately 654px wide inside a 358px
`.ledger-wrap`. The wrapper uses `overflow-x: auto` and accepts its full 296px
horizontal scroll range. The data is not technically clipped or unreachable.

The problem is discovery and context. The horizontal scrollbar is at the end
of a 100-row table. The top of the table has no edge cue or scroll instruction.
Pipeline rank and player identity also leave the viewport before the reader
reaches `LINE` and `VS. LEVEL`.

Keep semantic table markup. On narrow screens, pin the Pipeline rank and player
columns. Let the stat pane scroll. Add a visible edge fade or equivalent cue and
a short `Swipe for stats` instruction. At 768px and 1440px, show the complete
ledger when it fits without reducing core text below the existing small-text
role.

### Filter meaning

Put all filters in one labeled `FILTER PROSPECTS` band. Give each control a
visible label:

- `TEAM`
- `ROLE`
- `PERFORMANCE VS. CURRENT LEVEL`

Do not present a bare `1 2 3 4 5` scale. It resembles a scouting or player
rating. Use neutral band names such as `BOTTOM`, `BELOW`, `MIDDLE`, `ABOVE`, and
`TOP`. If the native range remains, preserve its keyboard behavior. Its visible
and accessible value must use the band name, not `Tier 4`.

Show the result count after each filter change. Show a reset action when any
filter is active.

### Statistical language

Make the exact level-relative result the lead fact. Use this form:

`OPS VS AA - 72ND PERCENTILE`

Follow it with a comparison statement that names the population and sample
floor:

`Top 28% among 569 AA hitters with 40+ PA`

Use the equivalent ERA and innings form for pitchers. Do not use `ELITE FOR
LEVEL`. A single OPS or ERA percentile does not support a whole-player scouting
claim. Use neutral band copy, for example `TOP BAND FOR AA ERA`.

Always show sample confidence with the player's sample:

- `EARLY SAMPLE - 42 PA`
- `BUILDING SAMPLE - 83 PA`
- `ESTABLISHED SAMPLE - 447 PA`

Do not rely on color, opacity, or dot fill to communicate confidence.

Write movement with its unit and a human date:

`UP 9 PERCENTILE POINTS SINCE JUL 26`

### Progression and analysis

Keep `Path to the Majors` factual. It can show reached levels, years, workload,
current assignment, future levels, and the MLB destination. Remove the repeated
current-level percentile from the progression rail. The Prospect Card is the
canonical analysis surface.

Use promotion and demotion events to create the progression feeling in the
trend. Break the trend line when the event changes the comparison population,
or clearly label the population reset. Do not imply that a cross-level change
is improvement against one continuous population.

## Information hierarchy

### Prospects page

1. `TOP 100 PROSPECTS`
2. `MLB Pipeline ranking - Aug 10, 2026`
3. Labeled filter band and result count
4. Fixed Pipeline rank and player identity
5. Current position, level, and team
6. MLB and MiLB season lines
7. Exact performance versus current level
8. Movement, confidence, and source note

Rename `RK` to `PIPELINE RK` so Pipeline rank and Tally's performance measure
do not compete as two unexplained ranks.

### Player page

1. Player identity and Pipeline badge
2. Factual `Path to the Majors`
3. Current season statistics
4. Prospect Performance card
5. Existing game log and supporting sections

### Prospect Performance card

1. Metric, current level, and exact percentile
2. Comparison population and sample floor
3. Labeled percentile track
4. Sample confidence and player sample
5. Movement with percentile-point units
6. Neutral performance band
7. Trend disclosure and chart
8. Age-versus-level fact

## Responsive wireframes

### Mobile, 390px

```text
TOP 100 PROSPECTS
MLB PIPELINE - AUG 10, 2026                  100 SHOWN

FILTER PROSPECTS
TEAM
[ MLB ][ A ][ ATL ][ BAL ][ BOS ]---------------->

ROLE
[ ALL ][ BATTERS ][ PITCHERS ]

PERFORMANCE VS. CURRENT LEVEL
[ ALL - BOTTOM - BELOW - MIDDLE - ABOVE - TOP ]

+- STICKY IDENTITY ---+---- SWIPE STATS --------------+
| RK  PLAYER          | POS  LEVEL  TEAM  2026 LINE... |
+---------------------+--------------------------------+
| 01  JESUS MADE      | SS   AA     MIL                |
|                     | MiLB  .282 - 13 HR - 78 RBI    |
|                     | OPS VS AA - 72ND PCTL - UP 9   |
+---------------------+--------------------------------+
| 13  MAX CLARK       | CF   MLB    DET                |
|                     | MLB   .297 - 1 HR - 7 RBI      |
|                     | MiLB  .276 - 11 HR - 42 RBI    |
+---------------------+--------------------------------+
```

### Desktop, 1440px

```text
TOP 100 PROSPECTS                          MLB PIPELINE - AUG 10, 2026

FILTER PROSPECTS
TEAM [club strip--------------------]  ROLE [ALL|BATTERS|PITCHERS]
VS CURRENT LEVEL [ALL|BOTTOM|BELOW|MIDDLE|ABOVE|TOP]       100 SHOWN

+------------+----------------+-----+-------+------+---------------------+----------------------+
| PIPELINE RK| PLAYER         | POS | LEVEL | TEAM | 2026 LINE           | VS CURRENT LEVEL     |
+------------+----------------+-----+-------+------+---------------------+----------------------+
| 1          | JESUS MADE     | SS  | AA    | MIL  | MiLB .282 - 13 - 78 | 72ND PCTL - UP 9 PT  |
| 13         | MAX CLARK      | CF  | MLB   | DET  | MLB  .297 - 1 - 7   | 64TH PCTL - DOWN 6   |
|            |                |     |       |      | MiLB .276 - 11 - 42 | ABOVE BAND           |
+------------+----------------+-----+-------+------+---------------------+----------------------+
```

### Expanded Prospect Card

```text
+ PROSPECT PERFORMANCE - AA                         #1 MLB PIPELINE +
|                                                                    |
| OPS VS AA                                      72ND PERCENTILE     |
| TOP 28% AMONG 569 AA HITTERS WITH 40+ PA                           |
|                                                                    |
| 0 --------------- 50 / LEVEL MEDIAN -----o------------------ 100  |
|                                                                    |
| SAMPLE       ESTABLISHED - 447 PA                                  |
| MOVEMENT     UP 9 PERCENTILE POINTS SINCE JUL 26                   |
| BAND         TOP BAND FOR AA OPS                                   |
|                                                                    |
| [ HIDE SEASON TREND ]                                              |
| 100 |                                      o 72                    |
|  50 | . . . . . . LEVEL MEDIAN . . . . . . . . . .              |
|   0 |                                                              |
|     APR        MAY        JUN   ^ PROMOTED TO AA       AUG         |
|                                                                    |
| AGE VS. LEVEL                                                      |
| 6.1 YEARS YOUNGER THAN THE AA HITTER COMPARISON GROUP             |
+--------------------------------------------------------------------+
```

On mobile, stack the sample, movement, band, and age facts. The chart must fill
the card width and remain approximately 120px to 140px high. On desktop, use the
available width instead of retaining the current fixed 280px plot.

## Component map

```text
ProspectsPage
|- RankingsHeader
|  |- PageTitle
|  |- PipelineSourceDateline
|  `- ResultsSummary
|- ProspectFilterDeck
|  |- TeamFilterStrip
|  |- PlayerTypeToggle
|  |- VsLevelBandFilter
|  `- ResetFilters
`- ProspectLedger
   |- StickyIdentityColumns
   |  |- PipelineRank
   |  `- PlayerIdentity
   `- ProspectStatColumns
      |- AssignmentCell
      |- SplitStatLines
      `- VsLevelSummary
         |- ExactPercentile
         |- NeutralBand
         `- Movement

PlayerPage
|- PlayerHeader
|- LevelProgressionCard
|  `- LevelMilestone
`- ProspectPerformanceCard
   |- StandingHeadline
   |- PercentileTrack
   |- SampleConfidence
   |- MovementFact
   |- TrendDisclosure
   |  `- SeasonPercentileChart
   |     `- PromotionMarker
   `- AgeVsLevelFact
```

## Visual vocabulary

- Manila paper is the canvas.
- Navy ink carries hierarchy and structure.
- Graphite carries axes, secondary labels, and comparison rules.
- Kraft marks a current assignment or promotion event.
- Green and red describe observed direction or percentile bands only.
- Do not use rarity colors, shields, stars, XP bars, glows, or dark panels.
- Use one percentile-track grammar across the ledger and Prospect Card.
- Use the level rail and real promotion events for progression.

## Typography and rule hierarchy

- Use the condensed uppercase display face for headlines, section flags,
  player names, and labels.
- Use tabular mono type for ranks, lines, percentiles, dates, populations, and
  samples.
- Use the body face for methodological explanations and age context.
- Give player identity and the exact standing the highest weight.
- Give assignment and season lines medium weight.
- Keep source, confidence, and comparison notes quiet but fully readable.
- Use a heavy navy rule for section boundaries.
- Use hairline rules for columns and rows.
- Use a dotted graphite rule only for the 50th-percentile reference.
- Use a dashed trend line only for missing periods.
- Draw promotion markers with text plus shape, never color alone.

Use existing semantic typography, color, spacing, and focus tokens. Do not add
ad hoc sizes or raw colors.

## Interaction guidance

- Keep all filters independent and cumulative.
- Never renumber Pipeline rank.
- Show and announce the result count after filter changes.
- Preserve native range keyboard behavior if the range remains.
- Preserve `aria-pressed` on role controls.
- Preserve `aria-expanded` on the trend disclosure.
- Give the trend disclosure a full touch target.
- Give the chart an accessible name and summary.
- Provide accessible text for promotion, demotion, gap, and population-reset
  events.
- State movement with direction, percentile-point units, and a readable date.
- Do not imply promotion readiness, future value, or projected MLB outcome.

## Acceptance criteria

- At 390px, the ledger has an obvious horizontal-scroll cue. Pipeline rank and
  player identity remain visible while the stat pane scrolls.
- At 768px and 1440px, all columns remain legible without compressed
  utility-sized core text.
- Every row preserves fixed Pipeline rank, player, team, level, position, every
  MLB/MiLB line, level-relative percentile, movement, and confidence.
- Combined team, performance-band, and role filters never renumber players.
- Dual MLB/MiLB lines retain explicit labels and do not imply a changed current
  assignment.
- The filter deck visibly labels all three fields. No bare numeric tier appears
  without meaning.
- The detailed card names the metric, level, percentile, comparison population,
  sample floor, player sample, and as-of context.
- Confidence always includes PA or IP and does not rely on dot fill alone.
- Movement uses percentile-point units and a human date.
- The trend labels its metric, 0/50/100 scale, time range, latest value, gaps,
  and promotion or demotion events.
- A level change breaks the trend line or clearly marks a comparison-population
  reset.
- Age-versus-level remains a factual comparison and never becomes a projection.
- `Path to the Majors` preserves reached, current, future, and MLB states without
  duplicating analytical judgment.
- Existing headings, table relationships, player and team links, focus rings,
  accessible names, `aria-pressed`, `aria-valuetext`, and `aria-expanded`
  remain intact.
- Red, kraft, and green never carry meaning without text or shape.
- Verify promotion markers with a fixture. Neither requested player exercised
  that state during the design review.

## Review validation

The lead and three independent specialist reviews inspected the exact PR branch
at all required widths. The pages rendered meaningful content without a
framework overlay. The Jesus Made page produced an external MiLB cap-logo CORS
warning. The Kade Anderson page produced no console errors.

The review did not change product code.

## Continuation instructions

Read this file before implementation. Then read `AGENTS.md`, the root
`CLAUDE.md`, `src/CLAUDE.md`, and the relevant ADRs. Resume in the PR 655
worktree or create a dependent task branch from the exact PR head. Do not base
the redesign on `origin/main` while PR 655 remains unmerged.

Implementation must remain on a task branch and must use a pull request. Do not
push to `main`. Do not create a Vercel deployment. Validate the exact routes
locally at 390px, 768px, and 1440px.
