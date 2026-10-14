# Slice 11: Arsenal menu and panel onto MenuRail; replay on pick; ghost fade

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 05a and 05b merged (`MenuRail` and its motion), and so 01a merged
  (`--dur-unfold`, `--ease-unfold`).
- Parallel with: 06, 08, 10, 16, 17, 20. Not with 12 to 15: they edit the same
  `modules/arsenal/` folder and `arsenal.css`, in the order 11, 12a, 12b, 12c, 13,
  14, 15 (spec.md, "Shared files").

## Goal

The Pitch arsenal card's pitch menu and its Detail panel use the shared `MenuRail`
part. A pick, a second tap on the picked card and "All pitches" replay the side
view, as the canvas does. Under a pick, the other paths fade in as ghosts at 0.22
opacity over 400ms.

## Done means

- The arsenal menu is a `MenuRail`. Its rail state folds the figures with the
  `grid-template-rows` transition, not `display: none`.
- The Detail panel is MenuRail's always-mounted panel, not `{one && <Detail>}`.
- The old "← All pitches" button in `.arsenal__bar` is gone. MenuRail's
  `backLabel` button replaces it.
- Each pick and each un-pick bumps `run`, so the side view draws in again.
- A ghost path fades in from 0 to 0.22 over `--dur-unfold`, starting at
  `calc(var(--dur-unfold) * 0.75)` (300ms). A ghost path does not draw in.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR. The new test fails before the change.

## Files

1. `src/screens/player/next/modules/arsenal/ArsenalCard.jsx`: the menu and the
   Detail move onto `MenuRail`; `pick` bumps `run`; the back button in the bar goes.
2. `src/screens/player/next/modules/arsenal/FlightScene.jsx`: the faint `<g>`
   takes the class `arsenal__path--ghost` instead of `opacity={0.25}`.
3. `src/styles/player-next/pitcher/arsenal.css`: delete the old menu rules; add
   the ghost rule and its keyframes.
4. `test/arsenal-motion.test.js` (new): the source and sheet assertions below.

Do not touch `FlightCard.jsx` (slices 13 to 15 own it).

## Canvas

ArsenalReveal board, `<style>`:

```css
.ar-menu{display:flex;flex-wrap:wrap;gap:8px}
.ar-mc{... flex:1 1 150px; ... transition:flex-basis .4s cubic-bezier(.23,1,.32,1),padding .4s cubic-bezier(.23,1,.32,1),background .2s,box-shadow .12s}
.ar-mc[aria-pressed="true"]{background:#86BE98;box-shadow:2px 2px 0 #0F1822}
.ar-mx,.ar-pn{display:grid;grid-template-rows:1fr;transition:grid-template-rows .4s cubic-bezier(.23,1,.32,1)}
.ar-rail .ar-mc{flex:0 0 auto;padding:4px 10px;min-height:44px;justify-content:center}
.ar-rail .ar-mx{grid-template-rows:0fr}
.ar-pn{grid-template-rows:0fr}  .ar-pn.ar-on{grid-template-rows:1fr}
.ar-ff1,.ar-ff2{animation:ar-fa .38s cubic-bezier(.23,1,.32,1) backwards}
```

All of that is MenuRail's job now (slices 05a and 05b). This slice only feeds it.

The card in menu state, canvas markup: a head row (glyph, name, mph on the right),
then the folding figures (`.ar-mx`: drop sparkline, flight time, usage %). Back
button text: `&larr; All pitches`.

Canvas script, pick and back both replay the timeline:

```js
pick: () => { this.setState({ solo: solo === i ? null : i, fgen: (st.fgen || 0) + 1 }); setTimeout(() => this.play(), 0); },
back: () => { this.setState({ solo: null, fgen: (st.fgen || 0) + 1 }); setTimeout(() => this.play(), 0); },
```

Ghost path opacity (the timeline restarts at t = 0 on each pick):

```js
op: ghost ? f(0.22 * eo((t - 300) / 400)) : ...
```

So a ghost is 0 until 300ms, then rises to 0.22 by 700ms on an ease-out. Slice 12a
moves this to the JS clock. Here it is a CSS animation: the side view remounts on
each pick (`key={run}`), so a CSS transition has no "from" state to start from. A
`from { opacity: 0 }` animation with a delay gives the canvas curve.
`--dur-unfold` is 400ms; `calc(var(--dur-unfold) * 0.75)` is 300ms.

## Live today

`src/screens/player/next/modules/arsenal/ArsenalCard.jsx:13-17` (state):

```jsx
export function ArsenalCard({ rows }) {
  const [solo, setSolo] = useState(null)
  const [run, setRun] = useState(0) // a new key replays the paths' draw-in
  const flyers = rows.filter((r) => r.path)
  const one = rows.find((r) => r.code === solo) ?? null
```

`ArsenalCard.jsx:19`: `<div className={`arsenal__card${one ? ' arsenal__card--solo' : ''}`}>`
(no CSS reads `arsenal__card--solo`).

`ArsenalCard.jsx:33`: `<div className="arsenal__side" key={run}>` (the replay key).

`ArsenalCard.jsx:58-81`:

```jsx
      <div className="arsenal__bar">
        {flyers.length > 0 && <Button size="control" onClick={() => setRun(run + 1)}>Replay</Button>}
        {one && <Button size="control" onClick={() => setSolo(null)}>← All pitches</Button>}
      </div>
      <div className={`arsenal__menu${one ? ' arsenal__menu--rail' : ''}`} role="group" aria-label="Pitch type">
        {rows.map((r) => (
          <Button
            key={r.code}
            className="arsenal__pick"
            pressed={one?.code === r.code}
            onClick={() => setSolo(one?.code === r.code ? null : r.code)}
          >
            <span className="arsenal__name"><PitchGlyph mark={r.mark} /><b>{r.mark.name}</b></span>
            <span className="arsenal__figs">{dash(r.velo, (v) => `${v.toFixed(1)} mph`)} · {r.pct}%</span>
            {r.path && (
              <svg className="arsenal__spark" viewBox="0 0 64 28" aria-hidden="true">
                <path className="arsenal__sparkline" d={sparkD(r.path)} />
              </svg>
            )}
          </Button>
        ))}
      </div>
      {one && <Detail r={one} />}
    </div>
```

`ArsenalCard.jsx:85-108`: `function Detail({ r })` (keep as is).

`src/screens/player/next/modules/arsenal/FlightScene.jsx:30-37`:

```jsx
        const faint = solo != null && solo !== it.code
        const t = faint ? it.path.T : Math.min(s, it.path.T)
        const landed = !faint && s >= it.path.T
        ...
        return (
          <g key={it.code} opacity={faint ? 0.25 : 1}>
```

`FlightCard.jsx` never passes `solo`, so this change reaches only the Arsenal card.

`src/styles/player-next/pitcher/arsenal.css` (376 lines):

- `:142-158`: the draw-in, `.arsenal__side .arsenal__halo, .arsenal__side .arsenal__trail { stroke-dasharray: 1; animation: arsenal-draw var(--dur-highlight) var(--ease-out) backwards; }` and its reduced-motion block. Keep it in this slice (12a removes it).
- `:190-196`: `/* layout-exempt: the pitch cards wrap */ .arsenal__menu { display: flex; flex-wrap: wrap; gap: var(--space-2); }`
- `:197-209`: `/* layout-exempt: ... */ .arsenal__pick.btn { display: flex; flex: 1 1 9rem; flex-direction: column; ... }`
- `:210-217`: `.arsenal__name { display: flex; ... }`
- `:218-222`: `.arsenal__figs` (keep), `:223-240`: `.arsenal__spark`, `.arsenal__sparkline`, `.arsenal__sparkbase` (keep).
- `:241-247`:

```css
.arsenal__menu--rail .arsenal__pick.btn {
  flex: 0 0 auto;
}
.arsenal__menu--rail .arsenal__figs,
.arsenal__menu--rail .arsenal__spark {
  display: none;
}
```

The `.arsenal__menu` and `.arsenal__pick.btn` rules carry `layout-exempt`, so the
layout ratchet does not count them, and `arsenal.css` has no entry in
`scripts/layout/layout-ratchet-budget.json`. Deleting them changes no budget.

## Build

Read `src/components/ui/control/MenuRail.jsx` as merged by slice 05a first. The API
in `spec.md` is: `label`, `items` (`{ key, title, meta, figures, mark }`; 05a also
takes `label`, `disabled`, `heading`, `style`, `className` per item), `picked`,
`onPick` (called with a key, or `null` when the picked card is tapped again),
`panel(key)`, `backLabel`.

### 1. `ArsenalCard.jsx`

Add the import:

```jsx
import { MenuRail } from '../../../../../components/ui/control/MenuRail.jsx'
```

Replace lines 13-19 and 58-81 so the component reads:

```jsx
export function ArsenalCard({ rows }) {
  const [solo, setSolo] = useState(null)
  const [run, setRun] = useState(0) // a new key replays the paths' draw-in
  const flyers = rows.filter((r) => r.path)
  const one = rows.find((r) => r.code === solo) ?? null
  // A pick, a second tap on the picked card (MenuRail sends null) and "All pitches" each replay the
  // side view, as the board does.
  const pick = (code) => {
    setSolo(code)
    setRun((n) => n + 1)
  }
  return (
    <div className="arsenal__card">
      {/* the mix bar and the side view: unchanged */}
      <div className="arsenal__bar">
        {flyers.length > 0 && <Button size="control" onClick={() => setRun(run + 1)}>Replay</Button>}
      </div>
      <MenuRail
        label="Pitch type"
        items={rows.map((r) => ({
          key: r.code,
          title: r.mark.name,
          mark: <PitchGlyph mark={r.mark} />,
          meta: dash(r.velo, (v) => `${v.toFixed(1)} mph`),
          figures: (
            <>
              <span className="arsenal__figs">{r.pct}%</span>
              {r.path && (
                <svg className="arsenal__spark" viewBox="0 0 64 28" aria-hidden="true">
                  <path className="arsenal__sparkline" d={sparkD(r.path)} />
                </svg>
              )}
            </>
          ),
        }))}
        picked={one?.code ?? null}
        onPick={pick}
        panel={(code) => {
          const r = rows.find((x) => x.code === code)
          return r ? <Detail r={r} /> : null
        }}
        backLabel="All pitches"
        railMeta
      />
    </div>
  )
}
```

Notes:

- The card shows the same facts as before: mph moves to `meta` (the canvas head
  row), usage and the sparkline go in `figures` (the part that folds).
- `railMeta` keeps the mph on the rail cards, as the canvas `.ar-rail` does
  (slice 05a's optional prop; Plate and Contact leave it off).
- `backLabel="All pitches"`: slice 05a's MenuRail draws it as a ghost `Button` with
  `icon="←"`, so the arrow is already there. Do not put a second arrow in the text.
- `panel` may get the last picked key while the panel closes (spec.md), so look the
  row up by code and return `null` when it is gone.
- `Detail` does not change. MenuRail's `menurail__body--a/--b` rise replaces any
  remount.
- Keep `key={run}` on `.arsenal__side` (line 33). Slice 12a replaces it with a clock.

### 2. `FlightScene.jsx`

Line 37 becomes:

```jsx
          <g key={it.code} className={faint ? 'arsenal__path arsenal__path--ghost' : 'arsenal__path'}>
```

Update the header comment (lines 6-9): "Under `solo` the other paths are drawn whole
as faint ghosts (`.arsenal__path--ghost`)".

### 3. `arsenal.css`

Delete lines 190-217 (the `.arsenal__menu`, `.arsenal__pick.btn` and
`.arsenal__name` rules, with their comments) and lines 241-247 (the two
`.arsenal__menu--rail` rules). Keep `.arsenal__figs`, `.arsenal__spark`,
`.arsenal__sparkline`, `.arsenal__sparkbase`. Put a one-line comment above
`.arsenal__figs`: `/* The menu card's figures; the card, rail and panel are MenuRail's (system/menurail/menurail.css). */`
(slice 05a's sheet is `src/styles/system/menurail/menurail.css`).

After the reduced-motion block that ends at line 158, add:

```css
/* A picked pitch leaves the others as ghosts: drawn whole, never drawn in, fading up to 0.22 after the
   replay starts (board: 400ms from 300ms). */
.arsenal__path--ghost {
  opacity: 0.22;
  animation: arsenal-ghost var(--dur-unfold) var(--ease-unfold) calc(var(--dur-unfold) * 0.75) backwards;
}
.arsenal__side .arsenal__path--ghost .arsenal__halo,
.arsenal__side .arsenal__path--ghost .arsenal__trail {
  animation: none;
}
@keyframes arsenal-ghost {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .arsenal__path--ghost {
    animation: none;
  }
}
```

Specificity: `.arsenal__side .arsenal__path--ghost .arsenal__halo` (three classes)
beats `.arsenal__side .arsenal__halo` (two), so a ghost skips the draw-in.

Guards: no raw time (`calc(var(--dur-unfold) * 0.75)`), no hex, no new flex or
grid rule. The sheet shrinks by about 30 lines.

## Test first

`test/arsenal-motion.test.js` (new). Run it before the change: every case fails.

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ruleBody, stripComments } from './helpers/css.js'

// Slice 11 (#2073): the Pitch arsenal menu and Detail panel sit on the shared MenuRail; a pick replays the
// side view; a ghost path fades in, never draws in. Asserted from the source text.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const card = read('src/screens/player/next/modules/arsenal/ArsenalCard.jsx')
const scene = read('src/screens/player/next/modules/arsenal/FlightScene.jsx')
const css = stripComments(read('src/styles/player-next/pitcher/arsenal.css'))
const decl = (body, prop) =>
  body.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('the arsenal menu is a MenuRail, with the Detail as its panel', () => {
  assert.match(card, /import \{ MenuRail \} from '[./]+components\/ui\/control\/MenuRail\.jsx'/)
  assert.match(card, /<MenuRail[\s\S]*panel=\{/)
  assert.match(card, /backLabel="All pitches"/)
  assert.match(card, /railMeta/)
  assert.doesNotMatch(card, /\{one && <Detail/)
  assert.doesNotMatch(card, /arsenal__menu/)
})

test('a pick and an un-pick bump the replay key', () => {
  assert.match(card, /onPick=\{pick\}/)
  assert.match(card, /const pick = \(code\) => \{[\s\S]*?setSolo\(code\)[\s\S]*?setRun\(/)
})

test('the old menu rules are gone: no display:none rail', () => {
  assert.doesNotMatch(css, /\.arsenal__menu/)
  assert.doesNotMatch(css, /\.arsenal__pick/)
  assert.equal(ruleBody(css, '.arsenal__name'), null)
})

test('a ghost path is a class, at 0.22, fading in over --dur-unfold from 300ms', () => {
  assert.match(scene, /arsenal__path--ghost/)
  assert.doesNotMatch(scene, /opacity=\{faint \? 0\.25/)
  const body = ruleBody(css, '.arsenal__path--ghost')
  assert.ok(body, 'no .arsenal__path--ghost rule')
  assert.equal(decl(body, 'opacity'), '0.22')
  assert.equal(
    decl(body, 'animation'),
    'arsenal-ghost var(--dur-unfold) var(--ease-unfold) calc(var(--dur-unfold) * 0.75) backwards',
  )
  assert.match(css, /@keyframes arsenal-ghost\s*\{\s*from\s*\{\s*opacity: 0;/)
})

test('a ghost path does not draw in', () => {
  assert.match(
    css,
    /\.arsenal__side \.arsenal__path--ghost \.arsenal__halo,\s*\.arsenal__side \.arsenal__path--ghost \.arsenal__trail\s*\{\s*animation: none;/,
  )
})
```

## Verify

- `node --test test/arsenal-motion.test.js` and `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `npm run dev`, then the pitcher route `/player/robert-gasser-688107?nointro` at
  390px and 1180px. Scroll to "Pitch arsenal". Tap "Four-seam": the cards fold to a
  rail, the panel opens with the rise, the side view draws the four-seamer again
  and the other paths fade up faint. Tap it again: back to the menu, and the view
  replays. Tap a second pitch, then "All pitches". Send Gary a three-frame strip
  (menu, rail with panel, back) with `SendUserFile`, and name the route.
- Load once with Playwright `reducedMotion: 'reduce'`: the rail and the panel switch
  at once, the ghosts sit at 0.22 with no fade.
- Keyboard: Tab to a card, Enter picks it, Tab reaches the back button in the panel.

## Out of scope

- The canvas timeline (one clock, ring, ball spin, ripple, menu entrance, count-up):
  slices 12a to 12c.
- The pitch flight card (`FlightCard.jsx`): slices 13 to 15.
- Any change to the MenuRail part itself.

## Stop if

- `MenuRail.jsx` is not on `main`, or its props differ from spec.md (`label`,
  `items`, `picked`, `onPick`, `panel`, `backLabel`).
- `--dur-unfold` or `--ease-unfold` is not in `src/tokens/effects.css`.
- `ArsenalCard.jsx` or `FlightScene.jsx` differs from the code quoted above (another
  slice landed first). Merge `main` and re-read before you edit.
- MenuRail cannot take a node for `meta` or `figures`.
- A guard fails on a rule this slice did not write.
