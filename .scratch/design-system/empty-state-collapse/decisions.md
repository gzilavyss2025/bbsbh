# Decisions for Gary — empty states (#1132)

## The four questions

Each line gives my recommendation first, then the cost. Gary chose the
recommendation for all four (2026-10-05); the answers are in the table below.

1. **Q1. Do the 29 "nothing on file" lines change in one step?** Recommended:
   **yes**. One shared line in the code draws all 29; it becomes the new empty
   state. Trade-off: 29 pages change at the same time, so one PR has a long
   list of pages to check.
2. **Q2. What does an empty state look like?** Recommended: **a thin dashed
   pencil box with no fill, and grey pencil words in the reading face**. A
   short heading line, if there is one, stays in the condensed capitals.
   Trade-off: 65 places gain a box they do not have today.
3. **Q3. Two sizes, or one?** Recommended: **two**. A full size for an empty
   card or section, and a smaller one for an empty tile, chart slot or roster
   list (9 places). Trade-off: one more choice for whoever adds an empty state.
4. **Q4. Leave six kinds of empty line as they are?** Recommended: **yes**:
   Express Lane, the search boxes, the bracket's "no games today" line, the
   series chart, one empty table row, and the tool pages. Trade-off: those
   places keep their own look.

| # | Gary's answer |
| --- | --- |
| Q1 | Yes: one step, through `AsyncStatus` (2026-10-05). E2 goes ahead. |
| Q2 | Yes: dashed, no fill, body face (2026-10-05). |
| Q3 | Yes: two sizes, `block` and `compact` (2026-10-05). |
| Q4 | Yes: hold all six groups (2026-10-05). |

All four are answered. E1 can start.

Some words used below:

- An **empty state** is what a page or a card shows when there is nothing to
  show, and that is a fact about the data: "No roster moves posted for this
  club yet." It is not "Loading…", and it is not "Couldn't load".
- A **hint** is the plain grey line the app uses today for loading, errors,
  footnotes AND empty states. 115 places use it.
- **Dashed** is the pencil line. The issue says it means "pencilled in, not
  final" and nothing else.

---

## Q1. Do the 29 "nothing on file" lines change in one step?

**Recommendation: yes, in one PR of its own (E2).**

29 pages say "nothing on file" through one shared piece of code: the
attendance board, the standings, the umpire rankings, the slate's "No games
scheduled", and 25 more. That code draws one plain grey line. If that one line
becomes the new empty state, all 29 change together, and no page can drift
from the others again.

The other choice is to move them page by page, in the slices that touch each
page anyway. That is more PRs, and for some weeks two looks live side by side.

Trade-off: one PR changes 29 pages, so its check list is long (slices.md, E2).
The change itself is one line, plus deleting a switch (`emptyProse`) that 10
pages set and the new look makes useless.

## Q2. What does an empty state look like?

**Recommendation: a thin dashed pencil box with no fill of its own. Inside it,
the words in grey pencil, in the reading face. A heading line above, when
there is one, in the small condensed capitals.**

Today, of the 25 empty-state styles, 1 is dashed (the innings viewer's "No
pitching lines yet"), 2 are solid boxes, and 22 have no box at all. The issue
asks for one look: a dashed inset with grey words, because waiting for data is
a kind of "pencilled in".

Three details are choices:

- **No fill.** The one dashed empty today fills its box with card paper. On a
  card, that reads as a second card. The brightest paper is the colour the app
  uses for a revealed value, which is the wrong signal for "nothing here". With
  no fill, the box shows the paper it sits on.
- **The reading face for the words**, not the condensed capitals. Most empty
  states are full sentences. The app writes every word in capitals, and a long
  sentence in condensed capitals is hard to read. The innings viewer's code
  says so in a comment. The heading line (the prospect card's "Standing vs
  level") stays condensed.
- **Grey pencil** (the caption colour) for every line. It already passes the
  contrast check on the page, on a card and on the bright inset.

Trade-off: 65 places gain a box they do not have today, most of them on
pages with a board or a list. If a screenshot shows a box that looks heavy in
one place, that place goes on the hold list.

## Q3. Two sizes, or one?

**Recommendation: two.** A full size (16 dots of space inside) for an empty
card body or a page section, and a small size (8 by 12) for an empty spot
inside something else: a team-hub tile, a chart slot on the Matchup Scout, the
roster list in the innings rail, the starter card on the lineup page. 9 places
take the small size.

With one size, a tile with one empty line inside it gets as much padding as a
whole empty page section, and the tile grows.

Trade-off: someone who adds an empty state must pick a size. The default is the
full size.

## Q4. Leave six kinds of empty line as they are?

**Recommendation: yes, leave all six.** 29 of the 97 empty-state places stay as
they are:

- **Express Lane** (3). It is drawn on dark album paper. Grey pencil on the dark
  album is not tested for contrast, and a paper box on a film reel looks wrong.
  If Express Lane gets its own look for empty states later, that is its own
  change.
- **The two search boxes** (2): site search and the team search. "No matches"
  is the status line of the drop-down list, read out by a screen reader as the
  list changes. It is not a block on a page.
- **The bracket fold on a day with no games** (1). It is a heading line with an
  "Open the bracket" door under it.
- **The postseason series chart** (1). The "No data" words are drawn inside the
  chart picture, which the new part cannot draw into.
- **One empty table row** (1): the farm-system report's "None inside the
  published list". The row keeps the table's columns, so it belongs to the
  table.
- **The lab, admin and dev-only pages** (21). Your answer for cards
  (2026-09-24) and tables (2026-10-01): leave them.

Trade-off: those places keep their own look.

---

## Already decided — not questions

- **Loading and error lines do not move.** 15 loading lines keep the plain
  hint or the pencil loader. 21 error lines wait for the third family,
  `Notice`, which has its own census next.
- **Footnotes do not move.** 61 places use the hint as a note about what IS on
  the page ("Updated 3 Oct.", the ABS report's prose under a board). They are
  not empty states, and they keep the hint.
- **Pencil marks and value marks do not move.** A TBD seed, a bracket slot to
  come, a "—" in a table cell, a stamp with no photo. The census found 41 such
  places. Some carry the word "empty" or "none" in the code, but none of them
  is an empty state.
- **The spoiler rule does not move.** 8 of the moving places sit on a page
  where a score could show (the slate, the lineups, the innings viewer, the
  box score's umpire window). Each one keeps the test that decides "empty"
  exactly where it is. Only the box changes. None of them says a result.
- **The issue's count was off.** It says 40 empty-state styles. The census finds
  25 real ones among 115 that look like one by name. The PR says so; the issue
  is not edited.
- **Six state names stay for later.** The issue's six state renames (ADR-0084)
  are not done here. Only one of them, Express Lane's empty deck, is an empty
  state, and it is held with Express Lane (Q4).
