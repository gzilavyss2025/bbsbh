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
| `src/lib/preview/posterCard.js` | The shared card chrome — `openCard`, `notPosted`, `PAD`. |
| `src/lib/preview/posterBlocks.js` | The pitcher, batting-order and records cards, and the footer. |
| `src/lib/preview/posterUmpire.js` | The umpire card: identity, zone map, watch band, lean scale, tiles. |
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

**Head** (a floor of 570px). The slate card as if permanently hovered: the
ballpark photograph full-bleed and grayscale under a manila wash, the two-layer
'@' printed out of register in kraft-amber and navy at the card's *hover*
opacities, both clubs' uniform-treatment tiles, place-over-nickname, and the
park's name promoted from a hover reveal to the poster's dateline. Under it:
start time, city, roof (only when it isn't Open), weather, broadcast.

The readiness pips are deliberately **not** carried over — see ADR-0045.

Everything below the head is **two cards per row**, never one card with two
columns. A club-coloured bar is only legitimate on a surface that IDENTIFIES
that club (ADR-0030), and a card holding both clubs identifies neither — there
is nowhere honest to put the colour. Splitting also gives each club's content
its own padded box instead of one of them starting hard against the outer edge.

Each card's bar is `headerThemeFor(teamId, treatment || 'main')` with the club's
one-colour knockout at its right. **The treatment falls back to `main`**: a
jersey is not posted until close to first pitch, which is exactly when a preview
gets made, and `headerThemeFor` answers null for a missing treatment — passing
the gap straight through left every bar the default navy. No card prints the
club abbreviation beside its own mark.

**Starting pitchers.** Two cards. Headshot, name in natural order, number and
hand, the season line (ERA · W-L · K · IP), and the last outing.

**Batting order.** Two cards, nine ruled rows each: order, face, full name,
position, and the broadcast stat line (`.278 · 17 HR · 48 RBI`). Four
left-aligned columns off fixed x positions — a card is read DOWN a column. The
surname alone is the fallback for a name too long to print whole, and a hitter
with no photo on file gets his initials on a paper disc.

**Umpire & records.** Two cards. Left is the Umpire Tendencies card
(`posterUmpire.js`) — identity, the 3×3 zone grid, the navy "area to watch"
band, the five-band zone-lean scale and the four tiles. Right is **How they
win**: four situational records both clubs carry INTO tonight, in two columns
headed by the clubs' knockout marks in the masthead.

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

**The vertical budget is solved, not chosen.** Head 570 + footer 60 leaves 970,
the three rows take 888, and the rest is the four gaps. Nine batting-order rows
carrying a headshot each is what makes it this tight. Two numbers must never be
worked out twice: `cardsHeight()` sizes the batting-order block and
`drawOrderCard()` draws its rows — they once computed the row count separately,
disagreed by one, and dropped the ninth hitter off every poster. Change any
height and `test/poster-layout.test.js` tells you what no longer fits.

**A `useAsync` holds `null`, not `undefined`.** `buildPreviewModel` reads every
`extras` key with `??` rather than a destructuring default, because a default
parameter only fires on `undefined` — `extras.starterLines.away` threw on first
paint and unmounted the whole screen until the fetch landed, which read as a
flaky page rather than a bug.

## Adding a block

1. Give it a natural height in `BLOCK_HEIGHT` and a place in `BLOCK_ORDER`
   (`posterLayout.js`).
2. Paint it in `posterBlocks.js`, opening with `openCard()` so it wears the
   same masthead as its neighbours, and register it in
   `drawPoster.js`'s `PAINTERS`.
3. Add it to `BLOCKS` in `GamePreview.jsx` with a `has(model)` predicate and the
   line to show while it's waiting. A block with no data is switched OFF, never
   printed as a tall panel saying "not posted yet".
4. Add whatever it reads to `buildPreviewModel` — **not** to the painter. The
   painter is handed the model and nothing else, and that is what keeps the
   spoiler audit to one file.

The budget is spent at three rows, so a fourth means shortening one or letting
the studio's `overflows` warning do its job.

## What was considered for the right-hand card, and why records won

A research pass over the site's pre-game modules ranked five candidates.
**Bullpen availability** (`api/workload.js` + `selectBullpen`) was the closest
rival and is the best fallback if this ever needs replacing: it is the only
candidate that is *exclusively* a tonight fact, it rides `workloadData` already
in `useGameData`, and its pen list populates before the lineups do. It lost on
reach — MLB-only, and `TeamInfo.jsx` gates it to games within three days of
`workload.asOf`, so archival posters would get an empty half.

`teamRecords` won because `gen-callouts.mjs` sets its `asOf` to the day BEFORE
the slate and bounds the schedule pull to it, so the shard for a date holds only
games already played when that date began. That is a written proof of "entering
tonight" — the exact property the feed's own `teams[side].record` lacks, and the
reason `recordFor` has to withhold that number once a game starts. It also
carries at MiLB and on archival dates, and costs no new fetch.

Rejected: **season series** and **standings** (both `cutoff-gated`, and both
reintroduce the "what does this number mean after first pitch" problem);
**recent form** (one boxscore request per game per club — 20 calls, and the
poster must paint synchronously); **career matchups** (samples usually too small
to be worth a slot, and the file only covers the current slate); **former
teammates** (text-dense, muddy at poster scale); **callout leaders** (the bundle
carries no player names).
