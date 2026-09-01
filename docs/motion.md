# The motion layer (`src/styles/motion/`)

Where every animation in the app lives, what gates it, and the rules a new one
has to clear. The craft bar itself is
`.agents/skills/review-animations/STANDARDS.md`; this file is the map.

Built as the motion study, issues #976–#983 — eight animations across the home
slate, the lineup card and the play-by-play feed.

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

Every one-shot in the package hangs off `src/hooks/motion/useBecameTrue.js`.

A CSS animation runs when its element mounts, or when the element gains the
class carrying it. That is right for a change the reader just caused and wrong
for a cold load, a return visit, a navigation, a poll, or a force-reveal (the
Scores Unlocked pass, ADR-0026, or the reader's own stamp, ADR-0048) — all of
which present the same already-changed DOM and would replay a gesture nobody
made. A substitution from the third inning must render struck through, not draw
itself again every time the page is opened.

`useBecameTrue` returns true only for the render in which its value went
false → true with the component already mounted, and keeps returning true while
it stays true, so the class it drives is stable. State is adjusted during
render — React's documented escape hatch, the same shape `ScorecardPage`'s
ink-in diff uses — so the committed DOM carries the class from its first frame.

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
| `lineup.css` | #979, #980 | The row's straightedge rule on hover, and the batting order's ink-in cascade |
| `strike.css` | #981 | The drawn cross-out, all four sites |
| `playbyplay.css` | #982 | The four-beat write-on |
| `innings.css` | #978, #983 | The live-edge dot's breath and the frontier seal's |

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
`.btn--reveal` is the kraft skin and not the frontier. The home slate wears it
on "Reveal all results" and a live game's lineup page on "Catch up to live", and
a bare `.btn--reveal` rule put a permanent breath on a spoiler action on the
app's front door.

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
  its writing line is printed at, and a short surname was left with a rule off
  both ends. `.struckline` is inline, so it hugs the glyphs the decoration used
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

`/animation-lab` is the review surface: every animation running live, with its
stages frozen underneath (`src/screens/animlab/motionDemos.jsx`). Add an entry
and a pause-list selector whenever a new animation ships.

`e2e/motion-study.spec.js` pins the gates the Lab cannot show — that a cascade
fires once and not on a poll, that a strike renders already drawn on a cold
load, that a half writes itself only when laid out to be read back, that the cap
holds, and that the whole study is off under reduced motion. It runs offline
against the captured anchor game (`e2e/fixtures/mock-api.js`), so it needs no
live statsapi.
