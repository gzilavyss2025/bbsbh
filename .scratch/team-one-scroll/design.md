# The team page, one scroll — the design

Step 2 of three. #1105 said what is on the page and in what order; this says what
it looks like. #1107 builds it.

Everything below was measured on `f12208170` (PR #1148 merged), at iPhone 13
width, against a live dev server on 2026-09-21, with `page-shape.mjs` and a new
`shoot.mjs` beside it. Where this document disagrees with `scope.md`, the
disagreement is listed in **Corrections** at the foot and the measurement is
given.

---

## Part one — the inventory, the idea, and the numbers

### 1 · What this page is

> **One club's chapter in a season annual: the same seven named sections in the
> same order on the same paper, so a thin club reads as a shorter chapter, never
> a broken page.**

Thirty-three words. Every decision below traces back to it, and each one says
where it came from.

The object is a printed annual, not a dashboard. That matters twice. A media
guide's records section runs for pages and nobody calls it a design failure —
it is the part you flip past unless you want it, and the book stays legible
because the *section furniture* never changes. And a Single-A club's annual is
eighty pages against the Brewers' four hundred: same cover, same section order,
same type. You never think the thin one is broken. You think that club has less
history.

Those are the two problems this page has, and the object already solves both.

### 2 · Who reads it

A second screen. Paper scorebook open, pencil in hand, game on. They scan
between pitches, one-handed, on a phone. They are not studying this page. Every
decision answers to that, and the one that answers hardest is **how few
landmarks a reader has to hold** — see §6.

---

### 3 · The inventory: every repeated element, and how many ways it is drawn today

The block catalog (`inventory.mjs`) reports **41 blocks — 31 card, 10 pill**
app-wide. That is the app's namespace count, not this page's problem. The finding
the catalog cannot give is the one below: **how many ways the same element is
drawn across these three pages.** Taken from the screenshots and the partials,
not from the JSX.

Pages walked: `/team/158` (all six tabs), `/team/249` (all five),
`/team/675?d=2026-01-15` (all four).

| Element | Variants | What they are |
| --- | ---: | --- |
| **Card head** | **5** | (a) themed bar — club fill, 3px club accent, club ink (`.thub-card__head`, `.tstats-card__head`, `.roster-super__head`, `.team-score__head` under `.is-themed`) — ~20 cards; (b) bar-less caption on paper — Run value, ABS challenges; (c) page-level group label with the cards under it — Team leaders (`.tledg`), which then puts a **themed bar on each of its two sub-cards**; (d) unwrapped caption, deliberate — Transactions (`.txcard`), because its deck bleeds past the gutter; (e) **none at all** — the season games grid (`.gamesgrid`) |
| **Rank cell** | **4** | (a) tinted tile, `RUNS 802 2ND`, green for good and clay for bad — team batting/pitching; (b) caption line, `3RD OF 30 CLUBS` — Run value; (c) inline after the figure, `6 OF 64` — Comebacks; (d) the word "org rank" as a card-head caption — Prospects |
| **Table header row** | **4** | (a) graphite display caps on a hairline — standings; (b) the same plus a sub-line inside the cell (`.rpt__sub`) — ABS; (c) no header, label/value pairs — Records, day-of-week; (d) no header, a stat-code gutter column — leaders ledger |
| **Bar / rail / plot** | **5** | (a) one stacked horizontal bar — Run value; (b) three dot-plot rails with a tick for the league average and a ringed dot for this club — Comebacks; (c) scatter + dashed trend line + axis — ABS; (d) form rails — Team Score; (e) workload marks — Bullpen health |
| **Stat tile** | **4** | (a) tinted rank tile — team batting/pitching; (b) dotted-underline record row, every row a door — Records; (c) plain day cell — day-of-week; (d) payroll tile — Money |
| **Door out** | **5** | (a) standalone 22px row, `Season schedule ›` (`.thub-door`); (b) text link right of a card head, `See all ›`; (c) card-foot link, `LEAGUE CHALLENGE BOARD ›`; (d) every Records row, dotted underline; (e) a button on a card head, `Stamp In` |
| **Prose explainer** | **2** | (a) shouted caps, inside the card body — Comebacks; (b) natural case, at the card foot — ABS (`text-transform: none`, caps-exempt). **One of these is wrong**: the house rule is shouted headings, natural-case body |
| **Empty / degraded** | **1, undrawn** | Ballpark at 249 is **93px** and at 675 **91px**: a head and a single line of text, with no diagram, no dimensions, no photo and no "not posted yet". It is not a designed state — it is a full card with most of it missing |
| **Band head** | **0** | Does not exist. `SectionMasthead` (`.metricbar`, 36 uses) and `SectionTitle` (`.section__title`, 38 uses) are the two things nearest to it and neither is one |

**Eight repeated elements, thirty ways of drawing them, and no band head at
all.** That is the harmonization job #1107 works through, and the full
element-by-element list lands in Part two.

#### The collision that matters most

Four heading tiers already exist on this page and **two of them are drawn
identically**:

| Tier | Today | Where |
| --- | --- | --- |
| 1 · page | `--fs-h1` 26px display, ink-0 | the club name in the hero |
| 2 · band | — | does not exist |
| 3 · card | 1.2em × `--fs-label` ≈ **14.4px** display caps, on a club-coloured bar | ~20 cards |
| 4 · group inside a card | `--fs-label` **12px** display caps, graphite, on a hairline | `SCORING`, `HITS AND HOMERS`, `LEADING AND TRAILING` … inside Records |

and `.section__title` — the app's generic section label, 38 uses — is **also**
`--fs-label` 12px display caps graphite. So tier 4 and the app's own idea of a
section heading are the same object. Any band head that lands near 12px joins
that pile. This is why the band head has to be unmistakably senior, and it is
the constraint that decided §5.

#### The second constraint, found by looking rather than by reading

Computed off the running page (`computed.mjs`), the card head is **two different
objects depending on whether the club has a tuned triad**:

| | `--bar-fill` | `--bar-accent` | `--bar-text` | themed |
| --- | --- | --- | --- | --- |
| 158 Milwaukee | `#12284B` navy | `#A6801F` gold, **3px** | `#F8F8F5` | yes |
| 249 Wilson | `#00274d` navy | `#98002e` crimson, **3px** | `#FFFFFF` | yes |
| **675 Los Mochis** | *unset* | *unset* | *unset* | **no** |

ADR-0030 tunes 67 (club, treatment) pairs out of several hundred and
`headerThemeFor` returns **null** for the rest, which keeps default chrome. 675
is one of the nulls. Its card head computes to **transparent background,
`--graphite` `#6B6558` ink, a 1px `--rule-soft` hairline** — no club colour
anywhere on the page.

Two consequences, and both decide the design:

1. **The band head cannot be a filled bar.** A filled bar is the themed card's
   device, its colour is not constant across clubs, and a club-neutral one would
   read as a card whose theme failed to load. ADR-0030 forbids it from the other
   direction too — a club may colour a card that identifies the club, never page
   chrome.
2. **On an unthemed club the collision above gets worse, not better.** An
   unthemed card head is graphite display caps on transparent paper over a
   hairline — which is *exactly* `.section__title`, and *exactly* the Records
   group label. On 675, tiers 3 and 4 and the app's generic section label are one
   object. So the band head must work on a page with **no club colour at all**,
   and on that page it is the only structural colour left. That is a feature: the
   band system carries the floor page when the club theme cannot.

---

### 4 · What I took from the three shipped screens

**`BroadcastBar.jsx` + `styles/report/charts.css` — the report pages.** Three
things, and the first is the whole design:

1. **`BroadcastSection` is already the band head.** `components/around-the-game/
   BroadcastMasthead.jsx` exports it; its own comment says it lives there
   "so the six pages cannot each invent their own heading treatment". It draws
   `.bcast-sec__title` — display face, `--fs-h2` 21px, `--w-bold`, `--ls-caps`,
   `--text-heading`, with a `::after` that is `flex: 1 1 auto`, `--bw-heavy` 2px
   of `--clay` at 50% opacity running from the end of the words to the column
   edge — and an optional `.bcast-sec__note` under it in the body face at
   `--fs-small` 13px, `--lh-prose`, `--text-muted`. Club-neutral. Sits on the
   bare manila, which makes it a different plane from every card on the page.
   **I am not designing a band head. I am promoting this one.**
2. **Tables are the default and a chart is the exception.** `charts.css` states
   it outright: the boards are tables because "a ranked list of thirty clubs is
   read by scanning one column", and the column chart exists only for the two
   questions nine table rows hide. I take that as the rule for the whole page.
3. **Drawn in HTML, not SVG, except the line.** Text inside an SVG scales with
   the viewBox, and an inline `font-size` in SVG is invisible to
   `check-typography`. Every chart I draw follows this.

Also taken, smaller: axis and tick labels use `--text-caption`, never
`--graphite-soft`, which measures 3.10:1 on card paper and fails AA; gridlines
are `--rule-grid`; and `BarCell` puts the shape *behind* the figure so the eye
never crosses the row twice.

**The Game Log.** One idea: **a dark surface is an exception that has to earn
itself by showing an edge the light surface cannot.** `--album-board` is the one
dark plane in a paper-and-ink app, and `colors.css` defends it in a paragraph —
a postage stamp's perforation is cut in cream paper, and cream-on-manila has no
edge at all. I take the *test*, not the colour: **any new plane on this page must
show something the manila cannot.** That test is what kills the band tint in §7.

**Today's `/team/158`.** The card is right and stays: `--surface-card` cream,
`--bw-hair` of `--border-rule`, `--radius-md`, `--shadow-card`, `overflow:
hidden`, and `margin-top: var(--space-4)`. I change nothing about it. The page's
problem was never the card — ADR-0034 named it as *interleaving*, and the bands
fix that. I also keep the club-coloured head bar exactly as it is: it is the one
place a club's identity reaches the page, and taking it away to make room for a
band head would trade a real thing for a new one.

---

### 5 · The system, as numbers

Each of these is a number, not an adjective, and every artboard is held to it.

#### ONE band-head treatment · 7 uses · 0 variants

`BroadcastSection`, unchanged: **title + optional note**. The title is the band
name. The note is **the band's question**, in the body face, natural case — the
question `scope.md` already wrote for each band.

The right-aligned slot 2G asks for is **not used on this page, zero times.** The
three heads that need to say something extra — Ranks (a level qualifier), Farm
(the parent org), Money (not dated) — say it in the note, because the note is a
sentence and those are sentences. Reporting that honestly is better evidence for
#1113 than inventing a slot this page does not use: the right slot is required
by the *player* hub, where `SectionTitle`'s `action` prop has 38 uses.

#### TEN type sizes on the whole page. There is no eleventh.

Every one already exists in `src/tokens/typography.css`. Nothing is invented and
nothing is a raw px value.

| px | token | job | uses |
| ---: | --- | --- | ---: |
| 34 | `--fs-display` | the one hero figure a card may print | ≤1 per card |
| 26 | `--fs-h1` | the club name | 1 |
| 21 | `--fs-h2` | **the band head** | 7 |
| 17 | `--fs-h3` | **the sub-head** | 1 |
| 16 | `--fs-num-md` | the figure in a stat tile | many |
| 15 | `--fs-body` | running copy in a card body | many |
| 14.4 | 1.2em × `--fs-label` | the card-head title | ~20 |
| 13 | `--fs-small` | the band question; a card-foot explainer | 7 + |
| 12 | `--fs-label` | captions, group labels, table heads, pills | many |
| 11 | `--fs-cell` | mono figures in a table cell | many |

Two of today's sizes are **folded** and that folding is on #1107's list:
`--fs-num-lg` 22px (→ 34 where it is a hero figure, 16 where it is a tile
figure), and any card-local `--fs-title-sm`/`--fs-title-md` heading (→ the card
head at 14.4, or the sub-head at 17).

Display and mono ship at **one weight, 700**, so `font-weight` is a no-op on
both. Every emphasis below is colour or size.

#### THREE vertical spacing values between blocks

| px | token | between |
| ---: | --- | --- |
| 48 | `--space-12` | the seam above a band head |
| 32 | `--space-8` | above a sub-head |
| 16 | `--space-4` | between two cards inside a band — `.thub-card`'s shipped `margin-top` |

There is no fourth. The 12px (`--space-3`) under the band title and under its
note is *inside* the head, not between blocks, and it is shipped.

The seam is 48 rather than `.bcast-sec`'s shipped 32 because a band is a bigger
thing than a report section: it can be four screens long, so the space that
opens the next one has to be readable as an opening after all that scrolling.

#### The scale ratio the page is designed for: 36 : 1

Largest card **Records at 158, 3,238px**. Smallest card **Ballpark at 675,
91px**. The page absorbs it with one rule:

> **No card carries the page's rhythm. Eight landmarks do — seven band heads and
> one sub-head — and a card of any height sits between two of them.**

#### Every value comes from an existing token — and no new token is proposed

See §7. If that changes, it is one alias-tier token and it is registered in
`contrastPairings.js` with its computed ratio.

---

### 6 · The two problems

#### Problem 1 — the outlier

Records is **3,238px and 61 rows**, 72% of the Standing band (4,511px), 7.7× the
next card in its own band (Team Score, 421px) and 2.5× the largest card anywhere
else (the 40-man, 1,282px). It stays full — decided, not open.

**The mechanism is the sub-head**, and it is #928's two-section rule doing real
work rather than decorating:

```
STANDING ——————————————————————————     band head, 21px, clay rule
how is the season going                  the question, 13px, natural case

  [ division standings + odds  272px ]   the ANSWER — 693px, under one screen
  [ Team Score                 421px ]

Record, split every way                  sub-head, 17px, no rule, 32px of air

  [ Records                  3,238px ]   the REFERENCE — 3,818px
  [ Record by day of week      173px ]
  [ Comebacks                  407px ]
```

The band answers its question in the first screen. The sub-head then says that
everything below is reference, so four screens of W-L splits are something the
reader scrolls *past* on purpose rather than something that has buried the
answer. That is what a records section in an annual does, and it is why the band
is not flattened by the card inside it.

The second half of the mechanism is the **stuck jump bar**, which keeps the word
*Standing* on screen through all 4,511px. Without it a reader four screens deep
has no frame; with it, length costs nothing.

##### And then the card itself was reorganised — Gary, 2026-09-21

> "I don't want to remove any of this information, but I think we can condense
> it and make it easier to navigate… so that you can drill into things you're
> interested in but won't have to scroll past a really ton of data to get to the
> next section."

This is a **third option `scope.md` never evaluated.** §2B weighed *full*
against *capped* and rejected capping because the ~45 rows that fall off have
nowhere to go. Nesting removes nothing and sends nothing anywhere, so the
decision that "Records stays full" is untouched — every row is still on this
page. §2B even points here: *"the way out is the half/month toggle the card
already has doing more work — not a cap."*

**The scheme.** The twelve groups stop being headings inside a wall and **become
the wall.** Each is a 44px ledger line carrying two figures: how many splits are
behind it, and the spread of win pct inside it —
`LEADING AND TRAILING · 9 SPLITS · .075–.966`. The rows live behind the line.
The spread is a **finding, not a label**: Leading and trailing runs .075–.966
where Defense runs .544–.677, and today you read 61 rows to learn that.

Twelve was the right cut for one measurable reason: **twelve 44px lines plus the
head and the two shipped scope controls is 760px — 0.90 of a phone screen.** The
whole card, every door in it, visible at once. A coarser cut fits better but
needs a fifth heading tier, which §3 says the page does not have.

| | shipped | **closed** | all open |
| --- | ---: | ---: | ---: |
| 158 Milwaukee | 3,238px | **760px** | 3,039px |
| 249 Wilson | 3,017px | **715px** | 2,869px |

Measured independently of the drawing that proposed it. **4.3× shorter closed**,
3.84 phone screens down to 0.90 — and **fully open is shorter than today**, so
`Open all ›` is not a punishment.

**Closed on arrival.** The sub-head above already declares this material
reference, and a reference section opens at its contents. A scorekeeper wants
*one* of these rows and which one changes with the inning, so opening any by
default is right for almost nobody.

**Open groups persist in `sessionStorage`, per tab**, keyed
`bbsbh:records-open:{teamId}`. They must survive a navigation, because every row
is a door to `/situational-records` and plain `useState` would close the group
the reader just drilled out of. They must *not* persist across visits or
devices: ADR-0049 persists a **consent**, not a preference, and borrowing that
machinery would make the box-score bit look like a convention rather than the
exception it is.

**And the three row shapes are harmonized**, which was the other half of the
ask. The 18 season counts stop being stacked tiles and become W-L rows with one
figure — a count *is* a ledger row whose figure happens to be one number
(411 → 363px). The 10×2 by-inning matrix stays a matrix, because the register is
the point, but its cell goes from three lines to two, with record and win pct
sharing a line in the same order and colours as every other row (644 → 508px).

**What this changes in §5: nothing.** Ten type sizes, three spacings, no new
token. One number in §6 moves — **the scale ratio falls from 36:1 to ≈14:1**,
because Records was the numerator and the largest card on the page is now
Milwaukee's 40-man at 1,282px. That is §6's own argument carried out rather than
contradicted. One addition to the fold list: `--fs-ui` 14px is **not** one of the
ten and the shipped card uses it in three places; it folds to `--fs-cell` 11px.

Standing at 158 goes **4,511 → 2,033px**, Records' share of its own band goes
**72% → 37%**, and the page goes **20,006 → 17,528px**. The floor gains more than
the long page does: at 249 Records is 22% of the whole page against Milwaukee's
16%.

Full reasoning, the four rejected alternatives and the measured boards:
`canvas/records/records.md`.

#### Problem 2 — the floor

Measured, post-#1143, and it does not say what `scope.md` says:

| | 158 Milwaukee | 249 Wilson | **675 Los Mochis** |
| --- | ---: | ---: | ---: |
| Standing | 4,511 | 3,488 | **599** |
| Ranks | 2,533 | 534 | **534** |
| Games | 2,622 | 2,010 | **1,711** |
| Roster | 3,517 | 2,974 | **3,917** |
| Farm | 3,185 | 3,205 | *absent* |
| Money | 2,364 | *absent* | *absent* |
| About | 1,274 | 1,357 | **349** |
| **total** | **20,006** | **13,568** | **7,110** |
| bands | 7 | 6 | 5 |

**The floor is 7,110px — 36% of Milwaukee, not 68%.** And it is not thin
evenly: **Roster at 675 is 3,917px, larger than Milwaukee's 3,517px**, because
a winter club's 40-man is one uncapped list of 55 players (2,387px against
Milwaukee's 1,282px). So the floor page is *lopsided*, not small, and its
dominant card is **34% of the page** where Milwaukee's Records is only 16%.

That reframes problem 1: **the outlier is not Records. Every club has one card
that dominates its page, and which card it is changes by club.** A rhythm built
around Records specifically would not survive the floor. A rhythm built on
landmarks that appear whatever the band holds does.

**The mechanism is the question line, printed at every width of band.** A band
that asks its question and answers it in two cards reads as *answered briefly*.
A band that asks nothing and shows two cards reads as *truncated*. The question
costs one line of 13px body copy and it is the difference between the two.

Three things carry it:

1. **Every band head prints its question, on every club.** Identical treatment,
   identical position, 349px band and 4,511px band alike.
2. **A band a club cannot fill is absent** — it does not render and it is not in
   the jump bar. An absent band leaves no gap to read as broken. A *disabled*
   one would.
3. **About is last and no club can fail it**, so every page ends the same way.
   On 675 that is 349px of Ballpark and marks, under the same head, in the same
   place, as Milwaukee's 1,274px.

And for the one band where thinness has a *reason*, the note says the reason.
Ranks at 249 is one card, and its head reads:

> **RANKS** ————————
> Where this club sits among the rest — the league rank boards start at
> Triple-A, so this is the club's own leaders.

That is 2G's level qualifier, and it turns the page's thinnest band from an
apparent truncation into a stated fact about Single-A.

---

### 7 · The band tint: heard, and rejected

1D.4 names the band tint as step 2's job, so it gets a real hearing rather than
a silent omission. It is drawn on the canvas as **v2**, so the decision is
visible rather than asserted.

A tint can only be applied two ways, and both fail:

- **Every band tinted** — the page ground is then never seen, so the tint is not
  a band device at all. It is a new page colour, and it says nothing.
- **Alternating bands tinted** — now two band heads sit on two different grounds,
  which is a second band-head variant. "One treatment, zero variants" is the
  first number in §5, and this breaks it on the first page.

The Game Log's test settles it: **a new plane has to show an edge the manila
cannot.** A band's edges are already shown — by 48px of space and a 2px clay
rule that runs the width of the column. A tint behind that would be a second
statement of a boundary already drawn, which is the accessory Chanel says to
take off.

**No new token is proposed.** The band head is `--clay` at 0.5, shipped. The
sub-head carries no colour of its own. The jump bar is navy, shipped. If v4
turns out to need a colour after all, it is one alias-tier token, registered in
`src/lib/design/contrastPairings.js` with its computed ratio — an unregistered
token passes `check-contrast` unchecked, which is worse than failing.

---

### 8 · Defaults argued for, or avoided

| Move | Verdict |
| --- | --- |
| two-up card grid at phone width | **Used, for tiles only.** Shipped precedent: the report pages' `.slabrow` is `repeat(2, minmax(0,1fr))`, and Records' own splits are already 2-up. Never for cards |
| a different accent per band | **Avoided.** Seven accents would make the band head seven treatments |
| icons as band identity | **Avoided.** Seven names, set once, read faster one-handed than seven glyphs that have to be learned |
| a coloured pill on every heading | **Avoided.** The pill is the jump bar's device and stays there |
| centre-aligned band heads | **Avoided.** The trailing rule needs a start |
| a NEW shadow to separate things | **Avoided.** This is paper. `--shadow-card` on a card stays and is not a band device |
| a scroll progress indicator | **Avoided.** It would duplicate the jump bar, which already shows position |

---

### 9 · Corrections to `scope.md` and ADR-0082

Each proven by my own measurement on `f12208170`. Listed here and applied in the
same PR. ADR-0082 stays **DRAFT**.

1. **2E: "it is the only affiliate that keeps a Ranks band"** — false since the
   leaders ledger stayed in Ranks (#1148). 249 and 572 keep Ranks too, with the
   ledger as its only card. Measured: `/team/249/numbers` renders `.tledg` at
   534px. Nashville's Ranks is *two* cards (ABS 1,014 + ledger 534 = 1,548px),
   not one.
2. **2G: "Six heads"** over a table of **seven** rows.
3. **2E, the winter table: the Injured List does not render at 675.**
   `/team/675/roster?d=2026-01-15` measures three blocks — projection 1,530,
   40-man 2,387, the as-of banner — on two separate runs. The table lists
   "projection · 40-man · injured list".
4. **The floor is 7,110px, not "thin everywhere".** `scope.md` and #1106 both
   frame 675 as uniformly thinner. Its **Roster band is 3,917px, larger than
   Milwaukee's 3,517px.** Stated above in §6.
5. **The 664px figure for 675 is dead** (pre-#1143). It survives in 2E's prose
   as "the measured thinnest real page … at **664px**". The page is 2,355px as
   one tab today and 7,110px as five bands.

---

*Part two — the mechanism chosen for each problem and what it beat, the
element-by-element harmonization list, and the band-head spec — is written after
the canvas is drawn and Gary has picked a version.*
