# Records — the card becomes an index that unfolds

The STANDING band's Records card is **3,238px** at iPhone 13 width (158) and
**3,017px** (249). It is 72% of its band and 3.8 phone screens. Nothing in it is
deleted here. Every row stays on this page, one tap away, and the card that
holds them all opens at **760px** — a screen you can see the whole of.

Measured on `9992a2f57`, against the running dev server, 2026-09-21. Shipped
figures from `measure-shipped.mjs`; proposed figures from the artboards in
`boards/`, both at 390px.

---

## 1 · The scheme

> **The twelve groups stop being headings inside a wall and become the wall.**
> Each one is a 44px ledger line carrying its own two figures, and the rows live
> behind it.

```
RECORDS                              156 GAMES · WIN PCT
[ Full season | Pre-All-Star | Post-All-Star ]
[ All | Mar | Apr | May | Jun | Jul | Aug | Sep ]
  SCORING                   4 SPLITS   .267–.854   ›
  SCORING BY INNING        19 SPLITS   .500–.840   ›
  HITS AND HOMERS          10 SPLITS   .283–.828   ›
  DEFENSE                   2 SPLITS   .544–.677   ›
  LEADING AND TRAILING      9 SPLITS   .075–.966   ›
  CLOSE GAMES               5 SPLITS   .565–.688   ›
  STARTING PITCHING        10 SPLITS   .500–1.000  ›
  SCHEDULE                  6 SPLITS   .500–.706   ›
  BY MONTH                  7 SPLITS   .480–.800   ›
  BY DIVISION               6 SPLITS   .563–.733   ›
  BY LEAGUE                 2 SPLITS   .611–.667   ›
  SEASON COUNTS            18 TALLIES              ›
                                          OPEN ALL ›
```

**Why the twelve groups and not another cut.** Three reasons, and the third is
the one that decided it.

1. **They already exist and they already name themselves well.** The groups are
   authored in `api/teamRecords.js` and `/situational-records` names them the
   same way. A new taxonomy would make the card and its own door disagree.
2. **The cut already separates the three row shapes.** Two of the twelve are not
   W-L splits, and both are already their own group. Any other cut would have to
   re-separate them by hand.
3. **Twelve is the number that fits.** Twelve 44px lines plus the head and the
   two scope controls is **760px — 0.90 of an iPhone 13 screen.** The whole card,
   every door in it, on one screen. A coarser cut (four super-groups) fits even
   better but each open group is then 15–20 rows, which is a wall again, and the
   sub-groups under it need a fifth heading tier the page does not have.

**What a closed line says, and why those two figures.** The count says how much
is behind the door. The win-pct spread says whether it is worth opening — and
the spread is a real finding, not a decoration. Leading and trailing runs
**.075 to .966**. Defense runs **.544 to .677**. That difference is the whole
argument of a splits section, and today you have to read 61 rows to find it.
Both figures are computed off the group's own rows, so nothing is authored
twice. Season counts has no win pct, so it prints the count alone: a ledger line
with one fewer figure, not a different kind of row.

**No new heading tier.** The index line is the *group label* tier that already
exists (`--fs-label` 12px display caps, graphite, on a hairline). It has grown a
touch target and two figures. The card head above it is untouched.

---

## 2 · What is open on arrival: nothing

**Every group is closed on a fresh visit.** The reasoning is the reader's, not
tidiness:

- This card is **reference, and the page already says so.** The sub-head above
  it — *Record, split every way* — is `design.md` §6's mechanism for exactly
  this: the band answered its question in the first screen, and everything under
  the sub-head is the part of the annual you turn to on purpose. A reference
  section opens at its contents. That is what makes the contents legible.
- **A scorekeeper between pitches wants none of these rows and one of them.**
  Which one changes with the game in front of them — scoring first in the 1st,
  leading after 6 in the 7th, one-run games in the 9th. There is no row that is
  right for everybody, so opening one by default is right for almost nobody and
  costs everybody the screen it sits on.
- **The closed card is not a menu.** It carries 24 figures. A reader who taps
  nothing still learns which parts of this club's season are decided by which
  circumstance, which is more than the first screen of the shipped card tells
  them.

**`Open all ›` at the card foot** puts it back exactly as it ships today, in one
tap, and it is at the foot rather than the head so the index reads first.

---

## 3 · The control

A **full-width `<button>`, 44px minimum, `aria-expanded`** — the whole line, so a
one-handed reader hits it without aiming. No `title=` anywhere.

| | closed | open |
| --- | --- | --- |
| name | `--text-caption` graphite | `--text-heading` ink |
| figures | `N SPLITS` + the spread | **gone** — the rows say it better |
| chevron | points right, graphite | points down, ink |

The chevron is **drawn, not a glyph**: a 7px square with two 1.5px strokes on
two sides, rotated 45°. It takes a colour token like everything else, it has no
font dependency, and at that weight it reads as a pencil mark on the paper
rather than a UI icon.

**The figures leaving on open is the gesture.** A chevron-down beside a name
beside two numbers is crowded at 390px, and the rows underneath now carry every
one of those numbers. Closing puts them back. Nothing is lost in either state.

**It reads as tappable because the page keeps two affordances apart, which today
it does not:**

- a **dotted underline** means *a door out of this page* — every split row and
  every count opens that split ranked across the level at `/situational-records`;
- a **chevron on a 44px line** means *a fold, in place*.

Today the group caption has no affordance at all and the rows carry the dotted
underline, so the only thing that looks pressable is the thing that leaves.

### Persistence: per tab, not per account

**An open group survives an in-tab navigation and dies with the tab.**
`sessionStorage`, keyed `bbsbh:records-open:{teamId}`. It does not reach
`localStorage`, does not sync, and does not touch `preferences.js`.

- **It must survive a navigation**, because *every row is a door*. The reader
  taps `Leading after 8 innings`, lands on `/situational-records`, and comes
  back. React state is gone by then, so a plain `useState` accordion would close
  the group they had just drilled out of — punishing the card's own designed
  behaviour.
- **It must not persist across visits or devices.** ADR-0049 is the app's one
  persisted disclosure bit and it persists a **consent**, not a preference:
  re-sealing a box score you deliberately opened would be the app undoing your
  consent. Borrowing that machinery for a UI preference would make the box-score
  bit look like a convention instead of the exception it is. And ADR-0039's
  four-field set is closed by design — a fifth field to sync a fold nobody asked
  to sync is real scope for no reader.
- **A tab is the honest unit.** It is exactly as long as "the thing I am doing
  right now", which is exactly as long as an open group is useful.

---

## 4 · The three row shapes — the "harmonized" part

Today one card draws a row three ways and calls them all a group.

| shape | today | decided |
| --- | --- | --- |
| **61 W-L splits** | label + `W-L` + pct, 2-up, label is a door | **stays.** Two fixes below |
| **18 season counts** | figure stacked **over** its label, in an `8.5rem` tile grid | **becomes a W-L row with one figure.** 411 → 363px |
| **10×2 by-inning** | a real matrix, cell = record / pct / date on three lines | **stays a matrix.** Cell goes to two lines. 644 → 508px |

**Season counts is the important one.** It is not a record and it has no win
pct, and the shipped card answered that by inventing a third row shape — which
is why the block reads as something bolted on. But a count *is* a ledger row
whose figure happens to be one number instead of two. Label left, figure right,
same dotted door under the label as every split above it. It is now the same
object, and the card stops having a third way of drawing a row.

**The by-inning matrix genuinely is a matrix and is not flattened.** Ten innings
× top/bottom is a register, and 19 rows in a list would lose it. What *is*
harmonized is the cell: record and win pct go on **one** line, in the same order
and the same two colours as every W-L row on the card (`14-6` ink, `.700`
graphite), with the date of the last time under them. Three lines to two, across
20 cells, is 136px — and it is the same move that makes the matrix read as a
sibling of the rows rather than a different card that wandered in.

**Two fixes to the W-L row itself, both already on `design.md`'s harmonization
list:**

1. **The figure never wraps.** Without `min-width: 0` on the label, a long one
   ("Opponent scores first") pushes its own win pct onto a third line, which the
   shipped card does today.
2. **One dotted rule per row, not two.** The shipped card draws a dotted
   underline under the label *and* a dotted rule under the whole row, so an open
   group prints two dotted lines per split. `65-team-records.css` warns about
   exactly this — "a ledger full of underlined links stops reading as a ledger" —
   and then does it. The label's underline stays, because that is the door; the
   row rule goes. The underline is `text-decoration: underline dotted` rather
   than `border-bottom`, because two fifths of these labels wrap and a
   border-bottom draws one short dash under the second line only.

**Named, and deliberately NOT done here.** Season counts is not a record, and the
matrix's third value ("the last time it happened") is *Last Time* material —
and there is a **Last Time** card in this same sub-section. Moving either is a
module change in someone else's file and it is not needed to solve this problem.
So is shortening the labels: "Leading after 6 innings" inside a group headed
*Leading and trailing* is three redundant words, and it is the reason two fifths
of the rows wrap. Both are follow-ups. The boards draw the real labels.

---

## 5 · The measured result

> **Two figures in this section are behind `design.md` §6 and are left as
> written, because they are what the boards in `boards/` still draw.** After the
> outside design review, closed went **760 → 826** (158) and **715 → 781** (249)
> — all of it F3 taking `Open all` and the two shipped scope rows to a 44px touch
> target — and **"fully open is shorter than today" stopped being true**: the
> league mark puts a rank line on 49 marked rows, so open-all is **3,486px
> against today's 3,238px**. That 248px is paid only by a reader who taps
> `Open all ›`; the card's default is closed at 826px. `design.md` §6 is the
> settled record for both.

Every figure below is measured, not estimated. Shipped from the live page;
proposed from `boards/*.dc.html` at 390px.

| | shipped | **closed** | one W-L group open | matrix open | **all open** |
| --- | ---: | ---: | ---: | ---: | ---: |
| **158 Milwaukee** | 3,238 | **760** | 1,009 | 1,223 | **3,039** |
| **249 Wilson** | 3,017 | **715** | 964 | 1,178 | **2,869** |

- **Closed is 4.3× shorter** at 158 and 4.2× at 249.
- **0.90 of a phone screen** at 158; **0.85** at 249. Today: 3.84 and 3.57.
- **Fully open is shorter than today** — 3,039 against 3,238 — because the two
  row fixes and the two-line matrix cell give back more than twelve 44px lines
  cost. So the reader who taps `Open all` is not punished for it.
- The largest open group is **Scoring by inning at 508px**; the largest W-L group
  is **Leading and trailing at 293px**. Opening any one group keeps the card
  under 1.5 screens.

**The band, holding every other card at its shipped height:**

| | today | proposed |
| --- | ---: | ---: |
| STANDING at 158 | 4,511 | **2,033** |
| Records' share of it | 72% | **37%** |
| STANDING at 249 | 3,488 | **1,186** |
| the whole page, 158 | 20,006 | **17,528** |
| the whole page, 249 | 13,568 | **11,266** |

The second section of the band — the reference half under *Record, split every
way* — goes from **3,818px to 1,340px**, and the sub-head stops having to excuse
four screens of splits.

### Wilson behaves the same, with three differences held

Eleven lines, not twelve — **no `By league` below Triple-A**, and `By division`
is two rows. **`Started a game with an opener`** gives Starting pitching eleven
splits. And a MiLB record can end in a **tie**: `49-56-1`, `15-10-1`,
`27-22-2`. The figure is `white-space: nowrap` and sized for three parts, so
`NIGHT GAMES 49-56-1 .467` sits on one line beside its label — drawn in
`Rec-249.dc.html` with Schedule open. The index's range column is sized for
`.000–1.000`, which Wilson produces twice.

---

## 6 · What I rejected

**1 · Cap the card, door out.** Already rejected in `scope.md` §2B and not
re-proposed: the ~45 rows that fall off have nowhere to go, because
`/situational-records` ranks ONE split across the league and is not "this club's
other fifty splits". Named here so the record is complete.

**2 · A third row of pills — filter to one group at a time.** The most
consistent option: the card already has two pill rows, and a third would answer
"about what" beside "over which stretch". Closed height would be ~550px, the
best number here. **Rejected on three counts.** The card would open with *three*
rows of controls and ~200px before a single figure. Twelve group names squeezed
to pill width ("Leading and trailing" → "Lead/trail") destroys the one thing
that makes the group cut legible. And you could never see two groups at once,
while the comparisons a reader actually makes cross them — *we are .863 leading
after 6 but only .565 in one-run games.* A filter also says the hidden rows are
**excluded**; a fold says they are **there**. Gary asked for nothing removed.

**3 · Split into three cards — Records / Scoring by inning / Season counts.**
Genuinely attractive, and the most honest statement that three shapes are three
objects. **Rejected on the scope controls.** The half and month toggles scope all
three, and there is nowhere to put one copy that governs three sibling cards:
`design.md`'s system has a band head, a sub-head, a card head and a group label,
and no section-level control row. Three copies of an eleven-pill control is
worse than the problem it solves. Two extra card heads and two extra 16px gaps
also cost 112px for no reader gain. Kept as a follow-up if a section-level scope
row is ever designed.

**4 · Cap each group at three rows, with "N more" under each.** Closed height
~1,400px. **Rejected**: it produces twelve separate disclosure controls instead
of twelve lines, it pays nearly all of the disclosure cost for less than half
the saving, and it requires choosing which three rows of a group matter — a
ranking that does not exist in the data and would have to be invented and
maintained.

**5 · A two-level nest** — *How they win and lose* (Scoring, Hits and homers,
Defense, Leading and trailing, Close games, Starting pitching) over *When, and
against whom* (Schedule, By month, By division, By league). A real cut, and it is
the cut the reader's own question makes. **Rejected**: two levels inside one card
needs a **fifth heading tier**, and `design.md` §3 records that the page already
has four with two of them drawn identically.

---

## 7 · What this changes in `design.md` §5

**Nothing in the system. One number in it moves, and it moves the right way.**

| §5 item | effect |
| --- | --- |
| ONE band-head treatment · 7 uses · 0 variants | untouched |
| **TEN type sizes, no eleventh** | **unchanged.** The scheme uses four of them — 14.4 (card head), 12 (index name, row label, table heads), 11 (index figures, row figures, the matrix legend). It introduces none |
| **THREE vertical spacings between blocks** | **unchanged.** Every new value is *inside* a card: the 44px line, 12px of panel foot, 6px of row padding. No block-level space is added |
| **No new token** | **none proposed.** `--text-caption`, `--text-heading`, `--border-rule`, `--rule-grid` and the shipped link green, all existing |
| **The scale ratio, 36 : 1** | **becomes ≈14 : 1.** Records at 3,238px was the numerator. The largest card on the page is now Milwaukee's 40-man at 1,282px, against Ballpark at 675 at 91px |

That last row is the point. §6 already argues that *the outlier is not Records —
every club has one card that dominates its page, and which card it is changes by
club.* Taking Records out of the numerator does not weaken that argument; it is
the argument, carried out. The sub-head mechanism survives intact and gets
easier, because it no longer has to hold four screens open.

**One addition to §5's fold list.** §5 names two sizes to be folded
(`--fs-num-lg` 22px, and card-local `--fs-title-sm/md`). There is a third:
**`--fs-ui` 14px**, which the shipped card uses in three places —
`.tstatrow__v`, `.trec__countv`, `.trecinn__rec` — and which is **not one of the
ten**. The scheme folds it to `--fs-cell` 11px, which §5 defines as "mono figures
in a table cell", which is exactly what all three are.

### Two pre-existing findings, reported not fixed

- **The scope pills are ~29px tall**, under the 44px minimum, on both rows. This
  scheme neither worsens nor fixes it. The index lines are exactly 44px.
- **`.trec__grouphead` is `--graphite-soft` (`#938C7C`)**, which `design.md` §4
  measures at **3.10:1** on card paper and calls a fail. The index line's name is
  `--text-caption` (`#6B6558`), **5.44:1** on `--surface-card`. The scheme fixes
  it as a side effect.
- The brief describes the 18 season counts as "not a door". **They are doors** —
  `RecordsCard.jsx`'s `SeasonCounts` renders each as a `<button>` to
  `situationalRecordsPath`. That is why they can be plain ledger rows with the
  same dotted underline as every split.

---

## 8 · The boards

Generated, never hand-edited: `node
.scratch/team-one-scroll/canvas/records/build-records.mjs`. Same `.dc.html`
format as `../project/*.dc.html`, so they drop onto the same canvas unchanged.
Every figure is real, from `../data.mjs`.

| file | board |
| --- | --- |
| `boards/Rec-Closed.dc.html` | **158, closed** — twelve lines, 760px |
| `boards/Rec-Open.dc.html` | **158, two open** — Scoring by inning and Leading and trailing, the two shapes |
| `boards/Rec-All.dc.html` | **158, all twelve open** — the ceiling, 3,039px |
| `boards/Rec-249-Closed.dc.html` | **249, closed** — eleven lines, 715px |
| `boards/Rec-249.dc.html` | **249, Schedule open** — the three-part tie figure, sized |
| `boards/Rec-249-All.dc.html` | **249, all eleven open** — 2,869px |

Each board draws the sub-head, the card, and the *Record by day of week* card
under it, so the seam is judged rather than described.

```
MSYS_NO_PATHCONV=1 node .scratch/team-one-scroll/canvas/records/look-records.mjs "<abs out dir>"
MSYS_NO_PATHCONV=1 PORT=5173 node .scratch/team-one-scroll/canvas/records/measure-shipped.mjs 158 249
```

`look-records.mjs` slices each board at 390px and prints every part's height;
`measure-shipped.mjs` does the same to the live card, which is where the 3,238
and 3,017 come from.

### Found by looking, and fixed before this was written

1. The count and the range were **trailing text, not columns** — the count slid
   left whenever the range beside it was wide, and twelve lines wobbled. Both are
   fixed-width and right-aligned now.
2. Every open row carried **two dotted rules** — one under the label, one under
   the row. The row rule is gone.
3. A wrapped label's `border-bottom` drew **one short dash under its second line
   only**, which read as a mistake. It is a dotted `text-decoration` now, so
   every line of the label carries the door.
4. Season counts were still **tiles** — a figure stacked over its label — which
   is the third row shape the card is meant to stop having. They are ledger rows.
5. The matrix cell was still **three lines**, so the group was 630px on its own.
   Record and win pct share a line now: 508px.

No application file was changed.
