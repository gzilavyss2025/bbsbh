# Slice 05a: `MenuRail`, the part (markup, pure core, resting look)

Slice 05 is split in three, because one PR would touch more than 5 files:

- **05a (this file):** the component, its pure core, its resting and state CSS, the
  `index.css` import, the test. The states switch at once (no transition yet).
- **05b:** the motion sheet (`src/styles/motion/menurail.css`): the unfold, the fold, the
  panel, the rise on each pick. Its import and its test.
- **05c:** the `/design-lab` entry and the `/animation-lab` entry.

The consumers (09 Splits, 11 Arsenal, 16 Plate, 17 Contact) wait for 05a and 05b.

## Run

- Model: `claude-sonnet-5-5`. Effort: high.
- Depends on: 01a merged (the tokens `--dur-unfold`, `--ease-unfold`, `--dur-stamp-in`,
  `--ease-stamp`; 05a itself reads none of them, but 05b does, and the two land together).
- Parallel with: 02, 03, 04, 06, 07, 08, 10, 13, 20. Not with 05b (05b edits the same test
  helper area and `index.css`; run 05b after 05a merges, or stack them).

## Goal

Build `MenuRail`, the one shared menu, rail and focus panel (decision 5 in `spec.md`).
Arsenal, Splits (both roles), Plate approach and Contact will use it. It is a design-system
part: no baseball knowledge, no `api/` import.

## Done means

- `src/components/ui/control/MenuRail.jsx` renders the API below. Each card is a `.btn`
  (the markup `Button.jsx` writes, through `buttonClass.js`), so the house focus ring, the
  disabled state and the slice-02 stamp-press come with it ("One control, one door",
  `src/CLAUDE.md` l.222).
- `src/components/ui/control/menuRail.js` holds the pure core (the `shownKey` lag, the a/b
  generation, the class lists, the card and panel props) and the markup builder
  `menuRailMarkup(h, props)`, so the test can server-render the real markup.
- `src/styles/system/menurail/menurail.css` draws the menu state, the rail state, the
  picked card and the open/closed panel, with tokens only.
- `src/index.css` imports it after `system/jumpbar/jumpbar.css`.
- `test/menurail.test.js` passes, and it failed before the change.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files (5)

| File | Change |
|---|---|
| `src/components/ui/control/MenuRail.jsx` | **new**: the component |
| `src/components/ui/control/menuRail.js` | **new**: the pure core and the markup builder (node cannot import `.jsx`) |
| `src/styles/system/menurail/menurail.css` | **new**: resting look and states. A **new subfolder**: `src/styles/system/` holds 12 `.css` files today, the `check-dir-size.mjs` cap (`MAX_FILES = 12`). Slice 03a does the same (`system/segmented/segmented.css`) |
| `src/index.css` | one `@import` line |
| `test/menurail.test.js` | **new**: the pure core, the markup source, the CSS |

Why the pure core sits beside the component, not in `src/lib/design/`: that folder holds 11
files, and slice 03a adds `segmentedClass.js` there. `src/components/ui/control/` holds 4
files today.

## The API (spec.md, plus the extensions this slice adds)

```jsx
<MenuRail
  label="Pitch types"                 // aria-label of the role="group" menu
  items={[{
    key: 'FF',                        // unique, never null
    title: 'Four-seam',               // the card name
    meta: '34%',                      // optional: a short figure beside the title
    figures: <…/>,                    // optional: folds away in rail state
    mark: <…/>,                       // optional: an icon before the title (aria-hidden)
    // ---- extensions (not in spec.md; the live modules need them) ----
    label: 'Four-seam: …',            // optional aria-label for the card (Plate, Contact)
    disabled: false,                  // optional (Splits greys a section with no data)
    heading: 'Fly balls',             // optional: a full-width group head BEFORE this card;
                                      //   it folds away in rail state (Contact .tc-mh)
    style: {…},                       // optional: passed to the card (Arsenal timeline, slice 12)
    className: '…',                   // optional: added to the card
  }, …]}
  picked={code}                       // a key, or null for the full menu
  onPick={setCode}                    // a key, or null (tap the picked card again, or Back)
  panel={(key) => <Detail code={key} />}   // OPTIONAL extension: omit it and no panel renders
                                      //   (Splits opens its own sections below the menu)
  backLabel="All pitches"             // optional: ghost Button at the top of the panel
  railMeta                            // OPTIONAL extension: keep `meta` in rail state
                                      //   (Arsenal keeps the mph; Plate and Contact hide it)
  className="fplate__menu"            // OPTIONAL extension: the caller's namespace on the root
/>
```

Two CSS custom properties a caller may set on its `className`:
`--menurail-card` (menu basis, default 150px) and `--menurail-rail` (rail basis, default
132px). Splits wants 128px (`calc(var(--space-16) * 2)`, live today), Contact 112px.

Why each extension (say this in the PR):

| Extension | Who needs it | Evidence |
|---|---|---|
| `panel` optional | Splits | `splits/index.jsx:126-137`: the menu opens sections in `.splitsmod__cards`, not one panel; canvas PitcherSplits has no `.sp-pn`, it opens `.cw` wrappers per section |
| `railMeta` | Arsenal | canvas `.ar-rail` keeps `.ar-m` (the mph) beside the name; Plate and Contact hide it (`.tp-rail .tp-ms{display:none}`, `.tc-rail .tc-ms{display:none}`) |
| `items[].label` | Plate, Contact | canvas `.tp-mc`/`.tc-mc` carry `aria-label`; live `StretchTable.jsx:40` builds an aria per row |
| `items[].disabled` | Splits | live scope buttons use `disabled`; a section with no data can grey its card |
| `items[].heading` | Contact | canvas `.tc-mh{flex:1 0 100%;max-height:24px…}`, `.tc-rail .tc-mh{max-height:0;opacity:0}` |
| `items[].style`, `className` | Arsenal (slice 12) | canvas cards carry a per-frame `style` (opacity, `rotateX`, blur) and an absolute wash `.ar-sw` (`position:absolute;inset:0;z-index:-1`). The card is `position: relative; isolation: isolate`, so a wash the caller draws inside `mark` sits on the card |
| root `className` | all | the module's namespace, and the two custom properties |

No count field: Splits' and Arsenal's counts are on the Slot's tag, not on a card.

## Canvas

The four boards, side by side. Every value is copied from the board's `<style>`.

| Value | ArsenalReveal `.ar-*` | PitcherSplits `.sp-*` | PlateApproach `.tp-*` | Contact `.tc-*` |
|---|---|---|---|---|
| menu row | `display:flex;flex-wrap:wrap;gap:8px` | `gap:10px;margin-top:30px` | `gap:10px` | `gap:10px` |
| card basis | `flex:1 1 150px;min-width:0` | `flex:1 1 200px` | `flex:1 1 150px` | `flex:1 1 150px` |
| card box | `border:2px solid #0F1822;border-radius:0;background:#FBF6E9;min-height:48px;padding:8px 10px` | `min-height:44px;padding:12px 14px` | `padding:10px 12px` | `padding:10px 12px` |
| card extras | `position:relative;isolation:isolate;transform-origin:50% 0` | — | — | — |
| card transition | `flex-basis .4s cubic-bezier(.23,1,.32,1),padding .4s …,background .2s,box-shadow .12s` | `flex-basis .45s (.23,1,.32,1),padding .45s …,background .2s,color .2s,transform .12s ease-out` | `flex-basis 380ms cubic-bezier(.2,.9,.3,1),padding 380ms …,background 200ms,box-shadow 120ms` | same as Plate |
| press | (none) | `:active{transform:scale(.98)}` | `:active{transform:translate(2px,2px)}` | same as Plate |
| picked | `background:#86BE98;box-shadow:2px 2px 0 #0F1822` | `background:#1B2A3A;color:#FBF6E9` | `#86BE98` + `2px 2px 0` | `#86BE98` + `2px 2px 0` |
| figures fold | `.ar-mx{display:grid;grid-template-rows:1fr;transition:grid-template-rows .4s (.23,1,.32,1)}` `.ar-mx>span{display:block;min-height:0;overflow:hidden}` | `.sp-mx` same, `.45s` | `.tp-mx` same, `340ms (.2,.9,.3,1)` | `.tc-mx` same, `340ms` |
| rail card | `.ar-rail .ar-mc{flex:0 0 auto;padding:4px 10px;min-height:44px;justify-content:center}` | `flex:0 0 150px;padding:6px 14px;justify-content:center` + title `font-size:15px` | `flex:0 0 132px;padding:6px 12px` | `flex:0 0 112px;padding:6px 12px` |
| rail hides | `.ar-mx` → `0fr` (spark row). Name and mph STAY | `.sp-mx` → `0fr` (preview + hint) | `.tp-mx` → `0fr`; `.tp-ms{display:none}` (the % seen) | `.tc-mx` → `0fr`; `.tc-ms` none; `.tc-mh` heads `max-height:0;opacity:0` |
| panel | `.ar-pn{grid-template-rows:0fr}` `.ar-pn.ar-on{1fr}` `.ar-pn>div{visibility:hidden;transition:visibility 0s .4s}` `.ar-pn.ar-on>div{visibility:visible;transition-delay:0s}` | none (per-section `.cw` wrappers, same 0fr/1fr trick, `.45s`, plus `@keyframes cwo{to{overflow:visible}}` after open) | `.tp-pn` same as Arsenal, `340ms` | `.tc-pn` same, `340ms` |
| panel pad | `.ar-pi{padding-top:2px}` | — | `.tp-pi{padding-top:14px}` | `.tc-pi{padding-top:14px}` |
| back | `.ar-back` 44px, `2px` border, `2px 2px 0` shadow, `margin-bottom:10px`, "← All pitches" | — (tap the open card again) | `.tp-chip` 40px, `margin-bottom:14px`, "← All pitches" | same as Plate |
| rise | `.ar-ff1,.ar-ff2{animation:ar-fa .38s cubic-bezier(.23,1,.32,1) backwards}` `.ar-ff2{animation-name:ar-fb}` `@keyframes ar-fa{from{opacity:0;transform:translateY(8px)}}` (ar-fb the same) | — | `tp-fa`/`tp-fb`, `380ms cubic-bezier(.2,.9,.3,1)`, same steps | `tc-fa`/`tc-fb`, same as Plate |
| reduced | `.ar-ff1,.ar-ff2{animation:none!important}.ar-mc,.ar-mx,.ar-pn{transition:none!important}` | `.cw,.sp-mc,.sp-mx{transition:none !important}` | as Arsenal | as Arsenal, plus `.tc-mh` |
| hover | — | `@media (hover:hover) and (pointer:fine){.sp-mc:hover{background:#EDE6D1}}` | — | — |

State logic, all three menus that have a panel (Arsenal l.159/173, Plate l.190/194-195,
Contact l.449/454; excerpts):

```js
pick: () => this.setState({ solo: solo === i ? null : i, fgen: (st.fgen || 0) + 1 })
if (sp) this._lf = sp;  const q = sp || this._lf || D.P[0];      // the panel shows the LAST pick while it folds
fx: (st.fgen || 0) % 2 ? 'ar-ff2' : 'ar-ff1'                      // a new pick swaps the class: the rise restarts
menuCls: 'ar-menu' + (solo !== null ? ' ar-rail' : ''), panelCls: 'ar-pn' + (solo !== null ? ' ar-on' : '')
```

**Which one `MenuRail` follows.** Timing: Arsenal's (`.4s`, `cubic-bezier(.23,1,.32,1)`) as
`--dur-unfold` and `--ease-unfold` (spec.md token table). The rise: Plate's (`380ms` on
`(.2,.9,.3,1)`) as `--dur-stamp-in` and `--ease-stamp` (spec.md). Box: Plate's (padding
`10px 12px` menu, `6px 12px` rail, rail basis `132px`, panel pad `14px`). Picked: the mint
(`--accent-tint`) and the 2px offset shadow, as three of the four boards (spec.md). Splits'
ink pick and `.45s` are the exceptions; slice 09 moves Splits onto the mint.

Why a fixed rail basis and not Arsenal's `flex:0 0 auto`: `auto` cannot interpolate, so the
width would snap while the padding glides. A fixed basis glides. A long title ellipses.

## Live today (what the part must cover; 05a changes none of it)

- `src/screens/player/next/modules/arsenal/ArsenalCard.jsx:58-80`: the bar with Replay and
  "← All pitches" (`Button size="control"`), then `.arsenal__menu` (`role="group"
  aria-label="Pitch type"`), one `Button className="arsenal__pick" pressed=…` per pitch:
  `PitchGlyph` + name, `.arsenal__figs` (`92.4 mph · 34%`), `.arsenal__spark`. Then
  `{one && <Detail r={one} />}`: the panel mounts and unmounts, so it cannot fold.
- `src/styles/player-next/pitcher/arsenal.css:189-247`: `.arsenal__menu` (wrap, `gap:
  var(--space-2)`), `.arsenal__pick.btn` (`flex: 1 1 9rem`, column), and the rail:

  ```css
  .arsenal__menu--rail .arsenal__pick.btn { flex: 0 0 auto; }
  .arsenal__menu--rail .arsenal__figs,
  .arsenal__menu--rail .arsenal__spark { display: none; }
  ```
- `src/screens/player/next/modules/splits/index.jsx:126-137`: a hand-written `<button
  type="button" className="splitsmod__mc" aria-pressed>` per section (title, then
  `.splitsmod__mx` with preview and hint). No panel: the picked ids filter
  `.splitsmod__cards` (`show(id)`, l.78).
- `src/styles/player-next/both/splits.css:130-189`: `.splitsmod__mc` (`flex: 1 1
  calc(var(--space-16) * 3)`, `[aria-pressed='true']` is `--text-body` ink) and the rail
  (`.splitsmod__menu.is-rail .splitsmod__mc { flex: 0 0 calc(var(--space-16) * 2); … }`,
  `.splitsmod__mx { display: none; }`).
- `src/components/ui/control/Button.jsx:25-63`: `pressed` writes `aria-pressed` through
  `buttonAria` (`src/lib/design/buttonClass.js`); `...rest` passes `disabled`, `style`,
  `aria-label` to the `<button>`.
- `src/styles/system/button.css`: `.btn` (l.111-140) sets `--btn-fill`, `--btn-edge`,
  `--btn-ink`, `--btn-fill-hover`, `--btn-edge-hover`, `display: inline-flex`, `align-items:
  center`, `justify-content: center`, `text-align: center`, `border: var(--bw-rule) solid
  var(--btn-edge)`, `border-radius: var(--radius-sm)`. The pick (l.249-260):

  ```css
  .btn[aria-pressed='true'] { background: var(--accent-primary); border-color: var(--accent-primary); color: var(--text-on-ink); }
  .btn[aria-pressed='true']::before { content: '✓'; content: '✓' / ''; … }
  ```
  Hover is `.btn:where(:not(…)):hover` (specificity 0,2,0) and reads `var(--btn-fill-hover)`.

## Build

### 1. `src/components/ui/control/menuRail.js` (pure, and the markup builder)

The markup is built here with `h` (React's `createElement`), so `node --test` can render it
with `react-dom/server` and read the real attributes. Node cannot import a `.jsx` file, so
the cards and the Back button write the markup `Button.jsx` writes (`type="button"`,
`buttonClassName`, `buttonAria`, the `.btn__icon` span) through the same pure helpers in
`src/lib/design/buttonClass.js`. Slice 03a's `Segmented` does the same
(`segmentedMarkup(h, props)`). They are still `.btn`: one control, one door.

```js
import { buttonAria, buttonClassName } from '../../../lib/design/buttonClass.js'

// THE MENU RAIL'S PURE CORE AND MARKUP (#2073, slice 05). MenuRail.jsx holds the state and
// calls menuRailMarkup(createElement, …); node --test renders the same builder with
// react-dom/server (a .jsx file cannot be imported there).
//
// The view is { picked, shownKey, gen }:
//   picked    what the caller says is picked now (a key or null)
//   shownKey  what the panel shows. It is the pick, or the LAST pick while the panel
//             folds shut, so the content does not vanish before the fold ends
//   gen       counts the picks. A new pick adds one, so the panel body swaps between
//             its a and b class and the rise restarts without a remount (canvas fgen)

export const BODY_A = 'menurail__body--a'
export const BODY_B = 'menurail__body--b'

export const firstView = (picked = null) => ({ picked, shownKey: picked, gen: 0 })

// One render's step. The same pick returns the SAME object, so the caller can test
// `next !== view` before it sets state during render.
export function nextView(view, picked = null) {
  if (picked === view.picked) return view
  if (picked == null) return { ...view, picked: null }
  return { picked, shownKey: picked, gen: view.gen + 1 }
}

export const bodyClass = (gen) => `menurail__body ${gen % 2 ? BODY_B : BODY_A}`

// A tap on the picked card closes the panel; a tap on any other card picks it.
export const pickFor = (key, picked) => (picked === key ? null : key)

export function rootProps({ picked = null, railMeta = false, className = '' } = {}) {
  const open = picked != null
  return {
    className: ['menurail', open && 'menurail--rail', railMeta && 'menurail--railmeta', className]
      .filter(Boolean)
      .join(' '),
    'data-state': open ? 'rail' : 'menu',
  }
}

// The card's props. `pressed` is always a boolean, so every card is a toggle
// (aria-pressed "true" or "false"), never an ordinary action.
export function cardProps(item, picked = null) {
  return {
    className: ['menurail__card', item.className].filter(Boolean).join(' '),
    pressed: picked != null && picked === item.key,
    disabled: item.disabled ? true : undefined,
    'aria-label': item.label,
    style: item.style,
  }
}

// A closed panel is inert: nothing in it takes focus or a tap while it is folded.
export const panelProps = (open) => ({
  className: open ? 'menurail__panel menurail__panel--open' : 'menurail__panel',
  inert: !open,
})

// The whole part. `view` is the step nextView returned for this render.
export function menuRailMarkup(h, { label, items, picked = null, onPick, panel, backLabel, railMeta = false, className = '', view }) {
  const open = picked != null
  const card = (item) => {
    const { pressed, className: cls, ...rest } = cardProps(item, picked)
    return h(
      'button',
      {
        key: item.key,
        type: 'button',
        className: buttonClassName({ className: cls }),
        ...buttonAria({ pressed }),
        ...rest,
        onClick: () => onPick(pickFor(item.key, picked)),
      },
      h(
        'span',
        { className: 'menurail__top' },
        item.mark != null && h('span', { className: 'menurail__mark', 'aria-hidden': 'true' }, item.mark),
        h('span', { className: 'menurail__title' }, item.title),
        item.meta != null && h('span', { className: 'menurail__meta' }, item.meta),
      ),
      item.figures != null &&
        h(
          'span',
          { className: 'menurail__fold' },
          h('span', { className: 'menurail__figs' }, h('span', { className: 'menurail__figsin' }, item.figures)),
        ),
    )
  }
  const cells = items.flatMap((item) => [
    item.heading ? h('span', { key: `${item.key}:head`, className: 'menurail__head' }, item.heading) : null,
    card(item),
  ])
  const back =
    backLabel &&
    h(
      'button',
      { type: 'button', className: buttonClassName({ skin: 'ghost', className: 'menurail__back' }), onClick: () => onPick(null) },
      h('span', { className: 'btn__icon', 'aria-hidden': 'true' }, '←'),
      backLabel,
    )
  const body = view.shownKey != null && h('div', { className: bodyClass(view.gen) }, panel(view.shownKey))
  return h(
    'div',
    rootProps({ picked, railMeta, className }),
    h('div', { className: 'menurail__menu', role: 'group', 'aria-label': label }, ...cells),
    panel &&
      h(
        'div',
        panelProps(open),
        h('div', { className: 'menurail__panelin' }, h('div', { className: 'menurail__inner' }, back, body)),
      ),
  )
}
```

Notes:
- `cells` is spread into `h(…)` as separate children, so the keys are only for React's
  list check; spreading with keys is fine. If the dev build warns about keys, pass
  `cells` as one array child instead (`h('div', {...}, cells)`).
- `inert` is a boolean prop in React 19 (`package.json` has `react ^19.3.0`): `true` writes
  `inert=""`, `false` writes nothing.
- The panel follows the menu in the DOM, so Tab goes card, card, …, Back, panel.
- The Back button sits OUTSIDE the rising body, as on the canvas (`.ar-back` is before
  `.ar-ff1`). It stays put while the content rises.
- Why three wrappers in the fold and the panel: the grid track goes to `0fr`, and the item
  with `min-height: 0; overflow: hidden` goes to 0 height. Padding on THAT item would stay
  (padding is not part of the content height), so the padding sits one level deeper
  (`__figsin`, `__inner`).

### 2. `src/components/ui/control/MenuRail.jsx`

```jsx
import { createElement, useState } from 'react'
import { firstView, menuRailMarkup, nextView } from './menuRail.js'

// THE MENU RAIL (#2073, slice 05): one shared menu of cards that folds into a rail, with
// a focus panel under it for the picked card. Arsenal, Splits, Plate approach and Contact
// use it. Drawn once, in styles/system/menurail/menurail.css; it moves in
// styles/motion/menurail.css. No baseball knowledge (ui/CLAUDE.md).
//
//   label     the menu's aria-label.   items  [{ key, title, meta, figures, mark,
//             label, disabled, heading, style, className }]
//   picked    a key, or null for the full menu.   onPick(key | null)
//   panel     optional (key) => node: the focus panel. It stays mounted, so it can fold.
//   backLabel optional: a ghost button at the top of the panel that closes it.
//   railMeta  keep `meta` on the rail (Arsenal keeps the mph).
//   className the caller's namespace on the root; it may set --menurail-card and
//             --menurail-rail (the two flex bases).
//
// The markup is menuRail.js's builder, so node --test renders exactly what ships. Each
// card is a .btn (the markup Button.jsx writes), so the focus ring, the disabled state and
// the stamp-press are the button's own.
export function MenuRail(props) {
  const picked = props.picked ?? null
  // Adjust state during render (React's documented escape hatch, as useBecameTrue does):
  // the committed DOM carries the new body class from its first frame.
  const [view, setView] = useState(() => firstView(picked))
  const next = nextView(view, picked)
  if (next !== view) setView(next)
  return menuRailMarkup(createElement, { ...props, picked, view: next })
}
```

### 3. `src/styles/system/menurail/menurail.css`

`src/styles/system/` is skipped by `layout/check-layout-ratchet.mjs` (the parts themselves),
so this file needs no `layout-exempt` markers. Every value is a token or a `calc` of one.
Every selector that meets `.btn` outranks it on specificity (0,2,0 or more against `.btn`'s
0,1,0 and the hover rule's 0,2,0 which only reads our variables), so the import position is
free of the button cascade. No `text-transform` (the app is uppercase; `check-caps.mjs`
bans `none`).

```css
/* ---------------------------------------------------------------------------
   THE MENU RAIL (#2073, slice 05; components/ui/control/MenuRail.jsx).
   A row of cards. Pick one and the row folds into a rail of narrow cards, and
   the focus panel under it opens. The canvas boards: ArsenalReveal .ar-mc,
   PitcherSplits .sp-mc, PlateApproach .tp-mc, Contact .tc-mc.

   This file is the RESTING look and the two states. The motion (the unfold,
   the fold, the rise on each pick) is styles/motion/menurail.css (docs/motion.md,
   "The seam").

   Each card is a .btn. Every rule below that meets .btn outranks it on
   specificity, so no rule here depends on the import order.

   A caller may set two bases on its own class: --menurail-card (the menu,
   150px as the boards draw it) and --menurail-rail (the rail, 132px as Plate
   draws it; Splits wants 128px, Contact 112px).
   --------------------------------------------------------------------------- */

.menurail {
  --menurail-card: calc(var(--space-2h) * 15);
  --menurail-rail: calc(var(--tap-min) * 3);
}

.menurail__menu {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2h);
}

/* A group head before a card (Contact). It takes the whole row. */
.menurail__head {
  flex: 1 0 100%;
  max-height: var(--space-6);
  overflow: hidden;
  color: var(--text-heading);
  font-family: var(--font-display);
  font-size: var(--fs-label);
  font-weight: var(--w-bold);
  letter-spacing: var(--ls-label);
  line-height: var(--lh-ui);
}

/* ---- the card ---- */

.menurail__card.btn {
  --btn-fill: var(--surface-card);
  --btn-edge: var(--border-stamped);
  --btn-ink: var(--text-heading);
  --btn-fill-hover: var(--surface-inset);
  --btn-edge-hover: var(--border-stamped);

  position: relative;
  isolation: isolate;
  display: flex;
  flex: 1 1 var(--menurail-card);
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0;
  min-width: 0;
  padding: var(--space-2h) var(--space-3);
  border-width: var(--bw-heavy);
  border-radius: 0;
  font-family: var(--font-body);
  letter-spacing: var(--ls-none);
  text-align: left;
}
.menurail__card.btn[aria-pressed='true'] {
  background: var(--accent-tint);
  border-color: var(--border-stamped);
  color: var(--text-heading);
  box-shadow: var(--bw-heavy) var(--bw-heavy) 0 var(--border-stamped);
}
/* The pick is the mint and the shadow. No tick. */
.menurail__card.btn[aria-pressed='true']::before {
  content: none;
}
/* The stamp-press (slice 02) takes the shadow away while the card is down. */
.menurail__card.btn[aria-pressed='true']:active {
  box-shadow: none;
}

.menurail__top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.menurail__mark {
  display: inline-flex;
  flex: none;
}
.menurail__title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: var(--fs-title-md);
  font-weight: var(--w-bold);
  line-height: var(--lh-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menurail__meta {
  flex: none;
  font-family: var(--font-mono);
  font-size: var(--fs-small);
  font-weight: var(--w-bold);
  font-variant-numeric: tabular-nums;
}

/* The figures fold: a one-row grid that goes 1fr -> 0fr in the rail. */
.menurail__fold {
  display: grid;
  grid-template-rows: 1fr;
}
.menurail__figs {
  display: block;
  min-height: 0;
  overflow: hidden;
}
.menurail__figsin {
  display: block;
  padding-top: var(--space-2);
}

/* ---- the rail: a card a pick, narrow; the figures fold away ---- */

.menurail--rail .menurail__card.btn {
  flex: 0 0 var(--menurail-rail);
  padding: var(--space-1h) var(--space-3);
  justify-content: center;
}
.menurail--rail .menurail__fold {
  grid-template-rows: 0fr;
}
.menurail--rail .menurail__head {
  max-height: 0;
  opacity: 0;
}
.menurail--rail:not(.menurail--railmeta) .menurail__meta {
  display: none;
}

/* ---- the focus panel: always mounted, 0fr shut, 1fr open ---- */

.menurail__panel {
  display: grid;
  grid-template-rows: 0fr;
}
.menurail__panel--open {
  grid-template-rows: 1fr;
}
.menurail__panelin {
  min-height: 0;
  overflow: hidden;
  visibility: hidden;
}
.menurail__panel--open .menurail__panelin {
  visibility: visible;
}
/* Room on the right and the bottom for a stamped shadow in the panel: the
   wrapper above clips (canvas .cwp did the same, 6px). */
.menurail__inner {
  padding: var(--space-3h) var(--space-1) var(--space-1) 0;
}
.menurail__back.btn {
  margin-bottom: var(--space-3);
}
```

Guard notes for this sheet:
- `check-raw-values.mjs`: the picked `box-shadow` reads a token for every value, so it does
  not count (the header of the script says so). No hex, no radius (only `0`), no time.
- `check-typography.mjs`: every `font-size`, `font-weight`, `line-height`,
  `letter-spacing`, `padding` and `gap` is a token.
- `check-focus-ring.mjs`: no `:focus-visible` rule here; `.btn:focus-visible` draws the house
  ring.
- `check-component-reuse.mjs`: `system/` is skipped.
- `check-contrast.mjs`: `--text-heading` on `--accent-tint` is the pair `.fstretch__row--pick`
  already uses (`formchart.css:145`). If the guard names the pair, stop.

### 4. `src/index.css`

Add one line right after `@import './styles/system/jumpbar/jumpbar.css';` (l.172 today),
with a comment:

```css
/* The MENU RAIL (#2073): MenuRail.jsx. Its selectors outrank .btn, so its place does not
   depend on system/button.css. The motion is motion/menurail.css. */
@import './styles/system/menurail/menurail.css';
```

Do NOT put it between `system/button.css` and `07-team-logo-and-buttons.css`:
`test/button-cascade.test.js:48` pins that button.css is IMMEDIATELY before 07.

## Test first

`test/menurail.test.js`. Write it, run `node --test test/menurail.test.js`, see every case
fail (the files do not exist), then build. The markup cases render the real builder with
`react-dom/server` (the suite's one way to read React output; `test/CLAUDE.md`).

```js
// The shared menu, rail and panel (#2073, slice 05a): the pure core, the markup it renders
// (server-rendered, the real builder MenuRail.jsx calls) and the resting CSS of the states.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { stripComments, ruleBody } from './helpers/css.js'
import {
  BODY_A, BODY_B, bodyClass, cardProps, firstView, menuRailMarkup, nextView, panelProps, pickFor, rootProps,
} from '../src/components/ui/control/menuRail.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = () => stripComments(read('styles/system/menurail/menurail.css'))
const decl = (body, property) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${property}:`))?.slice(property.length + 1).trim()

const ITEMS = [
  { key: 'a', title: 'First', meta: '41%', figures: 'one', label: 'First: 41 percent' },
  { key: 'b', title: 'Second', meta: '27%', figures: 'two', heading: 'Group B' },
  { key: 'c', title: 'Third', disabled: true },
]
const render = ({ picked = null, view = firstView(picked), ...rest } = {}) =>
  renderToStaticMarkup(
    menuRailMarkup(createElement, {
      label: 'Kinds',
      items: ITEMS,
      onPick() {},
      panel: (k) => createElement('p', null, `panel ${k}`),
      backLabel: 'All kinds',
      picked,
      view,
      ...rest,
    }),
  )
const count = (s, needle) => s.split(needle).length - 1

test('the panel shows the last pick while it folds shut (the shownKey lag)', () => {
  let v = firstView(null)
  assert.equal(v.shownKey, null)
  v = nextView(v, 'FF')
  assert.equal(v.shownKey, 'FF')
  v = nextView(v, null)
  assert.equal(v.picked, null)
  assert.equal(v.shownKey, 'FF') // still FF: the content stays until the fold ends
})

test('every new pick swaps the body a <-> b; a close or the same pick does not', () => {
  let v = nextView(firstView(null), 'FF')
  const g1 = v.gen
  v = nextView(v, 'SL')
  assert.equal(v.gen, g1 + 1)
  assert.notEqual(bodyClass(g1), bodyClass(v.gen))
  assert.equal(nextView(v, 'SL'), v) // the same object: no state write during render
  const shut = nextView(v, null)
  assert.equal(shut.gen, v.gen)
  assert.equal(nextView(shut, 'SL').gen, v.gen + 1) // re-open the same one: it rises again
  assert.deepEqual([bodyClass(0), bodyClass(1)], [`menurail__body ${BODY_A}`, `menurail__body ${BODY_B}`])
})

test('a tap on the picked card closes; a tap on another picks it', () => {
  assert.equal(pickFor('FF', 'FF'), null)
  assert.equal(pickFor('SL', 'FF'), 'SL')
  assert.equal(pickFor('SL', null), 'SL')
})

test('the small helpers: root state, card toggle, inert panel', () => {
  assert.deepEqual(rootProps({ picked: 'a', railMeta: true, className: 'x' }), {
    className: 'menurail menurail--rail menurail--railmeta x',
    'data-state': 'rail',
  })
  assert.equal(cardProps({ key: 'a' }, null).pressed, false)
  assert.equal(cardProps({ key: 'a', className: 'is-x' }, 'a').className, 'menurail__card is-x')
  assert.deepEqual(panelProps(false), { className: 'menurail__panel', inert: true })
  assert.deepEqual(panelProps(true), { className: 'menurail__panel menurail__panel--open', inert: false })
})

test('menu state markup: a labelled group of .btn toggles, all off; the panel shut and inert', () => {
  const html = render()
  assert.match(html, /^<div class="menurail" data-state="menu">/)
  assert.match(html, /<div class="menurail__menu" role="group" aria-label="Kinds">/)
  assert.equal(count(html, 'class="btn menurail__card"'), 3)
  assert.equal(count(html, 'aria-pressed="false"'), 3)
  assert.equal(count(html, 'aria-pressed="true"'), 0)
  assert.match(html, /aria-label="First: 41 percent"/)
  assert.match(html, /<button type="button" class="btn menurail__card" aria-pressed="false" disabled=""/)
  assert.ok(html.indexOf('Group B') < html.indexOf('Second')) // the head comes before its card
  assert.match(html, /<div class="menurail__panel" inert="">/)
  assert.doesNotMatch(html, /menurail__body/) // nothing picked yet: no body
})

test('rail state markup: one card pressed, the panel open, not inert, body b (first pick), Back first', () => {
  const html = render({ picked: 'b', view: nextView(firstView(null), 'b') })
  assert.match(html, /data-state="rail"/)
  assert.match(html, /class="menurail menurail--rail"/)
  assert.equal(count(html, 'aria-pressed="true"'), 1)
  assert.match(html, /<div class="menurail__panel menurail__panel--open">/)
  assert.doesNotMatch(html, /menurail__panel menurail__panel--open" inert/)
  assert.match(html, /class="btn btn--ghost menurail__back"><span class="btn__icon" aria-hidden="true">←<\/span>All kinds<\/button><div class="menurail__body menurail__body--b"><p>panel b<\/p>/)
})

test('closing keeps the last panel while it folds, and the panel goes inert at once', () => {
  const open = nextView(nextView(firstView(null), 'a'), 'b') // gen 2: body a
  const html = render({ picked: null, view: nextView(open, null) })
  assert.match(html, /data-state="menu"/)
  assert.match(html, /<div class="menurail__panel" inert="">/)
  assert.match(html, /<div class="menurail__body menurail__body--a"><p>panel b<\/p>/)
})

test('no panel prop: no panel at all (Splits opens its own sections)', () => {
  assert.doesNotMatch(render({ panel: undefined }), /menurail__panel/)
})

test('MenuRail.jsx renders the builder with the stepped view', () => {
  const jsx = read('components/ui/control/MenuRail.jsx')
  assert.match(jsx, /return menuRailMarkup\(createElement, \{ \.\.\.props, picked, view: next \}\)/)
  assert.match(jsx, /if \(next !== view\) setView\(next\)/)
})

test('menu state CSS: cards share the row from a 150px basis; the pick is mint with a 2px shadow', () => {
  const c = css()
  assert.equal(decl(ruleBody(c, '.menurail'), '--menurail-card'), 'calc(var(--space-2h) * 15)')
  const card = ruleBody(c, '.menurail__card.btn')
  assert.equal(decl(card, 'flex'), '1 1 var(--menurail-card)')
  assert.equal(decl(card, 'border-radius'), '0')
  const pick = ruleBody(c, ".menurail__card.btn[aria-pressed='true']")
  assert.equal(decl(pick, 'background'), 'var(--accent-tint)')
  assert.equal(decl(pick, 'box-shadow'), 'var(--bw-heavy) var(--bw-heavy) 0 var(--border-stamped)')
  assert.equal(decl(ruleBody(c, ".menurail__card.btn[aria-pressed='true']::before"), 'content'), 'none')
  assert.equal(decl(ruleBody(c, '.menurail__fold'), 'grid-template-rows'), '1fr')
  const figs = ruleBody(c, '.menurail__figs')
  assert.equal(decl(figs, 'min-height'), '0')
  assert.equal(decl(figs, 'overflow'), 'hidden')
})

test('rail state CSS: narrow cards, the figures fold to 0fr, the meta hides unless railMeta', () => {
  const c = css()
  assert.equal(decl(ruleBody(c, '.menurail'), '--menurail-rail'), 'calc(var(--tap-min) * 3)')
  assert.equal(decl(ruleBody(c, '.menurail--rail .menurail__card.btn'), 'flex'), '0 0 var(--menurail-rail)')
  assert.equal(decl(ruleBody(c, '.menurail--rail .menurail__fold'), 'grid-template-rows'), '0fr')
  assert.equal(decl(ruleBody(c, '.menurail--rail:not(.menurail--railmeta) .menurail__meta'), 'display'), 'none')
  assert.equal(decl(ruleBody(c, '.menurail--rail .menurail__head'), 'max-height'), '0')
})

test('panel CSS: 0fr and hidden when shut, 1fr and visible when open', () => {
  const c = css()
  assert.equal(decl(ruleBody(c, '.menurail__panel'), 'grid-template-rows'), '0fr')
  assert.equal(decl(ruleBody(c, '.menurail__panel--open'), 'grid-template-rows'), '1fr')
  assert.equal(decl(ruleBody(c, '.menurail__panelin'), 'visibility'), 'hidden')
  assert.equal(decl(ruleBody(c, '.menurail__panel--open .menurail__panelin'), 'visibility'), 'visible')
})

test('index.css loads the sheet, and not between button.css and 07', () => {
  const imports = [...read('index.css').matchAll(/@import '\.\/styles\/([^']+)'/g)].map((m) => m[1])
  assert.ok(imports.indexOf('system/menurail/menurail.css') > -1)
  assert.equal(imports[imports.indexOf('system/button.css') + 1], '07-team-logo-and-buttons.css')
})
```

If a markup regex fails only on attribute ORDER (React writes props in the order the
builder passes them), fix the regex to the order the builder writes, not the builder.

## Verify

- `node --test test/menurail.test.js` and `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- Nothing on a live route uses `MenuRail` yet (05c adds the lab entries; 09, 11, 16, 17
  adopt it). To see it now, mount it for a minute in `/design-lab` locally with invented
  items, check the two states at 390px and 1180px with `?nointro`, then remove the
  scratch mount. Check: cards wrap three to a row at 390px; tap one, the rest go narrow,
  the picked card is mint with the shadow, the panel opens; tap it again, all return; Tab
  never lands inside a shut panel. Send Gary the screenshot with `SendUserFile` and say it
  is a local scratch mount on `/design-lab?nointro`.

## Out of scope

- Any transition, the rise keyframes (05b).
- The lab entries (05c).
- Any module (09, 11, 16, 17). Do not touch `arsenal/`, `splits/`, `plate/`, `contact/`.
- `Button.jsx`, `button.css` (slice 02 owns the press).

## Stop if

- `src/styles/system/menurail/` already exists with other files in it.
- `buttonClassName` or `buttonAria` (`src/lib/design/buttonClass.js`) changed signature, or
  `Button.jsx` writes markup the builder does not match (a new attribute or wrapper).
- `renderToStaticMarkup` writes the inert panel as something other than `inert=""` (then
  report what it writes; do not drop the attribute).
- `.btn[aria-pressed='true']` gains specificity above 0,2,0, or `.btn` stops reading
  `--btn-fill` / `--btn-fill-hover`.
- `check-contrast.mjs` or `check-typography.mjs` fails on a value above and no token fits.
- A test above passes BEFORE you write the code.
