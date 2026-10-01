# Decisions for Gary — tables (#1132)

## The five questions

Each line gives my recommendation first, then the cost. If you agree with all
five, say "all five as recommended", and T1 and T2 can start. The details for
each are below.

1. **Q1. Keyboard scrolling on every wide table?** Recommended: **yes**, every
   table that scrolls sideways becomes a Tab stop with a short spoken name.
   Trade-off: a keyboard user presses Tab once more per wide table.
2. **Q2. Move 14 tables to the two standard spacings?** Recommended: **yes**, all
   14, and Nine Keys keeps its own. Trade-off: small visible changes on those 14
   pages.
3. **Q3. Fix two code names that describe the wrong thing?** Recommended:
   **yes**, `bs__row--substitute` and `ledger__label`. Trade-off: none on
   screen; the September name list gets a dated correction.
4. **Q4. Leave the score sheets and the tool pages alone?** Recommended: **yes**,
   all eight. Trade-off: the tool pages keep the old table look.
5. **Q5. Keep the team leaders as a list?** Recommended: **yes**. Trade-off: a
   later change to table spacing does not reach it.

| # | Gary's answer |
| --- | --- |
| Q1 | (open) |
| Q2 | (open) |
| Q3 | (open) |
| Q4 | (open) |
| Q5 | (open) |

Some words used below:

- A **table** is a grid of figures with column names at the top: the standings,
  a box score, a player's year-by-year lines. The app has 70 of them.
- **Spacing** is the room around each figure inside its cell. "6 by 8" means 6
  dots above and below the figure and 8 dots each side.
- A **card** is a box of paper with a thin edge and rounded corners.

---

## Q1. Can every wide table be scrolled with the keyboard?

**Recommendation: yes. Every table that scrolls sideways becomes a stop for the
Tab key, with a short name a screen reader says ("Batting, Milwaukee").**

48 tables sit in a frame that scrolls sideways when the table is wider than the
screen. On the 24 report boards
(attendance, pace of play, the ABS boards…) you can tab to the table and scroll
it with the arrow keys. On the other 24 (standings, the player's career lines,
the box score…) you cannot: without a mouse or a finger, their right-hand columns
are out of reach.

Trade-off: a keyboard user presses Tab once more for each wide table on a page.

## Q2. Can 14 tables move to the two standard spacings?

**Recommendation: yes, move all 14, and keep Nine Keys.**

The census found two real spacings: **6 by 8** (most tables) and **4 by 2**
(the box score's dense grids). 14 tables use something else. The new table
moves them to the nearer standard:

- **To the dense 4 by 2:** the rolling line score and the two pitchers tables
  in the innings viewer (today 6 by 0 and 6 by 1), and the box score's team
  totals (today 8 by 4). They join the rest of the box score.
- **To the standard 6 by 8:** the prospects board (today 8 by 12), the
  contract grid on a club's Contracts tab (seven different spacings in one
  table today), the doubleheaders drawer (4 by 10), the standings boards (6 by 6
  on a phone, 8 by 8 on a laptop), and four small tables that have NO space
  between their columns today: the player's awards, the two offseason tables, and
  the ABS challenge board on the team page.
- **Kept as they are:** the Nine Keys grid. Each of its cells holds a drawn mark,
  not a figure.

Trade-off: you will see small changes on those 14 tables, most of all on the
four tables that gain space between columns. If a screenshot shows one that
reads worse, that one table keeps its own spacing and goes on a short list.

## Q3. Two names in the code describe the wrong thing. Can we fix them?

**Recommendation: yes. Name them for what they are: `bs__row--substitute` and
`ledger__label`.** The names in the September list would have said "subtotal"
on things that are not subtotals.

The naming rules from September (ADR-0084) left two names for this work, and
wrote down what each one meant. Reading the code shows both readings are wrong:

- The box score's `bs__sub` was written down as a "subtotal" row. It is a
  **substitute** batter's row: the one that sits indented under the starter he
  replaced.
- The ledger's `ledger__sub` was written down as a "subtotal" cell. It is the
  **second name column** on every row: the club in a career register, the
  prospect's name on the Minors tab.

Trade-off: none on screen. The September list and its decision record get a
dated correction note.

## Q4. Do the score sheets and the tool pages keep their own tables?

**Recommendation: yes, leave all eight as they are.** This is the answer you gave
for cards on 2026-09-24 (leave the lab and admin pages). The one exception is the
`/game-notes-debug` page: it shares a style that the last step deletes, so it
moves with the standings.

The issue already says the live scorecard and the box score's inning tally keep
their own look: they are the sheets you score on. The census found eight more
tables that are not like the rest:

- **The printable score sheet** (`…/sheet`): blank, measured in millimetres, and
  drawn with lines only, because a printer drops background colour. It is a sheet
  you score on too.
- **Seven tables on tool pages:** four on the design lab, one on the identity
  lab, and the two admin research pages (which need your sign-in, so a laptop
  cannot check them).

Trade-off: the tool pages keep the old table look.

## Q5. Do the team leaders stay a list?

**Recommendation: keep it a list.** Making it a table would add a row of column
names that say nothing new.

The design review called the team page's "Batting / Pitching" leaders "a table
built from divs". The census says it is a list: six lines of "category, leader,
figure", with no column names at the top. Nobody reads it down a column. It is
already on the new card (September's work).

Trade-off: it stays outside the new table, so a later change to table spacing
does not reach it.

---

## Already decided — not questions

- **Two tables keep a box inside a card for now.** The team page's division
  standings and the Minors tab's prospects table each draw their own box inside
  a card. You said boxes inside boxes wait for a later issue (2026-09-24, card
  Q4). They keep their inner box, and that issue decides them.
- **The spoiler rule does not move.** Seven tables sit where a score could leak
  (the box score, the rolling line, the pitchers tables). Each one keeps its
  gate exactly. The census names the gate for each.
- **The issue's numbers were low.** It counted 40 tables; there are 70. It
  counted 30 on the shared standings style; there are 38. The PR says so; the
  issue is not edited.
