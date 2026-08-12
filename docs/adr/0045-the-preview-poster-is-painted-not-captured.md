# ADR-0045 — The preview poster is painted, not captured

Status: accepted (2026-08-12)

## Context

The app can already say everything you want to know before a game starts: who
is pitching, who is hitting, who has the plate, what the sky is doing, which
park. It says all of it as HTML, on pages built for a phone held next to a
scorebook. None of that leaves the browser.

The ask was for the same facts as a **file** — one image, posted to X, read by
people who will never open the app. That is a different medium with different
constraints, and three of them decide everything below:

- **A fixed frame.** X shows a single image uncropped down to a 3:4 portrait
  and crops anything taller. A responsive layout has no answer to that question;
  a poster has to be composed at one size, and 1200 × 1600 is the tallest frame
  that survives the timeline whole.
- **No hover, no scroll, no tap.** The slate card's best state is the one you
  only see with a mouse — the ballpark washing in, the '@' inking up, the park's
  name sliding open. On a poster there is nothing to reveal it, so the hover
  state has to be the resting state.
- **It has to rasterise.** The page must be able to produce actual bytes, or the
  feature does not exist.

That last constraint is the one with real alternatives, and they were weighed:

**A DOM-to-canvas library** (html2canvas, dom-to-image, satori) is the ordinary
answer and would have been the fastest to write. It is a runtime dependency in a
project that has deliberately avoided them — there is no react-router here for
the same reason — and each of these re-implements a layout engine well enough to
be convincing and badly enough to be surprising.

**Hand-rolled `<foreignObject>`** takes no dependency: serialise the DOM into an
SVG, draw the SVG to a canvas. But a serialised SVG cannot reach the document's
stylesheets or its fonts, so it works only if every rule and all four woff2
faces are inlined as data URIs on every export. That is brittle in general and
worst on iOS Safari, which is the phone this app is built for.

**Screenshot it yourself** — render the sheet at exact size and let the user
capture it — takes no dependency and no rasteriser. It also makes the
deliverable a manual step on a phone, and hands back a screenshot at whatever
scale the device felt like.

## Decision

**The poster is painted directly onto a `<canvas>`, and that canvas is both the
preview and the export.** There is no HTML version of the poster to keep in
sync: what is on screen is the thing that gets saved, pixel for pixel.

Four consequences, all deliberate:

**The composition lives in `src/lib/preview/`, as pure modules.** `posterLayout
.js` is arithmetic and nothing else, so where the blocks sit is unit-testable
(`test/poster-layout.test.js`) rather than something you discover by squinting
at a PNG. It has already earned that: the first draft's batting order and its
block height each worked out the row count separately, disagreed by one, and
dropped the ninth hitter off every poster.

**The palette is read out of the stylesheet at paint time.** A canvas cannot
resolve `var(--navy)`, and typing the hex in forks the poster off the design
system the moment a token moves. `posterPaper.js` reads the PRIMITIVE tier off
`:root` — primitives only, because `getPropertyValue` on a semantic alias hands
back the literal string `"var(--paper-2)"` rather than a colour.

**Every image is loaded CORS-anonymous, or not at all.** One image drawn without
CORS taints the canvas permanently: `toBlob()` throws `SecurityError` and the
Save button silently does nothing forever after. `posterImages.js` is the single
loader, and it DROPS an image whose host refuses CORS rather than drawing it — a
poster missing a headshot still saves; a tainted one never can.
`e2e/poster-export.spec.js` exports for real and asserts the bytes, so a new
image source from a host with no `access-control-allow-origin` fails a check
rather than shipping a dead button.

**`caps()` uppercases in JavaScript.** The global ALL-CAPS invariant is a CSS
`text-transform`, and a canvas glyph has no CSS to inherit it from — so unlike
every component, this is the only implementation rather than a redundant second
one. `scripts/check-name-casing.mjs` walks `.jsx` only, which is why this needs
no exemption marker; do not copy the call into a component.

## The head is the slate card's hover state, minus the checklist

The poster's top 570px (a floor) is `GameCard` as if permanently hovered: the ballpark
photograph washed grayscale under the whole sheet, the two-layer '@' printed a
few pixels out of register in kraft-amber and navy, and the park's name promoted
from a hover reveal to the poster's dateline. The photo comes from the same
`parkBackdrop` resolver, so a park the owner re-shot from the team hub's
Ballpark card (ADR-0044) shows up here with no second upload.

**The readiness pips do not come with it.** On the slate they answer "have the
lineups posted *yet*" — a fact about the moment you are looking at the page, not
about the game. Printed into a file that outlives that moment they are stale the
second the lineup posts, and actively wrong to whoever opens the image tomorrow.

**The head is a floor, not a fixed height.** Switching a section off gives its
room back, and spreading that into gaps just makes blank paper with a card
floating in it. The photograph is the one element that improves with more room,
so it absorbs the slack first (`POSTER.headStretch`) and the rest is centred in
what is left.

## Spoiler footing

The poster is the one surface here whose output is a file posted in public, so a
leaked number cannot be un-leaked by re-sealing anything. It is nonetheless
**not** a new spoiler exception, and needs none: everything on it is pre-game by
nature — a matchup, a scheduled time, a ballpark, a posted lineup, a probable
starter's season line, an umpire's season accuracy — and none of it moves when
the game does. That is why a preview of a game already played renders exactly
the same, with no score on it.

The rule is kept structurally rather than carefully. **`api/gamePreview.js`
assembles every value the poster can print, and the painter is handed that
object and nothing else** — no feed, no linescore, no gamePk. Auditing the
poster is reading one file. It is classified `spoiler-free` in
`spoiler-manifest.json`, and `test/game-preview-model.test.js` puts a sentinel
in every score-bearing feed path a finished game carries and asserts none of
them reaches the model.

One thing IS withheld, and for a correctness reason rather than a spoiler one.
A club's W-L record is a standings fact, and standings are an open surface here
(ADR-0034). But `gameData.teams[side].record` is the record **including** that
game's result — verified against gamePk 823035, where it reads 58-33 rather than
the 57-33 Milwaukee carried into the game. Before first pitch that same field is
exactly the "record entering" a preview graphic is supposed to show; afterwards
it quietly becomes a different statistic on a sheet that still says preview. So
a started game's poster carries no record at all.

## Consequences

- Design iteration on the poster is code, not CSS. That is the cost of the
  decision and it is real; `e2e/shots/poster-shot.mjs` exists to make the loop
  short by writing the exported PNG straight to disk.
- New blocks must declare a natural height in `posterLayout.js` and be painted
  in `posterBlocks.js`. The vertical budget is nearly spent at three blocks, so
  a fourth means either shortening one or letting the studio's `overflows`
  warning do its job.
- A block with no data is switched off rather than printed as a tall panel
  saying "not posted yet" — a third of a poster reading NOT POSTED YET is not
  something anybody sends.
- If a future surface needs the same treatment (a Game Log stamp sheet, a
  season card), the modules in `src/lib/preview/` generalise; the studio screen
  does not, and should not be made to.

## Amendment, 2026-08-12 — two cards per row, and what fills the fourth slot

Three changes settled after the first build, all pulling the same direction.

**A row is two cards, not one card with two columns.** The original poster put
both clubs inside one bordered panel per section. That panel could not be
club-coloured — a card holding both clubs identifies neither, and ADR-0030 only
licenses colour on a surface that identifies the club it colours — so every bar
stayed default navy and the marks had nowhere to go. Splitting each row into two
cards earns each half its own bar, its own knockout, and its own padding; the
away half had been starting hard against the poster's outer edge.

Two traps came with it. `headerThemeFor` answers null for a missing treatment,
and a jersey is not posted until close to first pitch — which is exactly when a
preview gets made — so passing the gap straight through left every bar navy for
clubs that *do* have curated colours on file; `barFor` falls back to `main`. And
no card prints its club's abbreviation beside its own mark: the knockout already
says whose card it is.

**The batting order carries faces, full names and a broadcast stat line.** Nine
rows with a headshot each cost 162pt off the sheet and every other block gave
some back. The line is `.278 · 17 HR · 48 RBI` — three terms, not four, because
a fourth pushed it past the column at every font size worth printing, and a stat
that ends in "…" is worse than a stat that isn't there. OPS, OBP and SLG are all
on the model for a one-line swap.

**The umpire card halved, and situational records took the other half.** A
research pass over the site's pre-game modules ranked five candidates; the
reasoning and the rejections are in `docs/preview-poster.md`. `teamRecords` from
the nightly callouts bundle won on a property none of the others had:
`gen-callouts.mjs` sets its `asOf` to the day BEFORE the slate and bounds the
schedule pull to it, so a date's shard holds only games already played when that
date began. That is a written proof of "entering tonight" — precisely what the
feed's own `teams[side].record` lacks, and the reason this ADR withholds that
number once a game starts. The row shows **leading after seven**, not eight: a
record leading after eight is close to a fact about how saves work, where after
seven there is still a game left to lose.

**One bug worth recording**, because it did not look like one. Every `extras`
key reaching `buildPreviewModel` arrives from a `useAsync`, which holds `null`
while in flight — and a destructuring default only fires on `undefined`. So
`extras.starterLines.away` threw on first paint and unmounted the screen until
the fetch landed. It presented as an intermittently blank page, and cost more
time than the fix (`??`) is worth reading.
