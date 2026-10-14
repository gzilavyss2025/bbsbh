# 10 — On the mound: track draw, bar grow, now chip, bar hover

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 01a merged (tokens `--ease-stamp`, `--dur-rise`, `--dur-unfold`,
  `--dur-draw`, `--stagger-step`, `--dur-stamp-in` at 380ms), 01c merged
  (`useInViewOnce`), 01d merged (`src/screens/animlab/PlayerMotionLab.jsx`).
- Parallel with: 02, 03, 05, 06, 07, 08a, 08b, 09, 11, 13. It shares only the lab
  files with other slices (`spec.md`, "Shared files").

## Goal

The On the mound card plays the board's entrance once, the first time it comes
into view in this page visit: the track block rises, the days-since fill draws,
the usual-gap zone fades in, the Day chip stamps and then pulses a few times, the
outing bars grow one after the next, their pitch counts fade in, and the average
line draws. A pointer hover lifts a bar.

## Done means

- Before the card is in view, the track block, the fill, the zone, the Day chip,
  the bars, the pitch counts and the average line are hidden or at zero.
- In view (phase `'play'`): each beat plays once on the timeline in "Canvas". Every
  time is a token or `calc()` of tokens.
- The Day chip pulses 4 times (about 10s) and then rests. The pulse animates
  `opacity` and `transform` on a ring, not `box-shadow`.
- Bars grow with `scale` (Y), not `height`.
- A card seen earlier in this page visit, or under reduced motion, shows drawn at
  once with no beat.
- Under `(hover: hover) and (pointer: fine)`, a bar hover lifts it
  `calc(var(--bw-heavy) * -1.5)` (3px) and brightens it, over `--dur-fast`.
- `/animation-lab` has an On the mound entry with the real classes, in
  `src/screens/animlab/PlayerMotionLab.jsx`.
- `test/player-next-mound-motion.test.js` and `npm run lint` pass. CI runs the full
  `npm test` and `npm run build` on the PR.

## Files

1. `src/screens/player/next/modules/mound/index.jsx` — split out `MoundCard`
   (mounts with data, holds the hook); track block class; `--k` on each bar.
2. `src/styles/player-next/pitcher/mound.css` — the motion block (349 lines today;
   about 110 added).
3. `test/player-next-mound-motion.test.js` — new.
4. `src/screens/animlab/PlayerMotionLab.jsx` (01d) — `MoundDemo` and its `Entry`.

Not `motionDemos.jsx`, not `AnimationLab.jsx`: 01d moved every player-motion entry to
`PlayerMotionLab.jsx`, because `AnimationLab.jsx` is at the 600-line cap.
`PlayerMotionLab.jsx` is shared with other slices (05c, 08b, 12c, 17a): merge `main`
in before you push, and add your entry after the ones already there.

## Canvas

Board `MoundCard`:

```css
.mc-nowchip{...;box-shadow:3px 3px 0 #0F1822;...;animation:pulse 2.6s ease-in-out 1.4s infinite,stampin 380ms cubic-bezier(.2,.9,.3,1) 500ms backwards}
.mc-fill{...;transform-origin:left;animation:drawx 900ms cubic-bezier(.2,.9,.3,1) 250ms backwards}
.mc-zone{...;animation:fade 400ms ease-out 900ms backwards}
.mc-bar{...;transition:transform 120ms cubic-bezier(.2,.9,.3,1),filter 120ms;animation:growh 650ms cubic-bezier(.2,.9,.3,1) var(--d,0ms) backwards;transform-origin:bottom}
.mc-bar:hover{transform:translateY(-3px);filter:brightness(1.15)}
.mc-pv{animation:fade 300ms ease-out calc(var(--d,0ms) + 450ms) backwards}
.mc-avg{transform-origin:left;animation:drawx 900ms cubic-bezier(.2,.9,.3,1) 700ms backwards}
.rise{animation:rise 420ms cubic-bezier(.2,.9,.3,1) var(--d,0ms) backwards}
@keyframes stampin{from{opacity:0;transform:translate(4px,4px);box-shadow:0 0 0 #0F1822}}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes growh{from{height:0}}
@keyframes drawx{from{transform:scaleX(0)}}
@keyframes fade{from{opacity:0}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 2px #FBF6E9,0 0 0 4px #0F1822}50%{box-shadow:0 0 0 2px #FBF6E9,0 0 0 7px rgba(227,176,75,.75)}}
@media (prefers-reduced-motion:reduce){.stamp,.rise,.mc-card,.mc-bar,.mc-avg,.mc-pv,.mc-day.today{animation:none!important}.mc-o,.mc-bar{transition:none}}
```

```html
<div class="mc-turn rise" style="--d: 80ms">   <!-- the days-since block -->
<span class="mc-bar {{b.cls}}" style="...; animation-delay: {{b.d}}ms"><span class="mc-pv" style="animation-delay: {{b.pvd}}ms">{{b.p}}</span></span>
```

Bar `k` starts at `320 + k * 55`ms; its count label at `770 + k * 55`ms (the
`--d + 450ms` above).

The timeline as tokens. The time unit is `--stagger-step` (55ms) unless a token
names the value:

| Beat | Canvas | Here | Value |
|---|---|---|---|
| Track block rise | 420ms after 80ms | `var(--dur-rise)` after `calc(var(--stagger-step) * 1.5)` | 420 after 82.5 |
| Fill draw | 900ms after 250ms | `var(--dur-draw)` after `calc(var(--stagger-step) * 4.5)` | 900 after 247.5 |
| Zone fade | 400ms ease-out after 900ms | `var(--dur-unfold) var(--ease-out)` after `var(--dur-draw)` | 400 after 900 |
| Day chip stamp | 380ms after 500ms | `var(--dur-stamp-in)` after `calc(var(--stagger-step) * 9)` | 380 after 495 |
| Day chip pulse | 2.6s ease-in-out from 1.4s, infinite | `calc((var(--dur-draw) + var(--dur-unfold)) * 2)` `ease-in-out` after `calc(var(--stagger-step) * 25)`, **4 times** | 2600 after 1375 |
| Bar `k` grow | 650ms at `320 + k*55` | `calc(var(--stagger-step) * 12)` at `calc(var(--stagger-step) * (6 + var(--k, 0)))` | 660 at 330 + k·55 |
| Count `k` fade | 300ms ease-out at `770 + k*55` | `calc(var(--dur-fast) * 2.5) var(--ease-out)` at `calc(var(--stagger-step) * (14 + var(--k, 0)))` | 300 at 770 + k·55 |
| Average draw | 900ms after 700ms | `var(--dur-draw)` after `calc(var(--stagger-step) * 13)` | 900 after 715 |
| Bar hover | `translateY(-3px)`, `brightness(1.15)`, 120ms | `translate: 0 calc(var(--bw-heavy) * -1.5)`, `brightness(1.15)`, `var(--dur-fast) var(--ease-stamp)` | |

The board's `cubic-bezier(.2,.9,.3,1)` is `--ease-stamp`. Its rise is `6px`:
`var(--space-1h)`. Its `ease-out` keyword beats map to `--ease-out` (the house
deceleration). The stamp reuses `card-stamp-in` from
`src/styles/motion/stamp-in.css` (the board's `stampin`, byte for byte, as tokens).

### Three choices this slice makes, and why

1. **The pulse stops after 4.** The board loops it forever. `docs/motion.md`
   ("Seal breath") runs `sc-seal-breathe` 4 times and then rests; an idle loop
   that never stops reads as a notification. 4 × 2.6s is about 10s.
2. **The pulse is an opacity and transform ring, not `box-shadow`.** The board
   animates a `box-shadow` ring. `docs/motion.md` ("Two idle loops, one beat")
   records that `liveedge-pulse`, an outward ring pushed on `box-shadow`,
   "repainted every frame and read as a notification", and was replaced. Here a
   `::after` ring in `--award-line` (the board's gold, `rgba(227,176,75,.75)`)
   fades in and grows a little (`scale(1.06)`), then fades out. Both are
   compositor properties. The chip keeps its own `--shadow-stamped-soft`; the
   board's pulse also replaced the chip's offset shadow while it ran, which this
   does not copy.
3. **Bars grow with `scale`, not `height`.** The board animates `height` from 0.
   A `height` keyframe runs layout and paint on every frame for every bar; `scale`
   runs on the compositor. The bar's height also stays its inline value, so no
   keyframe needs to know it. The bar already has `transform: translateX(-50%)`,
   so the grow uses the separate `scale` property (and the hover the separate
   `translate` property): the three do not fight over one `transform`. The cost:
   the count label and the latest bar's inset ring squash while the bar grows.
   The label is not visible then (it fades in at 770ms; the bar is near full by
   then on `--ease-stamp`), so this does not show.

## Live today

`src/screens/player/next/modules/mound/index.jsx:17-36` — the module holds the
tab state and renders the card straight from the data:

```jsx
export default function MoundModule({ bio, asOf, season, onEmpty }) {
  const { data, loading } = useAsync(fetchWorkload, [])
  const [picked, setPicked] = useState(null)
  ...
  if (loading) return <div className="mound mound--loading" aria-busy="true" />
  if (empty) return null
  const tab = view.tabs.includes(picked) ? picked : view.tab
  const v = view.views[tab]
  return (
    <div className="mound">
```

The first render is the loading `<div>`, a different node from the card. An
in-view `ref` must sit on a node that exists when the hook first runs, so the hook
moves into a child that mounts with the data (Build step 1).

`index.jsx:59` — `<div className="mound__block">` (the Track block).
`index.jsx:80-85`:

```jsx
            <span className="mound__now" style={{ left: `${track.nowLeft}%` }}>
              <span className="mound__day">Day {track.since}</span>
            </span>
            <div className="mound__rail">
              <span className="mound__fill" style={{ width: `${track.nowLeft}%` }} />
              {track.zone && <span className="mound__zone" style={{ left: `${track.zone.left}%`, width: `${track.zone.width}%` }} />}
```

`index.jsx:76-77` — when the pitcher is out of turn, the Day chip renders without
`.mound__now`: `<span className="mound__day">Day {track.since}</span>`. That chip
does not pulse (the board has no chip there).

`index.jsx:140-148`:

```jsx
        {chart.avg != null && <span className="mound__avg" style={{ bottom: `${chart.avgPct}%` }} />}
        {chart.live && <span className="mound__today">Today</span>}
        {chart.bars.map((b, i) => (
          <span
            key={i}
            className={`mound__bar${b.relief ? ' mound__bar--relief' : ''}${b.post ? ' mound__bar--post' : ''}${b.last ? ' mound__bar--last' : ''}`}
            style={{ left: `${b.left}%`, width: `${b.w}%`, height: `${b.h}%` }}
          >
            <span className="mound__pv">{b.p}</span>
```

`src/styles/player-next/pitcher/mound.css:193-199`:

```css
.mound__bar {
  position: absolute;
  bottom: 0;
  min-width: 12px;
  transform: translateX(-50%);
  background: var(--navy);
}
```

`mound.css:119-123` (`.mound__now .mound__day` is `position: absolute`),
`:133-137` (`.mound__fill`), `:138-143` (`.mound__zone`), `:210-219`
(`.mound__pv`), `:220-225` (`.mound__avg`). None has motion today.

`src/screens/AnimationLab.jsx` is 597 lines (cap 600). Slice 01d added
`src/screens/animlab/PlayerMotionLab.jsx` for every player-motion entry.

## Build

### 0. The slice 01c hook (merged; 01c is the source of truth)

`src/hooks/scroll/useInViewOnce.js` exports `useInViewOnce(key)` and returns
`[ref, phase]`. There is no options argument; the threshold is fixed at 0.1.
`phase` is `'wait'` (not seen yet: hold hidden, `.mound--pre`), `'play'` (it came
into view: play, `.mound--in`; it stays `'play'`), or `'rest'` (seen earlier in this
page visit, reduced motion, or no IntersectionObserver: rest drawn, no class).
`viewKey(playerId, slotKey)` in `src/lib/motion/inViewOnce.js` builds the key. The
hook already returns `'rest'` under reduced motion, so `MoundCard` does not read
`motionIsReduced`.

### 1. `index.jsx`

```jsx
import { useInViewOnce } from '../../../../../hooks/scroll/useInViewOnce.js'
import { viewKey } from '../../../../../lib/motion/inViewOnce.js'
```

`MoundModule` keeps the data and the two early returns, and hands the view on.
Move `picked` / `tab` / `v` and the JSX into `MoundCard`:

```jsx
export default function MoundModule({ bio, asOf, season, onEmpty }) {
  const { data, loading } = useAsync(fetchWorkload, [])
  const view = useMemo(...)            // unchanged
  const empty = !loading && !view      // unchanged
  useEffect(...)                       // unchanged
  if (loading) return <div className="mound mound--loading" aria-busy="true" />
  if (empty) return null
  return <MoundCard view={view} once={viewKey(bio.id, 'mound')} />
}

// The card. It mounts once the data is in, so the in-view ref sits on a node that exists at
// mount. The entrance plays the first time the card comes into view in this page visit
// (docs/motion.md, "The one-shot gate"); seen before, or under reduced motion, it rests drawn.
function MoundCard({ view, once }) {
  const [picked, setPicked] = useState(null)
  const [ref, phase] = useInViewOnce(once)
  const tab = view.tabs.includes(picked) ? picked : view.tab
  const v = view.views[tab]
  return (
    <div ref={ref} className={`mound${phase === 'wait' ? ' mound--pre' : phase === 'play' ? ' mound--in' : ''}`}>
      …the old body, unchanged…
    </div>
  )
}
```

In `Track`, line 59: `<div className="mound__block mound__block--track">`.

In `Calendar`, line 146, the bar's style takes its index:

```jsx
            style={{ left: `${b.left}%`, width: `${b.w}%`, height: `${b.h}%`, '--k': i }}
```

A Starter/Bullpen tab tap changes the bars in place and does not replay the
entrance. That is out of scope.

### 2. `mound.css`

Add to the existing rules:

- `.mound__fill` (line 133): `transform-origin: left center;`
- `.mound__avg` (line 220): `transform-origin: left center;`
- `.mound__bar` (line 193): `transform-origin: bottom center;` and
  `transition: translate var(--dur-fast) var(--ease-stamp), filter var(--dur-fast) var(--ease-stamp);`

Append at the end of the file:

```css
/* --- the entrance (board MoundCard) ---
   MoundCard (index.jsx) sets .mound--pre until the card first comes into view in this page
   visit, then .mound--in, which plays each beat once. A card seen earlier, or under reduced
   motion, gets neither and rests drawn. Times count in --stagger-step from the moment the card
   is in view. Bars grow on `scale` and lift on `translate`, so neither fights the bar's own
   translateX(-50%) on `transform`. */
.mound--pre .mound__block--track,
.mound--pre .mound__zone,
.mound--pre .mound__pv,
.mound--pre .mound__now .mound__day {
  opacity: 0;
}
.mound--pre .mound__fill,
.mound--pre .mound__avg {
  transform: scaleX(0);
}
.mound--pre .mound__bar {
  scale: 1 0;
}

.mound--in .mound__block--track {
  animation: mound-rise var(--dur-rise) var(--ease-stamp) calc(var(--stagger-step) * 1.5) backwards;
}
.mound--in .mound__fill {
  animation: mound-draw var(--dur-draw) var(--ease-stamp) calc(var(--stagger-step) * 4.5) backwards;
}
.mound--in .mound__zone {
  animation: mound-fade var(--dur-unfold) var(--ease-out) var(--dur-draw) backwards;
}
.mound--in .mound__now .mound__day {
  animation: card-stamp-in var(--dur-stamp-in) var(--ease-stamp) calc(var(--stagger-step) * 9) backwards;
}
.mound--in .mound__bar {
  animation: mound-grow calc(var(--stagger-step) * 12) var(--ease-stamp) calc(var(--stagger-step) * (6 + var(--k, 0))) backwards;
}
.mound--in .mound__pv {
  animation: mound-fade calc(var(--dur-fast) * 2.5) var(--ease-out) calc(var(--stagger-step) * (14 + var(--k, 0))) backwards;
}
.mound--in .mound__avg {
  animation: mound-draw var(--dur-draw) var(--ease-stamp) calc(var(--stagger-step) * 13) backwards;
}

/* The Day chip's pulse: a ring in the board's gold that fades in, grows a little and fades out,
   4 times, then rests (docs/motion.md: the seal breath stops after 4; the box-shadow ring
   liveedge-pulse repainted every frame and was replaced). Opacity and transform only. */
.mound__now .mound__day::after {
  content: '';
  position: absolute;
  inset: calc(var(--bw-heavy) * -2);
  border: var(--bw-heavy) solid var(--award-line);
  opacity: 0;
  pointer-events: none;
}
.mound--in .mound__now .mound__day::after {
  animation: mound-ring calc((var(--dur-draw) + var(--dur-unfold)) * 2) ease-in-out calc(var(--stagger-step) * 25) 4;
}

@keyframes mound-rise {
  from {
    opacity: 0;
    transform: translateY(var(--space-1h));
  }
}
@keyframes mound-draw {
  from {
    transform: scaleX(0);
  }
}
@keyframes mound-fade {
  from {
    opacity: 0;
  }
}
@keyframes mound-grow {
  from {
    scale: 1 0;
  }
}
@keyframes mound-ring {
  0%,
  100% {
    opacity: 0;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

@media (hover: hover) and (pointer: fine) {
  .mound__bar:hover {
    translate: 0 calc(var(--bw-heavy) * -1.5);
    filter: brightness(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mound--pre .mound__block--track,
  .mound--pre .mound__zone,
  .mound--pre .mound__pv,
  .mound--pre .mound__now .mound__day {
    opacity: 1;
  }
  .mound--pre .mound__fill,
  .mound--pre .mound__avg {
    transform: none;
  }
  .mound--pre .mound__bar {
    scale: none;
  }
  .mound--in .mound__block--track,
  .mound--in .mound__fill,
  .mound--in .mound__zone,
  .mound--in .mound__now .mound__day,
  .mound--in .mound__now .mound__day::after,
  .mound--in .mound__bar,
  .mound--in .mound__pv,
  .mound--in .mound__avg {
    animation: none;
  }
  .mound__bar {
    transition: none;
  }
}
```

Notes:

- `ease-in-out` is a CSS keyword. `check-raw-values.mjs` counts times, not
  keywords; no token holds an in-out curve that fits a breath (`--ease-flip` is
  too sharp).
- `.mound__now .mound__day` is already `position: absolute`, so it holds the
  `::after` ring. The out-of-turn chip (not in `.mound__now`) gets no ring.
- `card-stamp-in` is declared in `src/styles/motion/stamp-in.css`, which
  `src/index.css` imports in its core list, so the name resolves here. Its `from`
  sets `box-shadow: none`, and the chip's `--shadow-stamped-soft` prints as it lands.
- `calc((a + b) * 2)` and `calc(t * (6 + var(--k, 0)))` are valid time `calc()`s.

### 3. `PlayerMotionLab.jsx` (the demo)

In `src/screens/animlab/PlayerMotionLab.jsx` (01d), add the import with the others:
`import '../../styles/player-next/pitcher/mound.css'`. Add the demo above
`export function PlayerMotionLab()`, not exported (the file exports only
`PlayerMotionLab`). Invented figures; `mound--in` is set at once, so Play replays:

```jsx
// On the mound's entrance (board MoundCard): the days-since fill draws, the Day chip stamps and
// pulses, the bars grow one after the next and their counts fade in, the average draws. The
// real classes with invented figures.
const DEMO_OUTINGS = [[10, 88], [28, 95], [46, 79], [64, 101], [82, 92]]
function MoundDemo() {
  return (
    <div className="mound mound--in">
      <div className="mound__block mound__block--track">
        <div className="mound__trk">
          <span className="mound__chip">
            <span className="mono"><b>9/30</b> · 92 P</span>
          </span>
          <span className="mound__now" style={{ left: '70%' }}>
            <span className="mound__day">Day 5</span>
          </span>
          <div className="mound__rail">
            <span className="mound__fill" style={{ width: '70%' }} />
            <span className="mound__zone" style={{ left: '70%', width: '14%' }} />
          </div>
        </div>
      </div>
      <div className="mound__block">
        <div className="mound__plot mono">
          <span className="mound__avg" style={{ bottom: '82%' }} />
          {DEMO_OUTINGS.map(([left, p], k) => (
            <span key={left} className={`mound__bar${k === DEMO_OUTINGS.length - 1 ? ' mound__bar--last' : ''}`} style={{ left: `${left}%`, width: '6%', height: `${Math.round((p / 110) * 100)}%`, '--k': k }}>
              <span className="mound__pv">{p}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### 4. The lab entry

Add this `Entry` inside the fragment that `PlayerMotionLab` returns, after the
entries already there:

```jsx
      <Entry
        title="On the mound — the card comes in"
        note={
          <>
            The pitcher&rsquo;s On the mound card (board MoundCard). The days-since fill draws, the
            Day chip stamps, then pulses four times and rests; the outing bars grow one after the
            next, their counts fade in, and the average line draws. Off under reduced motion.
          </>
        }
        live={<MoundDemo />}
      />
```

No frozen strip, so no rule in the `.animlab__frame` freeze list of
`src/styles/46-consent-modal.css` (01d: only a frozen strip needs one). Do not touch
`AnimationLab.jsx` or `motionDemos.jsx`. Do not raise the file-size cap.

### Guards

- `check-raw-values.mjs`: no hex, no radius, no raw time, no `box-shadow`. Pass.
- `check-layout-ratchet.mjs`: no new flex, grid or column. Pass.
- `check-typography.mjs`: no font declarations added. Pass.
- `check-file-size.mjs`: `mound.css` 349 → about 460; `index.jsx` 175 → about 185;
  `PlayerMotionLab.jsx` grows by about 45 lines (more if other lab slices landed
  first). All under 600.
- `check-dir-size.mjs`: no new source file under `src/`.
- `test/css-tokens.test.js` fails a `var(--token)` that no sheet defines: every
  token above exists after slice 01a.

## Test first

New file `test/player-next-mound-motion.test.js`. Run it before the change and see
it fail.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'

// On the mound's entrance (#2073, slice 10), read from the source text.
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const css = stripComments(read('src/styles/player-next/pitcher/mound.css'))
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()
const anim = (sel) => decl(ruleBody(css, sel), 'animation')

test('the track: rise, fill draw, zone fade, chip stamp, on the board times', () => {
  assert.equal(anim('.mound--in .mound__block--track'), 'mound-rise var(--dur-rise) var(--ease-stamp) calc(var(--stagger-step) * 1.5) backwards')
  assert.equal(anim('.mound--in .mound__fill'), 'mound-draw var(--dur-draw) var(--ease-stamp) calc(var(--stagger-step) * 4.5) backwards')
  assert.equal(anim('.mound--in .mound__zone'), 'mound-fade var(--dur-unfold) var(--ease-out) var(--dur-draw) backwards')
  assert.equal(anim('.mound--in .mound__now .mound__day'), 'card-stamp-in var(--dur-stamp-in) var(--ease-stamp) calc(var(--stagger-step) * 9) backwards')
})

test('the bars grow on scale, one --stagger-step apart, and their counts follow', () => {
  assert.equal(anim('.mound--in .mound__bar'), 'mound-grow calc(var(--stagger-step) * 12) var(--ease-stamp) calc(var(--stagger-step) * (6 + var(--k, 0))) backwards')
  assert.equal(anim('.mound--in .mound__pv'), 'mound-fade calc(var(--dur-fast) * 2.5) var(--ease-out) calc(var(--stagger-step) * (14 + var(--k, 0))) backwards')
  const grow = ruleBody(css, '@keyframes mound-grow')
  assert.match(grow, /scale:\s*1 0/)
  assert.doesNotMatch(grow, /height/)
  assert.equal(anim('.mound--in .mound__avg'), 'mound-draw var(--dur-draw) var(--ease-stamp) calc(var(--stagger-step) * 13) backwards')
})

test('the Day chip pulses 4 times on opacity and transform, never box-shadow', () => {
  assert.equal(anim('.mound--in .mound__now .mound__day::after'), 'mound-ring calc((var(--dur-draw) + var(--dur-unfold)) * 2) ease-in-out calc(var(--stagger-step) * 25) 4')
  const ring = css.slice(css.indexOf('@keyframes mound-ring'), css.indexOf('@keyframes mound-ring') + 200)
  assert.match(ring, /opacity/)
  assert.match(ring, /transform:\s*scale\(1\.06\)/)
  assert.doesNotMatch(ring, /box-shadow/)
})

test('before view the parts wait hidden or at zero', () => {
  assert.match(ruleBody(css, '.mound--pre .mound__fill,\n.mound--pre .mound__avg') ?? '', /scaleX\(0\)/)
  assert.match(css, /\.mound--pre \.mound__bar\s*\{\s*scale:\s*1 0/)
})

test('a bar lifts on a fine-pointer hover, on translate', () => {
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.mound__bar:hover\s*\{\s*translate:\s*0 calc\(var\(--bw-heavy\) \* -1\.5\);\s*filter:\s*brightness\(1\.15\)/)
  assert.equal(decl(ruleBody(css, '.mound__bar'), 'transition'), 'translate var(--dur-fast) var(--ease-stamp), filter var(--dur-fast) var(--ease-stamp)')
})

test('reduced motion: no beat, no pulse, no lift', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(block, /\.mound--in \.mound__now \.mound__day::after/)
  assert.match(block, /animation:\s*none/)
  assert.match(block, /\.mound__bar\s*\{\s*transition:\s*none/)
})

test('no raw time in any mound.css animation or transition', () => {
  for (const m of css.matchAll(/(?:animation|transition)[a-z-]*:\s*([^;}]*)/g)) {
    assert.doesNotMatch(m[1].replace(/var\([^)]*\)/g, ''), /\d(?:ms|s)\b/, m[0])
  }
})

test('the card gates its entrance on view, and each bar carries its index', () => {
  const jsx = read('src/screens/player/next/modules/mound/index.jsx')
  assert.match(jsx, /function MoundCard\(/)
  assert.match(jsx, /useInViewOnce\(once\)/)
  assert.match(jsx, /phase === 'wait' \? ' mound--pre' : phase === 'play' \? ' mound--in' : ''/)
  assert.match(jsx, /mound__block mound__block--track/)
  assert.match(jsx, /'--k': i/)
})
```

Notes for the test:

- `ruleBody` finds a selector only at the start of a line (or after `;`, `}`, `{`,
  `,`). The two-selector rule `.mound--pre .mound__fill,\n.mound--pre .mound__avg`
  is passed whole, with its newline, as written above. If you format it on one
  line, change the test string to match; do not loosen the assertion.
- The `mound-ring` slice reads 200 characters from the keyframe; that holds the
  whole keyframe as written.
- No `.mound__bar {` sits inside an `@media` at column 0, so `ruleBody(css, '.mound__bar')`
  is the base rule at line 193.

## Verify

1. `node --test test/player-next-mound-motion.test.js` and `npm run lint`. Do not
   run the full `npm test` or `npm run build`: CI runs them on your PR.
2. `npm run dev`, pitcher `/player/robert-gasser-688107?nointro`, at 390px and at
   1180px. Scroll to On the mound: the beats play once as it comes into view. Scroll
   away and back: nothing replays. Count the Day chip's pulses: 4, then still.
3. At 1180px with a mouse, hover a bar: it lifts 3px and brightens.
4. A pitcher whose card shows "out of turn" (no `.mound__now`): no pulse, no error.
   If no live pitcher shows it today, say so in the PR.
5. `/animation-lab?nointro`: press Play on the On the mound entry.
6. Load once with Playwright `reducedMotion: 'reduce'`: the card shows drawn at once.
7. Send Gary a frame strip (`SendUserFile`) of the entrance, with the route.

## Out of scope

- Replaying the bars on a Starter/Bullpen tab tap.
- The card's own stamp-in and the `Slot` hold (slice 07).
- The tab `Button`s' press (slice 02); moving the tabs onto `Segmented` (slice 04).
- The `.mc-o` row hover on the board (On the mound has no such rows live).
- A frozen strip for the lab entry.

## Stop if

- 01a, 01c or 01d is not merged, or `useInViewOnce` does not return `[ref, phase]`
  with the three phases (`wait`, `play`, `rest`), or any
  token in the "Canvas" table is missing from `src/tokens/effects.css`.
- `--dur-stamp-in` is not 380ms (01a changes it from `var(--dur-slow)`).
- `card-stamp-in` is not in `src/styles/motion/stamp-in.css`, or its `from` is no
  longer opacity, the stamped offset and `box-shadow: none`.
- The quoted code at `index.jsx:17-36`, `:80-85`, `:140-148` or `mound.css:193-199`
  differs from this brief.
- `src/screens/animlab/PlayerMotionLab.jsx` does not exist (01d not merged). Do not
  add the entry to `AnimationLab.jsx`.
- An open PR touches `src/screens/player/next/modules/mound/` or `mound.css`.
