# The preview poster

`/{MMDDYYYY}/{matchup}/preview` — the game's fifth section, and the only one
that isn't a page of the scorebook. It makes a **1200 × 1600 PNG** of the
matchup to post: the tallest frame X shows in a timeline without cropping it.

ADR-0045 is the *why* (why a canvas rather than a DOM capture, why the head is
the slate card's hover state, what the spoiler footing is). This file is the
map — what each module does and what bites when you change it.

## The pieces

| File | Holds |
| --- | --- |
| `src/api/gamePreview.js` | `buildPreviewModel(feed, extras)` — every value the poster can print, and the whole spoiler audit. `spoiler-free` in the manifest. |
| `src/screens/GamePreview.jsx` | The studio: the sheet, three include/exclude checkboxes, the Save button. Owns no composition. |
| `src/components/preview/SavePosterButton.jsx` | `canvas.toBlob()` → share sheet on a phone, download on a computer. |
| `src/lib/preview/posterLayout.js` | Pure arithmetic: the frame, the block stack, the head's stretch. Unit-tested. |
| `src/lib/preview/posterPaper.js` | The palette read off `:root`, the four type roles, and the font preload. |
| `src/lib/preview/posterInk.js` | Canvas primitives — `caps`, `line`, `clip`, `track`, `rule`, `panel`, `masthead`, `cover`, `contain`. |
| `src/lib/preview/posterHead.js` | The head: backdrop, '@' watermark, treatment tiles, club names, dateline. |
| `src/lib/preview/posterBlocks.js` | The three body blocks and the footer. |
| `src/lib/preview/posterImages.js` | The CORS-anonymous image loader and its cache. |
| `src/lib/preview/posterArt.js` | Which picture each slot wants, and the CSS-focus → canvas-focus conversion. |
| `src/lib/preview/drawPoster.js` | One synchronous paint, plus `posterFile()`. |
| `src/styles/62-game-preview.css` | The page around the poster. Never the poster — it has no CSS. |

Tests: `test/poster-layout.test.js` (the composition),
`test/game-preview-model.test.js` (the spoiler sentinels),
`e2e/poster-export.spec.js` (a real export, asserting the bytes).
`e2e/shots/poster-shot.mjs` writes the exported PNG straight to disk for a
short design loop — `node e2e/shots/poster-shot.mjs /08122026/milsd/preview out.png`.

## What the poster shows

**Head** (a floor of 560px). The slate card as if permanently hovered: the
ballpark photograph full-bleed and grayscale under a manila wash, the two-layer
'@' printed out of register in kraft-amber and navy at the card's *hover*
opacities, both clubs' uniform-treatment tiles, place-over-nickname, and the
park's name promoted from a hover reveal to the poster's dateline. Under it:
start time, city, roof (only when it isn't Open), weather, broadcast.

The readiness pips are deliberately **not** carried over — see ADR-0045.

**Starting pitchers.** Both probables: headshot, name in natural order, number
and hand, the season line (ERA · W-L · K · IP), and the last outing.

**Batting order.** Both posted cards, away left and home right, nine ruled rows
of number / surname / position with the club's full-colour mark on each heading.

**Behind the plate.** The plate umpire, the rest of the crew, four tiles
(accuracy, rank, consistency, run impact) and the 3×3 league-relative zone grid
inked green where he calls more strikes than the league does there and clay
where he calls fewer.

**Footer.** The wordmark line and the matchup.

## Three things that bite

**Tainting.** One image drawn without CORS taints the canvas permanently:
`toBlob()` throws `SecurityError` and the Save button silently does nothing
forever after. `posterImages.js` is the only loader, it sets
`crossOrigin = 'anonymous'`, and it DROPS an image whose host refuses CORS
rather than drawing it. Verified open (2026-08-12, with an `Origin` header):
`www.mlbstatic.com` and `img.mlbstatic.com` both send
`access-control-allow-origin: *`; everything else the poster draws is
same-origin. `e2e/poster-export.spec.js` exports for real, so a new source from
a host with no CORS fails a check instead of shipping a dead button.

**Fonts.** A canvas rasterises with whatever face is loaded at the moment
`fillText` runs, and there is no reflow when a webfont arrives later — a poster
painted early bakes the fallback metrics into the exported PNG.
`ensurePosterFonts()` must resolve before the first paint; `font-display: swap`
cannot help a bitmap.

**The vertical budget is solved, not chosen.** Head 560 + footer 60 leaves 980,
the three blocks take 895, and the remaining 85 is the four gaps. Two numbers
must never be worked out twice: `cardsHeight()` sizes the batting-order block
and `drawOrder()` draws its rows — they once computed the row count separately,
disagreed by one, and dropped the ninth hitter off every poster. Change any
height and `test/poster-layout.test.js` tells you what no longer fits.

## Adding a block

1. Give it a natural height in `BLOCK_HEIGHT` and a place in `BLOCK_ORDER`
   (`posterLayout.js`).
2. Paint it in `posterBlocks.js`, opening with `openBlock()` so it wears the
   same navy/gold masthead as its neighbours, and register it in
   `drawPoster.js`'s `PAINTERS`.
3. Add it to `BLOCKS` in `GamePreview.jsx` with a `has(model)` predicate and the
   line to show while it's waiting. A block with no data is switched OFF, never
   printed as a tall panel saying "not posted yet".
4. Add whatever it reads to `buildPreviewModel` — **not** to the painter. The
   painter is handed the model and nothing else, and that is what keeps the
   spoiler audit to one file.

The budget is nearly spent at three blocks, so a fourth means shortening one or
letting the studio's `overflows` warning do its job.
