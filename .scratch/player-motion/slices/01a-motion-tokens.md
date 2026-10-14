# Slice 01a: motion tokens and row surfaces

Part 1 of 4 of slice 01. spec.md planned one slice, but its work needs 13 files, so
it is split: **01a** tokens (this file), **01b** curves and the rise sheet, **01c**
`useInViewOnce`, **01d** the Animation Lab room and the rise entry. A later slice that
says "01 merged" needs the parts that it reads (see each part's Goal).

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: none.
- Parallel with: 01c (no shared file). 01b, 01d and 02a wait for this slice.

## Goal

Add the player-page motion tokens and the two row surfaces, so that every later
slice reads a token and never a raw time, curve or hex. The stamp-in moves to the
canvas values (380ms on the stamp curve).

## Done means

- `src/tokens/effects.css` defines `--ease-stamp`, `--ease-unfold`, `--dur-rise`,
  `--dur-unfold`, `--dur-grow`, `--dur-draw`, `--stagger-step` with the values below.
- `--dur-stamp-in` is `380ms` and `--ease-stamp-in` is `var(--ease-stamp)`.
- `--ease-out` and `--dur-slow` do not change.
- `src/tokens/colors.css` has two new primitives (`--paper-4`, `--paper-5`) and two
  aliases (`--surface-row-hover`, `--surface-row-selected`).
- `src/lib/design/contrastPairings.js` asserts the text that sits on the two row
  surfaces. `npm run lint` (check-contrast) passes.
- `test/player-motion-tokens.test.js` passes, and it failed before the change.

## Files

1. `src/tokens/effects.css`: the new motion tokens; the stamp-in values and comment.
2. `src/tokens/colors.css`: two paper primitives and two surface aliases.
3. `src/lib/design/contrastPairings.js`: ten new pairings for the row surfaces.
4. `test/player-motion-tokens.test.js` (new): the token and pairing tests.

## Canvas

| Value | Canvas source (excerpt) |
|---|---|
| `cubic-bezier(.2,.9,.3,1)` | B-phone `.stamp{animation-duration:380ms;animation-timing-function:cubic-bezier(.2,.9,.3,1)...}`, `.ptab{...transition:transform 120ms cubic-bezier(.2,.9,.3,1)}` |
| `cubic-bezier(.23,1,.32,1)` | Splits `.part.in{animation:rise .8s cubic-bezier(.23,1,.32,1) both}` |
| 380ms | B-phone `.stamp{animation-duration:380ms...}` |
| 420ms | B-phone `.rise{...animation-duration:420ms...}`; MoundCard `.rise{animation:rise 420ms cubic-bezier(.2,.9,.3,1) var(--d,0ms) backwards}` |
| `#F3EBD2` | GameLog / BatterGameLog `.gl-row:hover{background:#F3EBD2}`, Firsts `.fr-row:hover`, SimilarPlayers `button.ll-row:hover` |
| `#EFE6C8` | GameLog / BatterGameLog: `bg: sel === x.i ? '#EFE6C8' : 'transparent'`; Firsts: `bg: debut ? INK : on ? '#EFE6C8' : 'transparent'` |

The other durations (`--dur-unfold` 400ms, `--dur-grow` 750ms, `--dur-draw` 900ms,
`--stagger-step` 55ms) come from spec.md's token table. Use them as written.

## Live today

`src/tokens/effects.css:55-68`:

```css
  /* Motion */
  --ease-standard: cubic-bezier(0.2, 0.0, 0.0, 1.0);
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast:   120ms;
  --dur-med:    220ms;
  --dur-slow:   360ms;

  /* The stamp-in (#1882, motion/stamp-in.css): a stamped card drops
     --stamped-offset into its own shadow as it appears. The canvas drew it at
     380ms on cubic-bezier(.2,.9,.3,1). That is under the eye's floor from
     --dur-slow and --ease-out, so the motion reads those two. It is not the
     Stamp In page (ADR-0042). */
  --dur-stamp-in:  var(--dur-slow);
  --ease-stamp-in: var(--ease-out);
```

`--dur-stamp-in` and `--ease-stamp-in` have one reader:
`src/styles/motion/stamp-in.css:25`
(`animation: card-stamp-in var(--dur-stamp-in) var(--ease-stamp-in) var(--stamp-delay, 0s) backwards;`).
No test pins their old values.

`src/tokens/colors.css:22-24` (the paper primitives):

```css
  --paper-2:  #FBF6E9;   /* raised card / cell fill */
  --paper-3:  #FFFDF6;   /* brightest inset (revealed value) */
  --paper-cream: #F1E7CC; /* cream knockout on ink: the player-page draft hex (#1984) */
```

`src/tokens/colors.css:139-140` (the surface aliases):

```css
  --surface-card:     var(--paper-2);
  --surface-inset:    var(--paper-3);
```

`src/lib/design/contrastPairings.js:345-346`, the end of `PAIRINGS`:

```js
  { fg: 'border-stamped-soft', bg: 'bg-canvas', min: UI, note: 'soft stamped shadow under the ink tile' },
]
```

## Build

### 1. `src/tokens/effects.css`

Replace lines 55-68 with this. Keep `--dur-snappy` and every line after it as is.

```css
  /* Motion */
  --ease-standard: cubic-bezier(0.2, 0.0, 0.0, 1.0);
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast:   120ms;
  --dur-med:    220ms;
  --dur-slow:   360ms;

  /* THE PLAYER PAGE'S TWO CURVES (#2073, from the design canvas). The stamp
     curve drops fast and settles with no overshoot: the stamp-in, the press
     of every Button and Pill, and new motion on the player page. The unfold
     curve is softer at the end: a menu that folds to a rail, a panel that
     opens. --ease-out stays for the rest of the app. JS reads both curves
     through src/lib/motion/curves.js, and a test pins the two copies
     together. */
  --ease-stamp:  cubic-bezier(0.2, 0.9, 0.3, 1);
  --ease-unfold: cubic-bezier(0.23, 1, 0.32, 1);

  /* The player page's durations (#2073), from the canvas. A rise is a card or
     a row that comes up as it fades in (motion/player-rise.css). An unfold is
     a menu, a rail or a panel that opens. A grow is a bar that fills to its
     value. A draw is a line or a track that inks itself. In a cascade, row n
     waits n x --stagger-step. A value that one slice needs one time stays in
     that slice, as calc(var(--dur-...) * n), never as a raw time. */
  --dur-rise:     420ms;
  --dur-unfold:   400ms;
  --dur-grow:     750ms;
  --dur-draw:     900ms;
  --stagger-step: 55ms;

  /* The stamp-in (#1882, motion/stamp-in.css): a stamped card drops
     --stamped-offset into its own shadow as it appears. Since #2073 it reads
     the canvas values: 380ms on the stamp curve. It is not the Stamp In page
     (ADR-0042). */
  --dur-stamp-in:  380ms;
  --ease-stamp-in: var(--ease-stamp);
```

### 2. `src/tokens/colors.css`

After line 24 (`--paper-cream`), add:

```css
  /* Two papers a step and two steps darker than the canvas (#2073): a table
     row under the pointer, and a picked row. Numbered, so the ADR-0107 guard
     in check-typography.mjs (`--paper-\d+`) stops a partial that reads them
     by name. Read --surface-row-hover and --surface-row-selected. */
  --paper-4:  #F3EBD2;   /* row under the pointer */
  --paper-5:  #EFE6C8;   /* picked row */
```

After line 140 (`--surface-inset`), add:

```css
  /* A table row under the pointer, and a picked row (#2073): the game logs,
     Firsts and Similar Players. The row is shaded, not lifted, so both are
     darker than the card. The text pairs are in
     src/lib/design/contrastPairings.js. A loss on a picked row reads
     --clay-deep: --accent-negative there is
     4.37:1 (--accent-negative on --surface-row-selected), under AA. */
  --surface-row-hover:    var(--paper-4);
  --surface-row-selected: var(--paper-5);
```

Why numbered names: ADR-0023 keeps raw hex in the primitive tier and `var()` in the
alias tier. ADR-0107's guard (`scripts/check-typography.mjs:236`) matches
`/^--(?:paper-\d+|rule(?:-soft|-grid)?)$/`. A name like `--paper-shade` would escape
it. `--paper-4` and `--paper-5` are inside it with no guard change.

### 3. `src/lib/design/contrastPairings.js`

Before the closing `]` on line 346, add:

```js
  // THE ROW SURFACES (#2073): a table row under the pointer, and a picked row
  // (game logs, Firsts, Similar Players). The row's own text sits on them.
  // --accent-negative on a picked row is not paired: it is
  // 4.37:1 (--accent-negative on --surface-row-selected), under AA. A loss on a
  // picked row reads --clay-deep: 6.33:1 (--clay-deep on --surface-row-selected).
  { fg: 'text-heading', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: heading ink' },
  { fg: 'text-body', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: body text' },
  { fg: 'text-caption', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: caption' },
  { fg: 'accent-positive', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: a win' },
  { fg: 'accent-negative', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: a loss' },
  { fg: 'text-heading', bg: 'surface-row-selected', min: TEXT, note: 'picked row: heading ink' },
  { fg: 'text-body', bg: 'surface-row-selected', min: TEXT, note: 'picked row: body text' },
  { fg: 'text-caption', bg: 'surface-row-selected', min: TEXT, note: 'picked row: caption' },
  { fg: 'accent-positive', bg: 'surface-row-selected', min: TEXT, note: 'picked row: a win' },
  { fg: 'clay-deep', bg: 'surface-row-selected', min: TEXT, note: 'picked row: a loss' },
```

Ratios I measured with `ratio()` from this module (all above 4.5): on `#F3EBD2`:
heading 15.01, body 12.25, caption 4.86, positive 5.09, negative 4.57. On `#EFE6C8`:
heading 14.33, body 11.69, caption 4.64, positive 4.86, clay-deep 6.33. The one
miss: `--accent-negative` on `#EFE6C8` is 4.37.

**Guard pitfall (check-contrast, part B).** A ratio written in a comment under
`src/tokens/` must name its pair as `N:1 (--fg on --bg)`, or lint fails ("a measured
ratio with no pair named"). Comments in `src/lib/design/*.js` and `src/styles/` are
checked the same way when they use that form. The comments above use the form, and
the guard then checks the number. Keep it if you reword them.

`/design-lab`'s tokens page (`src/screens/designlab/tokens.jsx`) lists every
`paper-*` and `surface-*` token and every pairing by itself. It needs no edit.

## Test first

Write `test/player-motion-tokens.test.js`. Run `node --test test/player-motion-tokens.test.js`
and see every test fail. Then do the Build steps.

```js
// The player-page motion tokens and the two row surfaces (#2073, slice 01a).
// Every later slice of the player motion work reads these names, so a wrong
// value here is wrong on every card. Asserted from the token sheets, the way
// test/alias-tokens.test.js reads colors.css.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PAIRINGS, TEXT, ratio } from '../src/lib/design/contrastPairings.js'
import { stripComments } from './helpers/css.js'

const sheet = (name) =>
  stripComments(readFileSync(fileURLToPath(new URL(`../src/tokens/${name}`, import.meta.url)), 'utf8'))
const effects = sheet('effects.css')
const colors = sheet('colors.css')
const decl = (css, name) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
const hex = (name) => {
  const v = decl(colors, name)
  const ref = v?.match(/^var\(--([\w-]+)\)$/)
  return ref ? hex(ref[1]) : v
}

test('the two curves are the canvas curves, and --ease-out stays', () => {
  assert.equal(decl(effects, 'ease-stamp'), 'cubic-bezier(0.2, 0.9, 0.3, 1)')
  assert.equal(decl(effects, 'ease-unfold'), 'cubic-bezier(0.23, 1, 0.32, 1)')
  assert.equal(decl(effects, 'ease-out'), 'cubic-bezier(0.16, 1, 0.3, 1)')
})

test('the player-page durations and the stagger step', () => {
  assert.equal(decl(effects, 'dur-rise'), '420ms')
  assert.equal(decl(effects, 'dur-unfold'), '400ms')
  assert.equal(decl(effects, 'dur-grow'), '750ms')
  assert.equal(decl(effects, 'dur-draw'), '900ms')
  assert.equal(decl(effects, 'stagger-step'), '55ms')
})

test('the stamp-in reads the canvas: 380ms on the stamp curve', () => {
  assert.equal(decl(effects, 'dur-stamp-in'), '380ms')
  assert.equal(decl(effects, 'ease-stamp-in'), 'var(--ease-stamp)')
  assert.equal(decl(effects, 'dur-slow'), '360ms', '--dur-slow stays for the rest of the app')
})

test('the row surfaces alias two numbered paper primitives', () => {
  assert.equal(decl(colors, 'surface-row-hover'), 'var(--paper-4)')
  assert.equal(decl(colors, 'surface-row-selected'), 'var(--paper-5)')
  assert.equal(hex('surface-row-hover'), '#F3EBD2')
  assert.equal(hex('surface-row-selected'), '#EFE6C8')
})

test('the text on each row surface is paired, and clears AA', () => {
  for (const bg of ['surface-row-hover', 'surface-row-selected']) {
    const fgs = PAIRINGS.filter((p) => p.bg === bg).map((p) => p.fg)
    for (const fg of ['text-heading', 'text-body', 'text-caption', 'accent-positive']) {
      assert.ok(fgs.includes(fg), `${fg} on ${bg} is paired`)
    }
    for (const p of PAIRINGS.filter((q) => q.bg === bg)) {
      assert.ok(p.min >= TEXT, `${p.fg} on ${bg} asserts text contrast`)
      assert.ok(ratio(hex(p.fg), hex(bg)) >= p.min, `${p.fg} on ${bg}`)
    }
  }
})

test('a loss on a picked row is clay-deep: --accent-negative is under AA there', () => {
  assert.ok(ratio(hex('accent-negative'), hex('surface-row-selected')) < TEXT)
  assert.ok(!PAIRINGS.some((p) => p.fg === 'accent-negative' && p.bg === 'surface-row-selected'))
  assert.ok(PAIRINGS.some((p) => p.fg === 'clay-deep' && p.bg === 'surface-row-selected'))
})
```

Note: `hex()` follows `var()` chains in colors.css only. `--accent-positive` →
`--field` and `--accent-negative` → `--clay` and `--clay-deep` all resolve inside
colors.css, so this works.

## Verify

1. `node --test test/player-motion-tokens.test.js`
2. `npm run lint`. Read the check-contrast output: the ten new rows show a tick.
3. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
4. Render `/design-lab?nointro` in the preinstalled Chromium at 390px. Find the
   tokens page: `--paper-4`, `--paper-5`, `--surface-row-hover` and
   `--surface-row-selected` show as swatches, and the new pairings show in the
   contrast list. Screenshot it.
5. Render `/player/robert-gasser-688107?nointro` at 390px. The stamped cards stamp
   in a little slower and with a snappier settle (380ms, not 360ms). No other
   change. Send Gary both screenshots with `SendUserFile` and name the routes.

## Out of scope

- No rule in `src/styles/` reads a new token yet. Slices 01b, 02a and later do that.
- The Animation Lab note that says the stamp-in takes 360ms
  (`src/screens/AnimationLab.jsx:474` and `:479-481`). Slice 01d fixes it.
- `src/lib/motion/curves.js` (slice 01b).

## Stop if

- `src/tokens/effects.css:55-68` or `src/tokens/colors.css:22-24` / `:139-140` differ
  from the quotes above.
- A name you add already exists (`grep -rn -- "--paper-4\|--ease-stamp:\|--dur-rise" src`).
- check-contrast fails on a new pairing (the ratios above say it must not; if it
  does, a hex is wrong).
- Any existing test pins `--dur-stamp-in: var(--dur-slow)` or
  `--ease-stamp-in: var(--ease-out)`. (None did on this checkout.)
