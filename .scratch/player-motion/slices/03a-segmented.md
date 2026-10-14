# 03a — `Segmented`: the joined 44px control (the part)

Slice 03 is split. **03a** (this file) builds the part, its CSS and its tests.
**03b** (`03b-segmented-lab-docs.md`) adds the `/design-lab` entry, the `#1130`
amendment comment and the two CLAUDE.md lines.

## Run

- Model: `claude-sonnet-5-5`. Effort: **high**.
- Depends on: **none**. (spec.md says "01 merged". Segmented reads no token that
  slice 01 adds, so it does not need to wait. The press it shows comes from
  `.btn:active`, which slice 02 changes for every Button at once.)
- Parallel with: 01a, 01c, 01d, 02, 06, 07, 08, 10, 13.
- Shares append-only lines with other slices: `src/index.css` (one `@import`). The run plan may put
  those slices in one wave. Before you push, merge `main` in, and keep both sides
  of any conflict in those lines.
- Blocks: 03b, 04a, 04b, 04c, 04d.

## Goal

Add one design-system part: `Segmented`, a joined row of 44px toggle buttons for a
choice inside a card (decision 4 in spec.md). It is **not a third control**. Each
option is a real `.btn` (the same class list and ARIA that `Button` writes, from
`lib/design/buttonClass.js`), and the new sheet only re-skins `.btn` inside a
`.segmented` group: square, joined, a 2px stamped edge, ink fill when selected, no
tick. That is how it keeps `src/CLAUDE.md`'s rule "one control, one door ... Never
hand-draw a third".

## Done means

- `src/components/ui/control/Segmented.jsx` exports `Segmented` with exactly the
  spec.md API: `label`, `value`, `onChange`, `options` (`{ value, label, count?,
  disabled? }`), `fill`. Plus one optional prop that every `ui/` part already takes:
  `className` (the caller's namespace on the group). Slices 04b-04d need it.
- The markup is `<div role="group" aria-label class="segmented [segmented--fill]">`,
  then one `<button type="button" class="btn segmented__btn" aria-pressed>` per
  option, with an optional `<span class="segmented__count">`.
- `src/styles/system/segmented/segmented.css` draws it, imported by `src/index.css`
  directly **after** `system/pill.css` and **before** `system/button.css`.
- `test/segmented.test.js` passes; it fails on `main` today.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files (5)

| File | Change |
|---|---|
| `src/lib/design/segmentedClass.js` | **new.** The pure half: class list, option view, and the markup builder (`segmentedMarkup(h, props)`). Node can import it. |
| `src/components/ui/control/Segmented.jsx` | **new.** A thin wrapper: `segmentedMarkup(createElement, props)`. |
| `src/styles/system/segmented/segmented.css` | **new.** The sheet. |
| `src/index.css` | One `@import` line and its comment, between `pill.css` and `button.css`. |
| `test/segmented.test.js` | **new.** CSS cases and a server-render case. |

### Why these paths (two spec.md facts that do not hold on this checkout)

1. **Not `src/styles/system/segmented.css`.** `src/styles/system/` holds 12 `.css`
   files today (button, card, cluster, door, empty-state, grid, notice, pill,
   section-head, series-mark, stack, table). `scripts/check-dir-size.mjs` has
   `MAX_FILES = 12` and no budget for that folder, so a 13th file fails lint. Use a
   subfolder, as `system/jumpbar/jumpbar.css` and `system/stamped/stamped.css` do.
   `check-component-reuse.mjs` and `layout/check-layout-ratchet.mjs` skip every path
   that starts with `src/styles/system/`, so the subfolder is still "the part".
2. **The import slot.** spec.md says "after `pill.css`". The only place that is true
   and legal is *between* `pill.css` and `button.css`: `test/button-cascade.test.js`
   (l.49-60) asserts that `system/button.css` sits **directly before**
   `07-team-logo-and-buttons.css`. So `segmented.css` loads before `button.css`, and
   every rule in it must out-rank `.btn` on **specificity** (two classes), never on
   order. `test/button-placement.test.js`'s header states this rule for every sheet
   that loads before `button.css`.

Other dir counts: `src/lib/design/` has 11 files (this adds the 12th, the cap: say
so in the PR). `src/components/ui/control/` has 4.

Why a `.js` builder: node `--test` cannot import a `.jsx` file (the header of
`src/lib/design/buttonClass.js` says so). The builder takes `h` (React's
`createElement`) as an argument, so the server-render test runs the real markup,
and the module itself imports no React.

## Canvas

Four boards draw the same control. Excerpts (hex shown only to name the token):

```
GameLog   .gl-fbtn{min-height:44px;padding:0 14px;border:2px solid #0F1822;margin-left:-2px;display:inline-flex;align-items:center;gap:6px}
          .gl-fbtn:first-child{margin-left:0}
          <div role="group" aria-label="Show games" style="display:flex;flex-wrap:wrap;row-gap:0">
          <button class="gl-fbtn gl-cap" aria-pressed="{{f.on}}" style="background:{{f.bg}};color:{{f.fg}};font-size:14px;font-weight:700">
             {{f.label}} <span class="gl-mono" style="font-size:12px;font-weight:500">{{f.n}}</span></button>
          f.bg = on ? INK : PAPER ; f.fg = on ? '#F1E7CC' : INK
InningsByPosition  .ib-sb{min-height:44px;padding:0 14px;border:2px solid #0F1822;margin-left:-2px;flex:1 1 0;
          font-family:'Barlow Condensed';font-weight:700;font-size:14px;letter-spacing:.08em;text-transform:uppercase;
          transition:transform 120ms cubic-bezier(.2,.9,.3,1)}  .ib-sb:active{transform:translate(2px,2px)}
SimilarPlayers .ll-seg{display:flex} .ll-segb{...;background:#FBF6E9;color:#0F1822;flex:1}
          .ll-segb[aria-pressed="true"]{background:#0F1822;color:#F1E7CC}
FoulBalls .fe-tab{flex:1 1 0;min-height:44px;padding:0 6px;border:2px solid #0F1822;margin-left:-2px;...}
          .fe-tab:focus-visible{outline:3px solid #0F1822;outline-offset:2px;position:relative;z-index:1}
```

Token map (spec.md): ink `#0F1822` → `--text-heading` / `--border-stamped`; paper
`#FBF6E9` → `--surface-card`; 14px → `--space-3h` (padding) and `--fs-ui` (type);
12px → `--fs-label`; 2px → `--bw-heavy`; 44px → `--tap-min`.

**Selected text.** The canvas writes cream (`#F1E7CC`, `--text-on-ink-cream`).
spec.md fixes `--text-on-ink`. Follow spec.md (`--text-on-ink`). Do not re-open it.

**Focus.** Do not copy the canvas 3px ink ring. `.btn:focus-visible` already draws
the house ring (`button.css` l.264-267). Copy only the canvas `position: relative;
z-index: 1` on focus, so the next joined button does not paint over the ring.

**Press.** Segmented adds no press rule. It inherits `.btn:active` (today 1px +
`--inset-cell`; slice 02 makes it the stamp-press for every Button). A Segmented
button has no offset shadow, so after 02 it gets only the move.

## Live today

No `.segmented` class exists anywhere in `src/` (only prose comments use the word).

`src/components/ui/control/Button.jsx` l.27-63 writes a toggle as:

```jsx
const cls = buttonClassName({ size, skin, className })   // 'btn' + modifiers + className
const aria = buttonAria({ pressed, busy })                // { 'aria-pressed': 'true' | 'false' }
<button type={type} className={cls} onClick={handle} {...aria} {...rest}>
```

`src/lib/design/buttonClass.js` l.14-33: `buttonClassName({ className })` returns
`'btn <className>'` for the defaults (tap, outline); `buttonAria({ pressed })`
writes `aria-pressed` only when `pressed !== undefined`.

`src/styles/system/button.css`, the rules Segmented must out-rank (all one class):

```css
.btn { --btn-fill: var(--surface-card); --btn-edge: var(--border-rule); --btn-ink: var(--text-body);
       --btn-fill-hover: var(--surface-inset); --btn-edge-hover: var(--text-caption);
       min-height: var(--tap-min); padding: var(--space-2) var(--space-4);
       border: var(--bw-rule) solid var(--btn-edge); border-radius: var(--radius-sm); ... }   /* l.111-140 */
.btn[aria-pressed='true'], .btn[aria-current='page'] {
  background: var(--accent-primary); border-color: var(--accent-primary); color: var(--text-on-ink); }  /* l.250-255 */
.btn[aria-pressed='true']::before, .btn[aria-current='page']::before { content: '✓'; ... }           /* l.256-262 */
```

`src/index.css` l.100-102:

```css
@import './styles/system/pill.css';
@import './styles/system/button.css';
@import './styles/07-team-logo-and-buttons.css';
```

## Build

### 1. `src/lib/design/segmentedClass.js` (new)

```js
import { buttonAria, buttonClassName } from './buttonClass.js'

// THE SEGMENTED CONTROL (#2073) — a joined row of 44px toggles for a choice inside a
// card (the Game Log's All / Regular season / Postseason, the Similar card's Usage /
// Velocity). It is not a third control: every option is a .btn, with the class list
// and the aria-pressed that Button writes (buttonClass.js), and
// styles/system/segmented/segmented.css re-skins .btn inside the group. Pure, so
// node --test can render it: a .jsx file cannot be imported there.

export function segmentedClassName({ fill = false, className = '' } = {}) {
  const parts = ['segmented']
  if (fill) parts.push('segmented--fill')
  if (className) parts.push(className)
  return parts.join(' ')
}

// One entry per option. `pressed` compares with Object.is, so a value of 0 (an index)
// works. A count of 0 still shows; only null or undefined hides the count.
export function segmentedOptions(options = [], value) {
  return options.map((o) => ({
    key: String(o.value),
    value: o.value,
    label: o.label,
    count: o.count ?? null,
    disabled: Boolean(o.disabled),
    pressed: Object.is(o.value, value),
  }))
}

// The markup, built with `h` (React's createElement), so this file imports no React.
export function segmentedMarkup(h, { label, value, onChange, options, fill = false, className = '' }) {
  const btn = buttonClassName({ className: 'segmented__btn' })
  return h(
    'div',
    { role: 'group', 'aria-label': label, className: segmentedClassName({ fill, className }) },
    segmentedOptions(options, value).map((o) =>
      h(
        'button',
        {
          key: o.key,
          type: 'button',
          className: btn,
          disabled: o.disabled || undefined,
          onClick: () => onChange?.(o.value),
          ...buttonAria({ pressed: o.pressed }),
        },
        o.label,
        o.count != null ? h('span', { className: 'segmented__count' }, o.count) : null,
      ),
    ),
  )
}
```

### 2. `src/components/ui/control/Segmented.jsx` (new)

```jsx
import { createElement } from 'react'
import { segmentedMarkup } from '../../../lib/design/segmentedClass.js'

// THE SEGMENTED CONTROL (#2073): a joined row of 44px .btn toggles for a choice
// inside a card. One option is always on; a tap on another moves the fill.
//
//   label     the group's aria-label ("Show games").
//   value     the selected option's value.
//   onChange  called with the tapped option's value.
//   options   [{ value, label, count?, disabled? }]. `count` is a figure in mono
//             after the label ("All 22").
//   fill      the buttons share the row's width (flex: 1).
//   className the caller's namespace on the group, for its place on the card.
//
// It is a group of Buttons, not a third control (src/CLAUDE.md, "One control, one
// door"): each option wears .btn, and styles/system/segmented/segmented.css only
// re-skins it. The markup is in lib/design/segmentedClass.js so node can test it.
export function Segmented(props) {
  return segmentedMarkup(createElement, props)
}
```

### 3. `src/styles/system/segmented/segmented.css` (new)

Every selector is **two classes or more**, because this file loads before
`button.css` (see "Why these paths"). Keep the quote style `[aria-pressed='true']`
exactly: the test matches the selector text.

```css
/* ---------------------------------------------------------------------------
   SEGMENTED — a joined row of 44px toggles for a choice inside a card (#2073,
   components/ui/control/Segmented.jsx). Not a third control: each option is a
   .btn (system/button.css), and this sheet re-skins it inside the group.

   THE ANATOMY. One spec; every part reads a token.

     height     --tap-min (44px). --control-min (34px) stays for the other
                small controls (tokens/layout.css).
     edge       --bw-heavy solid --border-stamped. Square: no radius.
     join       every button after the first moves left by one edge
                (calc(var(--bw-heavy) * -1)), so two edges draw as one.
     face       --surface-card with --text-heading ink. The type is .btn's:
                the display face, uppercase, --ls-label, --fs-ui.
     selected   [aria-pressed='true']: --text-heading fill, --text-on-ink text,
                and NO tick. The joined row and the fill carry the state. In
                forced-colors mode the fill becomes Highlight, so the state does
                not rest on a colour the mode removes (the job .btn's tick does).
     count      .segmented__count: a mono figure after the label.
     fill       .segmented--fill: the buttons share the row (flex: 1 1 0).
     press      .btn:active, unchanged (slice 02 owns the press for every Button).
     focus      .btn:focus-visible, the house ring. The focused button lifts above
                its neighbours so the next button does not cover the ring.

   WHERE IT SITS IN THE CASCADE. src/index.css imports this file after
   system/pill.css and BEFORE system/button.css, which must stay directly before
   07 (test/button-cascade.test.js). So every rule here is written at two-class
   specificity: it wins on specificity, never on order. test/segmented.test.js
   pins the slot.
   --------------------------------------------------------------------------- */

.segmented {
  display: flex;
  flex-wrap: wrap;
}

.segmented .segmented__btn {
  --btn-fill: var(--surface-card);
  --btn-edge: var(--border-stamped);
  --btn-ink: var(--text-heading);
  --btn-fill-hover: var(--surface-inset);
  --btn-edge-hover: var(--border-stamped);

  min-height: var(--tap-min);
  padding: 0 var(--space-3h);
  border-width: var(--bw-heavy);
  border-radius: 0;
  font-size: var(--fs-ui);
}

.segmented .segmented__btn + .segmented__btn {
  margin-left: calc(var(--bw-heavy) * -1);
}

.segmented .segmented__btn[aria-pressed='true'] {
  background: var(--text-heading);
  border-color: var(--border-stamped);
  color: var(--text-on-ink);
}

.segmented .segmented__btn[aria-pressed='true']::before {
  content: none;
}

.segmented .segmented__btn:focus-visible {
  position: relative;
  z-index: 1;
}

.segmented--fill > .segmented__btn {
  flex: 1 1 0;
}

.segmented .segmented__count {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--ls-none);
  text-transform: none;
}

@media (forced-colors: active) {
  .segmented .segmented__btn[aria-pressed='true'] {
    background: Highlight;
    color: HighlightText;
  }
}
```

Notes for the guards:

- `check-raw-values.mjs`: no hex, no time, no non-zero radius (`border-radius: 0`
  is "none"), no shadow. `Highlight` / `HighlightText` are system colours, not hex.
- `check-typography.mjs`: `font-size` reads `--fs-*`, `letter-spacing` reads `--ls-*`,
  padding reads `0` and `--space-3h`. No `font-weight` (the display face has one
  weight; `button.css` l.36-38 says why).
- `check-focus-ring.mjs`: the one `:focus-visible` rule sets no `outline` or
  `box-shadow`, so the guard leaves it alone. The ring stays `.btn`'s.
- `layout/check-layout-ratchet.mjs` and `check-component-reuse.mjs` skip
  `src/styles/system/`. No marker needed.
- `layout/check-z-index.mjs`: `z-index: 1` is a local lift (3 or less is allowed).
- Reduced motion: this sheet adds no transition or animation. `.btn` already turns
  its own transition off under `prefers-reduced-motion` (`button.css` l.286-297), so
  no `@media (prefers-reduced-motion)` block is needed here. Say so in the PR.
- No `/animation-lab` entry: Segmented adds no animation. (spec.md's shared-files
  table lists 03 against `motionDemos.jsx`; that line does not apply.)

### 4. `src/index.css`

Insert between l.100 and l.101, and add one sentence to the comment block above
l.100 (the PILL paragraph ends at l.99):

```css
/* The SEGMENTED control (#2073) — a joined row of .btn toggles. A subfolder,
   since system/ is at the 12-file cap. Between the pill and the button: the
   button must stay directly before 07, so every segmented rule out-ranks .btn
   on specificity, never on order (test/segmented.test.js). */
@import './styles/system/pill.css';
@import './styles/system/segmented/segmented.css';
@import './styles/system/button.css';
```

(Put the new comment directly above the new `@import` line if that reads better;
the order of the three `@import`s is what matters.)

## Test first

Create `test/segmented.test.js`. Run `node --test test/segmented.test.js` and see it
fail (the modules and the sheet do not exist), then build.

```js
// The Segmented control (#2073): a joined row of 44px .btn toggles. Asserted from
// the pure builder (rendered once through react-dom/server, as
// callout-ledger.test.js does) and from the stylesheet text.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { segmentedClassName, segmentedMarkup, segmentedOptions } from '../src/lib/design/segmentedClass.js'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const css = stripComments(readFileSync(join(SRC, 'styles/system/segmented/segmented.css'), 'utf8'))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()
const rule = (selector) => {
  const body = ruleBody(css, selector)
  assert.ok(body, `${selector} should be a rule in system/segmented/segmented.css`)
  return body
}

const OPTIONS = [
  { value: 'all', label: 'All', count: 22 },
  { value: 'reg', label: 'Regular season', count: 0 },
  { value: 'post', label: 'Postseason', disabled: true },
]
const render = (props) =>
  renderToStaticMarkup(segmentedMarkup(createElement, { label: 'Show games', value: 'all', onChange() {}, options: OPTIONS, ...props }))

test('the group is a labelled role=group with the segmented class', () => {
  const html = render()
  assert.match(html, /^<div role="group" aria-label="Show games" class="segmented">/)
  assert.match(render({ fill: true, className: 'batlog__scope' }), /class="segmented segmented--fill batlog__scope"/)
})

test('each option is a .btn toggle: type=button, aria-pressed on every one', () => {
  const html = render()
  const buttons = html.match(/<button[^>]*>/g)
  assert.equal(buttons.length, 3)
  for (const b of buttons) {
    assert.match(b, /type="button"/)
    assert.match(b, /class="btn segmented__btn"/)
    assert.match(b, /aria-pressed="(true|false)"/)
  }
  assert.match(buttons[0], /aria-pressed="true"/)
  assert.match(buttons[1], /aria-pressed="false"/)
  assert.match(buttons[2], /disabled=""/)
})

test('a count renders in its own span; zero shows, a missing count does not', () => {
  const html = render()
  assert.match(html, />All<span class="segmented__count">22<\/span><\/button>/)
  assert.match(html, />Regular season<span class="segmented__count">0<\/span><\/button>/)
  assert.match(html, />Postseason<\/button>/)
})

test('pressed compares with Object.is, so an index of 0 can be the value', () => {
  const view = segmentedOptions([{ value: 0, label: 'Fouls' }, { value: 1, label: 'Whiffs' }], 0)
  assert.deepEqual(view.map((o) => o.pressed), [true, false])
  assert.equal(segmentedClassName(), 'segmented')
})

test('a tap calls onChange with the option value', () => {
  const seen = []
  const el = segmentedMarkup(createElement, { label: 'x', value: 'all', onChange: (v) => seen.push(v), options: OPTIONS })
  el.props.children[1].props.onClick()
  assert.deepEqual(seen, ['reg'])
})

test('index.css loads segmented.css after pill.css and before button.css; button stays directly before 07', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map((m) => m[1])
  const pill = imports.indexOf('system/pill.css')
  const seg = imports.indexOf('system/segmented/segmented.css')
  const button = imports.indexOf('system/button.css')
  assert.ok(seg !== -1, 'index.css should import system/segmented/segmented.css')
  assert.ok(pill < seg && seg < button, 'segmented.css sits between pill.css and button.css')
  assert.equal(button, imports.indexOf('07-team-logo-and-buttons.css') - 1)
})

test('the button: 44px, a heavy stamped edge, square, the card face', () => {
  const b = rule('.segmented .segmented__btn')
  assert.equal(decl(b, 'min-height'), 'var(--tap-min)')
  assert.equal(decl(b, 'border-width'), 'var(--bw-heavy)')
  assert.equal(decl(b, 'border-radius'), '0')
  assert.equal(decl(b, '--btn-edge'), 'var(--border-stamped)')
  assert.equal(decl(b, '--btn-fill'), 'var(--surface-card)')
  assert.equal(decl(b, '--btn-ink'), 'var(--text-heading)')
})

test('the join: each button after the first moves left by one heavy edge', () => {
  assert.equal(decl(rule('.segmented .segmented__btn + .segmented__btn'), 'margin-left'), 'calc(var(--bw-heavy) * -1)')
})

test('selected: ink fill, paper text, and no tick', () => {
  const on = rule(".segmented .segmented__btn[aria-pressed='true']")
  assert.equal(decl(on, 'background'), 'var(--text-heading)')
  assert.equal(decl(on, 'color'), 'var(--text-on-ink)')
  assert.equal(decl(rule(".segmented .segmented__btn[aria-pressed='true']::before"), 'content'), 'none')
  assert.match(css, /@media \(forced-colors: active\)/)
})

test('fill shares the row; the count is mono; no literal sizes', () => {
  assert.equal(decl(rule('.segmented--fill > .segmented__btn'), 'flex'), '1 1 0')
  assert.equal(decl(rule('.segmented .segmented__count'), 'font-family'), 'var(--font-mono)')
  assert.doesNotMatch(css, /\b(34|44)px\b/)
  assert.doesNotMatch(css, /--control-min/)
})
```

If `el.props.children[1]` is not the second button (React keeps `children` as the
array passed), read the array with `[].concat(el.props.children)` instead. Do not
weaken the assertion.

## Verify

1. `node --test test/segmented.test.js`.
2. `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
3. No live screen uses Segmented yet (03b adds the lab entry, 04a-d the swaps). To
   see it in Chromium before 03b, mount it for one run in a scratch copy of the
   design lab, take the screenshot, and do not commit that edit. Check at 390px:
   the buttons join (one 2px line between them, not 4px), the selected button is
   ink with paper text and no tick, Tab shows the full ring on the middle button,
   and the count is mono. Send the screenshot to Gary with `SendUserFile`.

## Out of scope

- Any swap of a live toggle (slices 04a-d).
- The design-lab entry, the `layout.css` comment and the CLAUDE.md lines (03b).
- The press itself (slice 02).
- A keyboard arrow-key model (roving tabindex). Each option is a Tab stop, as the
  `Button` toggles it replaces are today.

## Stop if

- `src/styles/system/` no longer holds exactly 12 files, or `check-dir-size.mjs`
  gained a budget for it: re-check the path choice and say what changed.
- `test/button-cascade.test.js` no longer asserts that `button.css` sits directly
  before 07, or `index.css` l.100-102 differ from what is quoted above.
- `src/lib/design/` already holds 12 files (this would be the 13th).
- A `.segmented` or `.segmented__*` rule already exists in `src/styles/`.
- `.btn` or `.btn[aria-pressed='true']` changed specificity (for example, moved into
  `:where()`), so the two-class rules here no longer win.
- `npm run lint` fails on a guard this file does not name.
