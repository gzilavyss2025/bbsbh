# 09 — Splits: the pitcher's menu onto MenuRail

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 05a and 05b merged (`MenuRail` and its motion) and 08b merged (08a's `Part` and 08b's
  Game lines on `Part`; same module folder).
- Parallel with: 10, 11, 13, 16, 17, 20. Not with 08a or 08b.

## Goal

A pitcher's Splits card opens on a menu of its parts. Today that menu is a
hand-made row of buttons that jumps to a rail (`display: none` on the previews).
Move it onto the shared `MenuRail`, so it shrinks to a rail and opens its panel
with the same motion as Arsenal, Plate approach and Contact. A batter's card does
not change.

## Done means

- A pitcher sees the `MenuRail` menu: By handedness, Situational, Splits vs team
  (when the vs-team shard has data), Game lines (when there are game lines), All
  four. Each card shows its title, then its preview and its hint as `figures`.
- A tap on a card picks it: the cards shrink to the rail, the previews fold away,
  and the panel opens with that part (or every part for All four). A tap on the
  picked card goes back to the menu.
- Inside the panel, a part does not rise a second time: the panel rises
  (`MenuRail`), and only the part's bars grow, the first time it comes into view.
- The batter's card shows the four parts as before, with 08a's rise.
- The old menu CSS is gone; `MenuRail` has no API change.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files

1. `src/screens/player/next/modules/splits/index.jsx` — the menu becomes
   `MenuRail`; the parts become a `cards(pick)` render function.
2. `src/screens/player/next/modules/splits/splitsView.js` — new pure
   `splitsMenu(...)` (moves the menu data out of the JSX so a test can read it).
3. `src/styles/player-next/both/splits.css` — delete the menu rules; add the
   in-panel part rules.
4. `test/player-splits-menurail.test.js` — new.

Four files. No lab entry: the motion is `MenuRail`'s, and slice 05c adds its entry.

## Canvas

Board `PitcherSplits` (the menu, the rail and the per-section open):

```css
.sp-menu{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}
.sp-mc{flex:1 1 200px;...;transition:flex-basis .45s cubic-bezier(.23,1,.32,1),padding .45s cubic-bezier(.23,1,.32,1),background .2s,color .2s,transform .12s ease-out}
.sp-mc:active{transform:scale(.98)}
.sp-mc[aria-pressed="true"]{background:#1B2A3A;color:#FBF6E9}
.sp-mx{display:grid;grid-template-rows:1fr;transition:grid-template-rows .45s cubic-bezier(.23,1,.32,1)}
.sp-mx>span{display:block;min-height:0;overflow:hidden}
.sp-rail .sp-mc{flex:0 0 150px;padding:6px 14px;justify-content:center}
.sp-rail .sp-mx{grid-template-rows:0fr}
.cw{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s cubic-bezier(.23,1,.32,1)}
.cw.on{grid-template-rows:1fr}
```

```html
<button type="button" class="sp-mc" aria-pressed="{{m.pressed}}" onClick="{{m.pick}}"><span class="sp-mt cap">{{m.title}}</span><span class="sp-mx"><span><span class="sp-mp mono">{{m.pv}}</span><span class="sp-mh">{{m.hint}}</span></span></span></button>
```

State (board JS): `pick: () => this.setState({ fcs: S.fcs === id ? '' : id })`;
`open = (id) => S.fcs === id || S.fcs === 'all'`.

How this maps to `MenuRail` (`spec.md`, "The two new parts"):

| Canvas | `MenuRail` |
|---|---|
| `.sp-mc` card, `.sp-mt` title | an item, `title` |
| `.sp-mx` (preview + hint), folds to `0fr` in the rail | `figures` (the part's figures wrapper folds to `0fr`) |
| `fcs` (`''` or a key), tap again to clear | `picked` (`null` or a key), `onPick(null)` on a second tap |
| `.cw` per section, `0fr` ↔ `1fr` over .45s | the one `.menurail__panel`, `0fr` ↔ `1fr` over `--dur-unfold` |
| `.sp-mc:active` scale(.98), hover `#EDE6D1` | `MenuRail`'s own press and hover (slices 05a, 05b) |
| picked card ink fill `#1B2A3A` | `MenuRail`'s picked look, `--accent-tint` and the offset shadow |

**Decision (this slice): the section open is the `MenuRail` panel, not a per-part
`.cw` wrapper.** The board opens each section in its own `.cw` grid. `MenuRail`
has one panel that renders `panel(key)`; for `all` that is every part. So slice 08
does not build `.cw`, and this slice builds nothing beyond `MenuRail`. The picked
card takes the shared mint look, not the board's ink: one shared part, one look
(decision 5).

**API extension: none needed.** Every field the live menu shows has a place:
`title`, and `figures` for the preview and the hint. `meta` and `mark` stay unset.

## Live today

`index.jsx:28` — `const [focus, setFocus] = useState('')`.

`index.jsx:78-88`:

```jsx
  const show = (id) => !pitching || focus === id || focus === 'all'
  const hand = tables?.hand
  const sit = tables?.sit
  const sitOps = (code) => sit?.groups.flatMap((g) => g.rows).find((r) => r.key === code)?.ops ?? '—'
  const menu = [
    ['h', 'By handedness', hand && `${hand.rows[0].label} ${hand.rows[0].ops} · ${hand.rows[1].label} ${hand.rows[1].ops}`, 'OPS against'],
    ['s', 'Situational', sit && `Empty ${sitOps('r0')} · RISP ${sitOps('risp')}`, 'OPS against'],
    vs.data && ['v', 'Splits vs team', 'Every club, career', 'Career ERA'],
    glView && ['g', 'Game lines', `Home ${doorFigure(glView, 'home', group)} · Road ${doorFigure(glView, 'road', group)}`, 'Career ERA'],
    ['all', 'All four', 'Scroll through everything', 'Every section open'],
  ].filter(Boolean)
```

`index.jsx:125-137` — the hand-made menu:

```jsx
      {pitching && (
        <div className={`splitsmod__menu${focus ? ' is-rail' : ''}`} role="group" aria-label="Splits sections">
          {menu.map(([id, title, preview, hint]) => (
            <button key={id} type="button" className="splitsmod__mc" aria-pressed={focus === id} onClick={() => setFocus(focus === id ? '' : id)}>
              <span className="splitsmod__mt">{title}</span>
              <span className="splitsmod__mx">
                <span className="splitsmod__mp">{preview}</span>
                <span className="splitsmod__mh">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
```

`index.jsx:139-176` — `<div className="splitsmod__cards" aria-busy={splits.loading}>`
with `show('h')`, `show('s')`, `show('v') && vs.data`, `show('g') && glView`
guards. After 08a, the first two are `<Part once={`${once}:h`} label="By handedness">`
and `<Part once={`${once}:s`} label="Situational">`.

`splits.css:128-189` — the menu block. The rail hides the previews at `:187-189`:

```css
.splitsmod__menu.is-rail .splitsmod__mx {
  display: none;
}
```

Every rule in it is `.splitsmod__menu`, `.splitsmod__mc`, `.splitsmod__mt`,
`.splitsmod__mp`, `.splitsmod__mh` or their `[aria-pressed='true']` /
`.is-rail` forms. `.splitsmod__menu` and `.splitsmod__mc` carry
`/* layout-exempt: ... */`, so deleting them does not move the layout ratchet. No
other file names these classes (`grep -rn 'splitsmod__m[ctxph]\|splitsmod__menu'`
finds only `index.jsx` and `splits.css`).

## Build

### 1. `splitsView.js`

Add after `doorFigure` (line 265):

```js
// The pitcher's menu of the parts (board PitcherSplits, .sp-mc): a key, a title, a preview of the
// figures and a hint of what they are. A part with no data has no card; 'all' opens every part.
export function splitsMenu({ hand, sit, vs, glView, group }) {
  const sitOps = (code) => sit?.groups.flatMap((g) => g.rows).find((r) => r.key === code)?.ops ?? '—'
  return [
    { key: 'h', title: 'By handedness', preview: hand ? `${hand.rows[0].label} ${hand.rows[0].ops} · ${hand.rows[1].label} ${hand.rows[1].ops}` : null, hint: 'OPS against' },
    { key: 's', title: 'Situational', preview: sit ? `Empty ${sitOps('r0')} · RISP ${sitOps('risp')}` : null, hint: 'OPS against' },
    vs && { key: 'v', title: 'Splits vs team', preview: 'Every club, career', hint: 'Career ERA' },
    glView && { key: 'g', title: 'Game lines', preview: `Home ${doorFigure(glView, 'home', group)} · Road ${doorFigure(glView, 'road', group)}`, hint: 'Career ERA' },
    { key: 'all', title: 'All four', preview: 'Scroll through everything', hint: 'Every section open' },
  ].filter(Boolean)
}
```

### 2. `index.jsx`

- Import `MenuRail` (`../../../../../components/ui/control/MenuRail.jsx`) and
  `splitsMenu`; drop `doorFigure` from the `splitsView.js` import if nothing else
  in the file reads it.
- `const [focus, setFocus] = useState(null)` (line 28).
- Delete `show` (78), `sitOps` (81) and the `menu` array (82-88). Keep `hand` and `sit`.
- Build the items and the parts:

```jsx
  const menu = splitsMenu({ hand, sit, vs: Boolean(vs.data), glView, group }).map(({ key, title, preview, hint }) => ({
    key,
    title,
    figures: (
      <>
        <span className="splitsmod__mp">{preview}</span>
        <span className="splitsmod__mh">{hint}</span>
      </>
    ),
  }))
  // The parts. A batter sees all of them; a pitcher sees the ones he picks, in the MenuRail panel.
  const cards = (pick) => (
    <div className="splitsmod__cards" aria-busy={splits.loading}>
      {(pick === 'h' || pick === 'all') && (
        <Part once={`${once}:h`} label="By handedness">
          …the By handedness body, unchanged…
        </Part>
      )}
      {(pick === 's' || pick === 'all') && (
        <Part once={`${once}:s`} label="Situational">
          …the Situational body, unchanged…
        </Part>
      )}
      {(pick === 'v' || pick === 'all') && vs.data && <VsTeam … />}
      {(pick === 'g' || pick === 'all') && glView && <GameLines … />}
    </div>
  )
```

- Replace the menu (125-137) and the cards (139-176) with:

```jsx
      {pitching ? (
        <MenuRail label="Splits sections" items={menu} picked={focus} onPick={setFocus} panel={cards} />
      ) : (
        cards('all')
      )}
```

Keep the `Part` lines exactly as 08a wrote them: `test/player-splits-motion.test.js`
matches `<Part once={`${once}:h`}`.

### 3. `splits.css`

Delete the menu block, `splits.css:128-189`, except the two text rules for the
figures. Keep them, and drop the `[aria-pressed='true']` rule for them (a picked
card is in the rail, where the figures are folded away):

```css
/* ---- the pitcher's menu: the figures of a MenuRail card ---- */
.splitsmod__mp {
  display: block;
  margin-top: var(--space-2);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-label);
}
.splitsmod__mh {
  display: block;
  margin-top: var(--space-1);
  color: var(--text-caption);
  font-size: var(--fs-cell);
}
```

Add after 08a's entrance block (before "the rows"):

```css
/* ---- a part inside the pitcher's MenuRail panel ----
   The panel rises on each pick (MenuRail), so a part in it does not rise a second time: it shows
   at once and only its bars grow. Until the part is in view its fills hide, so a bar never shows
   full and then drops to the start of its grow. */
.menurail__panel .splitsmod__part.is-pre {
  opacity: 1;
}
.menurail__panel .splitsmod__part.is-pre .splitsmod__fill {
  visibility: hidden;
}
.menurail__panel .splitsmod__part.is-in {
  animation: none;
}
```

These win over 08a's `.splitsmod__part.is-pre` and `.splitsmod__part.is-in` on
specificity (three classes against two), not on order. The grow rule
`.splitsmod__part.is-in .splitsmod__fill` still applies inside the panel.

A closed panel is `0fr` with its inner box clipped, so a part in it is not
intersecting, and it stays `is-pre` until the panel opens. That is what makes the
grow start as the panel opens.

### Guards

- `check-layout-ratchet.mjs`: the deleted `display: flex` / `flex-wrap` /
  `flex-direction: column` rules are all `layout-exempt`, so no count changes. The
  new rules add no layout.
- `check-raw-values.mjs`, `check-typography.mjs`: the kept rules read tokens.
- `check-file-size.mjs`: `splits.css` goes down by about 30 lines net.
- `check-dead-exports.mjs`: `splitsMenu` is used by `index.jsx` and the test.

## Test first

New file `test/player-splits-menurail.test.js`. Run it before the change and see
it fail (the import of `splitsMenu` fails first).

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'
import { splitsMenu } from '../src/screens/player/next/modules/splits/splitsView.js'

// The pitcher's Splits menu on MenuRail (#2073, slice 09).
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const hand = { rows: [{ label: 'vs LHB', ops: '.702' }, { label: 'vs RHB', ops: '.655' }] }
const sit = { groups: [{ family: 'base', rows: [{ key: 'r0', ops: '.640' }, { key: 'risp', ops: '.711' }] }] }
const glView = { sections: [{ items: [{ key: 'home', era: '3.10' }, { key: 'road', era: '4.25' }] }] }

test('splitsMenu: every part with data, then All four', () => {
  const m = splitsMenu({ hand, sit, vs: true, glView, group: 'pitching' })
  assert.deepEqual(m.map((x) => x.key), ['h', 's', 'v', 'g', 'all'])
  assert.equal(m[0].preview, 'vs LHB .702 · vs RHB .655')
  assert.equal(m[1].preview, 'Empty .640 · RISP .711')
  assert.equal(m[3].preview, 'Home 3.10 · Road 4.25')
  assert.deepEqual(m.map((x) => x.hint), ['OPS against', 'OPS against', 'Career ERA', 'Career ERA', 'Every section open'])
})

test('splitsMenu: no vs-team shard and no game lines, no card for them', () => {
  assert.deepEqual(splitsMenu({ hand, sit, vs: false, glView: null, group: 'pitching' }).map((x) => x.key), ['h', 's', 'all'])
})

test('splitsMenu: a part still loading has a card with no preview', () => {
  const m = splitsMenu({ hand: undefined, sit: undefined, vs: false, glView: null, group: 'pitching' })
  assert.equal(m[0].preview, null)
  assert.equal(m[1].preview, null)
})

test('the module uses MenuRail for a pitcher, and the hand-made menu is gone', () => {
  const index = read('src/screens/player/next/modules/splits/index.jsx')
  assert.match(index, /<MenuRail label="Splits sections" items=\{menu\} picked=\{focus\} onPick=\{setFocus\} panel=\{cards\} \/>/)
  assert.match(index, /cards\('all'\)/)
  assert.doesNotMatch(index, /splitsmod__mc|splitsmod__menu/)
})

test('splits.css: the old menu rules are gone, the figure text stays', () => {
  const css = stripComments(read('src/styles/player-next/both/splits.css'))
  assert.doesNotMatch(css, /\.splitsmod__(menu|mc|mt|mx)\b/)
  assert.ok(ruleBody(css, '.splitsmod__mp'))
  assert.ok(ruleBody(css, '.splitsmod__mh'))
})

test('splits.css: inside the panel a part does not rise again, and its bars still grow', () => {
  const css = stripComments(read('src/styles/player-next/both/splits.css'))
  assert.match(ruleBody(css, '.menurail__panel .splitsmod__part.is-pre'), /opacity:\s*1/)
  assert.match(ruleBody(css, '.menurail__panel .splitsmod__part.is-pre .splitsmod__fill'), /visibility:\s*hidden/)
  assert.match(ruleBody(css, '.menurail__panel .splitsmod__part.is-in'), /animation:\s*none/)
  assert.ok(ruleBody(css, '.splitsmod__part.is-in .splitsmod__fill'), '08a grow rule still there')
})
```

## Verify

1. `node --test test/player-splits-menurail.test.js` and `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
2. `npm run dev`, pitcher `/player/robert-gasser-688107?nointro`, at 390px and at
   1180px. The Splits card opens on the menu. Tap "By handedness": the cards
   shrink to the rail, the previews fold, the panel opens and its bars grow. Tap
   "Situational": the panel rises with the new part. Tap "Situational" again: back
   to the menu. Tap "All four": every part, and the lower ones grow as you scroll.
3. Tab through the menu with the keyboard: each card takes focus with the house
   ring; Enter picks; the panel content follows in the tab order.
4. Batter `/player/brice-turang-668930?nointro`: no menu; the parts show and rise
   as in 08a.
5. Load once with Playwright `reducedMotion: 'reduce'`: picks switch at once.
6. Send Gary a frame strip of a pick (`SendUserFile`) with the route.

## Out of scope

- Any change to `MenuRail` itself (slices 05a, 05b). If it needs one, stop (below).
- The batter's card layout.
- A hint line under the menu ("Pick a section to open it."): the board has one,
  the live card does not. Not added here.

## Stop if

- 05a or 05b is not merged, or `MenuRail`'s props differ from the API in
  `05a-menurail-part.md` ("The API": `label`, `items` with `key`/`title`/`meta`/
  `figures`/`mark`, `picked`, `onPick`, an optional `panel`, `backLabel`, `railMeta`,
  `className`). This slice uses `label`, `items` (`key`, `title`, `figures`),
  `picked`, `onPick` and `panel`.
- The panel wrapper is not `.menurail__panel` (the in-panel rules key on it), or
  a closed panel is not clipped (a part in it would count as in view).
- `MenuRail` does not call `panel(key)` for the picked key, or cannot show a
  `figures` node with two spans.
- 08a or 08b is not merged (`Part` is missing, or Game lines is not on `Part`).
- The quoted code at `index.jsx:78-88` or `:125-137` differs from this brief.
