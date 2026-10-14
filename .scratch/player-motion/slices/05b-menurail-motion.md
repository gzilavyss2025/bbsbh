# Slice 05b: `MenuRail` motion (the unfold, the fold, the rise on each pick)

Second of three (05a the part, 05b the motion, 05c the lab entries). Read 05a's "Canvas"
table first if you need the four boards side by side; the values this slice uses are
copied again below.

## Run

- Model: `claude-sonnet-5-5`. Effort: medium (the code is below; the slice is three files).
- Depends on: 01 merged (the tokens), 05a merged.
- Parallel with: 02, 03, 04, 06, 07, 08, 10, 13, 20. Slices 09, 11, 16, 17 and 05c wait
  for this one.

## Goal

Give `MenuRail` its motion, as the canvas does it: the cards glide between the menu and the
rail, the figures fold, the panel folds open and shut, and the panel body rises on every
new pick. Under reduced motion every state switches at once.

## Done means

- `src/styles/motion/menurail.css` holds every transition and the two rise keyframes,
  token-only.
- `src/index.css` imports it after `motion/stamp-in.css`, before `focus/`.
- `test/menurail-motion.test.js` passes, and it failed before.
- `npm run lint`, `npm test`, `npm run build` pass.

## Files (3)

| File | Change |
|---|---|
| `src/styles/motion/menurail.css` | **new** (the folder holds 7 files today; 8 after this) |
| `src/index.css` | one `@import` line |
| `test/menurail-motion.test.js` | **new** |

Why a separate sheet: `docs/motion.md`, "The seam": `src/styles/motion/` holds motion and
nothing else, the resting look stays in the part's own sheet. `spec.md`, "Rules every slice
follows": motion of a shared part lives in `src/styles/motion/`. The pair
`system/card.css` + `motion/stamp-in.css` is the model.

## Canvas

ArsenalReveal (the timing MenuRail follows; `spec.md` maps `.4s` and
`cubic-bezier(.23,1,.32,1)` to `--dur-unfold` and `--ease-unfold`):

```css
.ar-mc{…transition:flex-basis .4s cubic-bezier(.23,1,.32,1),padding .4s cubic-bezier(.23,1,.32,1),background .2s,box-shadow .12s}
.ar-mx,.ar-pn{display:grid;grid-template-rows:1fr;transition:grid-template-rows .4s cubic-bezier(.23,1,.32,1)}
.ar-pn>div{visibility:hidden;transition:visibility 0s .4s}
.ar-pn.ar-on>div{visibility:visible;transition-delay:0s}
@media (prefers-reduced-motion:reduce){.ar-ff1,.ar-ff2{animation:none!important}.ar-mc,.ar-mx,.ar-pn{transition:none!important}}
```

PlateApproach (the rise MenuRail follows; `spec.md` maps it to `--dur-stamp-in`, 380ms after
slice 01, and `--ease-stamp`):

```css
.tp-ff1,.tp-ff2{animation:tp-fa 380ms cubic-bezier(.2,.9,.3,1) backwards}
.tp-ff2{animation-name:tp-fb}
@keyframes tp-fa{from{opacity:0;transform:translateY(8px)}}
@keyframes tp-fb{from{opacity:0;transform:translateY(8px)}}
```

Arsenal's own rise is `.38s` on `(.23,1,.32,1)`; Contact's equals Plate's. The two
keyframes have the same steps on purpose: the panel body swaps class on every pick
(`fgen % 2`), the animation name changes, and the browser restarts it without a remount.

Contact's group head: `.tc-mh{…transition:max-height 340ms cubic-bezier(.2,.9,.3,1),opacity 240ms}`.

Mapping of the small values: background `.2s` → `--dur-med` (220ms) on `--ease-standard`
(the `.btn` curve); box-shadow `.12s` → `--dur-fast` on `--ease-stamp` (the slice-02 press
uses the same pair); the head's opacity `240ms` → `--dur-med`; `8px` → `var(--space-2)`.

## Live today

- `src/index.css:219-225`: the motion imports, in order, ending with
  `@import './styles/motion/stamp-in.css';`. The comment above them (l.214-218) says the
  motion package sits after the numbered partials and BEFORE `focus/`.
- `src/styles/motion/stamp-in.css`: the model for a part's motion sheet (a header comment,
  the keyframe, the rule, a `@media (prefers-reduced-motion: reduce)` block).
- `src/styles/system/button.css:130-133`: `.btn { transition: transform …, background-color
  …, border-color … }`, and its reduced block `.btn { transition: none; }` (l.284-288).
  Specificity 0,1,0. The card rule below is `.menurail__card.btn` (0,2,0), so it REPLACES
  `.btn`'s transition list; that is why it restates `transform` and `border-color`, and why
  it needs its own reduced-motion rule.
- After 05a: `src/styles/system/menurail/menurail.css` has the state rules this sheet moves
  between (`.menurail--rail .menurail__card.btn`, `.menurail--rail .menurail__fold`,
  `.menurail__panel--open`, `.menurail__panelin`, `.menurail--rail .menurail__head`), and
  `MenuRail.jsx` writes `menurail__body menurail__body--a|b` on the panel body.
- `src/styles/01-base.css:188-195`: `:root[data-motion='reduced'] *` sets every
  `transition-duration` and `animation-duration` to `0.01ms !important`. That covers the
  in-app setting; the OS query is this sheet's own block.

## Build

### 1. `src/styles/motion/menurail.css`

```css
/* ---------------------------------------------------------------------------
   THE MENU RAIL'S MOTION (#2073, slice 05; components/ui/control/MenuRail.jsx).
   The resting look and the two states are system/menurail/menurail.css. This
   file holds only how they change:

     the cards     flex-basis and padding glide between the menu and the rail,
                   --dur-unfold on --ease-unfold (canvas ArsenalReveal .ar-mc)
     the figures   the one-row grid folds 1fr -> 0fr on the same pair (.ar-mx)
     the panel     folds 0fr <-> 1fr on the same pair; its inside hides only
                   AFTER the fold ends, so the content stays while it shuts (.ar-pn)
     the rise      every new pick swaps the body between --a and --b. The two
                   keyframes have the same steps, so the name change restarts the
                   rise without a remount (canvas tp-fa / tp-fb)

   A pick is a change the reader caused, so the rise plays on every pick
   (docs/motion.md, "The one-shot gate"). Reduced motion: no glide, no rise.

   .menurail__card.btn outranks .btn (0,2,0 against 0,1,0), so the list below
   REPLACES .btn's transition: it restates the press and the edge.
   --------------------------------------------------------------------------- */

.menurail__card.btn {
  transition:
    flex-basis var(--dur-unfold) var(--ease-unfold),
    padding var(--dur-unfold) var(--ease-unfold),
    background-color var(--dur-med) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-stamp),
    transform var(--dur-fast) var(--ease-stamp);
}

.menurail__fold {
  transition: grid-template-rows var(--dur-unfold) var(--ease-unfold);
}

.menurail__head {
  transition:
    max-height var(--dur-unfold) var(--ease-unfold),
    opacity var(--dur-med) var(--ease-standard);
}

.menurail__panel {
  transition: grid-template-rows var(--dur-unfold) var(--ease-unfold);
}
/* Shutting: stay visible until the fold ends, then hide (and the panel is
   already inert, so nothing in it takes focus meanwhile). Opening: show at once. */
.menurail__panelin {
  transition: visibility 0s var(--dur-unfold);
}
.menurail__panel--open .menurail__panelin {
  transition-delay: 0s;
}

@keyframes menurail-rise-a {
  from {
    opacity: 0;
    transform: translateY(var(--space-2));
  }
}
@keyframes menurail-rise-b {
  from {
    opacity: 0;
    transform: translateY(var(--space-2));
  }
}
.menurail__body--a {
  animation: menurail-rise-a var(--dur-stamp-in) var(--ease-stamp) backwards;
}
.menurail__body--b {
  animation: menurail-rise-b var(--dur-stamp-in) var(--ease-stamp) backwards;
}

@media (prefers-reduced-motion: reduce) {
  .menurail__card.btn {
    transition: none;
  }
  .menurail__fold {
    transition: none;
  }
  .menurail__head {
    transition: none;
  }
  .menurail__panel {
    transition: none;
  }
  .menurail__panelin {
    transition: none;
  }
  .menurail__body--a {
    animation: none;
  }
  .menurail__body--b {
    animation: none;
  }
}
```

Guard notes:
- `check-raw-values.mjs` counts a `transition`/`animation` with a non-zero raw time. Every
  time here is a `var()` or `0s` (a zero is not counted). The motion budget stays 55.
- `--dur-unfold`, `--ease-unfold`, `--ease-stamp`, `--dur-stamp-in` come from slice 01.
  `test/css-tokens.test.js` fails a `var(--x)` no sheet defines, so 01 must be merged.
- One rule per selector (no selector lists) on purpose: `ruleBody` in the test finds the
  rule by its exact selector.
- Keyframe names start with the block name (`spec.md`: `menurail-rise-a`, never `rise`).

### 2. `src/index.css`

After `@import './styles/motion/stamp-in.css';` (l.225 today):

```css
@import './styles/motion/menurail.css';
```

If other slices added motion sheets after `stamp-in.css` first, add this line after the
last `motion/` import and before the first `focus/` import.

## Test first

`test/menurail-motion.test.js`. Run `node --test test/menurail-motion.test.js`, see it fail
(the sheet does not exist), then build.

```js
// The menu rail's motion (#2073, slice 05b): the glide, the fold, the panel and the
// rise on each pick, on the unfold and stamp tokens, and none of it under reduced motion.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const all = () => stripComments(read('styles/motion/menurail.css'))
const REDUCED = '@media (prefers-reduced-motion: reduce)'
const main = () => all().split(REDUCED)[0]
const reduced = () => all().split(REDUCED)[1] ?? ''
const decl = (body, property) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${property}:`))?.slice(property.length + 1).trim()
const flat = (v) => v?.replace(/\s+/g, ' ')
// A rule inside the @media block: its selector is indented two spaces.
const indented = (css, selector) => {
  const at = css.indexOf(`  ${selector} {`)
  return at === -1 ? null : css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
}

test('the cards glide: flex-basis and padding on --dur-unfold / --ease-unfold, the press kept', () => {
  const t = flat(decl(ruleBody(main(), '.menurail__card.btn'), 'transition'))
  assert.match(t, /flex-basis var\(--dur-unfold\) var\(--ease-unfold\)/)
  assert.match(t, /padding var\(--dur-unfold\) var\(--ease-unfold\)/)
  assert.match(t, /transform var\(--dur-fast\) var\(--ease-stamp\)/)
  assert.match(t, /box-shadow var\(--dur-fast\) var\(--ease-stamp\)/)
})

test('the figures and the panel fold on grid-template-rows, the same pair', () => {
  for (const sel of ['.menurail__fold', '.menurail__panel']) {
    assert.equal(decl(ruleBody(main(), sel), 'transition'), 'grid-template-rows var(--dur-unfold) var(--ease-unfold)', sel)
  }
})

test('a shutting panel hides only after the fold; an opening one shows at once', () => {
  assert.equal(decl(ruleBody(main(), '.menurail__panelin'), 'transition'), 'visibility 0s var(--dur-unfold)')
  assert.equal(decl(ruleBody(main(), '.menurail__panel--open .menurail__panelin'), 'transition-delay'), '0s')
})

test('two keyframes with the same steps, so a new pick restarts the rise', () => {
  const c = all()
  const steps = (name) => flat(c.match(new RegExp(`@keyframes ${name}\\s*\\{\\s*from\\s*\\{([^}]*)\\}`))?.[1]).trim()
  assert.equal(steps('menurail-rise-a'), 'opacity: 0; transform: translateY(var(--space-2));')
  assert.equal(steps('menurail-rise-b'), steps('menurail-rise-a'))
  assert.equal(decl(ruleBody(main(), '.menurail__body--a'), 'animation'), 'menurail-rise-a var(--dur-stamp-in) var(--ease-stamp) backwards')
  assert.equal(decl(ruleBody(main(), '.menurail__body--b'), 'animation'), 'menurail-rise-b var(--dur-stamp-in) var(--ease-stamp) backwards')
})

test('reduced motion: no glide, no fold, no rise', () => {
  const r = reduced()
  for (const sel of ['.menurail__card.btn', '.menurail__fold', '.menurail__head', '.menurail__panel', '.menurail__panelin']) {
    assert.equal(decl(indented(r, sel), 'transition'), 'none', sel)
  }
  assert.equal(decl(indented(r, '.menurail__body--a'), 'animation'), 'none')
  assert.equal(decl(indented(r, '.menurail__body--b'), 'animation'), 'none')
})

test('index.css loads it with the motion package, before focus/', () => {
  const imports = [...read('index.css').matchAll(/@import '\.\/styles\/([^']+)'/g)].map((m) => m[1])
  const at = imports.indexOf('motion/menurail.css')
  assert.ok(at > imports.indexOf('motion/stamp-in.css'))
  const focus = imports.findIndex((p) => p.startsWith('focus/'))
  assert.ok(focus === -1 || at < focus)
})
```

Why `indented` and not `ruleBody` in the reduced test: `ruleBody` (`test/helpers/css.js`)
accepts a selector only after a newline, `;`, `}`, `{` or `,`. A rule inside the `@media`
block is indented two spaces, so `ruleBody` would never find it.

## Verify

- `npm run lint`, `npm test`, `npm run build`.
- Same local scratch mount as 05a (`/design-lab?nointro`, removed before the commit), or
  wait for 05c. At 390px and 1180px: tap a card, watch the row glide to the rail in about
  0.4s and the panel fold open; the panel body rises 8px as it fades in. Tap another rail
  card: the body rises again. Tap the picked card: the content stays while the panel folds,
  then hides. Record a short frame strip (Playwright `page.screenshot` every 80ms) and send
  it with `SendUserFile`.
- Reload with Playwright `reducedMotion: 'reduce'`: every state switches at once, no rise.

## Out of scope

- The state rules (05a), the lab entries (05c), any module.
- A press or a hover change on `.btn` (slice 02).

## Stop if

- 05a is not merged, or its class names differ from the ones above
  (`menurail__card`, `menurail__fold`, `menurail__head`, `menurail__panel`,
  `menurail__panel--open`, `menurail__panelin`, `menurail__body--a|b`).
- Slice 01's tokens are missing from `src/tokens/effects.css`.
- `check-raw-values.mjs` reports a motion count above its budget.
- The rise does not restart on a second pick in the browser (then the a/b swap is broken in
  05a; report, do not add a `key` remount).
