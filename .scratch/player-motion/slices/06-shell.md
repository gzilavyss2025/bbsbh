# Slice 06 — Shell: hero and tile stagger, age flip

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 01a merged (it adds `--ease-stamp` and sets `--dur-stamp-in` 380ms and
  `--ease-stamp-in: var(--ease-stamp)`).
- Parallel with: 02, 03, 05, 08, 10, 13, 20.
- Not in parallel with 07a: both add rules to `src/styles/player-next/page.css`. Run
  them one at a time; merge `main` in before you push.
- Change from spec.md: **the jump-bar ease line moves to slice 02.** Slice 02 already
  rewrites the `.jumpbar__item` transition and its `:active` press (decision 1:
  `--dur-fast` on `--ease-stamp`). One slice owns that rule, so 06 does not wait for 02
  and does not touch `src/styles/system/jumpbar/jumpbar.css`.

## Goal

Make the top of `/player/{id}` enter on the canvas beat: the hero card stamps in at
60ms, the five stat tiles follow at 120ms, 160ms, 200ms, 240ms and 280ms, and the Age
fact turns on the canvas curve and close to the canvas time.

## Done means

- The hero `Card` carries `--stamp-delay: 60ms`.
- Tile `i` carries `--stamp-delay: (120 + 40 * i)ms` (today it is `60 + 40 * i`).
- `.pnext__ageflip` turns with `transform calc(var(--dur-flip) * 1.15) var(--ease-stamp)`.
- A reduced-motion block next to it sets `transition: none`.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR. The new test fails before the change.

## Files

| File | Change |
|---|---|
| `src/screens/player/next/heroData.js` | Add `HERO_STAMP_DELAY` and `tileStampDelay(i)` (pure). |
| `src/screens/player/next/PlayerNextHero.jsx` | Hero `Card` gets `style={{ '--stamp-delay': HERO_STAMP_DELAY }}`. |
| `src/screens/player/next/PlayerNextTiles.jsx` | Tile style reads `tileStampDelay(i)`. |
| `src/styles/player-next/page.css` | `.pnext__ageflip` transition; reduced-motion block. |
| `test/player-next-shell-motion.test.js` | New. |

## Canvas

Boards B-phone, B-wide (hero and tiles), D2-phone, D2-wide (age flip). Same values on
the phone and the wide boards.

```css
.stamp{animation-duration:380ms;animation-timing-function:cubic-bezier(.2,.9,.3,1);
       animation-delay:var(--d,0ms);animation-fill-mode:backwards}
@keyframes stamp-a{from{opacity:0;transform:translate(4px,4px);box-shadow:0 0 0 #0F1822}}
```

```html
<div class="c stamp" style="--d:60ms ...">            <!-- the hero card -->
<div class="stamp" style="--d:120ms ...">            <!-- tile 1 (ink) -->
<div class="stamp" style="--d:160ms ...">  …200ms … 240ms … 280ms   <!-- tiles 2 to 5 -->
```

```css
/* D2-phone / D2-wide, the age flip */
.agef{display:grid;transform-style:preserve-3d;transition:transform 520ms cubic-bezier(.2,.9,.3,1)}
.agebtn.on .agef{transform:rotateX(180deg)}
@media (prefers-reduced-motion:reduce){.agef{transition:none}}
```

The canvas draws one tile row. A two-way player has two rows (`PlayerNextTiles` once per
block). Each row uses the same formula, so both rows start at 120ms (inferred; the
canvas has no two-row board).

## Live today

`src/screens/player/next/PlayerNextHero.jsx:53` — no delay:

```jsx
    <Card as="div" frame="stamped" body="flush" stampIn className="pnext__hero">
```

`src/screens/player/next/PlayerNextTiles.jsx:32-33`:

```jsx
            stampIn
            style={{ '--stamp-delay': `${60 + i * 40}ms` }}
```

`src/styles/player-next/page.css:85-91`:

```css
/* layout-exempt: two faces stacked in one grid cell */
.pnext__ageflip {
  display: grid;
  align-content: start;
  transform-style: preserve-3d;
  transition: transform var(--dur-slow) var(--ease-out);
}
```

`src/styles/motion/stamp-in.css:24-26` (read only; slice 01a changes the tokens it reads):

```css
.card--stamp-in {
  animation: card-stamp-in var(--dur-stamp-in) var(--ease-stamp-in) var(--stamp-delay, 0s) backwards;
}
```

`Card` passes `style` to the element (`src/components/ui/frame/Card.jsx:51,67`).
`StatTile` passes `style` to its Card (`src/components/ui/frame/StatTile.jsx:20,29`).

Open PR #2071 changes `PlayerNextHero.jsx:77` (the Born fact gets `mono`). This slice
changes line 53 and the imports only, so the two do not conflict. If #2071 lands first,
merge `main` in.

## Build

### 1. The delays (JS constants, not CSS tokens)

The delays stay as numbers in JS, on purpose. 60ms and 40ms match no token
(`--stagger-step` is 55ms), and spec.md says a one-time value lives in the slice's JS
as a named constant. `scripts/check-raw-values.mjs` scans only `.css` under
`src/styles/` (`listSheets`, line 323) and only `transition`/`animation` properties,
so an inline custom property in JSX is not counted. The current code already writes
`${60 + i * 40}ms` inline.

Add to `src/screens/player/next/heroData.js` (after `rankFor`):

```js
// The top's stamp-in beat (B-phone, B-wide): the hero card lands at 60ms, then the tiles
// one after another from 120ms, 40ms apart. Values from the canvas; no token is 40ms.
export const HERO_STAMP_DELAY = '60ms'
const TILE_FIRST_MS = 120
const TILE_STEP_MS = 40
export const tileStampDelay = (i) => `${TILE_FIRST_MS + i * TILE_STEP_MS}ms`
```

`PlayerNextHero.jsx`: import `HERO_STAMP_DELAY` from `./heroData.js` (the file already
imports `ageFact` from there) and change line 53:

```jsx
    <Card as="div" frame="stamped" body="flush" stampIn className="pnext__hero" style={{ '--stamp-delay': HERO_STAMP_DELAY }}>
```

`PlayerNextTiles.jsx`: import `tileStampDelay` with `rankFor` and change line 33:

```jsx
            style={{ '--stamp-delay': tileStampDelay(i) }}
```

### 2. The age flip

Canvas: 520ms on `cubic-bezier(.2,.9,.3,1)`. No token is 520ms. Use
`calc(var(--dur-flip) * 1.15)` = 517.5ms. Reasons: `--dur-flip` (450ms,
`src/tokens/effects.css:98`) is the house token for a two-way card turn, so a change to
the flip speed reaches this turn too; the result is within 3ms of the canvas. Do not add
a token. Do not use `--ease-flip`: the canvas curve is the stamp curve.

Replace `page.css:90`, and add the reduced-motion block right after the
`.is-flipped .pnext__ageflip` rule (line 102-104):

```css
/* layout-exempt: two faces stacked in one grid cell */
.pnext__ageflip {
  display: grid;
  align-content: start;
  transform-style: preserve-3d;
  /* The canvas turns in 520ms; the flip token times 1.15 is 518ms. */
  transition: transform calc(var(--dur-flip) * 1.15) var(--ease-stamp);
}
```

```css
@media (prefers-reduced-motion: reduce) {
  .pnext__ageflip {
    transition: none;
  }
}
```

`AgeFact` (`PlayerNextHero.jsx:18-19`) already draws plain text when
`motionIsReduced()` is true at mount. Keep that.

Guards: `check-raw-values` sees `calc(var(--dur-flip) * 1.15)`: the scanner skips
var() contents and 1.15 has no time unit, so it is not a raw time. The
`/* layout-exempt */` line stays on the line before the rule (do not move it).
`page.css` is 206 lines; the cap is 600.

## Test first

New `test/player-next-shell-motion.test.js`. Run it before the change; the four tests fail.

```js
// Slice 06 of the player-page motion (#2073): the top's stamp-in beat and the age flip,
// pinned to the canvas boards B-phone and D2-phone.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HERO_STAMP_DELAY, tileStampDelay } from '../src/screens/player/next/heroData.js'
import { stripComments, ruleBody } from './helpers/css.js'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const page = stripComments(read('src/styles/player-next/page.css'))
const decl = (body, prop) =>
  body.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('the hero lands at 60ms and the tiles from 120ms, 40ms apart', () => {
  assert.equal(HERO_STAMP_DELAY, '60ms')
  assert.deepEqual([0, 1, 2, 3, 4].map(tileStampDelay), ['120ms', '160ms', '200ms', '240ms', '280ms'])
})

test('the hero card and the tiles read the beat', () => {
  assert.match(read('src/screens/player/next/PlayerNextHero.jsx'), /'--stamp-delay': HERO_STAMP_DELAY/)
  assert.match(read('src/screens/player/next/PlayerNextTiles.jsx'), /'--stamp-delay': tileStampDelay\(i\)/)
})

test('the age flip turns on the stamp curve, near the canvas 520ms', () => {
  assert.equal(decl(ruleBody(page, '.pnext__ageflip'), 'transition'), 'transform calc(var(--dur-flip) * 1.15) var(--ease-stamp)')
})

test('reduced motion stops the age flip', () => {
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.pnext__ageflip\s*\{\s*transition:\s*none;?\s*\}/)
})
```

`heroData.js` loads in node: `test/player-next-sections.test.js` already imports it
(checked in this prep).

## Verify

- `node --test test/player-next-shell-motion.test.js` and `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `npm run dev`; open `/player/brice-turang-668930?nointro` and
  `/player/robert-gasser-688107?nointro` in the preinstalled Chromium at 390px and
  1180px. Take a frame strip of the first 500ms (for example, screenshots at 0, 100,
  200, 300, 450ms after the hero shows): the hero lands first, then the tiles left to
  right (on the phone: the ink tile, then two by two).
- Tap Age: it turns about the horizontal axis and settles without a bounce back.
- Load once with Playwright `reducedMotion: 'reduce'`: the hero and the tiles show at
  once, and Age is plain text.
- Send Gary the strip with `SendUserFile` and say the route.

## Out of scope

- The jump-bar ease and press (slice 02).
- The stamp-in keyframe and its tokens (slice 01a).
- Replaying the hero and tiles after a jump-bar tap (slice 07b).
- The hero's markup and facts (PR #2071 owns the Born fact).
- No `/animation-lab` entry: this slice adds no animation, only timings on
  `card-stamp-in` and the age-flip transition.

## Stop if

- Slice 01a is not on `main` (`grep -n "ease-stamp" src/tokens/effects.css` finds nothing).
- `PlayerNextHero.jsx:53` or `PlayerNextTiles.jsx:33` differs from the code quoted
  above (other than #2071's line 77).
- `.pnext__ageflip` already has a different transition than `var(--dur-slow) var(--ease-out)`.
- `check-raw-values` counts the new transition as raw. Do not add an exempt marker;
  report it.
- `heroData.js` does not import in node.
