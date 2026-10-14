# Player page motion: the build spec (#2073)

Status: **ready to build.** Gary made the five decisions on 2026-10-14 (issue #2073,
decisions comment). This folder is the prep for an `/orchestrate` run. Each slice in
`slices/` is a standalone brief that a Sonnet session can build without a design
decision. `run-plan.md` is the table and the prompts that orchestrate Lane 3 takes.

## The goal

Make the motion and the press, hover and focus feedback on `/player/{id}` match the
design canvas as closely as the house rules allow. The canvas is the private
artifact `https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK` ("Player Detail Page -
Pitcher and Batter"). Each slice copies the canvas values it needs, so a child does
not have to read the canvas. A child that runs as Gary can read a full board with
the Artifact tool: `action: "read"`, `path: "project/<Board>.dc.html"`.

**The repo is public and the canvas is private.** Copy only the values and the
short excerpts a slice needs. Never commit a whole board.

## The five decisions (settled; do not ask again)

1. **Press: site-wide.** The canvas stamp-press replaces the 1px press on every
   `Button` and `Pill`: `translate(2px, 2px)`, the offset shadow goes to none,
   `--dur-fast` (120ms) on `--ease-stamp`. A control with no offset shadow gets
   only the move.
2. **Curves: new tokens.** `--ease-stamp` and `--ease-unfold` (values below). The
   stamp-in, the press and all new player-page motion use them. `--ease-out`
   stays for the rest of the app.
3. **Jump-bar tap: stamp the section you land on.** After the scroll lands, the
   cards of the target section stamp in one time. Overview replays the hero and
   the tiles. A cold load, Back and a return visit do not replay.
4. **In-card toggles: a joined 44px segmented control.** A new design-system part.
   `--control-min` (34px) stays for other small controls.
5. **Menus: one shared menu, rail and panel part.** Built once. Arsenal, Splits
   (both roles), Plate approach and Contact use it.

## Settled details (decided in this prep, so a child does not stop on them)

- **Focus rings stay the house ring.** The canvas draws a 3px ink outline. The
  house ring is `var(--focus-ring)` at `--bw-heavy`, and `check-focus-ring.mjs`
  enforces the colour. Do not copy the canvas ring. Add a ring only where a
  control has none.
- **Canvas hex becomes a token.** Never write a canvas hex in `src/styles/`
  (`check-raw-values.mjs` counts it). The map is in "Canvas colour map" below.
  Slice 01 adds the two new surface tokens.
- **The one-shot rule for entrances.** An entrance (a rise, a bar grow, a draw)
  plays the first time its card comes into view in this page visit. It does not
  play again on a re-render, a poll, or a data refresh. It plays again after a
  full page load. It does not play again on Back inside the app in the same tab:
  `useInViewOnce` keeps a module-level `Set` of keys (`<playerId>:<slotKey>`) for
  the life of the JS bundle. A tap that changes what a card shows (a pick, a
  filter) is a change the reader caused, so its motion may play every time
  (`docs/motion.md`, "The one-shot gate").
- **Reduced motion.** CSS: `src/styles/01-base.css` (the `data-motion='reduced'`
  blanket) and the OS query already stop CSS animations and transitions. Add an
  `@media (prefers-reduced-motion: reduce)` block next to each new rule anyway,
  as the existing motion sheets do. JS: every rAF loop and every JS tween checks
  `motionIsReduced()` (`src/hooks/preferences/motionIsReduced.js`) and jumps to
  the end state.
- **No new route, no new data.** Motion only. Do not change what a card shows,
  except where a slice says so.

## Tokens (slice 01 adds them; every later slice reads them)

In `src/tokens/effects.css`, in the `/* Motion */` block:

| Token | Value | Canvas source |
|---|---|---|
| `--ease-stamp` | `cubic-bezier(0.2, 0.9, 0.3, 1)` | shell `.stamp`, `.ptab`, Mound, Plate, Contact |
| `--ease-unfold` | `cubic-bezier(0.23, 1, 0.32, 1)` | Splits `.part`, `.fill`; Arsenal `.ar-mc`, `.ar-mx` |
| `--dur-stamp-in` | `380ms` (was `var(--dur-slow)`) | shell `.stamp` |
| `--ease-stamp-in` | `var(--ease-stamp)` (was `var(--ease-out)`) | shell `.stamp` |
| `--dur-rise` | `420ms` | shell `.rise`, Mound `.rise` |
| `--dur-unfold` | `400ms` | Arsenal `.ar-mc`/`.ar-mx`/`.ar-pn` (.4s); Plate 380/340ms; Splits .45s |
| `--dur-grow` | `750ms` | Splits `.fill` |
| `--dur-draw` | `900ms` | Mound `.mc-fill`, `.mc-avg`; Arsenal mix roll |
| `--stagger-step` | `55ms` | Splits rows, Mound bars, fold rows |

Durations a slice needs only once (a 260ms ripple, a 1150ms dwell) stay in that
slice's JS as named constants, or in CSS as `calc(var(--dur-…) * n)`. They never
go into CSS as a raw time.

JS reads the curves through `src/lib/motion/curves.js` (slice 01):
`cubicBezier(x1, y1, x2, y2)` (moved from `src/lib/scorecard/glide.js`, which
re-exports it), `EASE_STAMP`, `EASE_UNFOLD`, `easeStamp`, `easeUnfold`, and
`easeOutQuart(t) = 1 - (1 - t) ** 4` (the canvas `eo` helper in ArsenalReveal and
PitchFlight). A test pins each array to its token, the same way
`test/scorecard-lens-glide.test.js` pins `EASE_OUT`.

## The two new parts: their API (fixed here, so the slices agree)

### `Segmented` (slice 03, `src/components/ui/control/Segmented.jsx`)

```jsx
<Segmented
  label="Show games"                 // aria-label of the group
  value={scope}                      // the selected option's value
  onChange={setScope}                // called with the option's value
  options={[{ value: 'all', label: 'All', count: 22, disabled: false }, …]}
  fill                               // optional: buttons share the row width (flex: 1)
/>
```

Markup: `<div role="group" aria-label class="segmented [segmented--fill]">`, then
one `<button type="button" class="segmented__btn" aria-pressed>` per option, with
an optional `<span class="segmented__count">`. CSS in
`src/styles/system/segmented.css` (imported by `src/index.css` after `pill.css`):
height `--tap-min` (44px); border `--bw-heavy` solid `--border-stamped`; every
button after the first has `margin-left: calc(var(--bw-heavy) * -1)`; the face is
`--surface-card` with `--text-heading`; `[aria-pressed='true']` is
`--text-heading` fill with `--text-on-ink` text; no tick; display face, label
tracking, uppercase (as `.btn`). Press: the stamp-press from slice 02. The canvas
sources are `.gl-fbtn` (GameLog), `.ib-sb` (InningsByPosition), `.ll-segb`
(SimilarPlayers), `.fe-tab` (FoulBalls).

### `MenuRail` (slice 05, `src/components/ui/control/MenuRail.jsx`)

```jsx
<MenuRail
  label="Pitch types"                // aria-label of the menu
  items={[{ key: 'FF', title: 'Four-seam', meta: '34%', figures: <…/>, mark: <…/> }, …]}
  picked={code}                      // a key, or null for the full menu
  onPick={setCode}                   // called with a key, or null when the picked card is tapped again
  panel={(key) => <Detail code={key} />}   // the focus panel for the picked key
  backLabel="All pitches"            // optional: a ghost Button at the top of the panel that calls onPick(null)
/>
```

The canvas sources are `.ar-mc`/`.ar-mx`/`.ar-pn` (ArsenalReveal), `.sp-mc`/`.sp-mx`
(PitcherSplits), `.tp-mc`/`.tp-mx`/`.tp-pn` (PlateApproach), `.tc-mc`/`.tc-mx`/`.tc-pn`
(Contact). Behaviour:

- **Menu state** (`picked == null`): cards in a wrapping row, each `flex: 1 1 150px`,
  showing `mark`, `title`, `meta` and `figures`.
- **Rail state** (`picked != null`): the cards shrink to a row of narrow cards
  (`flex-basis` and `padding` transition over `--dur-unfold` on `--ease-unfold`). Each
  card's `figures` sit in a wrapper with `display: grid; grid-template-rows: 1fr`
  that goes to `0fr` (transition `grid-template-rows var(--dur-unfold)
  var(--ease-unfold)`; the inner element has `overflow: hidden; min-height: 0`).
  The picked card is `aria-pressed='true'`: `--accent-tint` fill and a 2px offset shadow,
  `box-shadow: var(--bw-heavy) var(--bw-heavy) 0 var(--border-stamped)` (every
  value a token, so `check-raw-values.mjs` does not count it).
- **Panel**: always mounted. A wrapper `.menurail__panel` goes `grid-template-rows:
  0fr` → `1fr` on open (same transition). It renders `panel(shownKey)`, where
  `shownKey` is `picked`, or the last picked key while the panel closes, so the
  content does not vanish before the collapse ends. When closed it has
  `visibility: hidden` with `transition: visibility 0s var(--dur-unfold)`, and
  `inert`, so a closed panel takes no focus.
- **Rise on each pick**: the panel body carries `menurail__body--a` or
  `menurail__body--b`, which swap on every new pick. Two keyframes with the same
  steps (`menurail-rise-a`, `menurail-rise-b`: opacity 0 and `translateY(8px)` →
  none, `--dur-stamp-in`, `--ease-stamp`) restart the rise without a remount.
  This is the canvas `ar-fa`/`ar-fb` and `tp-ff1`/`tp-ff2` trick.
- **Keyboard**: each card is a `<button type="button" aria-pressed>`; the panel
  follows the menu in the DOM; `backLabel` gives a second way out.
- Reduced motion: no transitions and no rise; states switch at once.

## Canvas colour map

| Canvas hex | Use on the canvas | Token |
|---|---|---|
| `#0F1822` | ink, borders, selected fill | `--text-heading` / `--border-stamped` |
| `#FBF6E9` | card paper | `--surface-card` |
| `#F6EFDC` | page paper | `--bg-canvas` |
| `#FFFDF6` | bright inset, Splits door hover | `--surface-inset` |
| `#F1E7CC` | cream on ink | `--text-on-ink-cream` |
| `#DED6C0` | hairline; Splits fold hover | `--border-hairline` |
| `#86BE98` | mint: selected count badge, picked menu card | `--accent-tint` |
| `#DDE7CF` | tint tile; WAR hover | `--surface-stamped-tint` |
| `#6B6558` | graphite caption | `--text-caption` |
| `#1B2A3A` | Splits selected menu card | `--text-body` (ink-1) |
| `#F3EBD2` | row hover (game logs, Similar) | **new** `--surface-row-hover` (slice 01) |
| `#EFE6C8` | selected row (game logs, Firsts) | **new** `--surface-row-selected` (slice 01) |
| `#1F7A4A` / `#B4453A` | win / loss | `--accent-positive` / `--accent-negative` |

Pitch colours never come from the canvas. Use `pitchMark(code)`
(`src/lib/pitch/pitchTypes.js`).

## Rules every slice follows

- **Test first.** Write the test, run it, see it fail, then write the code. CSS
  motion is tested the way `test/notice-n5.test.js` does it: read the sheet with
  `stripComments` and `ruleBody` from `test/helpers/css.js` and assert the
  declaration (`animation`, `transition`, `transform`). Pure JS (a curve, a phase
  machine, a tween) gets a pure-module test. A hook's pure core goes in a plain
  module so the test needs no DOM (`test/CLAUDE.md`).
- **Tokens only** in `src/styles/`: no raw hex, no raw time, no raw radius
  (`check-raw-values.mjs`). Type through `tokens/typography.css` roles
  (`check-typography.mjs`). A new hand-written flex or grid rule takes
  `/* layout-exempt: <reason> */` on the line before it (ADR-0108).
- **Motion lives in `src/styles/motion/`** when it belongs to a shared part. A
  module's own entrance can stay in the module's sheet under
  `src/styles/player-next/<group>/`. Keyframe names start with the block name
  (`splitsmod-rise`, not `rise`).
- **File caps.** `check-file-size.mjs` caps a file at 600 lines and
  `check-dir-size.mjs` caps a directory at 12 source files. `src/styles/motion/`
  holds 7 files today. `src/styles/player-next/both/` is full: new player CSS goes
  in `season/`, `history/`, `gamelog/`, `pitcher/`, `batter/` or `top/`.
- **Module contract.** A module never edits `sections.js`, `Slot.jsx` or the page
  (`src/screens/player/next/CLAUDE.md`). Only slices 06 and 07 touch those files.
- **Shared parts go in the design system** (`src/components/ui/`,
  `src/styles/system/`), with a `/design-lab` entry. A new animation gets an
  `/animation-lab` entry in `src/screens/animlab/motionDemos.jsx`
  (`docs/motion.md`, "Verifying"), using the real class names.
- **Verify.** `npm run lint`, `npm test`, `npm run build`. Then render the route
  in the preinstalled Chromium at 390px and at 1180px with `?nointro`: batter
  `/player/brice-turang-668930?nointro`, pitcher
  `/player/robert-gasser-688107?nointro`. Send Gary a screenshot (or a short
  frame strip for motion) with `SendUserFile`, and say the route. Also load once
  with reduced motion on (Playwright `reducedMotion: 'reduce'`) and confirm that
  the end state shows at once.
- **Do not run `npm run e2e`.** Only Gary asks for it (hook-enforced).
- **Writing.** ASD-STE100 for comments, the PR text and docs
  (`docs/agents/writing-style.md`). Say "postseason".

## Slice template (each file in `slices/`)

Every slice file has these headings, in this order: **Run** (model, effort,
depends on, parallel with), **Goal**, **Done means**, **Files** (at most 5,
each with what changes), **Canvas** (the exact values and short excerpts),
**Live today** (`file:line` and the code as it is), **Build** (steps, with the
code to write), **Test first** (the test file and its cases), **Verify**,
**Out of scope**, **Stop if**.

## The slices

| # | Slice | Model, effort | Depends on |
|---|---|---|---|
| 01 | Motion tokens, curves, rise, row surfaces, `useInViewOnce` | Sonnet, medium | none |
| 02 | Site-wide stamp-press (`Button`, `Pill`, jump bar) | Sonnet, medium | 01 merged |
| 03 | `Segmented`: the joined 44px control | Sonnet, high | 01 merged |
| 04 | Swap player toggles onto `Segmented` | Sonnet, medium | 03 merged |
| 05 | `MenuRail`: the shared menu, rail and panel | Sonnet, high | 01 merged |
| 06 | Shell: stagger, age flip, jump-bar ease | Sonnet, medium | 01 merged |
| 07 | Slot: hold height, no loading text, rise in, jump hold, stamp on land | Sonnet, high | 01 merged |
| 08 | Splits motion: rise on view, bars grow and glide, fold cascade, hover, press | Sonnet, medium | 01 merged |
| 09 | Splits menu onto `MenuRail` | Sonnet, medium | 05, 08 merged |
| 10 | On the mound: track draw, bar grow, now chip, bar hover | Sonnet, medium | 01 merged |
| 11 | Arsenal menu and panel onto `MenuRail`; replay on pick; ghost fade | Sonnet, medium | 05 merged |
| 12 | Arsenal timeline: one clock, the canvas beats | Sonnet, high | 11 merged |
| 13 | Pitch flight: loop, off-screen pause, camera tween | Sonnet, high | 01 merged |
| 14 | Pitch flight: orbit drag and keys | Sonnet, medium | 13 merged |
| 15 | Pitch flight: `<canvas>` trail renderer | Sonnet, high | 14 merged |
| 16 | Plate approach onto `MenuRail`; rise on pick | Sonnet, high | 05 merged |
| 17 | Contact: dots drop in, highlight fade, menu onto `MenuRail` | Sonnet, high | 05 merged |
| 18 | Contact: ball flight on tap | Sonnet, high | 17 merged |
| 19 | Contact: play through the balls | Sonnet, medium | 18 merged |
| 20 | Small fixes: game-log rows, Season, Contract, Similar, Fouls | Sonnet, medium | 01 merged |

No slice needs Opus. Each one names its files, the values, the code shape and
its tests. Moving up a rung (`write-prompt` step 5) is the fallback when a
result is weak: Sonnet high, then Sonnet xhigh. Slices 12, 15 and 18 are the
likely ones.

## Shared files (two slices that touch one run one after the other)

| File | Slices |
|---|---|
| `src/tokens/effects.css`, `src/tokens/colors.css` | 01 |
| `src/styles/system/button.css`, `pill.css` | 02 |
| `src/styles/system/jumpbar/jumpbar.css` | 02 (press), 06 (ease) — 06 waits for 02, or 06 drops the jump-bar line |
| `src/screens/animlab/motionDemos.jsx` | 01, 02, 03, 05, 08, 10, 12, 17 — one line each; merge conflicts are trivial, but two open at once must merge `main` in |
| `src/screens/player/next/Slot.jsx`, `PlayerNextPage.jsx` | 07 |
| `src/screens/player/next/modules/splits/*` | 08, then 09 |
| `src/screens/player/next/modules/arsenal/*` | 11, 12, 13, 14, 15 — in that order |
| `src/screens/player/next/modules/contact/*` | 17, 18, 19 — in that order |
| `src/styles/player-next/both/logtable.css` | 20 |

Open PR at prep time: #2071 (hero Born fact, `PlayerNextHero.jsx`). Slice 06
touches the hero `Card` props only. Merge `main` in if #2071 lands first.
