# Records: the pick and the spec (S5, S5a to S5e)

**Status:** Picked and approved by Gary on 2026-10-15.
**Board:** https://claude.ai/artifact/8ZsTLDBL5qssA2XhdFvrFD. Page "Round 2 · the pick" holds the
approved card. Page "Round 1 · four directions" holds the options it beat. The board is private to Gary.
**Rows:** audit.md S5 (the index), S5a (the half and month controls), S5b (the group rows),
S5c (the inning grid), S5d (the season counts), S5e (the doors).
**Run:** #1107, ledger #1664.

## The pick

Round 1 drew four directions. Each one used one signature idea from a named player-page card:

1. **Menu rail** (Arsenal card, `MenuRail`)
2. **Count grid** (Foul balls card, `CountExplorer`)
3. **Rank strip** (Percentile rank card)
4. **Scope bar and picks** (Splits card)

Gary picked direction 3 for both parts: the rank-strip index, and the dumbbell for the inning grid.
Round 2 applied the fixes from a design critique, and then a polish pass copied each part from the
live CSS. Gary approved round 2.

What it makes easy to see:

- **The index:** where each group's splits rank among the clubs at the level, all 12 groups on one
  screen, before you open any group.
- **The inning grid:** the gap between the top and the bottom of each inning, on one win-pct axis.

## The card, top to bottom

The card is today's Records content in a new layout. It stays in the Standings band
(`src/screens/team/next/standings/index.jsx`), inside the stamped card that `wrap()` draws now.

| Part | What it is | Repo part | Notes |
| --- | --- | --- | --- |
| Card | Stamped card. The name tab says "Records". The count tag says "12 groups" (158) or "11 groups" (249). | `Card frame="stamped"` with `label` and `count` (`components/ui/frame/Card.jsx`) | Change the tag in `standings/index.jsx` from "win pct" to the group count. |
| Half toggle (S5a) | Three joined 44px buttons: Full season, Pre-All-Star, Post-All-Star. The pressed one is ink. | `Segmented` with `fill` (`components/ui/control/Segmented.jsx`) | It hides when the season has no All-Star date (today's `showHalves`). |
| Month toggle (S5a) | All, then every month played, as joined 44px buttons in two even rows. Columns = the number of buttons divided by 2, rounded up. At 740px and up: one row. | `Segmented` buttons inside `Grid` (`components/ui/layout/Grid.jsx`) | `Segmented` wraps as a flex row today. Two even rows need a grid. Add a `segmented--rows` variant, or put the buttons in `Grid`. It hides when there is only one month (today's `months.length > 1`). |
| Index head | A band across the card: "Group", then "30th … 1st" over the strips, then "N". | The `.table__grid thead` look (`styles/system/table.css`): `--bg-page`, `--text-caption`, display caps | The number in "30th" is the level's club count (`levelSize`). |
| Index line (S5) | One 44px line for each group: a chevron, the group name, the group strip, and the split count. A tap folds the group open in place. Several groups can be open at once. | A `.btn` with `aria-expanded`, plus the fold from `styles/motion/menurail.css` (rows `0fr` to `1fr`, `--dur-unfold`, `--ease-unfold`) | Design.md 14·F: a chevron on a 44px line means "this folds, in place". The line is not a door. |
| Group strip | A 2px ink box, best at the right edge. Each split is a 2px ink tick at its rank. The hollow square is the middle club. The right third (the top-third ranks) has a `--field-soft` wash. | New part, built from the Percentile rank card's bar (`styles/player-next/season/percentile.css`) | ADR-0109: shared parts live in the design system. Lift the bar into `src/components/ui/`. Do not copy it into the team page. |
| Split row (S5b) | Line 1: the label, a door. Line 2: W-L in the display face (`--fs-title-lg`) and the pct in mono (`--fs-cell`). Line 3: the rank, "4 of 30", on its own line. The rank bar sits to the right of lines 2 and 3. | Label: the `.tstatrow__k` + `.trec__rank` look (display caps, `--text-caption`, a dotted `--border-rule` underline). Rank: `.rankmark` for a top-third rank; plain `--text-caption` mono for the others. | At 740px and up, the rows sit in two columns. |
| Rank bar | The Percentile card's bar: a 2px ink box filled from the left to the rank, with a 3px ink tick at the rank and the hollow square at the middle club. Fill: `--field-mint` for ranks 1 to 10, `--clay` for ranks 21 to 30, `--field-soft` between. | The same lifted part as the group strip | The thirds come from the level size, not from a fixed 30. |
| Inning grid (S5c) | A 30px axis head ("Inn", "▲ Top", .500 to .800, "▼ Bot"), then one 48px row for each inning. Left: the top half's W-L over its pct. Right: the bottom half's W-L over its pct. Middle: a win-pct axis from .400 to .900 (values outside it clamp to the edge). ▲ marks the top half above the line, ▼ marks the bottom half below it, and an ink bar joins them. The better half's W-L is `--text-heading`; the other is `--text-caption`. | New part. It replaces `records/InningScoringGrid.jsx`. | A tap on an inning unfolds both halves under the row: a door label ("▲ Top of the 8th"), W-L, pct and the last date with its result, then the rank on its own line. |
| Extras | One row under the innings: "Extra innings · one bucket", W-L, pct, the last date, then the rank. | The split row, one column | Today's rule: extras are one bucket, not split by half. |
| Season counts (S5d) | Group 12 in the index. When open, the same split rows, but each shows the count in place of W-L and pct. | The split row | Design.md 14·E: ledger rows, not `StatTile`. |
| Key | One line at the card foot: tick = one split, hollow square = the middle club, the fill colours for the top third and the bottom third. The inning grid has its own key line for ▲ and ▼. | Natural-case body copy, `--fs-cell` | |

**One meaning per mark.** The hollow square means only "the middle club". ▲ and ▼ mean only "top"
and "bottom" of an inning (the scorebug convention). `--marker` appears only in `.rankmark`.

**Doors (S5e).** Every split label, every count label and every inning-half label opens
`/situational-records` for that metric through `situationalRecordsPath`. Each one carries the half and the
month. **It must also pass `d`.** Today the card passes `s` only (audit.md S5e, route row).

## Data (ADR-0109, decision 5)

- W-L, pct and the last date and result come from `teamRecordsFor(data, { cutoff, half, month })` in
  `src/api/teamRecords.js`, as they do today. The groups come from `RECORD_GROUPS`, and the counts from
  `COUNT_METRICS`.
- **The ranks are new to this card.** The board computes them with `buildRankingIndex` and `rankMetric`
  (`src/api/situationalRecordRankings.js`), the code the ranking page uses. That code needs every club's
  ledger at the level: `fetchLevelTeamRecords` fetches about 30 shards. The card fetches 1 today.
- **Data issue before the build:** the ranks need a source that does not cost the band 30 requests. The
  recommendation is to add the ranks to the nightly records generator (`scripts/gen-*.mjs`, see
  `docs/scripts/generators.md`): one small per-club file, or a field in the club's shard. It holds the rank
  of each metric for each scope: Full, Pre, Post, and each month. The alternative is to buy the 30 shards
  once through `SHARED`, after the band is near the viewport.
- The board ignores one thing that the build must do: the half and the month **combine**. The board
  reset the half when you picked a month, because its data held months for the full season only.

## States, measured at 390px

| | 158 Milwaukee (MLB) | 249 Wilson (Single-A, sportId 14) |
| --- | --- | --- |
| Games counted | 162 | 130 |
| Groups | 12 (11 record groups + Season counts) | 11 (no "By league") |
| Months | All + Mar to Sep: 8 buttons, 4 × 2 | All + Apr to Sep: 7 buttons, 4 + 3 |
| Level size | 30 clubs ("4 of 30") | 30 clubs ("25 of 30") |
| Card closed | 809px | 765px |
| Card with "Scoring by inning" open and one inning unfolded | 1,570px | 1,510px |
| Target closed (design.md section 10) | 826px | 781px |

Degraded states, for the MiLB rule:

- A split with no rank (thin data, or the level has no ranking) reads "—". It draws no tick and no bar fill.
- An inning half with no games reads "—", and the dumbbell draws no mark for that half.
- A group with no rows hides, and its line hides with it.
- No All-Star date: the half toggle hides.
- Only one month: the month toggle hides.
- No ledger (winter, an incomplete ledger): the card is absent, as today (`ledgerIsComplete` in
  `screens/team/data/loadNumbers.js`).

## Wide widths

- **820px:** the half toggle and the months share one row (the months on one row). The index lines are
  14px | 230px | strip | N, at most 860px wide. The split rows sit in two columns. The inning grid is at
  most 720px wide.
- **1180px:** the same layout. The half toggle is 400px wide.
- Nothing needs hover. Every target is 44px or more.

## Motion

- **Stamp-in:** the card drops 4px into its shadow once per page visit. `standings/index.jsx` already gates
  this with `viewKey(team.id, 'team-standings')`.
- **Fold:** a group opens and closes with rows `0fr` to `1fr` on `--dur-unfold` and `--ease-unfold`. The
  chevron turns 180 degrees on the same timing.
- **Rise:** an inning's detail rises 6px and fades in on each tap. A tap is a change the reader causes,
  so it plays every time (docs/motion.md, "The one-shot gate").
- All three are off under reduced motion. The frame strips are on the board's Round 1 page ("Motion").
  Strip 3 is this fold.

## Tokens used

Colour: `--surface-card`, `--surface-row-selected`, `--bg-page`, `--border-stamped`, `--border-hairline`,
`--border-rule`, `--border-grid`, `--ink-0`, `--text-heading`, `--text-caption`, `--text-muted`,
`--text-on-ink`, `--accent-tint`, `--field-soft`, `--field-mint`, `--clay`, `--marker` (in `.rankmark`
only), `--focus-ring`.

Note: the bar fills read `--field-soft`, `--field-mint` and `--clay`, as `percentile.css` does today. When
the bar moves into the design system, give each fill a semantic alias (ADR-0107).

Type: `--font-display`, `--font-display-tag` (count tag only), `--font-mono`, `--fs-title-lg`, `--fs-h3`,
`--fs-ui`, `--fs-label`, `--fs-cell`, `--ls-label`, `--ls-caps`, `--lh-title`.

Space and size: `--tap-min`, `--space-1` to `--space-8`, `--space-1h`, `--space-2h`, `--bw-hair`,
`--bw-heavy`, `--shadow-stamped`, `--stamped-offset`, `--z-sticky`.

Motion: `--dur-stamp-in`, `--ease-stamp-in`, `--dur-unfold`, `--ease-unfold`, `--dur-fast`, `--ease-stamp`.

No `--seal`: this is an open surface (ADR-0034). No `title=`. Square corners.

## What the build replaces

- `records/RecordsCard.jsx`: the pill rows, `RecordRows` and `SeasonCounts` become the index, the split
  rows and the count rows.
- `records/InningScoringGrid.jsx`: replaced by the dumbbell grid.
- `styles/65-team-records.css`: the `.trec*` and `.trecinn*` rules go when the old Numbers tab goes.
  Until then, the old tab still draws today's card, so build the new card beside it.
