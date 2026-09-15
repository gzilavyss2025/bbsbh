# The Game lines card is a table, not a stack of sentences

**Status:** Accepted
**Date:** 2026-09-15

## Context

The player page's Game lines card (ADR-0069) is a ledger of doors: each one a
career under one facet — at home, at night, in July, on a Sunday, off the bench
— opening the game-by-game rows behind it. Issues #998 through #1006 took it
from seven doors to **twenty-five**, and every one of them printed its career as
a sentence:

```
HOME: 855 G, 3616 PA, .281, 119 HR, .837 OPS          SEE ALL ›
ROAD: 870 G, 3875 PA, .283, 125 HR, .825 OPS          SEE ALL ›
ON GRASS: 1671 G, 7253 PA, .284, 237 HR, .834 OPS     SEE ALL ›
```

Four things were wrong with that, and they compounded:

- **Nothing lined up.** Home and Road carry the same five figures in the same
  order, and a reader comparing them had to read two sentences and hold the
  first one. Comparison is the only reason to print a split at all.
- **Almost every line wrapped.** At 390px the hitter's line orphaned `OPS` onto
  a second row; the pitcher's orphaned `BB`. Sixteen ragged two-line rows.
- **"See all ›" was said twenty-five times**, down the right edge. Every row is
  a door, so saying it on every row said nothing — and on a desktop column it
  sat marooned 500px from the figures it belonged to.
- **Two visual languages.** Seven weekday doors were compact bordered *chips*
  (#1001) because a stack of near-identical sentences buried their differences.
  The chips were right about the problem and could only hold two of the five
  figures.

The card ran 1,093px on a phone — about three screens — and the card directly
above it on the same page, Splits vs team, was already printing that identical
five-figure line as a **stat grid with the columns named once**.

## Decision

**The card is a table.** Every door prints the same five figures, so the figures
are named once at the head of each section and each door is five cells under
those names.

1. **Columns, named once per section.** `G · PA · AVG · HR · OPS` for a bat,
   `G · IP · ERA · K · BB` for an arm — `DOOR_COLUMNS` in
   `api/boxlines/careerSplits.js`, beside the `careerSplitLine` whose order it
   states. Each of the four sections heads its own rubric, so a reader who has
   scrolled past one meets the names again at the next.
2. **One chevron per row.** The promise moves out of the rows and under the
   card title, once: *Tap a line for the games behind it.*
3. **Four panels with an edge**, banded rather than ruled. A section was a word
   over a dashed rule and a reader could not see where one stopped; alternating
   paper also carries the eye across five columns and takes twenty-five
   hairlines out of a card whose complaint was noise.
4. **A family folds.** Fifteen of a hitter's twenty-five doors are two runs that
   differ in one number — the eight months, the seven weekdays. Each folds
   behind a single row naming and counting it (`FAMILIES` in
   `api/boxlines/cardFacets.js`), so the card opens at ten lines instead of a
   wall and the reader expands the run they came for. `FOLD_FROM` keeps a short
   run loose: a call-up with two months played is shown his two months.
5. **The chips are retired.** An opened family's doors are ordinary rows in the
   same five columns as everything else — which is strictly more than a chip
   could say, and readable down a column, which is what the weekday question
   wanted in the first place.

6. **A calendar door counts every kind of game played on that date.** A month
   and a weekday are facts about the DATE, and a date does not stop being
   October — or a Sunday — because the game was a division series. The month and
   weekday doors therefore span the regular season and the four postseason
   rounds, in the label and in the rows alike. No other door moved: "Home" is
   not a question about the date, and its aggregate stays the regular season's.

`BoxLinesDoor` grew a `face` prop and lost `chip`. A door on a line of its own
still says its whole career and "See all ›"; a door that is one row of a table
wears the host's columns. Both are the same control, so the host dresses it and
the door goes on owning the only two things it has ever owned — the open bit and
the sheet.


## Consequences

- **The card and the sheet are two renderings of one stat object**, built by two
  functions: `doorCells` for the table, `careerSplitLine` for the headline the
  sheet puts over its rows. Nothing but a test stops them drifting, so there is
  one: it asserts the sentence quotes every cell, in the cell order. A card
  reading OPS where its own headline read SLG would be wrong in a way no reader
  could catch, because the door is the only place the two ever meet.
- **The emphasised column must be a rate.** The card inks the cell that answers
  "how well" and greys the four that are context. The two groups do *not* answer
  in the same column — a bat is read on AVG and OPS, an arm on ERA — and the
  column sitting where a hitter's OPS sits is a pitcher's `BB`. The first draft
  of this design inked it there, pointing at a walk total as though it were the
  headline figure; `DOOR_EMPHASIS` is pinned to the rate columns by test.
- **Emphasis is colour, never weight.** JetBrains Mono ships one registered
  weight in this app (`tokens/fonts.css`), so every figure renders at 700
  whatever a rule asks for and a "bold" cell beside a regular one is two cells
  that look the same. Graphite for context, slate for the rate beside the
  answer, near-black for the answer.
- **The column tracks are `ch` of the mono face**, stated on the grid element
  itself for both the head row and every door. `ch` resolves against the grid
  *element's* font, not its cells': set the head row in the body face and its
  `4ch` is four Source Sans zeroes wide while the door's is four JetBrains ones,
  and the names drift off their figures at every width. It also makes the
  narrow-phone rule one line long — one step down the type scale takes the five
  columns with it and hands the width back to the name column, which is what
  stops "Substitution" truncating at 320px.
- **A folded door is not in the DOM.** Any test that asserts a month or weekday
  door opens its family first (`openFamily` in `e2e/box-lines.spec.js`), and
  asserts `aria-expanded` on both sides so it cannot quietly become a no-op if
  the default ever flips to open.
- **A cell the source cannot answer is null, not zero.** A hitter's Started and
  Substitution doors count games off a fielding career, which carries no rate
  stat; their last four cells draw a quiet rule-coloured dot. A `0` would be a
  claim about a career MLB never made, and an em-dash reads as a figure MLB
  failed to send.
- **Two halves have to move together, and each fails silently alone.**
  `spansPostseason` on the registry entry widens the LABEL's fetch;
  `facet.postseason` widens the ROWS'. Widen only the rows and the door states
  16 games over a sheet of 42; widen only the label and it states 42 over a
  sheet of 16. A test requires the pair on every entry.
- **MLB publishes no combined aggregate**, so the label adds two.
  `careerStatSplits` answers for one `gameType` at a time, and asking for `R,P`
  returns the two rows separately — and twice over — never a combined one. So a
  spanning door costs one extra request for the whole family, and
  `mergeCareerSplits` adds the counting stats and divides once.
- **Rates are recomputed, never averaged.** Yelich in October is .444 over 16
  regular-season games and .208 over 26 postseason ones; his October is neither
  and not the midpoint — it is 44 hits in 150 at-bats, .293. And the arithmetic
  copies MLB's, *including its rounding*: OPS is not OBP + SLG at full
  precision, it is each half rounded to three places and then added (.559 + .630
  = 1.189, where the unrounded sum prints 1.188). The suite checks the formula
  by feeding one real MLB split back through the merge and requiring MLB's own
  published string out the other side — the only available check, since there is
  no combined figure to compare against.
- **The exact agreement survives.** Calendar doors reconcile to the game where
  Home and Road cannot (ADR-0069), and that held across the sum: Yelich's
  October reads 42 G on the label against 42 rows in the sheet, 26 of them
  wearing a round pill. An e2e test asserts the two.
- **There is no November door.** statsapi's month situation codes stop at
  October — sitCode `11` returns nothing at all — so a World Series that runs
  into November has no month of its own. Those games are still on the Postseason
  door; they simply land in no month. Adding a November door would be one entry
  in the `MONTHS` table.
- **The calendar doors no longer share the other doors' fetch.** The join is
  keyed by game types, so month and weekday doors share one R+P join with each
  other and the remaining doors keep their R-only one. Opening a month door
  after a Home door costs a second pass; both are memoized for the session.
- **A postseason night game is in October and on its weekday, but not under
  "Night" or "Home".** Those doors were deliberately left on the regular season
  — they are not questions about the date. If that asymmetry ever reads as a
  bug, the fix is to give them `spansPostseason` too, not to narrow the calendar.
- The card runs 701px on a phone against 1,093px, and 659px against 1,108px for
  a pitcher, with every figure aligned under a name.

Nothing about the spoiler footing moved. The labels are career aggregates, open
on this page the way the Splits vs team card's are (ADR-0034 — a stat line is
not a score); the rows behind every door still go through
`api/boxlines/rows.js`'s cutoff gate.

## Alternatives weighed

- **Keep the sentences, just stop them wrapping** (drop PA and HR). Cheapest,
  and it fixes the least important of the four problems: two sentences still do
  not compare.
- **Make every door a chip**, extending #1001's answer to all twenty-five. One
  visual language, and it caps every door at two of the five figures — the
  chips existed because the sentences did not compare, and a table compares
  better than either.
- **Show all twenty-five rows, no folding** (drawn as "Option B" on the design
  canvas). Same alignment and dress, nothing to discover and nothing to tap
  twice, at the cost of a card still about a screen and a half long. Worth
  revisiting if the fold proves to hide the months from people.
