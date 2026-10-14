# Slice 02a: the site-wide stamp-press

Part 1 of 2 of slice 02. spec.md planned one slice, but its work touches 10 files,
so it is split: **02a** the press itself (this file), **02b** the three band focus
rules that the old press inset needed, now dead.

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 01a merged (reads `--ease-stamp`).
- Parallel with: 01b, 01c, 01d. Slice 02b waits for this slice. Slice 06 must not
  change the jump-bar `transition` line: this slice does it (spec.md "Shared files"
  lets 06 drop that line).

## Goal

Decision 1 of #2073: the canvas stamp-press replaces the 1px press on every
`Button` and `Pill` control. A press moves the control 2px down and 2px right, over
`--dur-fast` (120ms) on `--ease-stamp`. Neither control has an offset shadow, so each
gets only the move: the `--inset-cell` press shadow goes. The jump bar already moves
2px; it takes the stamp curve.

**This is a deliberate change of a pinned look.** The PR text must say so: "The
Button and Pill press changes from 1px down plus an inset shadow to the canvas
stamp-press, 2px down and right with no shadow (#2073, decision 1)." No existing
test pins `translateY(1px)` or the press inset on `.btn:active` /
`.pill--control:active` (I searched `test/`; the only press-inset pins are the three
band `:focus-visible:active` rules, which are slice 02b).

## Done means

- `.btn:active` and `.pill--control:active` are
  `transform: translate(var(--bw-heavy), var(--bw-heavy))` with no `box-shadow`.
- `.btn`, `.pill--control` and `.jumpbar__item` move `transform` over
  `var(--dur-fast) var(--ease-stamp)`. Colour transitions stay on `--ease-standard`.
- The reduced-motion blocks do not change: no transition, and the Button and Pill
  press has `transform: none`.
- The headers of button.css and pill.css describe the new press.
- The comment in `24-floating-nav-and-hud.css` that says "nudges the button 1px"
  says "moves the button 2px".
- `test/stamp-press.test.js` passes, and it failed before the change.

## Files

1. `src/styles/system/button.css` (297 lines): header, transition, `:active`.
2. `src/styles/system/pill.css` (313 lines): header, transition, `:active`.
3. `src/styles/system/jumpbar/jumpbar.css` (87 lines): transition curve, comment.
4. `src/styles/24-floating-nav-and-hud.css` (522 lines): one comment, no rule.
5. `test/stamp-press.test.js` (new).

## Canvas

- B-phone / B-wide: `.nv{transition:transform 120ms cubic-bezier(.2,.9,.3,1),box-shadow 120ms}` and `.nv:active{transform:translate(2px,2px)}`.
- B-phone: `.ptab{...transition:transform 120ms cubic-bezier(.2,.9,.3,1)}` and `.ptab:active{transform:translate(2px,2px)}`.
- PlateApproach: `.tp-chip[aria-pressed="true"]{background:#86BE98;box-shadow:2px 2px 0 #0F1822}` and `.tp-chip:active{transform:translate(2px,2px);box-shadow:none}`.
- Contact: `.tc-chip:active{transform:translate(2px,2px);box-shadow:none}` (same chip).
- Reduced motion (B-phone): `.nv{transition:none}`; PitchFlight: `.pf-b:active{transform:none}`.

House values: 2px is `var(--bw-heavy)` (the jump bar already writes it that way),
120ms is `var(--dur-fast)`, the curve is `var(--ease-stamp)`. The canvas
`box-shadow:none` is for a chip with an offset shadow. A house Button or Pill has
none, so the rule sets no `box-shadow` at all (decision 1: "a control with no offset
shadow gets only the move"). Do not copy the canvas 3px focus outline; the house ring
stays.

## Live today

`src/styles/system/button.css:61-67` (header, the pressed state):

```css
     pressed         :active. 1px down, and --inset-cell: the box is pressed
                     into the paper. The inset had one other job in this
                     family, the resting shadow of .posinn__scopebtn, and
                     --shadow-card was on its twin .stepnav__btn. Paper does
                     not float, so neither rests on a shadow any more, and the
                     inset moved to the one moment a control really is pressed
                     into the page.
```

`src/styles/system/button.css:91-92`:

```css
   Motion is --dur-fast on --ease-standard, and none at all under
   prefers-reduced-motion.
```

`src/styles/system/button.css:136-139` and `:245-248`:

```css
  transition:
    transform var(--dur-fast) var(--ease-standard),
    background-color var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard);
...
.btn:active {
  transform: translateY(1px);
  box-shadow: var(--inset-cell);
}
```

`src/styles/system/button.css:274-277` (disabled; keep as is) and `:286-297`
(reduced motion; keep as is):

```css
.btn:is(:disabled, [aria-disabled='true'], [aria-busy='true']):active {
  transform: none;
  box-shadow: none;
}
...
@media (prefers-reduced-motion: reduce) {
  .btn,
  .btn__icon {
    transition: none;
  }
  .btn:active {
    transform: none;
  }
```

`src/styles/system/pill.css:85`, `:154-157`, `:262-265`:

```css
     pressed         :active. 1px down and --inset-cell, as the button does.
...
  transition:
    transform var(--dur-fast) var(--ease-standard),
    background-color var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard);
...
.pill--control:active {
  transform: translateY(1px);
  box-shadow: var(--inset-cell);
}
```

`src/styles/system/jumpbar/jumpbar.css:55-60`:

```css
  transition: transform var(--dur-fast) var(--ease-standard);
}
/* The press: the item moves 2px down and right. */
.jumpbar__item:active {
  transform: translate(var(--bw-heavy), var(--bw-heavy));
}
```

`src/styles/24-floating-nav-and-hud.css:59-61`:

```css
   The offsets are measured from the BUTTON, not from the bar, and that is
   load-bearing rather than incidental: .btn:active nudges the button 1px with
   a transform, and a transform makes the element a containing block for its
```

### Every `:active` rule that composes with `.btn:active` or `.pill--control:active`

I listed all 68 `:active` rules in `src/styles/` and matched their classes against
every element that also wears `.btn` / `.pill--control` or is a `Button` / `Pill` /
`IconButton` with that `className`. Four hosts compose:

| Host | Where | What it does on press | After this slice |
|---|---|---|---|
| `.btn--reveal` (the seal) | `motion/innings.css:82-86` `.btn--reveal:hover, .btn--reveal:active, .btn--reveal:focus-visible { animation: none; }` | stops the breath | moves 2px down and right; no change to the breath rule |
| `.pitchlist__pick` (a ghost `Button`, `components/scoring/StrikeZone.jsx:192-194`) | `pitcher-card/card.css:437-439` `.pitchlist__pick:active { transform: none; }` | no move (its `::after` hit area) | still no move: (0,2,0) loads after button.css and wins |
| `.innings__notes` (a `.btn btn--control`) on a band | `11-innings.css:80-83` `:focus-visible:active { box-shadow: var(--inset-cell), var(--ring-band); }` | inset + halo | slice 02b deletes it |
| `.mastheadpill`, `.psodds-pill` (Pills) on a band | `10-lineup.css:484-487`, `09-team-info.css:181-183`, same shape | inset + halo | slice 02b deletes them |

Two hosts give a `.btn` a resting shadow: `.pagenav .btn:where(:not(.innings__refresh))`
(`24-floating-nav-and-hud.css`, `box-shadow: var(--shadow-raised)`) and
`.sc-lensback .btn` (`scorecard/lens.css`). Both are (0,2,0) and load after
button.css, so they already beat the old press inset. They keep their raised
shadow on press before and after this slice. No other `:active` rule in
`src/styles/` styles a `.btn` or a `.pill--control`.

The focus ring: `.btn:focus-visible` and `.pill--control:focus-visible` draw an
`outline`, which moves with the control. A band host draws `--ring-band` as a
`box-shadow` in a rule of three classes or more, which no `:active` rule now
overrides. So the ring stays visible on press, keyboard or pointer.

## Build

### 1. `src/styles/system/button.css`

Lines 61-67 become:

```css
     pressed         :active. The stamp-press (#2073): the box moves
                     --bw-heavy down and right, as a stamp is pushed into the
                     page. No shadow: the canvas press drops an offset shadow
                     to none, and a button has no offset shadow, so it gets
                     only the move. The inset it wore before (--inset-cell)
                     is gone from the press.
```

Lines 91-92 become:

```css
   Motion is --dur-fast. The press moves on --ease-stamp, the canvas press
   curve; the colours change on --ease-standard. None at all under
   prefers-reduced-motion.
```

Lines 136-139 become:

```css
  transition:
    transform var(--dur-fast) var(--ease-stamp),
    background-color var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard);
```

Lines 245-248 become:

```css
.btn:active {
  transform: translate(var(--bw-heavy), var(--bw-heavy));
}
```

Do not change the disabled `:active` rule or the reduced-motion block.

### 2. `src/styles/system/pill.css`

Line 85 becomes:

```css
     pressed         :active. The button's stamp-press (#2073): --bw-heavy
                     down and right, no shadow.
```

Lines 154-157: `transform var(--dur-fast) var(--ease-standard),` becomes
`transform var(--dur-fast) var(--ease-stamp),` (the other two lines stay).

Lines 262-265 become:

```css
.pill--control:active {
  transform: translate(var(--bw-heavy), var(--bw-heavy));
}
```

Do not change the disabled `:active` rule or the reduced-motion block.

### 3. `src/styles/system/jumpbar/jumpbar.css`

Lines 55-57 become:

```css
  transition: transform var(--dur-fast) var(--ease-stamp);
}
/* The press: the item moves 2px down and right on the stamp curve, the same
   press as Button and Pill (#2073). */
```

### 4. `src/styles/24-floating-nav-and-hud.css`

Line 60: `load-bearing rather than incidental: .btn:active nudges the button 1px with`
becomes `load-bearing rather than incidental: .btn:active moves the button 2px with`.
Rewrap the comment if a line passes 80 columns. No rule changes. (The same stale
phrase in `src/styles/focus/stage.css:232` is slice 02b's, to keep this slice at 5
files.)

### Guards

- `check-raw-values.mjs`: no raw time, hex, radius or shadow is added; one
  `box-shadow` with a token is removed from each press. No budget moves (a
  token-only shadow was never counted).
- `check-focus-ring.mjs`: no focus rule changes.
- `check-file-size.mjs`: every file stays far under 600.
- `check-layout-ratchet.mjs`, `check-typography.mjs`, `check-component-reuse.mjs`:
  no layout, type or shape declaration changes.

## Test first

Write `test/stamp-press.test.js`. Run it and see it fail. Then build.

```js
// The stamp-press (#2073, decision 1): every Button and Pill control, and the
// jump bar, moves 2px down and right when pressed, on the canvas press curve.
// Neither control has an offset shadow, so the press draws no shadow at all.
// Asserted from the stylesheet text, as test/notice-n5.test.js does.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ruleBody, stripComments } from './helpers/css.js'

const read = (rel) =>
  stripComments(readFileSync(fileURLToPath(new URL(`../src/styles/${rel}`, import.meta.url)), 'utf8'))
const decl = (body, property) =>
  body
    ?.split(';')
    .map((d) => d.trim().replace(/\s+/g, ' '))
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

const PRESS = 'translate(var(--bw-heavy), var(--bw-heavy))'

for (const [rel, sel] of [
  ['system/button.css', '.btn'],
  ['system/pill.css', '.pill--control'],
]) {
  test(`${sel}: the press moves 2px down and right, and draws no shadow`, () => {
    const body = ruleBody(read(rel), `${sel}:active`)
    assert.equal(decl(body, 'transform'), PRESS)
    assert.equal(decl(body, 'box-shadow'), undefined, 'no inset: the press is a move only')
  })

  test(`${sel}: under reduced motion the press does not move`, () => {
    const css = read(rel).replace(/\s+/g, ' ')
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    assert.match(reduced, new RegExp(`\\${sel}:active \\{ transform: none; \\}`))
  })
}

for (const [rel, sel] of [
  ['system/button.css', '.btn'],
  ['system/pill.css', '.pill--control'],
  ['system/jumpbar/jumpbar.css', '.jumpbar__item'],
]) {
  test(`${sel}: the press runs --dur-fast on --ease-stamp`, () => {
    const transition = decl(ruleBody(read(rel), sel), 'transition')
    assert.match(transition, /(^|, )transform var\(--dur-fast\) var\(--ease-stamp\)(,|$)/)
    assert.doesNotMatch(transition, /transform var\(--dur-fast\) var\(--ease-standard\)/)
  })
}

test('one press everywhere: Button, Pill and the jump bar move the same way', () => {
  const jump = decl(ruleBody(read('system/jumpbar/jumpbar.css'), '.jumpbar__item:active'), 'transform')
  assert.equal(jump, PRESS)
  assert.equal(decl(ruleBody(read('system/button.css'), '.btn:active'), 'transform'), jump)
  assert.equal(decl(ruleBody(read('system/pill.css'), '.pill--control:active'), 'transform'), jump)
})
```

Which cases fail before the change: the press case (translateY and the inset) and
the transition case for all three, and the "one press" case (the Button is
translateY). The reduced-motion case passes before and after; it guards that the
edit keeps that block. That is the one case that does not fail first, by design:
say so in the PR.

`ruleBody(css, '.btn')` returns the base rule (line 111): the first `.btn` that
starts a line and is followed by `{`. `ruleBody(css, '.btn:active')` returns line
245, the top-level rule, because the reduced-motion copy is indented and
`ruleBody` skips a selector after a space.

## Verify

1. `node --test test/stamp-press.test.js test/button-cascade.test.js test/pill-cascade.test.js test/jump-bar.test.js test/band-focus-ring.test.js test/icon-button.test.js`
2. `npm run lint`, `npm test`, `npm run build`.
3. `npm run dev`. In the preinstalled Chromium (Playwright), at 390px and 1180px:
   - `/design-lab?nointro`, the Button and Pill sections (the cells are live).
   - `/player/brice-turang-668930?nointro`, the jump bar and any card toggle.
   - `/team/milwaukee-brewers-158?nointro` (the hub; `/team/158` may also resolve, inferred), the Postseason Odds Pill and Game Notes Button on the hero.
   For each, hold the press and take the screenshot while it is down:
   `await el.hover(); await page.mouse.down(); await page.waitForTimeout(200); await page.screenshot(...); await page.mouse.up()`.
   The control sits 2px down and 2px right, with no inset shadow. Tab to one
   first, then press: the focus ring stays visible.
4. Load `/design-lab?nointro` with Playwright `reducedMotion: 'reduce'`: a held
   press does not move.
5. Open a live or recent game's innings view (`docs/test-games.md`) and press the
   reveal button once with the mouse: the reveal fires (the hit area moves with the
   button; `e2e/reveal-hit-area.spec.js` covers it, but do not run e2e).
6. Send Gary the held-press screenshots with `SendUserFile` and name each route.

## Out of scope

- The three band `:focus-visible:active` rules (slice 02b).
- `.btn--reveal`'s own rules in `07-team-logo-and-buttons.css` and
  `motion/innings.css`.
- Other pressed controls that are not a Button or a Pill (`.gamecard__open`,
  `.xl__door`, `.offday__tile`, and the rest of the 68 `:active` rules). They keep
  their own press.
- `Segmented` (slice 03) uses this press; it is built there.
- The `--inset-cell` token: it stays (cells, the note tile, and other readers).

## Stop if

- Any quoted line differs on your checkout.
- A test in `test/` pins `translateY(1px)` or `box-shadow: var(--inset-cell)` on
  `.btn:active` or `.pill--control:active` (I found none; if one appeared, update
  it to the new value and name it in the PR as a deliberate spec change).
- `--ease-stamp` is not defined (slice 01a not merged): `test/css-tokens.test.js`
  fails.
- A held press shows the focus ring gone on a band control (the halo is lost):
  report the computed `box-shadow`.
