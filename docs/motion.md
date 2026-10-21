# The motion layer (`src/styles/motion/`)

Where every animation in the app lives, what gates it, and the rules a new one
has to clear. The craft bar itself is
`.agents/skills/review-animations/STANDARDS.md`; this file is the map.

Built as the motion study, issues #976–#983 — eight animations across the home
slate, the lineup card and the play-by-play feed.

The at-bat replay's swing, contact and ball flight (#1771) run in JS from one
clock, not in this folder. Their spec is `docs/contact-replay.md`.

## The seam: motion here, resting appearance there

`src/styles/motion/` holds **motion and nothing else**: keyframes, the rules
that reference them, and the hover states that exist only to move something. A
surface's RESTING appearance stays in its own numbered partial. So the slate
card's `@` watermark is still printed two pixels out of register in
`06-loader-and-cards.css`, and only the closing of that gap lives in
`motion/slate.css`; the live dot is still a 9px circle in
`07-team-logo-and-buttons.css`, and only its breath lives in `motion/innings.css`.

Read a surface's own partial to know what it looks like. Read here to know what
it does when something changes.

## Why a subdirectory

The same reason `focus/` is one, and `focus/stage.css`'s header makes the
argument: `src/styles` is a flat directory sitting at its own file ratchet
(`scripts/check-dir-size.mjs`), so a partial that outgrows the 600-line file cap
subdivides rather than adding numbered siblings — ADR-0038's own answer.

The study landed rules on six surfaces at once, and four of the host partials
were already at or over budget (`13-play-by-play.css` was at exactly 600, with
no headroom at all). `scripts/check-file-size.mjs` is explicit that widening a
budget "is never the fix for a file that just grew", so nothing was widened.

**Order: after the numbered partials, before `focus/`.** `focus/`'s four sheets
stay last, and their header says every rule in them wins on cascade order rather
than specificity — a contract this package must not quietly take away. Where a
motion rule has to outrank one of them, it does so on specificity.

**The guards came along.** `check-typography.mjs`, `check-focus-ring.mjs` and
`check-strike-links.mjs` read `src/styles` flat, so a subdirectory would have
escaped them. All three now walk the tree, repointed in the same commit as the
move exactly as their own headers instruct. That also covers `focus/` and
`scorecard/` for the first time; both passed unchanged.

## The one-shot gate

Every one-shot in the package hangs off one of three gates (the leader board's fade-in is the one exception: a module flag, in the table below):
`src/hooks/motion/useBecameTrue.js` for a change the reader sees happen,
`src/hooks/scroll/useInViewOnce.js` for an entrance on the player page, and
`src/hooks/motion/useViewOnce.js` for a team-page band (plays once per page visit).

A CSS animation runs when its element mounts, or when the element gains the
class carrying it. That is right for a change the reader just caused and wrong
for a cold load, a return visit, a navigation, a poll, or a force-reveal (the
reader's own stamp, ADR-0048, or a box score they opened before, ADR-0049) — all of
which present the same already-changed DOM and would replay a gesture nobody
made. A substitution from the third inning must render struck through, not draw
itself again every time the page is opened.

`useBecameTrue` returns true only for the render in which its value went
false → true with the component already mounted, and keeps returning true while
it stays true, so the class it drives is stable. State is adjusted during
render — React's documented escape hatch, the same shape `ScorecardPage`'s
ink-in diff uses — so the committed DOM carries the class from its first frame.

**`useInViewOnce` is the entrance gate (#2073).** A card on `/player/{id}` plays its
entrance (a rise, a bar grow, a draw) the first time it comes a tenth into view in
this page visit. A module-level `Set` of `<playerId>:<slotKey>` keys
(`src/lib/motion/inViewOnce.js`) lives for the life of the JS bundle, so a re-render,
a poll and Back in the same tab do not replay it, and a full page load does. It
returns a phase: `wait` holds the card hidden until it shows, `play` runs the
entrance, `rest` is the end state (seen, reduced motion, or no
IntersectionObserver). A tap that changes what a card shows (a pick, a filter) is a
change the reader caused, so its motion may play on every tap; that motion does not
go through this gate.

**It is not `ScorecardPage`'s diff, and was deliberately not lifted from it.**
That one diffs a SET of at-bat ids, because it marks individual cells inside a
grid that is always mounted. Every animation here turns on a single boolean
instead, and wrapping a boolean in a set diff is the more complicated way to ask
a simpler question. The two are siblings.

**#980 needs no gate at all.** `TeamInfo` renders the batting order keyed by
player id, so a poll returning the same nine names reconciles the same nine
`<li>` nodes; React does not remount them, and an animation does not restart on
a node that was not remounted. Its cascade is an arrival, and a mount already
is one.

## What is in the package

| Sheet | Issues | Holds |
| --- | --- | --- |
| `slate.css` | #976, #977, #978 | The `@` plates pulling into register on hover, the doubleheader sheet's riffle, and `@keyframes tally-breathe` + the LIVE pill's dot |
| `slate/masthead.css` | D1 handoff (2026-10-18) | The slate masthead (`components/slatehead/`): the ladder ball's roll (`--dur-slow`, `--ease-stamp`) only under `.levelladder--rolling`, which `LevelLadder` sets only while the level on screen is the stop the reader tapped; the date's slide-in, only for a step taken in `DateStepper` (keyed per date); the compact bar, the level menu and the presses; the stamp-in once a session (`sessionStorage`). Back, a link and a poll play none of it. The resting look is `styles/slate/masthead.css` |
| `lineup.css` | #979, #980 | The row's straightedge rule on hover, and the batting order's ink-in cascade |
| `strike.css` | #981 | The drawn cross-out, all four sites |
| `playbyplay.css` | #982 | The four-beat write-on |
| `innings.css` | #978, #983 | The live-edge dot's breath and the frontier seal's |
| `scorecard-lens.css` | #724 (L7) | The phone lens (ADR-0092): the tear, the runner-move fade, the page turn, the two-cycle seal breath, the docked card's fade and the pitcher sheet's slide. The glide is beside it in JS |
| `board-in.css` | M1 | The leader board's fade-in after a scope tap on `/leaders`: up 6 px and opacity, 180 ms (`--dur-board-in`), `--ease-out`. Its gate is a one-shot module flag, `lib/motion/boardIn.js`: `ScopeNav` arms it on a tap to another scope, and `TeamLeaders` spends it on its first render. A cold load, a Back, a poll and a force-reveal never play it. The resting look is `styles/leaders/board.css` |
| `run-value-card.css` | #2295 | The team page's club run value card: the stamp-in on the card, tile, part buttons and rows, the league bars growing, the split bar's wipe, the mini bars growing, and a re-rank (rows that join stamp in on `rvrow--enter-a`/`-b`, rows that stay slide by a Web Animation in `ranks/runvalue/flip.js`, since React moves their nodes). The count-ups are a rAF loop on the text node (`useCountUp.js`). Gate: `useInViewOnce` (a tenth in view; the card is taller than a phone held sideways, so a third may never show), plus the band's `useViewOnce`. Not in `index.css`: the card imports it. Times are the `--*-rv-*` tokens in `effects.css`. Spec `.scratch/run-value-motion/handoff.md` |
| `styles/scout/motion.css` | #2319 | The Matchup Scout's motion (outside this folder, which is at the file cap): verdict stamp, marker slide and count-up, push and tug bars, meeting cards, map squares, presses, the in-flight pitch mark. Gate: `useInViewOnce`. Spec: `.scratch/scout-redesign/README.md`, "Slice 9" |
| `styles/worldseries/hero.css` (its last two sections) | #1906 hero redesign | The World Series "Overview" card (outside this folder, which is at the file cap). The split: the slate card's `--versus` switch (hover where the pointer can hover, or a press or focus of the next-game door) deepens the slanted seam and moves the hitters apart. The arrival, after `Card stampIn`: the slabs close on the seam, the hitters rise, the grayscale photo pushes in, the marks and lines stamp in, the calendar inks across to today and the next game, all on `--stagger-step`; about 1.3 s. Gate: once a session (`sessionStorage` `bbsbh:ws-hero-arrived`, the slate masthead's pattern). No Animation Lab entry yet |
| `styles/worldseries/fit.css` (its last section) | Park fit overlay, 2026-10-21 | The World Series Park fit card's park control (outside this folder, which is at the file cap). A tap on Both, Tampa Bay or Milwaukee changes which wall shows. The park that goes off draws its wall back (`stroke-dashoffset`, `--dur-med`, linear) while its ground, foul lines and signs fade (`--dur-med`, `--ease-out`). A park that comes on inks in from the left-field pole, one segment after the next (8 ms a segment, about 350 ms in all). A distance sign that makes room slides inside its wall (`transform`). The carry block folds open or shut (grid rows 0fr to 1fr, `--dur-unfold`), and a new park's figures fade in. Every one is a transition on a change the reader caused, so a cold load and a poll play none of it. All of it sits under `prefers-reduced-motion: no-preference`; the in-app reduced setting also zeroes the stagger delay. No Animation Lab entry yet |

### The scorecard lens (#724, L7)

One row per motion. The tear, the glide and the runner tint hang off
`useLensMotion`'s `beat`, which only a reveal tap sets and which clears when
the reader leaves the lens or the page turns: the existing `armed` gate, made
narrower. The turn runs on its own tap. The docked card's fade is the one on
`useBecameTrue`, and the ink-in keeps its set diff, unchanged.

| Motion | Spec | Gate |
| --- | --- | --- |
| Tear | Two copies of the seal's face, cut along `lib/sealTear.js`'s shared split (seeded from the gamePk and the step), fly off the box just inked: 180 ms (`--dur-lens-tear`), `--ease-out`, upper half `translate(-26px, 8px) rotate(-9deg)`, lower half mirrored, to opacity 0. In the cell, so they ride the glide | `beat`, keyed on the tap; unmounts on `animationend` |
| Glide | The pane's scroll to the next seal, 300 ms (`--dur-glide`), a rAF tween on `--ease-out` (`lib/scorecard/glide.js`, pinned to the token by a test). A touch, wheel or key stops it | `beat.n` new to `useLens`; null under reduced motion, at a turn, on a cold load, a poll and a return |
| Ink-in | `.sc-ab--fresh`, unchanged (box.css) | `armed` + the `fresh` set diff |
| Runner-move fade | The marker tint (`color-mix(--marker 45%)`) to the box's fill, 1.6 s (`--dur-highlight`), on the boxes of the runners the tap moved (`runnerMoves`) | `beat`; the tint span is keyed on the tap, so a runner moved twice fades twice |
| Ride | Near the top of the order the frame (with the ruler and the card under it) moves down to the next box, on the glide's 300 ms and `--ease-out`, a CSS `top` transition. The sheet does not scroll | A new frontier box above the seat (`lensFrame` in `lib/scorecard/geometry.js`) |
| Page turn | Out 160 ms (`--dur-turn-out`, opacity 0 + `translateX(-28px)`), switch `side`, in 200 ms (`--dur-turn-in`) from `translateX(28px)`. The pane only; the frame stays. No glide in a turn | The Turn tap; `animationend` steps it (`lib/scorecard/turn.js`). Leaving the lens mid-turn runs the switch at once |
| Seal breath | In the lens, 4 iterations of `sc-seal-breathe` (2 full cycles), then still. Held under press and focus, and under hover only where the pointer can hover (`(hover: hover)`): on a touch screen :hover sticks where the last tap was, which is where the next seal comes to rest. The desktop sheet breathes as before | None needed: the same on every seal (ADR-0046). A seal a poll brings at the live edge does not breathe (`--quiet`) |
| Cards | A docked card fades in 220 ms (`--dur-med`), opacity + `scale(1.04)` → 1 | `useBecameTrue(dock)` in `LensFrame`: not on a cold load or a return to the lens. A card a poll brings is an arrival, and it fades |
| Pitcher sheet | Slides up 260 ms (`--dur-lens-sheet`) from `translateY(40px)` | Mounts only on a tap |

## The arrival (ADR-0113, slice 3)

A notification card that has extra data to fetch starts as the plain yellow card (ink tab, photo,
name, badges, logo). When its data arrives, a club band wipes across the top. The full Now Pitching
card (`PitcherCard`) does this, and so do the two handoff cards (`DepartureLineCard`,
`FinalizedLineCard`). All times are CSS transitions on `--ease-stamp`
(`cubic-bezier(0.2, 0.9, 0.3, 1)`); the sheet is `motion/arrival.css`, the resting looks are
`pitcher-card/arrival.css`, and the times are tokens (`--dur-arrive*`, `--delay-arrive-*`).

| What | Spec |
| --- | --- |
| Tab | The ink tab fades out in 160 ms (`--dur-snappy`), at t = 0 |
| Band | 33 px: 30 px of fill and a 3 px underline. `clip-path: inset(0 100% 0 0)` to `inset(0)` in 380 ms (`--dur-arrive`), at t = 0 |
| Label | The band repeats the tab's words; it fades in over 220 ms after 200 ms |
| Texture | The ripple rings and sheen of `.sectionhead--band` (`--ripple-*`, `--sheen-*`, read there, not copied) fade in over 520 ms after 260 ms |
| Head | The top padding grows from 28 px to 47 px (band 33 + the 14 px the tab hung) in 380 ms |
| Sections | `grid-template-rows` 0fr to 1fr in 380 ms, and opacity in 260 ms (`Unfold`). The season line waits 380 ms, the pitch mix 435 ms, the last appearance 490 ms. The handoff table waits 380 ms |

**The band's colour.** The full card's band is the club's hand-set triad (`--bar-fill`,
`--bar-accent`, `--bar-text`, set by `bandPaint` from the club and the jersey it wears); a club with no
triad keeps the house navy (`--navy`, `--band-rule`, `--text-on-ink`). The two handoff cards are
always the house navy (`.sectionhead--house`). No colour is invented.

**The gate is `useBecameTrue` (`hooks/motion/useArrival.js`).** `arrival--play`, the class every
transition hangs off, is on only for the render in which the card's data went from absent to present
with the card already mounted, and it stays on. A card with its data in hand when it mounts (the
lead-in repeat, which reads `cardData`'s kept answer; a return to a half) is drawn `arrival is-in`,
final, with no motion. The timing depends on the fetch alone, never on the game (ADR-0046). Under
`prefers-reduced-motion` no transition runs.

**What the gate cannot see.** A fetch still has to finish after a page load, so a card on a freshly
loaded page arrives the same way, once its data is in. A stamp changes the seal, not the card, so it
does not change this. `FinalizedLineCard` has no fetch of its own: it is
drawn final unless a caller passes `open={false}` first.

## The at-bat replay's count and bases (#1858)

No new animation: the count strip ("2-1") and the small diamond change by text and
fill when a pitch lands, at a fixed size (ADR-0046). `PitchScene`'s `onLand` fires
once per pitch (state twice a pitch, never per frame). The replay rests on the end
state and plays only on a tap of "Play at-bat", wide as on a phone; a pitch pick
plays that one pitch. Under reduced motion it stays at the end state, the Play
button is gone, and the pitch chips step it. A plate appearance still in progress
has no replay. The Animation Lab has no entry: nothing here is a new transition.

Reduced motion: no tear, no glide, no turn (the JS reads `motionIsReduced`);
the cards and the sheet arrive at once under the blanket rules; the runner tint
opts out of the blanket and stays, still, until the next tap.

## Two idle loops, one beat

Both run 2.4 seconds, alternating, on `--ease-standard`.

`tally-breathe` (opacity 1 → 0.5 plus a `scale(0.88)`) is for the two "this game
is in progress" dots — the slate card's LIVE pill and the innings bar's
live-edge status. It replaced `liveedge-pulse`, an outward ring pushed on
`box-shadow`, which repainted every frame and read as a notification rather than
as a game quietly running.

`sc-seal-breathe` (opacity 1 → 0.82, no scale) is the scorecard sheet's own,
referenced where it stands in `styles/scorecard/box.css` rather than promoted —
that file is in `index.css`'s core list, so the keyframe is always defined, and
a keyframe resolves by name wherever it was declared. The frontier seal runs it,
byte for byte what `.sc-ab__seal` runs — scoped to `.pagenav--innings`, because
`.btn--reveal` is the kraft skin and not the frontier. A live game's lineup page
wears it on "Catch up to live" (the home slate wore it on "Reveal all results"
until ADR-0116), and a bare `.btn--reveal` rule put a permanent breath on a
spoiler action on the app's front door.

They stayed two keyframes rather than one: a full tape cover reads at opacity
alone, while a 6–9px dot needs the deeper fade and a little scale to register.

**Neither may ever key off the score, the inning, or how late the game is.** A
dot that breathed harder in a close game would spoil the game.

## Things that bit, and must not be un-learned

- **The frontier seal breath stops under the thumb.** Hover, press and focus
  each hold it at full opacity. That is what keeps the button from feeling
  unresponsive under a reader who taps it forty times a half hour, and what
  keeps the `:focus-visible` ring at a contrast anyone has actually measured.
  It does not breathe on the reveal pair's demoted second button, which is the
  skip, not the tape.
- **The write-on's real moment is the stacked read-back, not the reveal.**
  Unsealing a half does NOT snap to the stacked layout — `useFocusMode` holds
  the single-at-bat window on screen afterwards, and that card already has
  ADR-0046's denotation ink-set as its arrival, which composes a `scale` onto
  the very marks the write-on would animate. So the write runs at the other end
  of the same gesture: "See the whole half". Do not "fix" this by dropping the
  windowed exclusion.
- **Beat 3 is opacity-only, and that is load-bearing.** Two other rules own the
  result code's `transform`: `.pbp__code--center.pbp__klooking` mirrors a
  backwards K with `scaleX(-1)`, and focus mode's ink-set composes a scale onto
  it. Any animation touching `transform` un-mirrors a backwards K for the length
  of the write and snaps it back. The centring itself stays in the individual
  `translate` property where ADR-0046 put it.
- **The write is capped at six cards.** A half can be twenty plate appearances,
  and beat 2 animates `stroke-dashoffset`, which repaints rather than riding the
  compositor. Fine for a handful of 108px diamonds, a screensaver for twenty.
- **The cross-out's bar goes on an inner `.struckline` span, not on the
  wrapper.** `.plink` is a `<button>`: it does not inherit an ancestor's
  `text-decoration` and zeroes its own, so all four strike rules had to name
  `.plink` a second time or the line drew over an un-linked inning tag and
  skipped the name — the bug `check-strike-links.mjs` exists for. A bar that
  sits outside the link covers a link, a tag or plain text without knowing
  which it got, so the hazard is gone rather than guarded. But an
  absolutely-positioned bar fills its containing block, and hanging it on the
  wrapper drew it the width of the BOX: `.abhero__name` is an item of a column
  flex container, so it stretches to the card's full cross size, and the line
  ran 175px past an 87px name; `.defdiamond__name` holds the 58px `min-width`
  its writing line was printed at then, and a short surname was left with a
  rule off both ends. `.struckline` is inline, so it hugs the glyphs the decoration used
  to cross. The two flex sites restate their own layout on it
  (`styles/motion/strike.css`). Before adding a fifth site, check it cannot wrap
  onto two lines: a bar over a two-line box draws one rule through the gap.
- **An animation that starts late needs the ADDITIVE pause form in the Animation
  Lab.** Overwriting an element's own `animation-delay` with the bare frame
  offset freezes every row or cell at the same instant, and starts a delayed
  beat at zero — a strip labelled 0/140/300ms showed the write-on's result code
  fully inked by its second frame, 340ms before the app draws a stroke of it.
  Only an animation with no delay of its own may take the bare offset. See the
  `.animlab__frame` block in `46-consent-modal.css`.
- **Match a `:not()` selector's specificity in that pause list.** A bare
  `.animlab__frame .btn--reveal` TIED
  `.btn--reveal:not(.revealsplit__btn--quiet)` and lost on import order, and the
  `animation` shorthand there reset the pause. The frame rendered a seal
  breathing in real time instead of a frozen one.

## Verifying a change here

`/animation-lab` is the review surface: every animation on the page with its
stages frozen underneath (`src/screens/animlab/motionDemos.jsx`). Add an entry
whenever a new animation ships.

**Nothing there runs until you press Play.** Most of what the Lab demos is a
one-shot, and a CSS animation with no `forwards` fill is over — and removed from
the element — about half a second after it mounts, so a page that started all
fifteen at once had played every one-shot below the fold to nobody. Each stage
rests paused on its first frame, and Play remounts that one and runs it alone
(a finished animation is gone, so resuming it was never an option). The three
hover entries have no button: you start a transition with the pointer.

The **live** stage needs no pause-list entry — it blankets everything under
`.animlab__live:not(.is-running)`. The **frozen strips** still do, because each
needs its own `animation-delay`; a new animation missing from that list will not
freeze, and a delayed one added to the wrong half of it freezes at the wrong
moment. See the `.animlab__frame` block in `46-consent-modal.css`.

`e2e/motion-study.spec.js` pins the gates the Lab cannot show — that a cascade
fires once and not on a poll, that a strike renders already drawn on a cold
load, that a half writes itself only when laid out to be read back, that the cap
holds, and that the whole study is off under reduced motion. It runs offline
against the captured anchor game (`e2e/fixtures/mock-api.js`), so it needs no
live statsapi.

## The big-play stamp (focus mode)

Stepping through a half in focus mode, a home run, a grand slam, a triple, a double
and the bases left loaded each get an ink stamp over the page
(`components/inning/focus/BigPlay*.jsx`, `styles/focus/bigplay.css`). It is a plain
CSS animation on `transform` and `opacity`: no motion library, because every other
motion here is CSS on tokens and the bundle stays as it was.

| Rule | Why |
| --- | --- |
| It starts when the denotation has inked, not when the card arrives | The stamp names the play. Before the mark prints, the reader does not know it (ADR-0046) |
| Its length is a literal per kind (`BIG_PLAY_MS` in `beats.js`) | `beats.js` imports nothing, so no timing can come from a feed |
| `bigPlayKind` reads only the entry the reader stepped to | `stepCap` has cut the feed to what they revealed |
| The next step removes it, and it never holds the bar | A stepping tap is a frequent action. The overlay takes no pointer events |
| Once per at-bat per page load | Stepping back to a play does not replay it |
| Reduced motion mounts nothing | The denotation is the account |
