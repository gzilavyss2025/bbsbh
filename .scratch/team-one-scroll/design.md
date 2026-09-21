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
| **Card head** | **5** | (a) themed bar — club fill, 3px club accent, club ink (`.thub-card__head`, `.tstats-card__head`, `.roster-super__head`, `.team-score__head` under `.is-themed`) — ~20 cards; (b) bar-less caption on paper — Run value, ABS challenges; (c) page-level group label with the cards under it — Team leaders (`.tledg`), Affiliation history and Made The Show, which have **no card of their own at all**, and in the ledger's case put a bar on each of its two sub-cards that is **`--accent-primary`, the app's navy, never the club's** (corrected by Phase 2 — §14·A and §16.1; this read "a themed bar"); (d) unwrapped caption, deliberate — Transactions (`.txcard`), because its deck bleeds past the gutter; (e) **none at all** — the season games grid (`.gamesgrid`) |
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

> **Settled at v4, and §4's "promoted unchanged" is not what shipped.** Part one
> was written before anything was drawn, as the brief asked. Drawing it changed
> two things, and this passage is the settled spec — §4 records what the idea
> *started* as and why, which is still the reason the head looks like the report
> pages' rather than like something new.

```
────────────────────────────────  full-bleed, --bw-heavy 2px, --ink-0
STANDING                          --fs-h2 21px display, --ink-0, --ls-caps
Where they stand, and the         --fs-small 13px body, natural case, --ink-1
record split every way.           16px beneath it
```

**The rule runs full-bleed, edge to edge of the page**, not from the end of the
words to the column edge. `BroadcastSection`'s trailing `--clay` rule is right
on the report pages, where a section head sits between *unbordered* tables and
charts drawn straight on the paper. It loses here, where every block is a
bordered card under a filled club-coloured bar. A card is inset 16px and
rounded, so **a rule that runs edge to edge is a plane no card can reach** at
any weight or colour — and a plane difference survives a one-handed glance where
a weight difference does not.

**The note is a standfirst, not the band's question.** `scope.md` names each
band by a question and v1–v3 printed it. A second screen answers; it does not
ask. Seven interrogatives are seven lines the reader must read to discover they
carry no information. The standfirst says what is *in* the band — and it is
still where 2G's level qualifier and Money's "not dated" note land, because
those are sentences.

The seven, as drawn:

| Band | Standfirst |
| --- | --- |
| Standing | Where they stand, and the record split every way. |
| Ranks | Where this club sits against its league. |
| Ranks, below Triple-A | The league rank boards start at Triple-A, so this is the club's own leaders. |
| Games | Every game this season, and where they played it. |
| Roster | Who plays here, and who arrived and left. |
| Farm | The org ladder, and the players climbing it. |
| Money | What the roster costs. This band does not move with the date. |
| About | The ballpark, and the marks this club wears. |

#### The sub-head is the same gesture, one step down

```
────────────────────────────────  full-bleed, --bw-hair 1px, --rule (pencil)
Record, split every way           --fs-h3 17px display, --ink-1
```

32px of air above the rule, 10px under it, 12px under the words. **Not** a
ruleless head with air, which is what v1 drew and what §6's diagram below still
showed until this was reconciled: at 17px in `--ink-2` with nothing else it read
as a caption on the Records card rather than as a division of the band, and it
was the weakest of the three heads despite being the middle one.

So the page reads **full-bleed = page structure, contained = card structure**:

| Level | Device | Plane |
| --- | --- | --- |
| band head | 2px ink rule + 21px | full-bleed |
| sub-head | 1px pencil rule + 17px | full-bleed |
| card head | filled club-coloured bar + 14.4px | contained |
| group label in a card | hairline + 12px graphite | contained |

Four levels from two devices and two planes.

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
════════════════════════════════════     full-bleed 2px ink rule
STANDING                                 band head, 21px, --ink-0
Where they stand, and the record          the standfirst, 13px, natural case
split every way.

  [ division standings + odds  272px ]   the ANSWER — 693px, under one screen
  [ Team Score                 421px ]

────────────────────────────────────     full-bleed 1px pencil rule, 32px above
Record, split every way                  sub-head, 17px, --ink-1

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
head and the two shipped scope controls is 826px — 0.98 of a phone screen.** The
whole card, every door in it, visible at once. A coarser cut fits better but
needs a fifth heading tier, which §3 says the page does not have.

| | shipped | **closed** | all open |
| --- | ---: | ---: | ---: |
| 158 Milwaukee | 3,238px | **826px** | 3,486px |
| 249 Wilson | 3,017px | **781px** | 3,161px |

Measured independently of the drawing that proposed it. **3.9× shorter closed**,
3.84 phone screens down to **0.98** — still one screen, and every door on it.

> **Two of these numbers moved after the outside design review, and one claim
> died.** Closed grew 66px when `Open all` and the shipped scope pills were
> taken to a 44px touch target (F3): 760 → 826 and 715 → 781. And **"fully open
> is shorter than today" is no longer true** — it was, before the league mark
> put a rank line on 49 marked rows. Open-all is now 3,486px against today's
> 3,238px. The trade is 248px for a league rank on every marked split, and it is
> only paid by a reader who deliberately taps `Open all ›`; the card's default
> is closed at 826px. Recorded rather than quietly dropped, because the earlier
> claim is in the commit history.

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

Standing at 158 goes **4,511 → 2,099px** of cards — standings 272 + Team Score
421 + Records 826 + day-of-week 173 + Comebacks 407 — Records' share of its own
band goes **72% → 39%**, and the page goes **20,006 → 17,594px**. Drawn as
`V4-Band.dc.html`, which measures **2,122px** from the opening rule to the last
card.

> `V4-Loaded` and v1–v3 still draw the 3,238px card, and that is deliberate:
> they were the comparison that chose the band **furniture**, at a time when
> Records was still that size, which was the right context for that decision.
> `V4-Band` is the settled band on the settled card (review F7). The floor gains more than
the long page does: at 249 Records is 22% of the whole page against Milwaukee's
16%.

Full reasoning, the four rejected alternatives and the measured boards:
`canvas/records/records.md`.

##### And the rows carry a league mark — Gary, 2026-09-21

> "I think it would be interesting to have a green or red tint on these records
> sections if they were in the top 5 or bottom 5 in that category."

**Green for top 5 at the level, clay for bottom 5.** Decided by Gary after being
shown what the real numbers do to it, which is the part worth recording.

**The finding that was put to him.** Ranks computed off every club's shard with
the app's own `buildRankingIndex` / `rankMetric` / `bestOrder` — the same three
functions `/situational-records` ranks with, so a mark here is one the ranking
page would agree with:

| threshold | Milwaukee (98-58) | Wilson (64-66) |
| --- | --- | --- |
| top/bottom **5** | 40 green · **0 red** · 54% of the card | 13 green · 10 red · 35% |
| top/bottom 3 | 28 green · 0 red | 7 green · 5 red |
| top/bottom 1 | 15 green · 0 red | 1 green · 0 red |

**No threshold produces red on a 98-win club**, because such a club genuinely is
not bottom-5 at anything — and any threshold loose enough to be interesting on
Wilson paints half of Milwaukee green. League rank measures the club, not the
split. The alternative put beside it was **±.200 from the club's own season**,
which gives Milwaukee 6 green / 6 red and Wilson 13 / 7. Gary chose league rank,
having seen both. His call, and the trade-off is his to accept.

**How it is drawn.**

- **A row** takes a 3px edge in its own gutter and inks its win pct in the same
  colour. Never a fill: a fill puts the figure on a second paper and costs it
  contrast, and this card is read by scanning one column.
- **An index line** takes a **proportional** edge — green sized to the top-5
  count, clay to the bottom-5, over a faint `--rule-grid` track. A mixed group
  reads as mixed, where one flat colour would lie. Wilson is where it earns
  itself: Scoring by inning and Starting pitching run clay, Leading and trailing
  is split, Defense and Schedule carry nothing at all.
- **The spread is NOT tinted**, and that was a fault caught by checking the data
  rather than the picture. The spread is ordered by win pct; *good* is not.
  Milwaukee's league-best row in Leading and trailing is **Trailing after 8 at
  .075** — rank 5 of 30, because winning from there is rare — so tinting the ends
  would have put **green on the lowest number in the range**, beside an untinted
  `.966`. Two orderings, one pair of colours. Dropped.
- **The rank is printed on the marked row, on its own line** under the figure it
  ranks — `1 of 30` — in the row's own tone. That is the house rule for a rank
  ("78 of 89", never "#78") and it does three things at once: it explains the
  colour where the reader is already looking, it stops colour being the only
  carrier of meaning, and it removes the need for a legend.

  > **This replaced a key at the card foot** (review F2). The key was below the
  > fold when the card was closed and much further away with groups open, so a
  > reader had to scroll away from the split they wanted in order to learn what
  > the colour meant. The reviewer proposed moving the key above the first group;
  > the top of the card is the most expensive space on the page, and a legend
  > there is furniture before content. Putting the number on the row costs a
  > line on marked rows only, and answers the question where it is asked.

**Two exclusions, both from running the real numbers.** Under **10 games** —
"Started a game with an opener, 1 of 30" is four games, and "Scoring in extra
innings, 1 of 30" is eight. And any split whose ordering **makes no claim about
quality**, gated on the shipped `ordersByQuality()` rather than a list kept here,
so *days in 2nd place* never takes a colour. `COUNT_METRICS` already carries
`better: 'high' | 'low' | 'neutral'` for exactly this.

**It must be precomputed, and that is what decides whether it can ship.**
Ranking one split needs every club at the level — **31KB × 30 clubs ≈ 940KB and
30 requests** — and ADR-0082 gives each band only its own data. So a **second
generator pass writes the marks into the `team-records` shard the band already
fetches**: zero extra requests, and it is the app's own build-time-fetch pattern
(`src/api/CLAUDE.md`). `canvas/records/rank-probe.mjs` is the prototype of that
pass.

**And the spread on an index line is floored at the same 10 games** (review F6).
Starting pitching ran `.500–1.000` at Milwaukee, where the 1.000 was
"Opposing starter exits before 2" — a **one-game** split; at Wilson it ran
`.167–1.000` on a four-game opener row. A range that advertises a one-game
extreme sends the reader to the least useful row in the group. Floored, they read
`.500–.731` and `.214–.526`. The split **count** still counts every split,
because every one of them is still reachable — only the range is floored, and it
now uses exactly the rule the marks already use.

**Scope.** The marks are computed for **Full season / All months**. The card's
two levers still work; the marks go when either moves off default, because a
month-scoped top-5 is a small-sample claim the card should not make.

**Cost: 66px**, all of it the 44px touch targets, not the mark. Closed is
**826px** (158) and **781px** (249) — still one screen. No new
token — `--field` and `--clay` are shipped, and the team batting/pitching tiles
already use exactly this green/clay convention for ranks, so this **harmonizes
two surfaces that currently disagree.**

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

---

## Part two — what was chosen, what it beat, and what #1107 builds

Written after the canvas was drawn and Gary picked v4 on 2026-09-21. Part one was
written before anything was drawn, as the brief asked; this is written after, and
where the drawing changed a decision the change is recorded here rather than
edited into part one.

Everything below was re-measured on `2b58a0454` against a live dev server at
iPhone 13 width on 2026-09-21 — `page-shape.mjs` for the card heights,
`scrape-phase2.mjs` for the card contents, `measure-jumpbar.mjs` for the jump
bar, `measure-heights.mjs` and `measure-furniture.mjs` for the drawings.

---

### 10 · Problem 1, the outlier: the mechanism, and the three it beat

**The mechanism is two devices, not one, and they do different jobs.**

1. **The sub-head divides the band.** Standing answers its question in the first
   screen — the division table and the season grade, 693px — and everything under
   *Record, split every way* is reference. That is what a records section in an
   annual is: the part you turn to on purpose.
2. **The card became an index that unfolds.** Twelve 44px ledger lines, each
   carrying how many splits are behind it and the spread of win pct inside it.
   3,238px to **826px** closed.

**What the sub-head beat.** Three alternatives, all drawn or measured:

| Beaten | Why it lost |
| --- | --- |
| **Two bands** — *Standing* and *Records* as separate anchors | ADR-0034's failure 2 is *interleaving*, not length, so two adjacent bands on one subject would not be that failure. It would be **eight anchors on a phone jump bar** — and §13 below measures that bar at 472px of pills in 358px of room at seven. Eight is not available. |
| **A ruleless sub-head with air** — what v1 drew | At 17px in `--ink-2` with nothing else it read as a **caption on the Records card**, not as a division of the band. It was the weakest of the three heads despite being the middle one. The full-bleed 1px pencil rule fixes it by moving it to the page's plane. |
| **No sub-head; let the band run** | Four screens of W-L splits with no statement that they are reference. The band's answer is then buried by its own footnotes, which is the complaint ADR-0034 recorded about the old page, one level down. |

**What the index beat.** Four alternatives, each measured, each recorded in
`canvas/records/records.md` §6 with its closed height. The two that came closest:

- **A third row of pills, filtering to one group** — the best closed height here
  (~550px) and the most consistent with the card's own two pill rows. It lost on
  three counts: three rows of controls and ~200px before a single figure; twelve
  group names squeezed to pill width destroys the one thing that makes the cut
  legible; and a filter says the hidden rows are **excluded** where a fold says
  they are **there**. Gary asked for nothing removed.
- **Three cards — Records / Scoring by inning / Season counts** — the most honest
  statement that three shapes are three objects. It lost on the **scope
  controls**: the half and month toggles govern all three, and this system has a
  band head, a sub-head, a card head and a group label, with **no section-level
  control row**. Three copies of an eleven-pill control is worse than the problem
  it solves.

**And the sub-head is used once on the whole page.** About has four unlike
modules and does not get one; Ranks at Nashville has two cards and does not get
one. #928's rule is a device for a question with two halves, not a way to fit
seven bands into six anchors, and the restraint is what keeps the level readable.

---

### 11 · Problem 2, the floor: the mechanism, and what it beat

**The mechanism is that the band head prints the same way at every width of
band, and a band a club cannot fill is absent.** The floor page was drawn whole
(`P2-Page-675`), and it holds for a reason part one predicted and the drawing
confirmed:

> **675 is UNTHEMED.** `headerThemeFor` returns null, so every card head is
> graphite on transparent over a hairline — which is *exactly* `.section__title`
> and *exactly* the Records group label. On that page tiers 3 and 4 and the app's
> generic section label are one object, and **the band head's 2px ink rule is the
> only structural colour on the page.** The band system carries the floor when
> the club theme cannot.

**What it beat.**

| Beaten | Why it lost |
| --- | --- |
| **A band tint** (1D.4 asked step 2 to decide; drawn as v2 so the rejection is visible) | Tint every band and the page ground is never seen, so it is a new page colour rather than a band device. Alternate them and the band head sits on two grounds, which is a second variant — and "one treatment, zero variants" is the first number in §5. The Game Log's test settles it: a new plane must show an edge the manila cannot, and a band's edges are already drawn by 48px of space and a full-bleed rule. |
| **A disabled anchor for a band the club lacks** | A jump bar's only promise is "tap this and you land there", and a disabled anchor breaks the control's one contract on the page of the club least able to argue back. It is also an apology, where the level identity is real and should be used. |
| **Padding the thin page** — a placeholder card, a "more coming" note | An absent band leaves no gap a reader can see. A *filled* gap is a gap a reader can see, and it says the page is short. |
| **A different, shorter layout below MLB** | Then a thin club's page is a different object, and the whole idea — same sections, same order, same paper, shorter chapter — is gone. |

**And here is the number that settles it, which part one could not have had.**
Measured on the drawings with `measure-furniture.mjs`, with the board's own
legend and jump bar taken off first:

| | cards | page | furniture | share |
| --- | ---: | ---: | ---: | ---: |
| **158 Milwaukee**, 7 bands | 17,594 | 19,148 | **1,554px** | **8.8%** |
| **675 Los Mochis**, 5 bands | 7,110 | 7,758 | **648px** | **9.1%** |

**The system costs the floor the same share it costs Milwaukee.** That is not
what fixed chrome normally does — fixed chrome on a smaller page costs
proportionally more, every time. It does not here because **the furniture scales
with the number of bands, and a thin club has fewer bands.** The floor pays for
five heads and five seams, not seven. That is the mechanism working, and it is
the best answer this document has to #1106's question.

**Two seams exist on the floor page and nowhere else, and both were drawn.**
Farm and Money are absent between Roster and About, and nothing marks it. And
**Roster at 675 is 3,917px, larger than Milwaukee's 3,517px**, because a winter
40-man is one uncapped list of 55 players — so the floor's dominant card is 34%
of its page where Milwaukee's largest is 16% of its own. The floor is
**lopsided, not small**, and a rhythm built on Records specifically would not
have survived it.

---

### 12 · What survived from the three shipped screens

§4 recorded what each screen contributed before anything was drawn. This records
what is still true after.

**`BroadcastBar.jsx` + `styles/report/charts.css` — the report pages.**

| §4 said | After drawing |
| --- | --- |
| "I am not designing a band head. I am **promoting** this one." | **Half true, and the half that changed is the important half.** The type is `BroadcastSection`'s exactly — display face, `--fs-h2` 21px, `--ls-caps`, with a note under it in the body face at 13px. The **rule is not.** Its trailing `--clay` rule runs from the end of the words to the column edge, which is right on a page of unbordered tables drawn straight on the paper. Here every block is a bordered card under a filled club-coloured bar, so the head is **full-bleed 2px `--ink-0`** instead. A card is inset 16px and rounded; a rule that runs edge to edge is a plane no card can reach. |
| "Tables are the default and a chart is the exception." | **Kept, unchanged.** Every board drawn here is a table or a ledger. |
| "Drawn in HTML, not SVG, except the line." | **Kept, unchanged**, and it now also covers the Records index's mark: a 3px row edge and a proportional index edge are both HTML, so `check-typography` can see every size on them. |
| Axis and tick labels use `--text-caption`, never `--graphite-soft` (3.10:1, a fail) | **Kept, and it did real work.** The Records index line's name is `--text-caption` where the shipped group head is `--graphite-soft`, so the reorganisation fixes a contrast failure as a side effect. |

**The Game Log.** One idea was taken and it is the one that killed the band
tint: **a new plane has to show an edge the manila cannot.** Nothing else from
that screen reached this page — `--album-board` is the Game Log's, `--seal` is
spoken for by #1138, and both warm browns on the manila ladder are taken.

**Today's `/team/158`.** §4 said the card is right and stays, and **nothing in
either phase changed it**: `--surface-card`, `--bw-hair` of `--border-rule`,
`--radius-md`, `--shadow-card`, `overflow: hidden`, `margin-top: var(--space-4)`.
The club-coloured head bar also stays, because it is the one place a club's
identity reaches the page.

> **What the drawing added to this.** The card is not applied evenly. Four
> modules on this page have no card at all, and §14 lists them. Giving them one
> is not a change to the card — it is the card, applied.

---

### 13 · The band-head spec — and the jump bar under it

This section is also the evidence #1113 asked for in 2G.

#### The band head

```
────────────────────────────────  full-bleed, --bw-heavy 2px, --ink-0
STANDING                          --fs-h2 21px display, --ink-0, --ls-caps
Where they stand, and the         --fs-small 13px body, natural case, --ink-1
record split every way.           16px beneath it
```

| Part | Token | Value | Note |
| --- | --- | --- | --- |
| rule | `--bw-heavy` / `--ink-0` | 2px | **full-bleed**: `margin: 0 -16px 12px` against the page's 16px gutter |
| title | `--fs-h2` / `--ink-0` / `--ls-caps` | 21px | display face, one weight (700), `line-height: 1.25`, 10px beneath |
| standfirst | `--fs-small` / `--ink-1` | 13px | body face, **natural case**, `line-height: 1.45`, 16px beneath |
| seam above | `--space-12` | 48px | |

#### The sub-head — the same gesture one step down

```
────────────────────────────────  full-bleed, --bw-hair 1px, --rule (pencil)
Record, split every way           --fs-h3 17px display, --ink-1
```

32px (`--space-8`) above the rule, 10px under it, 12px under the words.

#### So the page has four heading levels from two devices and two planes

| Level | Device | Plane | Uses on the longest page |
| --- | --- | --- | ---: |
| band head | 2px ink rule + 21px | **full-bleed** | 7 |
| sub-head | 1px pencil rule + 17px | **full-bleed** | 1 |
| card head | filled club-coloured bar + 14.4px | contained | ~20 |
| group label in a card | hairline + 12px graphite | contained | many |

**FULL-BLEED is page structure; CONTAINED is card structure.** That is the whole
rule, and it is why the hierarchy survives on a club with no theme at all: the
two page levels do not depend on colour.

#### What each of the seven heads carries — 2G, answered

| Band | Standfirst | Carries |
| --- | --- | --- |
| Standing | Where they stand, and the record split every way. | — (and the page's one sub-head) |
| Standing, at 675 | Where they stand, and the record by day. | **the floor has no Records card** |
| Ranks | Where this club sits against its league. | — |
| Ranks, below Triple-A | The league rank boards start at Triple-A, so this is the club's own leaders. | **2G's level qualifier** |
| Ranks, at 675 | Winter ball runs no rank boards, so this is the club's own leaders. | the same qualifier, one level further down |
| Games | Every game this season, and where they played it. | — |
| Roster | Who plays here, and who arrived and left. | — |
| Roster, at 675 | Who plays here. A winter roster is one uncapped list. | why the band is 3,917px |
| Farm | The org ladder, and the players climbing it. | — |
| Farm, on an affiliate | The Milwaukee Brewers' ladder, and the players climbing it. | **2G's parent-org qualifier** |
| Money | What the roster costs. This band does not move with the date. | **2G's "not dated" note** |
| About | The ballpark, and the marks this club wears. | — |
| About, on an affiliate | The ballpark, the marks, the orgs this club has worn, and who it sent up. | four modules, not two |

**Every qualifier 2G asks for lands in the standfirst**, because each one is a
sentence. The right-aligned action slot 2G proposes is used **zero times on this
page**, and reporting that is better evidence for #1113 than inventing a slot
this page does not use. The slot is still required — by the *player* hub, where
`SectionTitle`'s `action` prop has 38 uses.

> **A standfirst that describes a card the club does not have is the one thing a
> head must never do.** That is why there are four club-specific lines above. It
> was found by drawing the floor: Standing at 675 is the table and the day, and
> the MLB line promised "split every way".

#### The jump bar — and the one requirement a tab bar never had

The jump bar is the **shipped control** (`.teamtabs` / `.teamtabs__btn`): a
6px-radius button, 34px tall, `--fs-label` on `--surface-card` under
`--shadow-card`, laid out `flex: 1 0 auto` in a strip that scrolls sideways with
its scrollbar hidden. It is `HubTabBar`, so the player hub inherits every
decision here in the same commit. Club-neutral navy per ADR-0030.

| State | Drawn as |
| --- | --- |
| **resting** | no rule under it — there is nothing above it to divide from |
| **stuck** | one 1px pencil rule, and the page's own paper. **No new shadow**: this is paper, and the control already carries `--shadow-card` |
| **current section** | that band's button filled `--accent-primary` |

**Measured, by putting the band names through the real control on the running
page** (`measure-jumpbar.mjs`):

| Club | Bands | Pills | Room | Tabs today |
| --- | ---: | ---: | ---: | ---: |
| 158 Milwaukee | 7 | **472** | 358 | 460 |
| 249 Wilson | 6 | **405** | 358 | 367 |
| 675 Los Mochis | 5 | **347** | 358 | 358 |

The shipped bar already overflows at Milwaukee by 102px and at Wilson by 9px, so
sideways scrolling is not new. **The floor is the one club in the app whose bar
does not scroll.**

> **And this is the new requirement.** A tab bar's current tab is wherever the
> reader tapped it, so it is on screen by definition. A jump bar's current button
> changes by **scrolling the page** — and measured, the two that fall off the end
> at Milwaukee are **Money and About**, the last two bands. A reader four screens
> into a 17,594px page arrives in About and the mark that says so is off the end
> of a control nobody has touched. **The bar must scroll itself to keep the
> current band in view.** Nothing in `HubTabBar` does this today, because a tab
> bar never needed it.

---

### 14 · The harmonization list — what #1107 works through

§3 counted **eight repeated elements, thirty ways of drawing them, and no band
head at all**. This is that list resolved, element by element, with what Phase 2
added. Each row is a decision, not an observation.

#### A · The card head — 5 ways → 1, and the card is applied where it is missing

| Today | Where | Decided |
| --- | --- | --- |
| (a) themed bar — club fill, 3px accent, club ink | ~20 cards | **the one card head.** Unchanged |
| (b) bar-less caption on paper | Run value, ABS challenges | → (a) |
| (c) page-level group label, no card at all | **Team leaders, Affiliation history, Made The Show** | → **(a), inside a card.** The largest item on this list |
| (d) unwrapped caption, deliberate | Transactions — its deck bleeds past the gutter | → (a), with the deck still bleeding. A head does not have to clip its body |
| (e) none at all | the season games grid | → (a). A 1,302px block with no head is the only unlabelled object on the page |

> **And (c) hides a second fault, found by reading the CSS rather than the
> screen.** `.tledg__block-title` is `--accent-primary` — **the app's navy, never
> the club's**. So on Wilson an app-navy bar sits 16px under a club-navy one, and
> on Nashville under crimson. §3 recorded this as "a themed bar on each of its two
> sub-cards", which is wrong; the correction is in §16.

Drawn both ways on the canvas: `P2-About-249` is the four modules as they ship,
`P2-About-249-Carded` is the same four with the card applied. It is the one item
on this list big enough to be looked at rather than argued.

#### B · The rank cell — 4 ways → 2, split by what is being ranked

| Today | Decided |
| --- | --- |
| (a) tinted tile, `RUNS 802 2ND` | **kept, for a board of ranked stats** |
| (b) caption line, `3RD OF 30 CLUBS` | → (d) |
| (c) inline after the figure, `6 OF 64` | → (d) |
| (d) the word "org rank" as a card-head caption | **kept, as the head's note** |
| — | **and the house rule governs all of them: no `#`, and the rank on its own line from the stat it ranks — `1 of 30`, never `1st of 30` and never `#1`.** The Records index already draws it this way |

#### C · The table header row — 4 ways → 1

Graphite display caps at `--fs-label` on a `--rule-soft` hairline, right-aligned
except the first cell. The ABS card's sub-line inside the cell (`.rpt__sub`) is
kept as an option on that one row; the two "no header" cases (Records,
day-of-week) are ledgers rather than tables and keep no header, which is correct.

#### D · Bar / rail / plot — 5 ways → 5, deliberately

**Not harmonized, and this is the one row on the list that ends in "leave it".**
A stacked bar, a dot-plot rail, a scatter with a trend line, form rails and
workload marks answer five different questions. `charts.css` already states the
rule they share — tables by default, a chart only for what nine table rows hide —
and that rule is the harmonization. Forcing one mark on five questions would be
the accessory Chanel says to take off, in reverse.

#### E · The stat tile — 4 ways → 2

The tinted rank tile (B·a) and the **ledger row** — label left, figure right, one
dotted door under the label. The 18 season counts stop being stacked tiles and
become ledger rows (411 → 363px); the payroll tiles stay tiles because they are
a board of four figures, not a list.

#### F · The door out — 5 ways → 3, by destination

| Decided | Means |
| --- | --- |
| **a dotted underline on a label** | *this row opens a page* — every Records split, every season count |
| **a chevron link, `See all ›`** | *this card has a fuller page* — the card head's right slot, or the card foot |
| **a chevron on a 44px line** | *this folds, in place* — the Records index |

The standalone 22px `.thub-door` row (`Season schedule ›`) goes: on a one-scroll
page the band it pointed into is directly below it. And **the two affordances
must stay apart** — today the group caption has no affordance at all and the rows
carry the dotted underline, so the only thing that looks pressable is the thing
that leaves.

#### G · The prose explainer — 2 ways → 1

**Natural case, at the card foot.** The shouted-caps version inside the Comebacks
card is the bug: the house rule is shouted headings and natural-case body, and
`#root *` uppercases everything that does not opt out. The ABS card already does
it right (`text-transform: none`, caps-exempt).

#### H · The empty and degraded state — 1, undrawn → drawn

**The Ballpark at 93px (249) and 91px (675) is the page's one undrawn empty**: a
head and a single line of text, with no diagram, no dimensions, no photo and no
"not posted yet". It is a full card with most of it missing, and on the floor
page it is the second-to-last thing a reader sees. Carding the other About
modules makes it worse, not better — it becomes the only module in the band that
still looks like it failed to load. **#1107 designs this state.** The MiLB rule
already exists and says what it should do: fall back to `—` and say "not posted
yet" rather than render a shape with nothing in it.

#### I · The band head — 0 → the spec in §13

#### J · Type sizes to fold — the eleventh, twelfth and thirteenth

§5 allows **ten sizes and no eleventh**. Three shipped sizes are not among them:

| Size | Where | Folds to |
| --- | --- | --- |
| `--fs-num-lg` 22px | several cards | 34 where it is a hero figure, 16 where it is a tile figure |
| card-local `--fs-title-sm` / `--fs-title-md` | several cards | the card head at 14.4, or the sub-head at 17 |
| `--fs-ui` 14px | `.tstatrow__v`, `.trec__countv`, `.trecinn__rec` | `--fs-cell` 11px — §5 defines it as "mono figures in a table cell", which is what all three are |

#### K · Touch targets — two, both named rather than changed here

- **The Records scope pills are ~29px**, on both rows, under the 44px minimum.
  Pre-existing; the reorganisation neither worsens nor fixes it, and the index
  lines it adds are exactly 44px.
- **The jump bar is 34px.** The Records review held `Open all` to 44px (F3), and
  on a one-scroll page the jump bar is the page's *only* navigation. It is a
  strong argument for 44px, and it is **not made here**, because the control is
  `HubTabBar` and raising it moves the player hub in the same commit and costs
  10px of sticky chrome on every screen of both hubs. #1107's call, with the cost
  stated.

#### L · Contrast — one fix, already a side effect

`.trec__grouphead` is `--graphite-soft` (`#938C7C`), **3.10:1 on card paper — a
fail**. The Records index line's name is `--text-caption` (`#6B6558`), **5.44:1**.
Any other `--graphite-soft` on text follows it to `--text-caption`.

---

### 15 · What Phase 2 confirmed, and what it did not

**Confirmed, by re-measuring rather than trusting the brief.** Every page total
and every band, band by band, off the running page:

| Band | 158 Milwaukee | 249 Wilson | 675 Los Mochis |
| --- | ---: | ---: | ---: |
| Standing | 2,099 | 1,252 | 599 |
| Ranks | 2,533 | 534 | 534 |
| Games | 2,622 | 2,010 | 1,711 |
| Roster | 3,517 | 2,974 | 3,917 |
| Farm | 3,185 | 3,205 | *absent* |
| Money | 2,364 | *absent* | *absent* |
| About | 1,274 | 1,357 | 349 |
| **total** | **17,594** | **11,332** | **7,110** |
| bands | 7 | 6 | 5 |

Nothing moved. The floor is **40.4% of Milwaukee**, up from 36% before Records
was reorganised — the reorganisation cost the long page 2,412px and the floor
nothing, because the floor has no Records card to reorganise.

**Wilson is a check, not an artboard, and the system holds at six bands.** Its
Ranks (one card) and its About (four modules) are the two hard cases and both are
drawn. The rest of what differs is two *absences inside* bands — Games is two
cards rather than four, with no Highlights and no Photos below MLB; Roster is
three rather than five, with no bullpen health and no transactions deck — and
neither costs anything, because the band head carries the rhythm and it is
identical. **Farm is the one head that differs**, and it differs in the
standfirst, in the same slot as the level qualifier. The four cards under it are
Milwaukee's, unchanged, because all three affiliates share one org's system. 572
is identical to Wilson. 556 differs by one card: the ABS board slots in above the
ledger under the same head, 1,014 + 534 = 1,548px, with no new furniture and no
variant.

**Not confirmed, and left open.**

- **The loading state does not reserve a band's height.** §5's v4-Loading board
  draws one skeleton per card the band will have, because which cards exist is
  decided from cheap identity data before any fetch — but a skeleton cannot
  honestly pretend to be 3,917px tall, so the page jumps when the winter 40-man
  lands. Named rather than hidden, and it is worse on the floor page than on
  Milwaukee's, because the floor's single largest card is 34% of its page.
- **Nothing here measures the cold request count.** ADR-0082 sets ≤ 20 cold and
  ≤ 110 scrolled, and `count-requests.mjs` is the instrument. That is #1107's
  gate, not this document's.

---

### 16 · Corrections proved by Phase 2's own measurements

Applied in this PR. ADR-0082 stays **DRAFT**.

1. **`design.md` §3 — the leaders ledger does not put a themed bar on its
   sub-cards.** §3's card-head table says variant (c) "puts a **themed bar** on
   each of its two sub-cards". `.tledg__block-title` is `background:
   var(--accent-primary)` (`src/styles/23-box-score-detail.css:367`), and
   `--accent-primary: var(--navy)` (`src/tokens/colors.css:110`). It is the app's
   navy on every club. Corrected in §14·A, and it makes the element a *worse*
   collision than §3 recorded, not a better one.

2. **ADR-0082 — "each on its own tinted band" contradicts the band tint's
   rejection.** The decision paragraph says the seven bands sit "each on its own
   tinted band", and *Failure 1* says "seven heads, seven tinted grounds". §7 of
   this document heard the tint and rejected it, drawn as v2 so the rejection is
   visible. Both phrases go; the band's device is 48px of space and a full-bleed
   rule.

3. **ADR-0082 — "the six band heads this page needs".** There are **seven**, and
   `scope.md` §2G lists seven under a heading that says six. Both corrected.

4. **`scope.md` §2B — Roster at Milwaukee is 3,517px, not ~3,495px.** §2B sums the
   band with the Overview tab's 184px transactions deck. The deck that moves into
   Roster is the **Games tab's**, which measures **206px**. The band is
   1,245 + 467 + 1,282 + 317 + 206 = **3,517px**, which is the figure `design.md`
   and the page totals already use.

5. **`canvas/records/records.md` §5 is behind `design.md` §6.** It still reports
   closed at **760px / 715px** and claims "fully open is shorter than today". Both
   moved after the outside design review: closed is **826 / 781** (F3 took
   `Open all` and the scope pills to a 44px touch target) and open-all is
   **3,486px against today's 3,238px** (the league mark adds a rank line to 49
   marked rows). `design.md` §6 records both; records.md now points at it rather
   than repeating stale figures.

6. **`scope.md` §2E — the leaders ledger at 675 has one door, not two.** The table
   lists "team leaders 6+6" for the winter club. Measured, it renders `See all ›`
   alone: there is no parent org, so there are no org leaders to send anyone to.
   Small, and it is the kind of thing a full-page drawing catches and a module
   list does not.

7. **`scope.md` §2I and ADR-0082 — the jump bar needs a requirement neither
   states.** Both describe it as "the tab strip kept in place". Measured, the
   current-band mark can sit off the end of a control nobody has touched (§13).
   The bar must scroll itself. It is a `HubTabBar` change, so it is 2I's sixth
   item — it generalises to the player hub.

---

### 17 · What #1107 is handed

- **The band head and sub-head spec** — §13, in tokens, with the seven
  standfirsts and the four club-specific ones.
- **The harmonization list** — §14, twelve lettered items, each a decision.
- **Two new requirements on `SectionHead`** (#1113): a **sub-head level**, which
  neither `SectionMasthead` nor `SectionTitle` has; and the finding that this
  page uses the **right-aligned action slot zero times**, while the player hub
  uses it 38.
- **One new requirement on `HubTabBar`**: the bar scrolls itself to keep the
  current band in view.
- **Two things to design that do not exist**: the degraded Ballpark (§14·H), and
  a loading state for a band whose largest card is a third of the page (§15).
- **One thing not to do**: no band tint, no new token, no fifth heading tier, no
  eleventh type size, and no fourth block spacing.

*The canvas is https://claude.ai/artifact/NV6fz4ywi3d3nvX5rdRa8s — Phase 1 at the
left, Phase 2 at the right under its own title.*
