# The spacing residue, and the decision the odd band needs

Companion to ADR-0085. That ADR mints the three half-steps, records the sweep,
and lists what the sweep could not reach. This file is the evidence for the one
question it deliberately does not answer: **what to do with the odd
5/7/9/11/13px band.**

Measured on `main` at `ba07d2c9`, 2026-09-22, over the 137 partials in
`src/styles/`. Re-derive with `.scratch/design-system/prC/measure.mjs`. Counts
are of px LITERALS unless a column says declarations — `padding: 6px 10px` is
one declaration and two literals.

## Where the 637 residue literals sit

| band | literals | declarations | state |
| --- | ---: | ---: | --- |
| 1-3px optical nudges | 363 | 348 | exempt under a ceiling (ADR-0085) |
| odd 5/7/9/11/13px | 231 | 222 | **open — this file** |
| one-offs, 18px and up | 43 | 37 | listed; see the last section |

## The finding that reframes the question

The issue asks whether to "round the band to the nearest existing step". After
the three half-steps land, there is no nearest step. The scale between 4 and 16
now reads 4, 6, 8, 10, 12, 14, 16 — every gap is 2px — so **every one of the 231
is an exact tie:**

| value | step below | step above |
| ---: | --- | --- |
| 5px | 4px (−1) | 6px (+1) |
| 7px | 6px (−1) | 8px (+1) |
| 9px | 8px (−1) | 10px (+1) |
| 11px | 10px (−1) | 12px (+1) |
| 13px | 12px (−1) | 14px (+1) |

"Round to the nearest" therefore resolves to nothing. The real choice is a
**direction**, taken once for all 231, or taken 231 times by hand. There is no
third mechanical reading.

## The before and after

Three real surfaces, shot at 390px, under both directions. The variant was
applied to all 137 partials, not only the three, so each shot carries the
compound effect the way a shipped change would.

| | |
| --- | --- |
| `.scratch/design-system/prC/shots/compare-umpire.png` | `/umpire/{id}` — `53-umpire-tendencies.css`, the densest odd-band partial (15 literals in 10 declarations, all four values) |
| `.scratch/design-system/prC/shots/compare-standings.png` | `/standings` — `30-standings.css`, where 9px is HORIZONTAL padding on a table already 358px wide in a 390px viewport |
| `.scratch/design-system/prC/shots/compare-player.png` | `/player/{id}` — `26-player-page.css`, the stat grid and the ledger row |

Reproduce with `.scratch/design-system/prC/` — `variant.mjs down|up`, shoot,
then `git checkout -- src/styles`.

### What the shots show

Nothing. On all three surfaces the three columns are indistinguishable without
measuring. Nothing crowds, nothing breaks, no text reflows, no table overflows.

### What the measurements show

| surface | element | round down | as shipped | round up |
| --- | --- | ---: | ---: | ---: |
| umpire | page height | 6569 | 6583 | 6597 |
| | `.umptend__id` height | 83.3 | 84.3 | 85.3 |
| | `.umptend__tile` height | 67 | 69 | 71 |
| | `.umptend__prov` height | 35 | 37 | 39 |
| | `.umptend__row` width | 302 | 300 | 298 |
| standings | page height | 3227 | 3230 | 3233 |
| | `.standings--full` height | 181 | 181 | 181 |
| | row height | 31 | 31 | 31 |
| | `.standings-jump` width | 98.63 | 100.63 | 102.63 |
| | `.standings-ctrl` height | 142 | 145 | 148 |
| player | page height | 2388 | 2400 | 2412 |
| | `.player__statgrid` height | 58 | 60 | 62 |
| | `.stat` height | 56 | 58 | 60 |

The largest compound move is 14px on a 6583px page — two tenths of one percent.
The standings table does not change height at all: its 9px is horizontal only,
so it moves column widths inside a fixed 358px table and nothing else.

## The decision — made, and DONE

**Decided 2026-09-22: round the whole band DOWN, in one direction, with the
direction fixed once rather than chosen 231 times. Shipped the same day.**

5 to 4, 7 to 6, 9 to 8, 11 to 10, 13 to 12 — 231 literals in 222 declarations
across 63 partials. The residue ledger in `scripts/check-typography.mjs` fell
from 274 entries in 72 partials to **43 in 22**, all of them genuine one-offs.

Everything below is the evidence the decision was made on. It is kept because
the next person to look at a 1px spacing question should be able to see what
was measured, not just what was concluded.

### What the shipped change measured

The prediction was tested rather than trusted. Ten routes at 390px, loaded on
one dev server minutes apart, with the computed padding and gap of every
element recorded in DOM order on both sides:

| | |
| --- | --- |
| computed padding/gap values compared | **3570** |
| values that moved DOWN exactly 1px | **2936** |
| anything else — a property swapped, an axis lost, a value moved the wrong way | **0** |
| console errors, horizontal overflow | none, on any route |

The moves by value were 1969 at 7 to 6, 824 at 5 to 4, 71 at 9 to 8, 57 at 11
to 10, 15 at 13 to 12. The counts are far above the 231 literals in the source
because one rule paints many elements — which is the point: `.rankchip` and its
five siblings all sit at `padding: 2px 7px` and render on nearly every page.

Page heights fell where the saving compounds down a long list and nowhere else:
umpires 4721 to 4539, salaries 4771 to 4710, team hub 4344 to 4316, umpire 6583
to 6569, player 2400 to 2388, standings 3230 to 3227. The slate, postseason,
team roster and about pages did not move at all.

Before-and-after shots of five surfaces, including the pill family and the
contracts grid: `c2-umpire.png`, `c2-standings.png`, `c2-player.png`,
`c2-pills.png` and `c2-contracts.png` in `.scratch/design-system/prC/shots/`.
Each pair is indistinguishable apart from being a hair tighter.

1. **Per-site judgement is not available.** Every value is an exact tie. A
   reviewer asked to pick a direction for `.umptend__prov` has nothing to
   weigh: both answers are 1px, and the shots say neither reads better. 231
   arbitrary choices cost 231 reviews and buy nothing over one arbitrary
   choice.
2. **The change is invisible, and that is the argument FOR making it.** The
   fear in #1137 was an unreviewed spacing change across the whole app. Three
   dense surfaces, both directions, at the app's own width, say the change is
   below the threshold at which anyone can see it. The risk the issue was
   protecting against is measured, and it is not there.
3. **Down, not up, because the app is a phone-first second screen.** Down
   recovers 14px of scroll on the longest page measured and never widens a
   table that already fills 358 of 390px. Up spends space on every long page
   and grows every pill by 2px.
4. **It is the only candidate that closes the rule.** Exempting the band leaves
   a guard carrying 274 listed exemptions that will never shrink — the "guard
   that mostly says except" the issue itself names. Rounding down takes the
   ledger from 274 entries to 43.

### The caveats that belong in that PR

- **The pill family moves app-wide.** `31-wild-card.css` holds
  `.rankchip`, `.prospectpill`, `.milestonepill`, `.rookiepill`, `.duepill` and
  `.debutpill`, all at `padding: 2px 7px`, and they render far outside the wild
  card page. 7px to 6px narrows every one of them by 2px. Shoot a pill-dense
  surface, not only the three here.
- **Scoring surfaces are in scope.** `12-sealbox.css` carries 9, including
  `.abs__rowbtn` and `.abs__detail` at 13px. The cover and the ABS rows are the
  surfaces this app exists for; they want their own shot.
- **Keep the 1-3px nudges out of it.** Rounding the odd band does not touch
  them, and folding the two together would hide a decided change inside an
  undecided one.
- **Do not widen `sweep.mjs`'s MAP until the direction is agreed.** Adding a
  value to that map that no token carries exactly IS the spacing change. That
  is the one guard rail the tooling does not enforce for you.

## The one-offs stay listed either way

43 literals in 37 declarations, at 18, 22, 23, 28, 30, 36, 42, 44, 50, 52, 56,
62, 72, 84, 120, 130 and 200px.

Five of those VALUES — 72, 84, 120, 130 and 200px, nine literals between them —
sit above the top of the scale and have no step to round to at all. They are a
reserved strip or a lab gutter, not spacing. Six more values are ties of their
own: 18, 22, 28, 36, 44 and 56px. Only six of the seventeen have a genuine
nearest step.

They stay in `SPACING_RESIDUE` either way, and they want an exempting comment
where the value is load-bearing, not a rounding.

## The 231, by partial — the record of what moved

Both counts, and the value mix, for each partial the band lived in. Every row
here went down one step.

| partial | literals | declarations | values |
| --- | ---: | ---: | --- |
| `53-umpire-tendencies.css` | 15 | 10 | 3 x 7px, 2 x 9px, 3 x 11px, 7 x 13px |
| `31-wild-card.css` | 13 | 13 | 6 x 5px, 6 x 7px, 1 x 9px |
| `26-player-page.css` | 11 | 11 | 5 x 5px, 2 x 7px, 1 x 9px, 3 x 11px |
| `12-sealbox.css` | 9 | 9 | 5 x 5px, 2 x 7px, 2 x 13px |
| `28-team-hub.css` | 9 | 9 | 2 x 5px, 3 x 7px, 3 x 9px, 1 x 13px |
| `69-hit-chart.css` | 9 | 9 | 1 x 5px, 2 x 7px, 5 x 9px, 1 x 11px |
| `70-contracts-grid.css` | 9 | 9 | 3 x 5px, 5 x 7px, 1 x 13px |
| `71-salaries-league.css` | 9 | 9 | 3 x 5px, 2 x 7px, 3 x 9px, 1 x 11px |
| `42-first-scorebook.css` | 8 | 8 | 4 x 5px, 2 x 7px, 2 x 13px |
| `29-team-transactions.css` | 7 | 7 | 2 x 5px, 4 x 7px, 1 x 9px |
| `21-box-score.css` | 6 | 6 | 5 x 5px, 1 x 9px |
| `26b-player-contract.css` | 6 | 5 | 2 x 5px, 2 x 9px, 2 x 13px |
| `06-loader-and-cards.css` | 5 | 5 | 2 x 5px, 3 x 9px |
| `14-strike-zone.css` | 5 | 5 | 3 x 5px, 2 x 7px |
| `27-player-position-innings.css` | 5 | 5 | 1 x 5px, 4 x 9px |
| `30-standings.css` | 5 | 5 | 1 x 5px, 3 x 9px, 1 x 11px |
| `43-foul-tracker.css` | 5 | 5 | 3 x 5px, 1 x 7px, 1 x 9px |
| `67-awards-ledger.css` | 5 | 5 | 2 x 5px, 2 x 7px, 1 x 9px |
| `69-pitch-arsenal.css` | 5 | 5 | 1 x 5px, 3 x 7px, 1 x 9px |
| `35-postseason-series.css` | 4 | 3 | 2 x 7px, 1 x 9px, 1 x 11px |
| `51-similar-players.css` | 4 | 4 | 4 x 5px |
| `52-highlight-clip-card.css` | 4 | 4 | 3 x 5px, 1 x 7px |
| `04-site-bar.css` | 3 | 3 | 2 x 5px, 1 x 7px |
| `09-team-info.css` | 3 | 3 | 2 x 5px, 1 x 7px |
| `20-charts.css` | 3 | 3 | 2 x 7px, 1 x 9px |
| `24-floating-nav-and-hud.css` | 3 | 3 | 2 x 5px, 1 x 9px |
| `28a-team-hub-hero.css` | 3 | 2 | 2 x 5px, 1 x 7px |
| `33-awards-history.css` | 3 | 2 | 2 x 5px, 1 x 9px |
| `38-umpire-pages.css` | 3 | 3 | 2 x 5px, 1 x 9px |
| `76-workload-marks.css` | 3 | 3 | 3 x 5px |
| `03-slate-header.css` | 2 | 2 | 1 x 7px, 1 x 9px |
| `05-masthead-nav.css` | 2 | 2 | 1 x 7px, 1 x 9px |
| `10-lineup.css` | 2 | 2 | 2 x 9px |
| `11-innings.css` | 2 | 2 | 1 x 5px, 1 x 7px |
| `13-play-by-play.css` | 2 | 2 | 1 x 5px, 1 x 7px |
| `23-box-score-detail.css` | 2 | 2 | 1 x 5px, 1 x 7px |
| `26a-percentile-strip.css` | 2 | 2 | 1 x 7px, 1 x 9px |
| `26d-command-map.css` | 2 | 2 | 2 x 5px |
| `26e-contract-history.css` | 2 | 2 | 2 x 5px |
| `40-game-modals.css` | 2 | 2 | 1 x 5px, 1 x 9px |
| `62-identity-admin.css` | 2 | 2 | 2 x 11px |
| `68-around-the-game.css` | 2 | 2 | 1 x 5px, 1 x 7px |
| `73-spray-map.css` | 2 | 2 | 1 x 5px, 1 x 7px |
| `77a-express-lane-entry.css` | 2 | 2 | 1 x 5px, 1 x 7px |
| `78-offseason.css` | 2 | 2 | 2 x 7px |
| `boxlines/listdoor.css` | 2 | 2 | 1 x 7px, 1 x 9px |
| `22-box-score-tables.css` | 1 | 1 | 1 x 5px |
| `26f-glove-target.css` | 1 | 1 | 1 x 5px |
| `26g-command-received.css` | 1 | 1 | 1 x 7px |
| `34-postseason.css` | 1 | 1 | 1 x 5px |
| `37-all-star-rosters.css` | 1 | 1 | 1 x 5px |
| `39-manager-page.css` | 1 | 1 | 1 x 5px |
| `44-pre-game-cards.css` | 1 | 1 | 1 x 7px |
| `48a-logbook-stats.css` | 1 | 1 | 1 x 5px |
| `50-logbook-landing.css` | 1 | 1 | 1 x 5px |
| `61-ballpark-admin.css` | 1 | 1 | 1 x 5px |
| `64-milb-alumni.css` | 1 | 1 | 1 x 5px |
| `66-situational-records.css` | 1 | 1 | 1 x 7px |
| `77-express-lane.css` | 1 | 1 | 1 x 5px |
| `boxlines/boxlines.css` | 1 | 1 | 1 x 5px |
| `boxlines/gamelines.css` | 1 | 1 | 1 x 7px |
| `designlab/lab.css` | 1 | 1 | 1 x 7px |
| `scorecard/box.css` | 1 | 1 | 1 x 5px |
| **63 partials** | **231** | **222** | |

