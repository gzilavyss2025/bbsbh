# 17b — Contact: the batted-ball menu onto MenuRail

The second half of slice 17 (`spec.md`). 17a did the dot entrance.

## Run

- Model: `claude-sonnet-5-5`. Effort: medium (a swap onto a finished part, like 09).
- Depends on: 05 merged (`MenuRail`), 17a merged (the `gen` counter and `pick`).
- Parallel with: any slice that does not touch the Contact files below.

## Goal

The ball-type picker of the Contact card becomes the shared `MenuRail`: a menu of
ball-type cards that folds to a rail when you pick one, with that type's averages in the
panel below. A pick still shows only that type on the spray field, and replays the dot
drop from 17a. Every number the card shows today stays.

## Done means

- The "Highlight one kind of ball" chip row under the field is gone.
- Under "How contact ends", `BattedBallMix` stays, and a `MenuRail` follows it: one
  card per ball type with balls (title, ball count, hit and out share).
- A tap on a card filters the field to that type, folds the menu to a rail, opens the
  panel with the six averages (the `FactGrid` of today), and replays the dot drop.
- A second tap on the picked card, or "All batted balls", closes the panel and shows
  all types again.
- Keyboard: Tab reaches each card; Enter or Space picks; the panel follows in the DOM.
- `npm run lint`, `npm test`, `npm run build` pass.

## Files

1. `src/screens/player/next/modules/contact/ContactModule.jsx` — remove the chip row,
   add `MenuRail`, move the `FactGrid` into a `TypeFacts` panel.
2. `src/screens/player/next/modules/contact/contactView.js` (96 lines) — `menuRows(mix)`.
3. `src/styles/player-next/batter/contact.css` — the card swatch and figure line.
4. `test/player-next-contact.test.js` (92 lines) — `menuRows` cases.
5. `test/player-next-contact-motion.test.js` (17a) — the wiring cases.

## Canvas

Board `Contact.dc.html`, card "How contact ends". The menu is the same shape as every
other `MenuRail` source (spec.md lists `.tc-mc`/`.tc-mx`/`.tc-pn`):

```css
.tc-mc{flex:1 1 150px; … transition:flex-basis 380ms cubic-bezier(.2,.9,.3,1),padding 380ms …,background 200ms,box-shadow 120ms}
.tc-mc[aria-pressed="true"]{background:#86BE98;box-shadow:2px 2px 0 #0F1822}
.tc-rail .tc-mc{flex:0 0 112px;padding:6px 12px}
.tc-mx,.tc-pn{display:grid;grid-template-rows:1fr;transition:grid-template-rows 340ms cubic-bezier(.2,.9,.3,1)}
.tc-rail .tc-mx{grid-template-rows:0fr}
.tc-ff1,.tc-ff2{animation:tc-fa 380ms cubic-bezier(.2,.9,.3,1) backwards}
```

`MenuRail` (slice 05) already draws all of this. This slice writes none of it.

A card on the canvas shows the name, a share (`.tc-ms`), and under it (`.tc-mx`, the
part that folds away) a result bar and "NN% hits / NN% outs". The panel holds a
"← All batted balls" button and the averages:

```html
<button class="tc-chip" type="button" onClick="{{backAll}}">&larr; All batted balls</button>
… Avg exit velo · Hard hit · Barrel … Avg launch angle · Avg distance · Avg xBA
```

A pick on the canvas filters the field and bumps `gen`, so the dots drop again:

```js
pick: () => this.halt({ grp: st.grp === g[0] ? '' : g[0], view: 'all', hl: '', fgen: st.fgen + 1 })
```

The canvas also forces `view: 'all'` on a pick. **The live card keeps its view.** Today a
type pick keeps the view (`pick(setType, …)` at l.118), and this slice does not change
what the card shows.

The canvas groups "By direction" (Pull, Center, Oppo) have no live data group. Out of
scope.

## Live today

`src/screens/player/next/modules/contact/ContactModule.jsx` (line numbers before 17a;
17a adds about 12 lines above them):

```jsx
75	  const row = mix?.find((r) => r.key === type)
76	  const pick = (set, v) => { set(v); setSel(null) }
…
116	          <div className="fcontact__chips" role="group" aria-label="Highlight one kind of ball">
117	            {mix?.map((r) => (
118	              <Pill key={r.key} role="control" fill="paper" pressed={r.key === type} disabled={!r.n} onClick={() => pick(setType, r.key === type ? null : r.key)}>
119	                {r.name} {r.n}
120	              </Pill>
121	            ))}
122	          </div>
…
145	      {mix && (
146	        <>
147	          <SectionHead look="rule" as="h3" note={`${mix.reduce((t, r) => t + r.n, 0)} balls with a launch angle`}>How contact ends</SectionHead>
148	          <BattedBallMix battedBall={{ rows: mix }} />
149	          {row && (
150	            <FactGrid className="fcontact__facts">
151	              {[
152	                ['Avg exit velo', one(row.ev, ' mph')],
153	                ['Hard hit', pct(row.hard)],
154	                ['Barrels', row.barrel],
155	                ['Avg launch angle', one(row.la, '°')],
156	                ['Avg distance', one(row.dist, ' ft')],
157	                ['Avg xBA', row.xba == null ? '—' : rate3(row.xba)],
158	              ].map(([k, v]) => (
159	                <div className="fact" key={k}><dt className="fact__label">{k}</dt><dd className="fact__value">{v}</dd></div>
160	              ))}
161	            </FactGrid>
162	          )}
163	          <p className="fcontact__note">
164	            Share is of balls with a launch angle. The right-hand figure is his average on those balls (hits over balls in play).
165	            Hard is 95 mph or more. Pick a ball type above to see its averages.
166	          </p>
```

`mixRows` (`contactView.js` l.59-79) returns, per type: `key`, `name`, `n`, `share`,
`avg` (hits over balls), `ev`, `hard`, `barrel`, `la`, `dist`, `xba`. `BattedBallMix`
(`src/components/charts/BattedBallMix.jsx`) prints every row's name, share and `avg`,
zero rows included.

### Which chip group goes where

| Live group | Lines | After this slice |
|---|---|---|
| "Which balls" (Home runs / Hits / All balls) | l.80-86 | Not this slice. An in-card toggle: slice 04 (`Segmented`), or `Pill` as today. |
| "Color by" (Result / Ball type) | l.87-91 | Not this slice. Same as above. |
| "Highlight one kind of ball" (ball types) | l.116-122 | **Removed.** `MenuRail` under "How contact ends" carries the pick. |
| The type `FactGrid` | l.149-162 | **Moves** into the `MenuRail` panel (`TypeFacts`). |
| `BattedBallMix` | l.148 | Stays, unchanged. It keeps the zero rows' share and the `avg` of every type. |

### Every number, before and after

| Today | After |
|---|---|
| chip "Ground ball 34" (name, `n`) | card title + meta "34 balls" |
| a chip for a type with 0 balls (disabled) | no card; `BattedBallMix` still lists it with its share |
| `BattedBallMix` share and `avg` | unchanged |
| the six averages of the picked type | the panel, same labels, same formats |
| — | card figures "NN% hits · NN% outs" (new, from `avg`; the canvas line) |

## Build

### 1. `contactView.js`: the menu rows

Add at the end of the file:

```js
// The ball-type menu (MenuRail) of the card: one row per type that has a ball, in the
// mixRows order. `hits` and `outs` are the canvas's "NN% hits / NN% outs" line, from `avg`.
// A type with no ball has nothing to pick, so it has no card (BattedBallMix still lists it).
export function menuRows(mix) {
  const pc = (x) => (x == null ? DASH : `${Math.round(x * 100)}%`)
  return (mix ?? [])
    .filter((r) => r.n > 0)
    .map((r) => ({
      key: r.key,
      title: r.name,
      meta: `${r.n} ${r.n === 1 ? 'ball' : 'balls'}`,
      hits: pc(r.avg),
      outs: pc(r.avg == null ? null : 1 - r.avg),
    }))
}
```

### 2. `ContactModule.jsx`

Imports: add `MenuRail` (path from spec.md) and `menuRows`:

```jsx
import { MenuRail } from '../../../../../components/ui/control/MenuRail.jsx'
import { COLORS, VIEWS, ballDetail, contactBalls, contactView, firstView, markKey, menuRows, mixRows, pickBalls } from './contactView.js'
```

Delete `const row = …` (l.75). Delete the chip row l.116-122. Replace l.148-166 with:

```jsx
          <BattedBallMix battedBall={{ rows: mix }} />
          <MenuRail
            label="Batted ball type"
            items={menuRows(mix).map((r) => ({
              key: r.key,
              title: r.title,
              meta: r.meta,
              mark: (
                <svg className="fcontact__swatch" viewBox="0 0 16 16" aria-hidden="true">
                  <circle className={`fcontact__dot--${r.key}`} cx="8" cy="8" r="6" />
                </svg>
              ),
              figures: <span className="fcontact__mfig">{r.hits} hits · {r.outs} outs</span>,
            }))}
            picked={type}
            onPick={(k) => pick(setType, k)}
            panel={(k) => <TypeFacts row={mix.find((r) => r.key === k)} />}
            backLabel="All batted balls"
          />
          <p className="fcontact__note">
            Share is of balls with a launch angle. The right-hand figure is his average on those balls (hits over balls in play).
            Hard is 95 mph or more. Pick a ball type to see its averages and to show only those balls on the field.
          </p>
```

`pick` is the 17a version: `set(v); setSel(null); setGen((g) => g + 1)`. `MenuRail` calls
`onPick(null)` when the picked card is tapped again or "All batted balls" is pressed, so
`setType(null)` shows all types and the drop replays (the canvas `halt` does the same).

Add the panel at the end of the file, below the default export. It is the old
`FactGrid`, unchanged:

```jsx
// The averages of one ball type: the MenuRail panel.
function TypeFacts({ row }) {
  if (!row) return null
  return (
    <FactGrid className="fcontact__facts">
      {[
        ['Avg exit velo', one(row.ev, ' mph')],
        ['Hard hit', pct(row.hard)],
        ['Barrels', row.barrel],
        ['Avg launch angle', one(row.la, '°')],
        ['Avg distance', one(row.dist, ' ft')],
        ['Avg xBA', row.xba == null ? '—' : rate3(row.xba)],
      ].map(([k, v]) => (
        <div className="fact" key={k}><dt className="fact__label">{k}</dt><dd className="fact__value">{v}</dd></div>
      ))}
    </FactGrid>
  )
}
```

`Pill` stays imported only if the view or colour chips still use it.

### 3. `contact.css`

Add after `.fcontact__facts` (l.120-122):

```css
/* The ball-type menu (MenuRail): a colour swatch and the hits / outs line on each card. */
.fcontact__swatch {
  display: block;
  width: var(--space-4);
  height: var(--space-4);
}
.fcontact__mfig {
  color: var(--text-caption);
  font-family: var(--font-mono);
  font-size: var(--fs-small);
}
```

The swatch reads the fill rules `.fcontact__dot--ground` … `--pop` (l.60-63), so the
colour stays one rule. `.fcontact__facts` has `margin-top: var(--space-3)`; in the panel
that is fine. `.fcontact__chips` (l.17-22) is still used by the view and colour rows;
keep it.

## Test first

Run each case before the change: each fails.

In `test/player-next-contact.test.js`, add `menuRows` to the import and:

```js
test('menuRows: one card per type with a ball, count and the hits / outs share', () => {
  const mix = mixRows([
    ...MANY(3, { launchAngle: 5, result: 'single' }),
    ball({ launchAngle: 5 }),
    ...MANY(2, { launchAngle: 30, result: 'out' }),
  ])
  assert.deepEqual(menuRows(mix), [
    { key: 'ground', title: 'Ground ball', meta: '4 balls', hits: '75%', outs: '25%' },
    { key: 'fly', title: 'Fly ball', meta: '2 balls', hits: '0%', outs: '100%' },
  ])
})

test('menuRows: one ball says "ball"; no mix gives no cards', () => {
  assert.equal(menuRows(mixRows([ball({ launchAngle: 60 })]))[0].meta, '1 ball')
  assert.deepEqual(menuRows(null), [])
})
```

(`ball` and `MANY` are the helpers at l.10-13 of that file. Check that `mixRows` keeps the
`TYPES` order: ground, line, fly, pop.)

In `test/player-next-contact-motion.test.js` (from 17a), add:

```js
test('the ball-type pick is a MenuRail; the six averages are its panel', () => {
  assert.match(JSX, /import \{ MenuRail \} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/components\/ui\/control\/MenuRail\.jsx'/)
  assert.match(JSX, /<MenuRail\s+label="Batted ball type"/)
  assert.match(JSX, /backLabel="All batted balls"/)
  assert.match(JSX, /onPick=\{\(k\) => pick\(setType, k\)\}/)
  assert.doesNotMatch(JSX, /Highlight one kind of ball/)
  for (const k of ['Avg exit velo', 'Hard hit', 'Barrels', 'Avg launch angle', 'Avg distance', 'Avg xBA']) {
    assert.ok(JSX.includes(`'${k}'`), k)
  }
  assert.match(JSX, /<BattedBallMix battedBall=\{\{ rows: mix \}\} \/>/)
})
```

## Verify

- `node --test test/player-next-contact.test.js test/player-next-contact-motion.test.js`,
  then `npm run lint`, `npm test`, `npm run build`.
- Chromium at 390px and 1180px: `/player/brice-turang-668930?nointro`. Pick "Fly ball":
  the menu folds to a rail, the panel opens with six averages, the field shows only fly
  balls and the dots drop in again. Tap "Fly ball" again: all types come back. Tab
  through the cards with the keyboard.
- Reduced motion (Playwright `reducedMotion: 'reduce'`): the rail and panel switch at
  once.
- Send Gary a screenshot of the menu state and the rail state, with the route.

## Out of scope

- The direction groups (Pull, Center, Oppo) and the spray wedge.
- The canvas result bar on each card (`.tc-seg`): a new chart. The hits / outs line
  carries the same split.
- The canvas `view: 'all'` on a pick.
- Any change inside `MenuRail` itself (slice 05).

## Stop if

- `MenuRail` is not on `main`, or its props differ from spec.md (`label`, `items`,
  `picked`, `onPick`, `panel`, `backLabel`).
- `MenuRail` has no slot for the `mark` or `figures` you need, or it draws its own
  share and count (then this slice would print them twice).
- 17a is not merged (no `gen`, no 17a `pick`).
- `mixRows` no longer returns `n` and `avg`.
