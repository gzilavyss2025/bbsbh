# ADR-0047 — The scorecard fills only what you have revealed

Status: accepted (2026-08-14)

## Context

The Numbers Game "22" sheet has been in the codebase three times over, each
copy holding a different piece of the product:

- the **DEV-only Scorecard Lab** (`/scorecard-lab`), which could ink a whole
  game onto the sheet via `loadScorecard.js`'s full-reveal half — deliberately
  kept out of the production module graph, because nothing clamped it;
- the **printable sheet** (`/{date}/{matchup}/sheet`, PR #705), which ships
  the grid EMPTY by design — the paper you print is the paper you score on;
- the **box score**, which already transcribes the #22's batting and pitching
  column orders but never drew the sheet itself.

What no surface offered: seeing the sheet **filled in** — the notation the
app already derives per plate appearance (the diamond, the fielding chain,
the pitch ladder, the out numbers) laid out in batting-order rows × innings,
during the game or after it. And nothing let a scorer disagree with a derived
notation: the official scorer's E5 that was a hit all day, a fielding chain
you'd write differently.

The obstacle was never drawing — the Lab drew it. It was the spoiler rule: a
filled scorecard is nothing BUT score-revealing state, and the Lab's own
loader was the manifest's motivating false-header case.

## Decision

**One grid builder, one clamp.** `src/api/scorecardGame.js` (reveal-gated,
ADR-0009's pattern) owns the inked grid, the per-inning P/WH/FO row, the
scoreboard with its FINAL block and decisions, and the pitcher table. Every
builder takes a `through` half-index and accumulates only from halves at or
under it. The visible inning columns come off the same clamp with
`unlockedInnings`' walk, so extras never spoil (ADR-0008) — a marathon grows
its columns one revealed inning at a time. `loadScorecard.js` keeps only the
loader and the pre-pitch staging view, finally the spoiler-free module its
header always claimed; the Lab now passes `through: Infinity` explicitly.

**Three surfaces, each holding the gate its own way:**

- `/{date}/{matchup}/scorecard` (`screens/scorecard/ScorecardPage.jsx`) — the
  live sheet, viewable at ANY point. It passes the user's own persisted
  `revealedThrough` mark, reads it and never advances it (no SealBox, no
  `revealTo`). Under Scores Unlocked / a consented day it substitutes the
  render-only mark exactly as the innings viewer does (ADR-0026).
- The **box score** embeds the completed sheet (`BoxScorecard.jsx`) at the
  page's foot, `through: Infinity` — safe because it mounts inside the box
  score's single SealBox reveal render (ADR-0002), behind which the whole
  game is already open.
- The **print sheet is untouched**: its grid stays empty, and
  `test/print-sheet.test.js` now forbids `screens/sheet/` from importing
  `scorecardGame.js` by name.

**Overrides are a pencil layer, not data entry.** Tapping a filled box opens
a small editor for the three marks a scorer argues with — the outcome box,
the diamond-center chain, the RBI count. An override lives in
`localStorage` per game (`lib/scorecardNotes.js` + `useScorecardNotes`),
keyed by the feed's own `atBatIndex`, wins at render time only, and is
flagged with an amber corner. Nothing derived is modified: the AB/H/R/RBI
tallies, the P/WH/FO row and the scoreboard keep reading the feed, an
override never syncs, and clearing one returns the feed's call. The root
`CLAUDE.md` line "this app is not a data-entry tool" stands — you still keep
score on paper; this is the margin note in your copy of the book.

## Consequences

- A spoiler audit of the filled sheet is one file (`scorecardGame.js`) plus
  the manifest's importer allowlist — three names, each named above.
- The sheet's numbers can never disagree with the innings viewer's: P and
  LOB come from `computeDerivedByInning`/`revealInning`, the pitcher table
  from `computePitcherLines`, all pinned by `test/scorecard-game.test.js` on
  the captured real game — which is also what caught the one real bug this
  work surfaced: a pinch runner's run never folded back into the origin
  batter's diamond once the fixture was trimmed past the substitution
  playEvents (the fixture now keeps them; the Bauers/Mitchell case is
  pinned).
- The end-of-inning mark is derived, not stored, and only for a FINISHED
  half. A revealed half still being played draws none prematurely. (The
  third amendment below moves it and cuts the second one.)
- An override exists only for a cell the user has revealed — a sealed cell is
  never rendered, so there is nothing to tap. If overrides ever grow a cloud
  mirror, they are consented user annotations, never a reveal source.

## Amendment (2026-08-14): the sheet plays

The live scorecard gained the reveal VERB, not just the reveal's output. The
next plate appearance renders as a face-down kraft seal in the grid cell it
will ink into (`scorecardPlays`' `frontier` + `scorecardStep`); tapping it
advances the SAME persisted cursor the innings viewer's at-bat stepping
walks (`revealAtBat`'s entry-count mark, ADR-0016), and the last step of a
finished half collapses into the ordinary `revealTo` commit. One ratchet,
two surfaces — the sheet and the innings viewer can never double-reveal or
disagree about where you are.

Three rules keep the game honest:

- **Mid-step, only cards.** A stepped half contributes its revealed cards
  and nothing else — no P/WH/FO line, no scoreboard cell, neither
  end-of-half mark. Those are whole-half facts and they ink on commit, which
  is the turn-end beat.
- **The frontier is derived, never stored.** It is always the half after
  `revealedThrough`; under the Scores Unlocked pass the render mark covers
  the whole game, so the seal simply never renders and nothing on the page
  can commit (ADR-0026's commitReveals contract, honored by construction).
- **Juice follows the tap.** Newly revealed marks ink in (outcome, then
  diamond, then the out circle pressed with `--ease-press` — the stamp's own
  ease); the ink-in set is diffed per side and armed only after the reader's
  first tap, so a cold load or a sheet flip renders settled ink. Skipped
  under reduced motion. ADR-0046 is respected: every duration is a fixed
  token, never a function of what was revealed.

Deliberately NOT built: points, streaks, or any meta-economy. The app's
fantasy is being the scorer; the game is the ritual (press, ink, count outs,
flip the sheet), and the gamification stops where the paper does.

## Amendment (2026-08-14): one live sheet, not two copies of it

The box score's embedded copy (`BoxScorecard.jsx`, `through: Infinity`) is
retired. It existed because the game's tab bar had no stop of its own for the
live sheet — the fifth tab was "Card", the shareable preview poster — so the
only way in was through the box score. That tab now opens the live scorecard
directly (`GameView.jsx`'s `sectionTabs`, `key: 'scorecard'`, `section:
'scorecard'`), which by the time a Final game's box score is open already
renders the whole sheet inked (its `revealedThrough` clamp has nothing left to
hold back) — the exact same output the box score's copy existed to show, on
its own page instead of at the box score's foot. A completed game's sheet is
now one page, not two.

The poster studio the "Card" tab used to open (`screens/GamePreview.jsx`,
route `preview`) didn't lose its door — it moved to both lineup pages
(`TeamInfo.jsx`), as a full-width primary button ("View preview card") rather
than the tab bar, since that's the pre-first-pitch page a scorer is on to post
the matchup. The lineup pages' other door, "Open the live scorecard", is
retired outright: the tab bar covers that trip now, and a second door to the
same page read as an unnecessary second promise about what's safe to open
mid-game. Its sibling door, "Print tonight's sheet", stays as a quiet
chevron link but under a new name, "Print blank scorecard" — the live sheet
above replaced what it used to advertise, and the destination itself
(`screens/sheet/ScoreSheetPage.jsx`) is due its own rebuild to match, not done
here.

`src/api/spoiler-manifest.json`'s `scorecardGame.js` entry drops
`screens/boxscore/BoxScorecard.jsx` from its importer list — one caller now,
the live page, plus the DEV-only Lab.


## Amendment (2026-08-14): the end-of-inning slash, where a scorer draws it

A finished half used to leave ONE mark, in the WRONG PLACE: a corner-to-corner
diagonal through the next-due batter's unused box. That mark carried two
claims at once — "the inning ended" and "this slot leads off the next" — and
it made the first of them a row or more below the box where the half actually
ended.

The convention is not ambiguous. Wikipedia's baseball-scorekeeping article:
"a slash is drawn diagonally across the lower right corner" of the cell.
Every beginner guide surveyed agrees on the shape and the corner, differing
only on which box (the third out's, or the half's last plate appearance) and
offering a horizontal rule under the box as a minority variant.

So:

- **The end-of-inning slash** (`endsHalf` on the card, `.sc-ab--halfend`) —
  a short "/" across the LOWER-RIGHT CORNER of the box of the plate
  appearance that CLOSED the half. It is the sheet's only end-of-half mark.
  Anchored on the last PLATE APPEARANCE, not on the cell that recorded the
  third out: the two differ whenever the out was a runner cut down during a
  later batter's trip, and a half can end with no third out at all (a
  walk-off). Set even when that last card is `interrupted` — the half ended
  at that box either way, which is all the mark claims.
- **The leads-off-next diagonal is retired.** It was a second, competing
  end-of-inning notation, and the slash is the one a scorer actually draws.
  What survives is `leadoffMarks`/`leadoffCells`: the same next-due batter's
  unused box, as a LOCATION with nothing drawn in it.

An intermediate version of this ADR described the mark as a horizontal rule
under the box. That was the minority variant, it read as an underline rather
than a closing mark, and it is not what shipped.

The turn handoff — formerly a kraft banner above the sheet (`.scflip`,
"Bottom 3 is next — flip the sheet ›"), now deleted — lives in that leadoff
box. When the next at-bat belongs to the other club's page, the leadoff box
of the half that JUST ended carries the button that flips to it. That box is
where the reader's eye lands as a half closes and it is empty by definition,
so the handoff costs the sheet no notation of its own. Only that one box is a
door: `leadoffCells` is valued by the INNING that ended rather than a bare
`true`, and `ScorecardPage` names the inning it wants (`stepInfo`'s half,
minus one when the next half is a top), so every older leadoff box stays
blank. Under the Scores Unlocked pass `stepInfo` is null and no box is
pressable — the construction that already withholds the frontier seal.

A half whose last card was interrupted yields no leadoff box, so it offers no
flip button. Not a dead end: the Top/Bottom control above the sheet has
always been the general way across, and the banner it replaced was a prompt,
never the only path.

**A CSS trap worth keeping.** The slash cannot be a `background-image` on
`.sc-ab`. The corner a scorer cuts is the cell's own, which on this box falls
inside the pitch strip, and `.sc-ab__strike` paints an opaque
`--sc-strike-fill` over it — the mark renders as a perfectly valid computed
style that is simply invisible. It is an absolutely-positioned pseudo
instead. Its host `.sc-ab__strip` must stay `position: static`: making the
strip positioned lifts the whole strip into the positioned paint layer, where
its fill covers the out circle's `right: -8px` overhang and clips the ①②③.

## Amendment (2026-08-19): the default is `-1`, and it had to be

The sentence above — "the Lab now passes `through: Infinity` explicitly" — was
true of the intent and false of the code. The Lab called `scorecardFull(loaded.data,
side)` with no options at all, and the four builders defaulted `through` to
`Infinity`, so the Lab was riding a permissive default rather than stating a
choice. Nothing shipped wrong: the Lab is DEV-gated out of the production graph,
and every production caller passes its clamp. But the audit that found this is the
argument against it. A default of `Infinity` means any future caller that forgets
the option inks a finished game end to end, and the only thing standing between
that and a reader is whether the author remembered — which is exactly what this
ADR exists to stop being the mechanism.

`scorecardPlays`, `scorecardScoreboard`, `scorecardPitchers` and `scorecardFull`
now default `through` to `-1`: nothing revealed. A forgotten option draws the
blank card, which is the product anyway. The Lab says `{ through: Infinity }` out
loud, and `test/scorecard-game.test.js` pins both halves — that a caller with no
clamp gets an empty card, and that the full card still draws when asked for.

## Amendment (2026-08-21): one row per slot, and the marks a scorer actually draws

Six changes, all from reading the live sheet against a real game (gamePk
823747, 2026-08-20 SEA@MIL) and against a #22 in hand. Four are notation, two
are the page.

**A slot is ONE row, however many men bat in it.** The sheet used to open a
fresh row of the grid for every occupant — the starter, then a row of his own
for each substitute. That is not what a scorer does and it read badly: every
starter who was ever lifted left a full-height band of empty boxes under his
line, and his replacement's at-bats sat a row below the inning they belong to.
The rail STACKS a written line per occupant instead (`slot.lines` — his name,
his position, his number, his own AB/H/R/RBI, stacked in step in the Pos and
summary columns through a shared `--sc-line-h`), and the boxes stay one row. A
column holds one card for the slot no matter who batted it, so `slot.cells` was
always the right shape; the per-occupant `rows` split was the mistake.

`ScorecardSheet` renders `SLOTS.map` to exactly nine `<tr>`, and the frontier
seal no longer needs an `isLast` test to find the current occupant's row —
there is only one.

**Two handover marks, both on the ARRIVING box.** With one row per slot there
is no outgoing row left to rule off, so the mark moved to where the change
takes effect, which is also where a scorer draws it:

- the **substitution mark** (`subMarks`) — the incoming batter's number, on the
  first box he bats in;
- the **pitching change** (`pitcherMarks`) — new, and the sheet was simply
  missing it. The opposing club's arms changed several times a game and nothing
  said so. The incoming pitcher's number, on the box of the first batter he
  faces.

Both draw the same way (`.sc-sub`): a red rule across the box's top edge with
the number above it, pitcher's first. The mark takes NO layout — the box under
it is a real plate appearance now — so it is absolutely positioned and the
numbers hang into the bottom-left of the box above, which is blank on every box
the sheet draws (the out circle and the end-of-inning slash both live in the
bottom RIGHT). A double switch sets both on one box and they read left to
right.

The pitching change is found by walking every card on the side **in
`atBatIndex` order, never column order** — an inning that batted around widens
into sub-columns whose left-to-right order is per-slot, and walking columns
hands a reliever's mark to whichever sub-column sorted first rather than to the
batter who actually led off against him. The starter takes no mark (the first
card only sets the comparison), and a placed runner carries no pitcher, so he
neither draws one nor breaks the chain across the half he opens.

Both live in `api/scorecard/handover.js`, classified **spoiler-free** and
meaning it: they are pure functions over cards the caller has already clamped,
and neither can produce a mark for a card it was not handed. A sealed half
yields no marks by construction, not by a check either function has to
remember.

**The out circle inks red.** Counting outs is what you do most on a live sheet,
so the ringed 1/2/3 takes the app's second ink (`--accent-negative`, 5.05:1 on
`--surface-card`) and the notation around it stays pencil.

**WP/LP/SV carry their figure.** Each pitcher of record now reads the way a box
score writes him — `Chad Patrick (7-4)`, `Trevor Megill (23)` — off his own
boxscore `seasonStats.pitching`, which include tonight.
`api/scorecard/decisions.js` is **caller-gated**: it takes
`scorecardScoreboard`'s own `done` (Final AND fully revealed, the same flag the
FINAL block waits on) and returns empty strings until then. Which pitcher won
is as score-revealing as the score. A missing line degrades to a bare name; the
screen builds the brackets only around a figure that exists, so `()` can never
render.

**The sheet runs the window on desktop.** A #22 in your hands is a wide piece of
paper — you take the whole order and most of the game in at once, and the zoom
control exists because a phone cannot. From 740px up the whole scorecard (header
band, grid and footer trio — one printed page, not a grid with chrome around it)
steps out of the app's 960px reading column and runs gutter to gutter. Classic
negative-margin full-bleed; `+ var(--app-gutter)` both keeps a page margin and
covers the classic scrollbar's share of `100vw`, without which the PAGE gained a
horizontal scrollbar, which is the one thing a sheet must never do. The phone is
untouched.

**The page is a page, and it is centred.** The full-bleed alone left the
scorecard reading as a banner laid across a desk: the header's two heavy rules
and the footer trio ran on past the last summary column, and the whole thing sat
pinned to the left gutter. A #22's printed rules stop where its COLUMNS stop, so
the grid now reports the width it drew — Player + Pos + the innings +
AB/H/R/RBI, hairlines included, at whatever zoom is showing — and the header
band, the footer trio and the grid's own frame all cap to it and take `auto`
side margins.

Measured, not calculated from the `--sc-*` tokens, for exactly the reason the
zoom floor is: the per-column hairlines are not in the tokens. `ScorecardSheet`
already measured the table for the floor, so it reports the same rect up through
an `onWidth` callback and `Scorecard.jsx` sets `--sc-sheet-w` on `.scorecard`.
Capped `min(var(--sc-sheet-w), 100%)`, which is what keeps the phone out of it:
there the grid is far WIDER than the column it is read in — that is what the
zoom control is for — and a band held to the grid's width would run off the
screen. Below the breakpoint the cap resolves to 100% and the auto margins have
nothing to divide.

**The backwards K moved to the middle of the diamond.** A called third strike is
still a strikeout: the outcome box reads SO like every other one, and what tells
it apart is the ꓘ drawn where the K goes. It used to take the outcome box
INSTEAD of the SO, which left the sheet's one column of out categories with a
hole in it and put the strikeout's own notation nowhere. Written in `atBatMarks`
rather than read off the feed, since `code` is often empty on a called strike
(entriesView's `atbat.code || 'K'` is the same workaround one layer up).

**The AB/H/R/RBI figures centre in their columns**, tabular and hung off the
row's top edge like the rail beside them, so a slot's stacked lines read
straight across: name, position, then his four figures, each on his own line.

**A CSS trap, and it was a real bug.** `.sc-sheet__name` was `display: flex`. A
flexed `<td>` stops behaving like a cell — it shrinks to its content's height
instead of stretching to the row's — and since this is the STICKY rail, the
part of the row its background no longer covered was a window the inning
columns scrolled *through*: pan right and the grid visibly ran under the names.
The cell is a plain table cell again and the written lines inside it do the
flexing. Same family as the strip/slash trap above: a rule that computes fine
and paints wrong.

Two file caps came due in the same work (ADR-0038). `scorecardGame.js` shed
`scorecard/handover.js` and `scorecard/decisions.js`; `41-scorecard.css` split
three ways and moved to `src/styles/scorecard/` (`grid.css`, `box.css`,
`page.css`, imported in that order, which is the order the one file read top to
bottom), which also took `src/styles` back under its own directory budget.

## Amendment (2026-08-21): the page, the foot row, and a type audit

A second read of the live sheet, same game (823747). Five more.

**The two handover marks rule different edges.** Both were drawn across the top
in the round above, which was wrong about the batting-order one. A slot's men
share ONE row of boxes, so the change between them cuts ALONG that row — left to
right, trip by trip — and a scorer closes the previous man off with a rule down
the LEFT EDGE of the box the new man takes over. That is where it stands now
(`.sc-sub--batter`), the incoming number riding the rule at mid-height on a
small paper chip so it stays legible where the diamond's left vertex reaches
under it. The PITCHING change cuts across the order rather than along it, so it
keeps the top edge (`.sc-sub--pitcher`), number above the rule. A double switch
sets both on one box and they cannot collide: one is vertical at the left, the
other horizontal along the top.

**The foot row is a real `<tfoot>`, and only now does it pin.** The comment
above it had claimed for months that it was "pinned to the pane's bottom edge";
it never was. It was the last `<tr>` of the tbody with `position: sticky; bottom:
0` on its cells, and a sticky table CELL is clamped by its own ROW — there was
nowhere for `bottom: 0` to move it to, so the line simply scrolled away with the
grid. Sticking the ROW GROUP is the shape browsers honour. Where a browser does
not, the row still renders in place unpinned, which is what it did before.

**It says what it counts.** P / WH / FO across a three-column grid in the rail
became PITCHES · WHIFFS · FOULS, one run of small caps. The initials were the
printed sheet's shorthand for a scorer who already knows the sheet, and the
3-column grid was matched to the three figures in each inning column — which
never lined up anyway, the rail and an inning column being different widths.

**THE PAGE is one cream plate.** `.scorecard` is now only the ROOM the sheet may
run into; `.scorecard__page` inside it is the sheet — capped to the grid's drawn
width, centred, and painted `--bg-page`, the app's own "standard page" cream and
already what the grid's sticky top and foot bands use. It is a shade deeper than
the cells above it, so the grid still reads as raised. Opaque is the point: the
body's 24px graph-paper ruling showed through every gap between header, grid and
footer, and the three read as three cards on a desk rather than one printed
page. Two arithmetic notes on the cap, both found by measuring: `box-sizing` is
border-box here, so the plate's own padding has to be added back or the grid
loses that much width; and so does the pane's hairline frame, without which the
last summary column sat 2px over the edge and the sheet panned on a screen it
otherwise fits.

**A type audit, and it found three real divergences.** Every rule already used
the `--font-*` role tokens — the drift was in what those roles were given
alongside them.

- **The backwards K was set in a different FONT.** It was the ꓘ character
  (U+A4D8, a Lisu letter). JetBrains Mono has no glyph there, so it fell back to
  whatever system face did, and one mark on a sheet of mono notation was in
  another typeface. The app's own way of drawing it is a real "K" mirrored in
  CSS (`.pbp__klooking`, the play-by-play card's same mark), which is what the
  sheet does now. Its centring had to move from `transform` to the standalone
  `translate` property first, so the flip has `transform` to itself — the
  play-by-play's copy learned the same lesson, and its rule says so.
- **Figures were missing `--ls-num`.** Every numeric run on the sheet — the
  uniform numbers, the AB/H/R/RBI columns, the foot figures, the TOTALS bar, the
  pitch pips, the handover numbers — set `--font-mono` without the letter-
  spacing the app's numeric role carries (`.t-num`, and the shared mono-figure
  helper the lineup and roster jerseys ride). That is why the sheet's numbers
  read a shade tighter than the same numbers everywhere else.
- **The out circle invented its own treatment.** The play-by-play draws this
  exact mark as `--clay-deep` on a `--clay-soft` plate inside a `--clay` ring;
  the sheet had clay ink on bare paper. Two surfaces drawing one notation should
  not each invent a dress for it. 6.2:1.

The outcome codes also took `--ls-title`, matching `.pbp__code`, which renders
the same scorebook codes one surface over.

And the header's team/manager pair stopped growing: it carries `flex: 1` so it
is never squeezed on a narrow row, which on a wide one made it absorb all the
spare space and run two writing lines halfway across the band under a club name
and a surname. Capped at what the longest of them needs; the slack goes to
UNIFORMS beside it, whose line genuinely wants the room.

## Amendment (2026-08-21): two pages, two headers

The #22 does not print the same band twice, and the sheet now does not either.

**The visitors' page keeps what is declared once**: the umpire crew, KEEPING
SCORE BY, and FIRST PITCH — how you are watching this game and when it began,
neither of which is worth asking for a second time.

**The home club's page takes the game's own particulars**: BALLPARK, WEATHER,
ATTENDANCE, and the time of the FINAL OUT. Both pages keep the club/manager/
uniform block, since each page is one club's.

Three of those four are spoiler-free and sit on `scorecardView` beside the
lineup: a ballpark and a wind reading are known before first pitch, and a
turnstile count is not a score. **The final out is not**, and the difference is
worth stating because it is the kind of field that looks harmless. Read against
FIRST PITCH on the facing page it gives the game's LENGTH, and a long one says
extra innings — which is the exact fact ADR-0008 spends the whole sheet
withholding, unlocking one extra column at a time. So it lives in
`api/scorecard/finalout.js`, **caller-gated**, and takes `scorecardScoreboard`'s
own `done` — Final AND every played half at or under `through`, the same flag
the FINAL line waits on. Until then it is a blank line to write on. By the time
it fills, the reader has walked every half and there is nothing left to tell.

It reads the LAST PLAY's own timestamp, which is literally the final out and
already carries every rain delay and every extra inning rather than needing them
added back; a lean feed falls back to first pitch plus playing time plus delay.
The park's clock, never the reader's — the same game read from another time zone
must not say a different hour. `boxscore.js` resolves its own end time the same
way and is reveal-only, so this is a deliberate second reader on one feed path
rather than an import across the gate.

FINAL OUT is the same write-in field FIRST PITCH is, rings and all, sharing one
`ClockField`. Its AM/PM pair stacks rather than reading across, which is what
lets it sit beside its own line instead of pushing the block wider.

**Three smaller things in the same pass.**

- **WP/LP/SV print a surname**, the way the pitcher table above them already
  does and the way a scorer writes a pitcher onto this sheet. Read off the
  feed's own name parts, not split from the full name, so a "Jr." or a two-part
  surname survives; the split is the fallback for a lean feed.
- **Every player name on the sheet is a `PlayerLink`** — the rail's line per man
  who batted, the pitcher table, and the three decisions (the defense diamond
  already was). Each is a door to his page, and on a desktop a hover opens his
  card on the way. The name itself carries the link class, so the rail keeps the
  truncation it depends on, and a row with no id falls back to a plain span.
  `scorecardView`'s pre-pitch lineup gained an `id` for this: it was the one
  name source on the sheet without one.
- **The whole batting order fits.** The pane's vertical bound is now whichever
  is BIGGER: the room the window has, or the height nine slots need. A cap of
  viewport-minus-chrome alone left an ordinary desktop window a row or two
  short, so you scrolled INSIDE the lineup to reach the 8 and 9 hitters — the
  one thing a scorer should never do with a sheet in front of them. The order is
  a fixed nine rows, so its height is knowable in CSS.

`src/styles/scorecard/` gained `footer.css` at the file cap: page.css now holds
the header band, the zoom control and the editor, and the footer trio is its
own partial.
