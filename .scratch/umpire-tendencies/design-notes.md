# Umpire Tendencies card — design notes

Companion to `mock.html`. Written for whoever implements
`src/components/umpire/UmpireTendencies.jsx` + the CSS partial.

---

## 0. What the card is FOR

Before any styling decision: this card answers one question a person scoring on
paper wants answered before first pitch — **what kind of zone is tonight's plate
umpire going to call?**

Everything else on the card (name, accuracy %, rank, consistency, challenge
rates) is corroboration. The old mock treated all six bands as peers, so nothing
led and the eye had nowhere to land. The redesign gives band 3 the whole top of
the card and demotes everything else to a second pass.

Glance order is now, deliberately:

1. **VERY HITTER FRIENDLY** — clay, 27px display, two-thirds of the card width.
2. **ERICH BACCHUS** — 21px, above it, but ink-neutral so it doesn't compete.
3. **LOW IN THE ZONE** on the highlighter band — the one concrete "where".
4. The axis, the caveat prose, the tiles, the provenance.

---

## 1. Band 3 — the scale. Rebuilt from scratch; this is the real work

**Old:** a 12px vertical gradient stripe beside five stacked text rows, one of
them boxed. That is a *list with a highlighted item*. Position on a vertical
gradient is not a reading anyone performs — you read the labels, find the boxed
one, and the gradient is decoration.

**New geometry: horizontal.** Left-to-right position is the fastest positional
judgement the visual system makes, and a horizontal axis is the only orientation
where "pitcher ← → hitter" can be labelled at the two ends without any text
touching a fill.

Five decisions, in descending order of load-bearing-ness:

### 1.1 The verdict is TYPE, not a highlighted row  ← load-bearing

The resolved bucket is set as a 27px condensed display line in `--clay-deep`
(the hitter pole's ink; a pitcher-friendly umpire gets `--navy`, neutral gets
`--ink-0`). It is the loudest element on the card. This is what makes the card
readable in under a second — the axis underneath is *evidence for* the headline,
not the headline itself.

`--clay-deep` on `--paper-2` is 7.3:1. `--navy` on `--paper-2` is 14.9:1. Both
clear AA comfortably; no guard exemption needed.

### 1.2 Block widths are their real z-widths  ← load-bearing, easy to "simplify" away

The five blocks are **25% / 16.25% / 17.5% / 16.25% / 25%**, not five equal
fifths. Those are the PRD's own bucket boundaries (z = −1, −0.35, +0.35, +1)
mapped onto a clamped **z ∈ [−2, +2]** domain.

This exists so the needle's x-position and the lit block are *the same
measurement*. Equalise the widths and the needle starts lying — a z of +1.05
would land in the middle of a block whose left edge is supposed to be +1.0.
If you change the buckets, recompute the widths from the same constants; do not
hand-tune them.

Two consequences worth knowing:

- The tails are clamped. The pool's real range is roughly z −3.5 … +2.1, so the
  most pitcher-friendly umpire in the league pins to the left edge. That is
  correct behaviour for a clamped axis, but the `aria-label` must state the
  bucket in words (it does) because the pixel position saturates.
- The neutral block looks narrow (17.5%) even though it is the *most populated*
  bucket (22 of 90). That is honest: the band is narrow in z, not in headcount.
  Do not widen it to "look fairer".

### 1.3 The lit block stands proud AND takes an ink outline  ← load-bearing

The occupied block is 26px tall against the strip's 13px, plus a 1.5px `--ink-0`
inset outline. Two redundant encodings on purpose: the card must survive
greyscale and colour-vision deficiency, and the navy↔clay ramp is *not*
value-symmetric (clay is a lighter ink than navy), so hue alone would leave the
pitcher and hitter ends reading differently. Verified in a greyscale render —
the strip still reads as a valley with one bar standing up at the right.

### 1.4 The needle lives entirely above the strip  ← load-bearing (contrast guard)

A 2px `--ink-0` stem + arrowhead, `translateX(-50%)`, positioned at
`(z + 2) / 4` clamped. It stops at the strip's top edge and never overlays a
fill. That is not fussiness: an ink needle drawn *through* the navy pole block
would be invisible, and a paper-coloured one would vanish on the neutral block.
Keeping it above means one treatment works at every position and
`check-contrast.mjs` never has to think about it.

### 1.5 The zero tick + "LEAGUE AVG" label  ← load-bearing, and the statistical point of the whole card

A 1px graphite tick at 50%, with `LEAGUE AVG` absolutely centred on it (not
flex-centred — the two pole labels have different widths, and an off-centre
label under a tick is worse than no label).

This is the visual expression of the PRD's most important sentence: *the league
mean is +0.179, not zero.* Without this tick the axis silently implies that the
centre is "no favour to anybody", which would mislabel a perfectly ordinary
umpire. Do not drop it to save 12px of height.

### 1.6 What I deliberately did NOT do

- **No numeric readout beside the verdict.** The caveat prose immediately below
  already carries `0.46 runs per game` and `1.6 standard deviations`; a second
  copy in figure form would be duplication at a width that can't afford it. I
  did re-set that `<b>` in `--font-mono` / tabular so it reads as *the figure*
  inside the sentence.
- **No per-block labels.** Five long strings ("VERY PITCHER FRIENDLY") cannot be
  set beside a 314px strip at any legible size, and putting them on it is
  forbidden. The two poles plus the headline carry the same information.

---

## 2. Band 4 — "Area to watch": highlighter, not kraft tape. This one I'd fight for

**Changed from the kraft-amber diagonal hatch (`--seal` / `--seal-hatch`) to a
`--marker` highlighter wash + a 4px solid `--marker` left rule.**

The argument:

1. **The hatch is a promise, and it's the app's most important one.** In this
   product the kraft diagonal hatch means exactly one thing: *there is a
   score-revealing number under here and it is sealed until you tap.* That
   texture is the visual half of the spoiler invariant. Spending it on a panel
   that is neither sealed nor tappable dilutes the single signal the app most
   needs to keep sharp. A user trained by twenty innings of SealBoxes will read
   a hatched panel as tappable and be wrong.
2. **`--marker` is literally the token for this.** `colors.css` documents
   `#E9C33F` as *"highlighter yellow — 'watch' flag"*. The app already uses it as
   a wash for "this is the row that matters right now"
   (`.umprank__row--today`, `color-mix(--marker 16%, --paper-2)`). "Area to
   watch" is the same semantic, and reusing it costs nothing new.
3. **The metaphor is truer.** Someone scoring by hand who wanted to flag a
   tendency would run a highlighter over that line in the book. Nobody would tape
   over it.

The mock hardcodes `--marker-wash: #F8EDCA` (= `--marker` at 18% over
`--paper-2`); ship it as `color-mix(in srgb, var(--marker) 18%, var(--surface-card))`.
`--ink-0` on it is 13.8:1.

The kraft `--seal` still appears on the card exactly once — the 3px masthead
underline — because that is `.metricbar`'s established treatment app-wide and
consistency there beats purity.

---

## 3. The 3×3 zone map: yes, include it. With a caveat that is a real bug

**Verdict: it earns its place.** "Low in the zone" is a phrase; the map is the
thing itself, and it makes the Area-to-watch band the only place on the card
where the reader sees an actual picture of the umpire's zone. It costs ~78×88px
sitting to the right of the phrase inside the same band, and it reuses
`UmpireZoneMap` verbatim — same cells, same `--accent-negative` outlines with
`over`-weighted stroke, same batter orientation. The mock draws Bacchus' real
`cellStrikeCall` / `cellMiss` against a league baseline computed the same way
`accuracyIndex()` does.

One addition to the existing component: **a `--surface-inset` plate rect behind
the grid.** Without it the highlighter wash tints every low-opacity navy cell
olive and the chart stops being readable as a chart. Add it as an optional prop
or a `.zonemap--onwash` modifier; don't tint the whole map.

### The caveat — and it is not cosmetic

Putting the map next to the phrase exposed that **the two are computed from
different partitions and currently disagree.**

- `accuracyTendency()` picks the largest of four *edge-region* tallies. For
  Bacchus that is **low 66 vs high 60** — a six-call lead out of 198 missed
  calls. Inside 1σ of a coin flip, printed as a confident finding.
- The 3×3 grid measured against the league miss baseline flags, in order:
  **high-and-outside (+4.6 pts), high-inside (+2.4), low-middle (+3.0)**. By
  cell rows his misses are actually high 92 / low 86 — the *opposite* direction
  from the region tally.

So the shipped card would show a headline saying "low" beside a picture whose
two heaviest flags are up in the zone. I left both unchanged in the mock because
I was asked not to alter the data — but this needs fixing before Phase 1 merges.
Two acceptable fixes:

1. **Derive the phrase from the same grid the map draws** (rank cells by `over`,
   name the winning cell's row/column). One source of truth, and it is the
   league-relative measure, which is the better one anyway.
2. Keep `accuracyTendency()` but **gate it on a margin** — require the top region
   to beat the runner-up by some real threshold (a binomial SE on the two counts
   is cheap), and render the band as "no strong tendency" otherwise. Roughly a
   third of qualifying umpires will fall out, which is the correct answer for
   them.

Option 1 is what I'd do.

---

## 4. Band 2 — the identity band as a real masthead

- **The `MLB` placeholder box is gone.** Replaced with the app's own
  **home-plate polygon** (the exact `HomePlateIcon` path from
  `UmpireTierGlyph.jsx`), 32px, in `--navy`. It means "this man was behind the
  plate", which is what the band is about; a league mark would have meant
  nothing and would have been a third-party asset to source.
- **The tier pill moved off the name line** into a right-aligned stack with an
  `ACCURACY` eyebrow above it. On the old mock the bare `AVERAGE` pill sat
  inline after the name where it read as a judgement on the *lean*, which it is
  not — it is the accuracy tier. Labelling it removes a genuine misreading.
- **The masthead gained a right-aligned aside** (`2026`), which is what
  `SectionMasthead`'s `children` slot is for. The bar now looks like the app's
  other mastheads instead of a centred banner.
- Name in `--font-display` at 21px; the `84 GAMES · 21 BEHIND THE PLATE` sub-line
  in `--font-mono`/tabular, because those are figures.

---

## 5. Band 5 — tiles: 2×2, not 4-up

The 4-up row at 340px forced 8px labels with `letter-spacing: .06em`, which is
below anything else in the type scale and unreadable on a phone. Changed to a
2×2 grid of `--surface-inset` chips — which is not a new idea, it is exactly what
`.umpage__accrow`'s own comment already prescribes:

> *"4 wraps to a 2×2 grid on a phone-width card rather than squeezing every tile
> down to an unreadable sliver."*

Ship it as `.umpage__acctile` with `flex: 1 1 120px`, unchanged, and let it wrap.
Phase 2's two challenge tiles get their own labelled sub-band with a hairline
above, so they read as a second topic rather than tiles five and six.

---

## 6. Density and rhythm

- One consistent 13px horizontal inset everywhere; the old mock ran 14 / 13 / 8.
- Removed a hairline: the watch band no longer carries its own `border-bottom`,
  so the map's caption is visually attached to the map instead of floating
  between two rules.
- Vertical rhythm is now three groups separated by hairlines — identity /
  lean+caveat / watch+caption — then the tiles on open paper, then provenance.
  Four rules total, down from six.
- Card height at 340px: **672px**. At 390px viewport that is about 1.4 screens,
  which is fine for a page host and acceptable in the modal (`max-height: 86vh`,
  already scrolls).

---

## 7. Constraints I found myself fighting

- **Global uppercase + long bucket names.** "VERY PITCHER FRIENDLY" is 20
  characters that cannot be shortened and cannot be sentence-cased. It sets the
  floor for the headline size (27px condensed is about the largest that stays on
  one line at 340px) and it is why the five bucket names are *not* printed beside
  the axis. In the mock's fallback font it wraps to two lines; with real IBM Plex
  Sans Condensed it will be one. Check this on device before nudging the size.
- **The palette has no true mid-tone between navy and clay.** A diverging ramp
  wants a light, low-chroma centre. `--graphite-soft` reads as a *third colour*
  rather than an absence, so the neutral block is `--rule-soft` — bare pencil
  paper — which reads as "nothing here", which is the correct meaning. The two
  inner blocks are the pole inks at 55% over paper rather than invented hues.
  Ship them as `color-mix(in srgb, var(--navy) 55%, var(--surface-card))`.
- **Two different "runs per game" on one card.** The `RUNS/GAME 1.5` tile is
  `favorMagnitude / games` — unsigned, both directions summed. The scale
  caption's `0.46 runs per game` is the signed net. A reader who notices both
  will conclude one is a bug. I left them as given, but the tile needs a
  different label before this ships — `RUN IMPACT/GAME`, or drop it (the signed
  figure in the caption is the more informative of the two and the tile is the
  weakest of the four).

---

## 8. Where I'd push back on PRD §3

1. **"White pointer chip → `--surface-inset` chip with `--border-rule`."** Don't.
   A chip is a *container for a label*, and the label it would contain is already
   the headline. A chip parked on a five-step strip is the broadcast's solution
   to a problem broadcast has (no room for a headline) and we don't. Use the
   needle + proud block instead — it locates a continuous value, which a chip
   cannot.
2. **"The five labels sit beside the bar, exactly as they do in the reference."**
   This is the one line in §3 I think is straightforwardly wrong at this width.
   It is what produced the list-with-a-highlighted-row reading. Two pole labels
   plus a headline carries strictly more information in strictly less space.
3. **§3 doesn't say what the scale's *domain* is** — only where the bucket
   boundaries are. Add the clamped z ∈ [−2, +2] domain (or whatever you settle
   on) to the spec, because the boundaries are meaningless as pixel positions
   without it, and two implementations will diverge silently.
4. **"`AREA TO WATCH` panel → Kraft-amber `--seal`/`--marker` flag panel."**
   Pick one and say which. §2 above argues for `--marker`, unambiguously, and for
   never reaching for `--seal` outside a real seal.
5. **§3's guard list should add `check-caps.mjs` scrutiny of the two prose
   exemptions** — the caveat paragraph and the zone-map caption are natural-case
   sentences, and they are the only two on the card. They are load-bearing (the
   caveat is the honesty of the whole metric) so they need to be registered as
   exemptions rather than discovered by a failing lint run and uppercased away.
6. **§1 says nothing about the card's height in the modal.** At 672px it fits,
   but the modal already stacks the zone map and five game rows *below* whatever
   goes in. If this card ships into `UmpireAccuracyModal`, the modal's existing
   zone-map section becomes a duplicate of this card's and should be dropped
   there.

---

## 9. What I left alone, on purpose

- **The masthead.** Navy bar, 3px kraft-seal underline, condensed uppercase
  title — it was already an exact reproduction of `.metricbar` and it was right.
  I only added the right-hand aside slot.
- **The caveat paragraph.** Its wording, its natural case, and its position
  directly under the axis are all correct. It is the most trustworthy thing on
  the card and it should not be shortened, moved into a popover, or set smaller
  than 10.5px.
- **The overall band order.** Six bands, same sequence as the reference. The
  structural match was already achieved; the problem was never the order.
- **The provenance line.** Centred graphite mono, correct as-is.

---

## Final polish — 2026-08-06

Client direction overruled parts of §1, §2 and §8 above. Those sections are kept
as the record of the earlier pass; where they conflict with what follows, **this
section wins.**

The direction, in three lines: *almost no sentences, no descriptor text, as close
to the source graphic as possible*; *restore the vertical five-band stack*; *no
red and no green on that bar*.

### 1. Prose: removed, all of it

Deleted from both cards:

- the four-line caveat paragraph under the scale (`.cap`);
- the two-line zone-map caption (`.watch__cap`);
- the 27px `VERY HITTER FRIENDLY` verdict headline (redundant once the stack is
  back — the boxed band *is* the verdict, and printing it twice reopens the
  "which one is it" question the headline was meant to close).

Nothing on either card is a sentence now. Every string is a label, a figure, or
the one asterisked footnote — which is the source graphic's register exactly:
count the words on it, there are about thirty.

The one fact that genuinely had to survive — **the scale is measured against a
league average, not against zero** — is now carried by two terse table
annotations rather than a paragraph:

| Where | Sets |
| --- | --- |
| Column head, right of `ZONE LEAN` | `NET R/G` — states the unit once |
| Right cell of the `NEUTRAL` row | `LG AVG +0.18` |
| Right cell of the occupied row | `+0.46` |

Putting `+0.18` **on the neutral row** is the whole argument in one move: the
band called "neutral" sits at +0.18, not at 0. That is stronger than the sentence
was, because it is positional rather than assertive. The `1.6 standard
deviations` figure moved into the `aria-label`, which is where a screen-reader
user needs it and where it costs no ink.

### 2. The scale: vertical stack restored, continuous position kept

Back to the source's geometry — a narrow ramp on the left, five band names
stacked beside it, the occupied band boxed. What I kept from the previous pass is
the thing it got right: **the card shows where on a continuum he falls, not
merely which bucket.**

- **Rows are equal height (24px).** Uneven rows sized to their true z-widths
  (§1.2's 25/16.25/17.5/16.25/25) look like a typesetting error in a label list,
  and at 340px the narrow ones fall below a legible line box.
- **The caret carries the continuous reading.** An ink triangle in the gutter,
  `top` set by mapping z through the band boundaries onto the equal-height rows:
  z is located within its own band, then that fraction is applied to that band's
  row. Bacchus (z ≈ +1.6, band domain clamped to [+1.0, +2.0]) → 60% into band
  five → `top: 92%` of the 120px stack. So the caret always lands **inside** the
  boxed band, and its offset within that band is the sub-bucket reading.
  Piecewise-linear rather than globally linear — but every claim the card makes
  (which band; where in the band) is true under that mapping, and the earlier
  global-linear axis is what forced the uneven blocks.
- **The ramp is continuous, not segmented.** Nothing on it can contradict the
  caret, so the two encodings can't drift.
- **Two redundant encodings survive** (§1.3's real point): paper-3 chip + 1.5px
  `--ink-0` keyline + ink type on the occupied row. Greyscale- and CVD-safe
  without the ramp.
- **No text on the ramp.** Labels are in a separate column on open paper.

### 3. The ramp: no red, no green

`--clay` is gone from the scale entirely. The ramp follows the source's own
blue→yellow, mapped onto this palette:

```
linear-gradient(180deg,
  var(--navy)   0%,  var(--navy)   16%,   /* very pitcher friendly */
  var(--rule)   46%,                      /* neutral — bare pencil paper */
  var(--seal)   72%,                      /* kraft amber */
  var(--marker) 92%, var(--marker) 100%)  /* highlighter yellow */
```

Four notes on it:

1. **Holding the poles** (0–16%, 92–100%) matters. A pure two-stop navy→rule
   interpolation spends the whole cool half in a desaturated olive-grey and the
   pitcher pole stops reading as a pole. Holding navy for the top band's height
   fixes it; the same hold at the bottom keeps the hitter pole a clean gold.
2. **`--rule`, not `--rule-soft`, at the midpoint.** `--rule-soft` on
   `--surface-card` is close to invisible and the stripe appeared to break in
   half. `--rule` still reads as bare paper — "nothing here", which is what
   neutral means — while staying a visible object.
3. **A 1px `--rule` hairline around the stripe** for the same reason.
4. **Luminance is not monotone** (dark → light → mid-dark → light). Neither is
   the source's (blue → cyan → green → yellow). It is monotone in *hue
   temperature*, which is what carries "cool end / warm end", and neither end
   carries a good/bad valence.

`--field` appears nowhere. `--clay` survives on the card in exactly one place:
the zone map's `over` cell outlines, which is `UmpireZoneMap`'s existing
`--accent-negative` treatment and means "more misses than baseline" — a real
negative, on a component we are reusing verbatim.

### 4. Area to watch: navy panel, not the highlighter wash

**Reversed from §2 above, and for a reason §2 could not have anticipated:** the
ramp now ends in `--seal`/`--marker`. A `--marker` wash panel sitting directly
beneath a stripe whose bottom quarter is `--marker` reads as *linked* — as though
the yellow band and the yellow panel were one statement. They aren't.

So the panel takes the source's own treatment: solid `--navy`, paper text, a
`--rule` eyebrow. That gives the card exactly two ink anchors (masthead and this
panel) and makes the one concrete "where" the loudest thing below the fold.

§2's core argument still stands and is still honoured: **the kraft diagonal hatch
is not used here.** `--seal` appears only as the masthead's 3px underline
(`.metricbar`'s established treatment) and as a ramp stop. The hatch — the
texture that means *sealed, tappable* — is untouched.

`--marker` is now spent on the ramp, where it does load-bearing work, rather than
on a panel that was neither sealed nor tappable.

### 5. The zone map: kept, caption dropped, no key added

It earns its place for the reason §3 gave — "low in the zone" is a phrase, the
map is the thing itself — and it now sits on `--surface-inset` against the navy
panel, which is the plate rect §3 asked for, so the cells keep their value.

**It gets no caption and no legend.** The band's own label is `AREA TO WATCH`;
the outlined cells *are* the areas to watch. A key would be re-explaining the
label directly above it. If usability testing says otherwise, the source's idiom
for it is a footnote, not a caption.

### 6. `RUNS/GAME 1.5` → `RUN IMPACT/GM 1.5` — relabelled, not dropped

**Call: relabel.** The two figures are now unambiguously different in both label
and form:

- the lean band's `+0.46` under a `NET R/G` column head — **signed**, and it
  keeps its `+`;
- the tile's `1.5` under `RUN IMPACT/GM` — **unsigned**, "impact" reading as
  magnitude.

Dropping it was the alternative and remains defensible (§7 called it the weakest
of the four), but it fills the 2×2 honestly and it answers a different question —
*how much do his misses move a game at all*, in either direction — which nothing
else on the card answers. **If the implementing engineer would rather have three
tiles than argue this label, drop it; do not ship it labelled `RUNS/GAME`.**

### 7. Kept from the previous pass, deliberately

- The masthead, verbatim.
- The 2×2 tile arrangement, and its reasoning (§5). Re-set as a **ruled table**
  — hairline cross-rules to the card edges, label over figure, centred — rather
  than four floating chips. Same information, one less kind of object, and it
  matches the source's own two-tile divider.
- The home-plate glyph over a fake league crest (§4).
- The `ACCURACY` eyebrow over the tier pill (§4) — it fixed a real misreading.
- The provenance line, verbatim.
- Both prose blocks in the page's bottom `.note` chrome, which is now the *only*
  natural-case text on the page. The `Runs/game 1.5` reference in the second one
  is updated to the new label; every substantive clause is unchanged.

### 8. Also changed

- **Name split across two lines** — `ERICH` small and tracked over `BACCHUS` at
  26px — which is what the source does and what lets the surname carry real
  display weight at 340px.
- **Card height 340px → 537px** (Phase 1), down from 672px. Fits the modal with
  room now.
- Every colour on the card clears WCAG AA: `--graphite` on `--surface-card` is
  5.36:1, `--rule` on `--navy` 8.15:1, `--text-on-ink` on `--navy` 13.5:1,
  `--ink-0` on `--surface-inset` 15.8:1. `--graphite-soft` (3.1:1) is no longer
  used for any text.
- Verified in Chromium at 390px and at desktop width. No horizontal overflow.

### 9. Still wrong, in my view

1. **The `AREA TO WATCH` phrase still disagrees with the map beneath it.** §3's
   caveat and PRD §2 Band 4 both say so; the data was not mine to change. This
   is the one thing that must be fixed before Phase 1 merges — derive the phrase
   from the same 3×3 grid the map draws.
2. **The fallback font.** IBM Plex Sans Condensed is not installed in the
   verification container, so everything above was checked in a *wider* face than
   ships. `VERY PITCHER FRIENDLY` at 13px fits with ~120px to spare in the
   fallback, so the real font has no risk; the Phase-2 watch line wraps to two
   lines in the fallback and probably will in Plex Condensed too — that is fine
   and faithful, the source's own watch line is two lines. Check the identity
   band on device: `BACCHUS` at 26px plus the tier pill is the tightest row.
3. **The ramp's band boundaries are implicit.** The stripe is continuous while
   the rows are discrete, so a very precise reader could ask where band three
   ends on the stripe. I judged tick marks not worth the clutter at 12px wide —
   the boxed row answers it — but if the implementer wants them, they belong as
   1px `--surface-card` notches at 25 / 41.25 / 58.75 / 75%, **not** as
   segmentation of the fill.
4. **`RUN IMPACT/GM` is a compromise, not a great label.** See §6.

## Trim pass — 2026-08-07 (maintainer direction)

Two removals, both requested directly.

**The `NET R/G` column is gone** — the column head, the per-row figures, and the
`LG AVG +0.18` marker that sat in the NEUTRAL row. The band label and the caret
are now the entire reading.

Worth recording what this costs, since it is invisible once removed: that marker
was the only thing on the card saying the scale is measured against a **league
average of +0.18 runs/game to hitters** rather than against zero. The buckets are
still z-scored against the qualifying pool, so NEUTRAL still means "an average
umpire", not "favours nobody" — but a reader can no longer tell. The figure
survives in the `aria-label` and in PRD §3. If it ever needs to be visible again,
the reference graphic's own idiom is an asterisked footnote, not a column.

**The `ACCURACY` / `AVERAGE` tier pill is gone from the identity band.** Accuracy
now appears exactly once on the card, as a tile. The tier vocabulary
(`UmpireTierPill` / `UmpireTierGlyph`) still does its job on the lineup page's
Umpires card, which is a better home for it than a header that was competing with
the umpire's own name.

Orphaned CSS was removed with the markup (`.id__tag`, `.id__tagk`, `.pill`,
`.lean__u`, `.row__n` and its `is-on` variant), and `.lean__hd` lost a
`space-between` that no longer had two children to separate.

Card height 538px → 547px. It grew slightly: the identity band no longer has a
right-hand column, so the name block sets on its own and the band relaxes. No
horizontal overflow at 390px.
