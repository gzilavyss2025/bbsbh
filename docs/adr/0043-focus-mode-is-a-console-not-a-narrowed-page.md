# ADR-0043 — Focus mode is a console, not a narrowed page

Status: accepted (2026-08-10)

## Context

Focus mode is what the innings viewer becomes while the half on screen is still
sealed: the reader taps "Next at-bat", reads the result, pencils it onto paper,
glances at bases and outs, and taps again. Forty times a half-hour, for three
hours. It is the app's core loop, and the screen it happens on is the one screen
that has to hold up under repetition.

The first implementation built it as **the ordinary innings page with things
taken away**. It kept the same `.innings__grid`, the same `.pbp__atbat` card,
the same floating scorebug dock and the same two-row action bar, and then took
268px away for a reference rail, folded the stat row behind a flap, and hid
everything else.

Every defect that followed came from that one premise, and there were a lot of
them. A card tuned for a ~780px reading column was re-hosted at ~478px with no
responsive answer, so its pitch list overprinted the batter silhouette and the
matchup names truncated to a single pixel of width. The reference rail was a
fixed-size container for content that ranged from empty to 1006px tall, so it
was either a wasted column or a nested scrollbar. The trail — the navigator for
the card — was a horizontally scrolling strip that hid the earliest at-bats of a
long inning and sat two cards below the thing it navigated. The floating dock,
which exists to survive a long scrolling page, kept landing on top of a page
that no longer scrolled: it covered the reveal button entirely at iPad width and
covered the at-bat card that focus mode had just scrolled into place on a phone.
(That auto-scroll went with the rebuild — the stage mostly fits one viewport, so
revealing an at-bat replaces the card where it already is rather than travelling
to it. Nothing in focus mode calls `scrollIntoView` today; if a comment says
otherwise it predates this.)

Taken one at a time these read as bugs. Taken together they are one decision
being wrong.

## Decision

**While a half is being scored, this screen is an instrument, not a page.**

> Focus mode is composed for its own loop rather than inherited from the
> unfocused page: an **anchored** game-state band across the top, ONE at-bat as
> a full-width hero, a **wrapping** trail directly beneath it, a **tabbed**
> reference column beside it, and a **single solid row** of action at the
> bottom. Nothing floats over anything.

Four things follow from that, and each replaces a piece of inherited furniture.

### 1. The scorebug is placed, not floated

The dock is a 246px portrait card because it has to survive floating over a long
scrolling page. Focus mode has no such page. A fixed overlay on a surface that
mostly fits one viewport is pure collision with zero benefit, and the
tap-to-move-corners affordance was an apology for that collision rather than a
feature — a HUD the reader has to manually dodge is a design failure.

So in focus mode the same component, with the same props, unrolls into a
horizontal band and parks at the top of the stage. It is the same scorebug; only
its placement and shape differ (`ScorebugMount.jsx` owns the choice). Navy
ground under a kraft rule, deliberately the masthead signature `.half__title`
already carries, so the band reads as the game's ink header rather than as a
floating chip from somewhere else.

**The dock survives unchanged outside focus mode**, corner-stepping included.
The unfocused page really does scroll past its own linescore, which is the
condition the dock was built for. This decision is about where the scorebug
lives on one screen, not about deleting a feature from the app.

### 2. The at-bat gets more room in focus mode, not less

This is the inversion that made the first pass indefensible: the mode called
"focus" gave the thing you are focused on a narrower column than the mode that
shows everything. Focus mode overrides `.pbp__atbat`'s inherited 38fr/62fr split
and stacks the pitch-zone pane *below* the card, so the card takes the stage's
full width. The scorebook denotation — the code you actually pencil — steps up
the type scale, because it is the payload.

The header (`AtBatHero.jsx`) **replaces** the card's ordinary name row rather
than sitting above it. The strip it grew from was additive, so the batter's name
was printed twice on the one card the whole screen is built around. The header
now owns the identity outright: name, position, pinch-runner chain, RBI chip.

### 3. Reference is tabbed, and only one section exists at a time

A hand-scorer needs exactly one of these at a time, and which one is predictable
from what they are doing — penciling the next name, decoding a 6-3, logging a
pitching change, checking who is left to hit. Stacking all five into one
scrolling column served none of those moments and produced the scrollbar.

The column is permanently open, which retires `railOpen` and its Show/Hide flap
entirely. The reserved track — not a piece of React state — is what keeps
opening a section from reflowing the at-bat card, which was ADR-0010's
requirement all along. On a phone the tabs themselves become the surface: a chip
row that opens the same panel in a sheet, already showing the section asked for.

### 4. The running line is demoted, not removed

Mid-half the linescore duplicates the console band's score, and writing R/H/E is
a *between-halves* act — the moment the half closes it commits, focus mode ends,
and the ordinary page returns. So in focus mode `RollingLine` moves **below** the
at-bat and its trail instead of sitting above them, and the hero takes the top of
the stage.

It was briefly removed outright, and that was wrong: `RollingLine`'s run cells
double as the **half-inning navigator**, and they are the only way to reach a
half that is not one step away — `.inningnav`'s Back/Next move ±1 only.
`e2e/innings-page-turn.spec.js` drives every one of its transitions through those
cells and caught the removal immediately. Demoting a surface is a layout
decision; deleting the only affordance for a whole navigation path is not, and
the two should not be confused because they save the same 90px.

## What this does NOT change

Nothing here touches the seal. Every value on this screen arrives already
resolved and already reveal-gated; focus mode adds no second reveal boundary,
and revealing stays the floating bar's "Next at-bat" alone. `revealRunsThrough`
moved down one component with the scorebug's placement logic and is reached
under exactly the gate it always was — `spoiler-manifest.json` records the move.
The stat/WPA row is hidden by CSS visibility only: no seal, no caller-gated
pre-pitch selector (ADR-0010), no fetch is affected either way.

## Consequences

- Focus mode is now genuinely its own composition, so a change to the unfocused
  innings page no longer silently reshapes the scoring loop. That cuts both
  ways: the two can drift, and a future change to the at-bat card must be
  checked at both widths.
- `61-focus-mode.css` outgrew the 600-line file cap. `src/styles` is a flat
  directory at its own ratchet, so it could neither fold back into an earlier
  partial (it must load after everything it overrides) nor split into a 68th
  numbered sibling. It subdivided into `src/styles/focus/` instead — the first
  partial here to take ADR-0038's own prescription. A future split under the
  same pressure should follow it rather than reach for another sibling.
- The floating bar gains a second layout. `e2e/reveal-hit-area.spec.js` pins the
  behaviours that must survive it — a near miss still reveals, Refresh still
  keeps its own taps, and the page above the bar still keeps its own — and those
  assertions were carried over to the new geometry rather than relaxed.

## Amendment (2026-08-11): the band is placed, not pinned, and wears the dock's own size

Placed at the top of the stage was the decision. **Sticky** was not — it arrived
with it and cost more than it paid.

Three things come off, all on the band:

- **The phone sticky is gone** (`.consolebar`). Desktop had already dropped the
  pin for the reason that applies just as well to a phone: a bar that follows
  the reader down the page spends the top of every scroll on a header. While a
  half is being scored, the reference is the at-bat card directly under the
  band, and it moves with it. The band is now `static` at every width, so
  `position: static` in the wide block is a restatement of the grid placement,
  not an override.
- **The phone scale-up is gone** (`.gamehud--console`'s `max-width` block).
  Bigger type, a 92px strip and larger pips answered "the band has the whole
  width to itself down here". What they bought was ~40px of the smallest
  viewport, spent ahead of the card being read. The band keeps the dock's own
  sizing at every width now — full width on a phone, dock scale.
- **The height floor comes off the BLANK band** (`.gamehud--console.gamehud--blank`).
  The floor stops the band collapsing when the batter and pitcher rows unmount;
  what it actually rendered was ~60px of bare navy under the strip, on every
  landing, since a half is blank until its first at-bat opens. A dark slab reads
  as a rendering fault, which is worse than the shift it prevents — and that
  shift is now small, and lands as a half ends rather than mid-read.

`--console-hud-h`'s phone value follows the measurement down, 167px -> 126px.
Both numbers are still measured, and the due-up cards beside the band still
stand on them.

## Amendment (2026-08-11): the held state is ONE at-bat too, and Summary is the whole half

Issue #660 asked whether `held` — focus mode outliving the half it is scoring,
until the reader taps Summary — should exist at all, and recorded that while it
did, "Rest of half" and the final commit both rendered the WHOLE half in the
one-at-bat hero layout. **`held` stays. The layout is what was wrong.**

The tap that reveals a half's last at-bat is the tap that commits the half:
`stepCap` goes null, `stepping` goes false, and the focus window — which was
gated `focusOne && stepping` — went with it. So the play that ends an inning
answered by dumping every at-bat of that inning onto the screen at once, at the
exact moment the reader is writing that play down. A GIDP to end the top of the
1st put four cards where one had been.

The window is now gated on `focusOne` alone (`PlayByPlay.jsx`), with the step
count measured against the full array once there is no cap left to measure
against. Focus mode holds ONE at-bat — the one just revealed — for as long as it
is focus mode, commit or no commit. That is what ADR-0043 already claimed the
mode was.

**Summary is the answer to the other half of the question.** "How did the half
end up" is a real thing to want, and it is a different screen: the whole half's
cards, the R/H/E/LOB stat card (`.innings__row2`, hidden until then — see
`focus/stage.css`, whose comment used to justify itself with a claim `held`
falsified), the ordinary page. One tap, on request, never automatically.

`focus.postHalf` and the Summary/next-half bar are unchanged; this is the layout
behind them, not the controls.

## Amendment (2026-08-12): the fourth tab is EXTRAS, and it holds the card header

The reference panel's fourth tab was BENCH and held exactly what its name said:
the batting club's bench and the fielding club's bullpen. It is now **EXTRAS**,
and the same two lists are followed by the fill-in facts a scorer copies into a
card header — each club's manager and uniform, the umpire crew, and the date,
ballpark, first pitch and weather (`ExtrasFacts.jsx`).

Those facts existed only on the two lineup pages. Reaching them from a half being
scored meant leaving focus mode, crossing two section tabs, reading one line, and
coming back to find the place again — for a value that does not change all game.
Decision 3 above says a scorer needs exactly one section at a time and that which
one is predictable from what they are doing; "filling in the top of the card" is
one of those moments, and it had no tab.

It joins the bench rather than becoming a fifth tab because a fifth tab does not
fit the strip at 328px, and because these are the same kind of thing: what the
half on screen is **not** about. The benches still lead — they answer a question
this half is asking, the facts answer one asked once and then rarely.

**Nothing here is sealed, and nothing here needed to be.** Every value comes from
`api/select.js` (`selectGameInfo` / `selectOfficials`), the spoiler-free module,
read at the component's top level exactly as the pre-game lineup page reads it;
`managers` / `uniforms` / `scorebookWeather` are the props `GameView` already
resolved for the box score and both lineup pages, so the innings screen fetches
nothing on this tab's account. A crew assignment, a jersey, a first-pitch time
and a temperature describe the staging of a game, never its score — the same
scope argument ADR-0034 makes.

## Amendment (2026-08-12): a half that opens with a new arm announces it

Decision 1 removed the Now Pitching card from focus mode outright, on the
argument that a mid-half change belongs in the feed and already renders there as
the same `PitcherNotice`, so only the restatement of an arm nothing had happened
to was being dropped.

That argument is true of a change made mid-half and **false of one made between
halves**, which is the commonest pitching change in baseball. Two other places
deliberately decline to announce a pre-pitch change *because this card already
did*: `computeHalfInningFeed` drops it from the feed (its `anyPitchInHalf`
guard), and `PrePitchChanges` drops it from the staged list. Remove the card and
all three are silent — the reader meets the new arm as a different face in the
hero, after the pitch they were about to write down.

The card comes back in **one state**: the half opens with an arm that just took
the mound (`selectIsFreshPitcher` — the app's existing answer to that question,
already choosing between "Now pitching" and "Pitching" for the card's own
label), and nothing of the half has been unveiled yet (`!startedRevealing`).
That second gate is the one `PrePitchChanges` two blocks down already carries,
and it makes this card the pitching-change member of the same staged set: it
stands where the reader is about to unveil, and steps aside for the at-bat
instead of sitting above it.

The redundancy that motivated the removal is untouched. Once an at-bat is up,
`AtBatHero` owns the matchup identity and the console band names the arm — and
the card is gone by then. A half whose pitcher simply carries over still shows
nothing at all.

## Amendment (2026-08-12): the whole-half view returns as a quiet link, and the invisible chart stops being computed

Two follow-ups from the owner's review of the week's focus-mode PRs.

**"See the whole half" is back — under the trail, not on the bar.** The #685
amendment removed the Summary button and sent the half's numbers to the console
band (`HalfTally`), which answered "what do I write down" and left "how did the
half unfold" two navigations away: page off the half and come back. That is the
wrong price for a question a scorer asks at the end of most halves. The
post-half hold now offers one quiet paper-pill link under the trail
(`FocusControls.jsx`) that drops that one half out of the focus layout — the
ordinary revealed page, in place. The half of #685 that stands is the bar: it
still has exactly one forward action, and the link disappears with the layout
it changes. `postHalf` (the fact) and `focused` (the layout) part ways again
exactly where the old `held` flag did, and navigating to any other half resets
it.

**The win-probability pair is not computed while focus mode is on.** Both
selectors re-walked the win-prob feed on every "Next at-bat" tap to grow a
chart that focus mode never renders (`InningPage`'s `!focusOne` gate) — the
same build-what-folds cost #686 removed from the stage's hidden surfaces,
one layer up. Since the step clamp only ever activates on the next-to-reveal
half, which is always sealed, which is always focus mode, the unfocused paths
are byte-for-byte what they were; the chart fills in the moment focus ends.

## Amendment (2026-08-13): the loop gets punctuation

Decision 2 above gave the at-bat the stage and the scorebook denotation the
typographic hero role. It left the loop itself unmarked: the mark replaced the
previous mark in the frame it was asked for, the half committed silently, and
the last half of a game ended like any other. This mode is composed for one
repeated act, and the act had no beginning, middle or end.

Three beats, all of them timing rather than layout, so the stage's composition
is untouched:

- **THE BEAT.** A focused at-bat card arrives whole except for its denotation
  cell, which holds blank for a constant 180ms and then lands with a 3% scale
  overshoot. The batter's name and the pitch ladder are up for the whole hold —
  only the code the reader is about to pencil waits.
- **THE RULE.** The half commits and the stage is closed: a hairline draws
  itself left to right under the at-bat card over 420ms, then the half's
  R/H/E/LOB ink in behind it, 90ms apart. ~700ms, interruptible by any tap,
  with the bar's forward action held until it ends. The trail and the quiet
  "See the whole half" pill (the previous amendment) are exactly where they
  were; this sits between them and the card.
- **THE DOUBLE RULE.** The reader's mark reaches the last half actually played
  and the same rule draws as a double one, with the bar's last action named as
  an act — "Close the book ›" rather than "Box score ›".

**ADR-0046 is the rule these obey and is the one to read first**: no timing
before a reveal may be a function of the reveal. It is why the hold is a
constant rather than scaled to the play, why the rule may not start before the
commit, and why the double rule keys on `revealedThrough` against
`finalHalfIndex` instead of `selectIsFinal` — which would have let the bottom of
the 9th tell you whether there is a 10th.

Two files were split on the way in, both moved verbatim and neither changing a
class: `PlayByPlay.jsx`'s notification-card family to `EventCards.jsx`, and this
screen's floating bar to `components/inning/InningActionBar.jsx`. The bar's
three states, its always-present Refresh and the hit-area reasoning
(`e2e/reveal-hit-area.spec.js`) all moved with it and now live in that file's
header rather than in a 40-line comment inside `InningViewer.jsx`.
