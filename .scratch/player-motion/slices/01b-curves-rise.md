# Slice 01b: the JS curves and the player rise sheet

Part 2 of 4 of slice 01 (see 01a for the split).

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 01a merged (the rise sheet reads `--dur-rise`, `--ease-stamp`,
  `--stagger-step`, and the curve test reads the tokens).
- Parallel with: 01c, 02a. Slice 01d waits for this slice.
- Shares append-only lines with other slices: `src/index.css` (one `@import`). The run plan may put
  those slices in one wave. Before you push, merge `main` in, and keep both sides
  of any conflict in those lines.

## Goal

1. One module for the curves JS reads: `src/lib/motion/curves.js`. `cubicBezier`
   moves there from `src/lib/scorecard/glide.js`, and glide re-exports it.
2. One shared rise for the player page: `src/styles/motion/player-rise.css`, the
   canvas `.rise` (opacity 0 and 6px down, to rest, over 420ms on the stamp curve).

## Done means

- `src/lib/motion/curves.js` exports `cubicBezier`, `EASE_STAMP`, `EASE_UNFOLD`,
  `easeStamp`, `easeUnfold`, `easeOutQuart`.
- `src/lib/scorecard/glide.js` has no local `cubicBezier`; it imports it and
  re-exports it. `test/scorecard-lens-glide.test.js` passes unchanged.
- `src/styles/motion/player-rise.css` defines `@keyframes player-rise-in`,
  `.player-rise`, `.player-rise--wait`, and a reduced-motion block.
- `src/index.css` imports it directly after `motion/stamp-in.css`.
- `test/motion-curves.test.js` passes, and it failed before the change.

## Files

1. `src/lib/motion/curves.js` (new; new folder `src/lib/motion/`).
2. `src/lib/scorecard/glide.js`: remove `cubicBezier`, import and re-export it.
3. `src/styles/motion/player-rise.css` (new). `src/styles/motion/` goes from 7 to 8
   files (cap 12).
4. `src/index.css`: one `@import` line.
5. `test/motion-curves.test.js` (new).

## Canvas

- B-phone / B-wide: `.rise{opacity:0;animation-fill-mode:forwards;animation-duration:420ms;animation-timing-function:cubic-bezier(.2,.9,.3,1);animation-delay:var(--d,0ms)}`
  and `@keyframes rise-a{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`.
- MoundCard: `.rise{animation:rise 420ms cubic-bezier(.2,.9,.3,1) var(--d,0ms) backwards}`.
- Reduced motion (B-phone): `.rise,.stamp{animation:none!important;opacity:1}`.
- ArsenalReveal: `const eo = (x) => 1 - Math.pow(1 - clamp(x), 4);` with
  `const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));`.
  PitchFlight: `easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 4);` (the same curve).
- Stagger: Splits rows and Mound bars step 55ms (`--stagger-step`, slice 01a).

House changes to the canvas: 6px is `var(--space-1h)` (6px). The delay is
`calc(var(--stagger-step) * var(--rise-i, 0))`, not a free `--d`, so a row's delay is
always a whole number of steps and never a raw time. The fill is `backwards`, as
`motion/stamp-in.css` and MoundCard use.

## Live today

`src/lib/scorecard/glide.js:11-34`:

```js
// The --ease-out token's control points (tokens/effects.css). A test pins the
// two together, so a change to the token cannot leave the glide behind.
export const EASE_OUT = [0.16, 1, 0.3, 1]

// A CSS cubic-bezier as a function of progress: find the curve's parameter
// for x by bisection (the curve is monotonic in x), then return its y.
// Twenty halvings put x within 1e-6, finer than a pixel on any scroll.
function cubicBezier(x1, y1, x2, y2) {
  const at = (p1, p2, s) => 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s ** 2 * (1 - s) + s ** 3
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < x) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

export const easeOut = cubicBezier(...EASE_OUT)
```

Readers of glide.js: `src/components/scoring/lens/useLens.js:3` (`durationMs`,
`glideAt`), `src/lib/ovr/card.js:5` (`easeOut`), and
`test/scorecard-lens-glide.test.js:5` (`EASE_OUT`, `durationMs`, `easeOut`, `glideAt`).
None reads `cubicBezier` (it is not exported today).

`src/index.css:219-225`, the motion block (its header comment is at lines 204-218):

```css
@import './styles/motion/slate.css';
@import './styles/motion/lineup.css';
@import './styles/motion/strike.css';
@import './styles/motion/playbyplay.css';
@import './styles/motion/innings.css';
@import './styles/motion/scorecard-lens.css';
@import './styles/motion/stamp-in.css';
```

`src/styles/motion/stamp-in.css:16-32` is the pattern to copy (keyframe with only
`from`, the class, the reduced-motion block).

## Build

### 1. `src/lib/motion/curves.js` (new)

```js
// The motion curves that JS reads (#2073). Each array is the control points of a
// token in src/tokens/effects.css, and test/motion-curves.test.js pins each pair
// together, so a change to a token cannot leave a tween behind. CSS reads the
// tokens. A requestAnimationFrame tween reads these.

// A CSS cubic-bezier as a function of progress: find the curve's parameter
// for x by bisection (the curve is monotonic in x), then return its y.
// Twenty halvings put x within 1e-6, finer than a pixel on any scroll.
// Moved here from lib/scorecard/glide.js, which re-exports it.
export function cubicBezier(x1, y1, x2, y2) {
  const at = (p1, p2, s) => 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s ** 2 * (1 - s) + s ** 3
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < x) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

// --ease-stamp: a fast drop that settles with no overshoot. The stamp-in, the
// press, and new motion on the player page.
export const EASE_STAMP = [0.2, 0.9, 0.3, 1]
// --ease-unfold: softer at the end. A menu that folds to a rail, a panel that opens.
export const EASE_UNFOLD = [0.23, 1, 0.32, 1]

export const easeStamp = cubicBezier(...EASE_STAMP)
export const easeUnfold = cubicBezier(...EASE_UNFOLD)

// The canvas's `eo` (ArsenalReveal) and `easeOut` (PitchFlight): a quartic
// ease-out, clamped to [0, 1]. It has no token, because no CSS reads it.
export const easeOutQuart = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 4
```

### 2. `src/lib/scorecard/glide.js`

Delete lines 15-32 (the comment and the local `cubicBezier`). Put this after the
header comment (line 9), before `EASE_OUT`:

```js
import { cubicBezier } from '../motion/curves.js'

// cubicBezier lives in lib/motion/curves.js now (#2073). Re-exported so this
// module's own readers keep one import.
export { cubicBezier }
```

Keep `EASE_OUT`, `easeOut`, `durationMs` and `glideAt` exactly as they are.

### 3. `src/styles/motion/player-rise.css` (new)

```css
/* ---------------------------------------------------------------------------
   THE PLAYER RISE (#2073). A card, a row or a block on /player/{id} comes up
   from --space-1h below its place as it fades in, over --dur-rise on the stamp
   curve. The canvas draws it as `.rise` (boards B-phone and MoundCard).

   WHEN IT PLAYS. Only the first time the block comes into view in this page
   visit. useInViewOnce (hooks/scroll/useInViewOnce.js) decides, and the caller
   writes the class for the phase it returns:
     wait  .player-rise--wait. Not seen yet: held at opacity 0, so the block
           does not show at rest and then jump back to 0 when its rise starts.
     play  .player-rise. The rise runs one time.
     rest  no class. Already seen, reduced motion, or no IntersectionObserver.
   A row in a cascade sets --rise-i (0, 1, 2, ...) and waits that many
   --stagger-step.

   Motion only. The block's resting look stays in its own sheet. Shared by
   the player modules and the Animation Lab, so src/index.css imports it.
   --------------------------------------------------------------------------- */

@keyframes player-rise-in {
  from {
    opacity: 0;
    transform: translateY(var(--space-1h));
  }
}

.player-rise--wait {
  opacity: 0;
}

.player-rise {
  animation: player-rise-in var(--dur-rise) var(--ease-stamp) calc(var(--stagger-step) * var(--rise-i, 0)) backwards;
}

:root[data-motion='reduced'] .player-rise--wait {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .player-rise--wait {
    opacity: 1;
  }
  .player-rise {
    animation: none;
  }
}
```

Notes for the guards:
- `check-raw-values.mjs` counts a raw time, hex, radius or shadow. This sheet has
  none: every time is a token, and `calc()` multiplies a token by a number.
- `check-typography.mjs`, `check-focus-ring.mjs`, `check-component-reuse.mjs` and
  `scripts/layout/check-layout-ratchet.mjs` find nothing here (no type, no ring, no
  shape, no flex or grid).
- The `:root[data-motion='reduced']` rule is there because
  `src/styles/01-base.css:188-195` shortens durations but not delays, and does not
  touch opacity. The hook returns `rest` in that case, so it is a second guard only.

### 4. `src/index.css`

After line 225 (`@import './styles/motion/stamp-in.css';`) add:

```css
@import './styles/motion/player-rise.css';
```

Why here and not as a per-route import: the header of `src/index.css` (lines 8-23)
says a partial that only one lazy screen uses goes in that screen. This sheet has
two screens (the player page and `/animation-lab`, slice 01d), and the shared
`MenuRail` and Slot slices read it too. "Anything two SCREENS share stays here."
It is motion, so it goes in the motion block, which must stay before `focus/`
(lines 215-218).

## Test first

Write `test/motion-curves.test.js`. Run it and see it fail (the import of
`curves.js` fails, and the sheet does not exist). Then build.

```js
// The player motion's JS curves and its shared rise (#2073, slice 01b).
// A tween in JS and a transition in CSS must run on one curve, so each array in
// lib/motion/curves.js is pinned to its token, the way
// test/scorecard-lens-glide.test.js pins EASE_OUT.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  EASE_STAMP,
  EASE_UNFOLD,
  cubicBezier,
  easeOutQuart,
  easeStamp,
  easeUnfold,
} from '../src/lib/motion/curves.js'
import * as glide from '../src/lib/scorecard/glide.js'
import { ruleBody, stripComments } from './helpers/css.js'

const read = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8')
const effects = stripComments(read('tokens/effects.css'))
const points = (name) =>
  effects.match(new RegExp(`--${name}:\\s*cubic-bezier\\(([^)]*)\\)`))?.[1].split(',').map(Number)
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim().replace(/\s+/g, ' '))
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

test('EASE_STAMP and EASE_UNFOLD are the --ease-stamp and --ease-unfold tokens', () => {
  assert.deepEqual(points('ease-stamp'), EASE_STAMP)
  assert.deepEqual(points('ease-unfold'), EASE_UNFOLD)
})

test('cubicBezier moved: glide.js re-exports the one in lib/motion/curves.js', () => {
  assert.equal(glide.cubicBezier, cubicBezier)
  // The glide's own curve still reads --ease-out through it.
  assert.equal(glide.easeOut(0.5), cubicBezier(...glide.EASE_OUT)(0.5))
})

test('easeStamp and easeUnfold run from 0 to 1, never fall and never overshoot', () => {
  for (const ease of [easeStamp, easeUnfold]) {
    assert.equal(ease(0), 0)
    assert.equal(ease(1), 1)
    let was = 0
    for (let i = 1; i <= 100; i += 1) {
      const y = ease(i / 100)
      assert.ok(y >= was && y <= 1, `at ${i / 100}`)
      was = y
    }
  }
})

test('easeStamp is front-loaded: most of the move is done by the middle', () => {
  assert.ok(easeStamp(0.5) > 0.85, `easeStamp(0.5) = ${easeStamp(0.5)}`)
})

test('easeOutQuart is the canvas eo: 1 - (1 - t)^4, clamped', () => {
  assert.equal(easeOutQuart(0), 0)
  assert.equal(easeOutQuart(1), 1)
  assert.equal(easeOutQuart(0.5), 0.9375)
  assert.equal(easeOutQuart(-1), 0)
  assert.equal(easeOutQuart(2), 1)
})

test('the player rise: 6px up and in, over --dur-rise on the stamp curve, one step per row', () => {
  const css = stripComments(read('styles/motion/player-rise.css'))
  assert.match(css, /@keyframes player-rise-in\s*\{\s*from\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*translateY\(var\(--space-1h\)\);/)
  assert.equal(
    decl(ruleBody(css, '.player-rise'), 'animation'),
    'player-rise-in var(--dur-rise) var(--ease-stamp) calc(var(--stagger-step) * var(--rise-i, 0)) backwards',
  )
  assert.equal(decl(ruleBody(css, '.player-rise--wait'), 'opacity'), '0')
})

test('the player rise is off under reduced motion, and a waiting block shows', () => {
  const css = stripComments(read('styles/motion/player-rise.css')).replace(/\s+/g, ' ')
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduced, /\.player-rise--wait \{ opacity: 1; \}/)
  assert.match(reduced, /\.player-rise \{ animation: none; \}/)
})

test('src/index.css imports the rise right after the stamp-in, before focus/', () => {
  const lines = read('index.css').split('\n')
  const at = (p) => lines.findIndex((l) => l.includes(p))
  assert.equal(at("motion/player-rise.css'"), at("motion/stamp-in.css'") + 1)
  assert.ok(at("motion/player-rise.css'") < at("focus/stage.css'"))
})
```

Values I measured with the moved `cubicBezier` on this checkout:
`easeStamp(0.5)` = 0.9499, `easeOutQuart(0.5)` = 0.9375 (exact in floating point).
I also ran the sheet in Build step 3 through `ruleBody` and the regexes above: every
assertion matches it.

## Verify

1. `node --test test/motion-curves.test.js`
2. `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
   CI also runs `test/scorecard-lens-glide.test.js`; if it fails there, see "Stop if".
3. No screen uses `.player-rise` yet, so nothing on `/player/...` changes. Render
   `/player/brice-turang-668930?nointro` at 390px and confirm that it looks the same
   as on `main` (the import adds no rule that matches today). The Animation Lab entry
   that shows the rise is slice 01d.

## Out of scope

- The Animation Lab entry (slice 01d).
- `useInViewOnce` (slice 01c). No JSX reads `.player-rise` in this slice.
- A replay variant (`-a`/`-b` keyframes). `MenuRail` (slice 05) has its own pair.

## Stop if

- `src/lib/scorecard/glide.js:15-32` or `src/index.css:219-225` differ from the quotes.
  One known change is fine: if 05b merged first, `motion/menurail.css` follows
  `motion/stamp-in.css`. Then put `player-rise.css` directly after `stamp-in.css`, before
  `menurail.css` (the test asks for "directly after the stamp-in").
- `src/lib/motion/` already exists with other files (then add to it, and report).
- `src/styles/motion/` has 12 files already (`ls src/styles/motion | wc -l`).
- `test/scorecard-lens-glide.test.js` fails after the move (do not change that test).
